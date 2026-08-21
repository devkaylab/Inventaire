'use client'

// Données partagées par tous les onglets du tableau de bord.
//
// Deux rythmes différents, d'où deux fonctions de rechargement :
//  · `refreshLive` — balises, totaux, derniers scans. Rejoué à chaque battement
//    (sondage ou message du mobile), donc il doit rester bon marché.
//  · `refreshMeta` — l'inventaire lui-même, l'équipe, les invitations, l'état
//    des imports. Ne bouge que sur action du superviseur.
//
// ── Ne recharger que ce qui est à l'écran ───────────────────────────────────
//
// `refreshLive` ne coûte pas rien : l'avancement par zone et les totaux font
// tous deux reparcourir à la base l'ensemble des comptages de l'inventaire.
// Les rejouer pour une section qui ne les affiche pas est du travail pur perdu,
// et il se multiplie par le nombre de superviseurs connectés.
//
// D'où la portée (`LiveScope`), donnée par la section ouverte :
//   · `suivi` — avancement, totaux **et** derniers scans ;
//   · `zones` — avancement et totaux, sans le fil des scans (Set up, Écarts :
//     on y agit sur les balises, on n'y regarde pas passer les comptages) ;
//   · `aucun` — rien du tout (Rapport, Équipe). Le Rapport recharge le sien,
//     qui est bien ce qui est affiché ; l'Équipe ne bouge que sur action.
//
// Le bandeau de progression, lui, reste visible partout : sur les sections en
// portée `aucun`, il garde les derniers chiffres connus. C'est un résumé de
// côté, pas l'objet de la page — et revenir sur Suivi le remet à jour.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCountTotals, getImportState, getSession, getSessionInvitations, getSessionMembers,
  type ImportState, type Member, type Session, type SessionInvitation,
} from '@/lib/inventory'
import { getZoneDashboard, type ZoneDashboardRow } from '@/lib/zones'
import { getRecentCounts, type CountEvent } from '@/lib/activity'

export type Totals = { counted: number; audited: number; countedSkus: number; auditedSkus: number }

/** Ce que la section ouverte a réellement besoin de voir se rafraîchir. */
export type LiveScope = 'suivi' | 'zones' | 'aucun'

export type SessionData = {
  loading: boolean
  error: string | null
  notFound: boolean
  session: Session | null
  zones: ZoneDashboardRow[]
  totals: Totals
  members: Member[]
  invitations: SessionInvitation[]
  recent: CountEvent[]
  importState: ImportState
  refreshLive: () => Promise<void>
  refreshMeta: () => Promise<void>
  refreshAll: () => Promise<void>
}

const EMPTY_TOTALS: Totals = { counted: 0, audited: 0, countedSkus: 0, auditedSkus: 0 }

export function useSessionData(sessionId: string, scope: LiveScope = 'suivi'): SessionData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [zones, setZones] = useState<ZoneDashboardRow[]>([])
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<SessionInvitation[]>([])
  const [recent, setRecent] = useState<CountEvent[]>([])
  const [importState, setImportState] = useState<ImportState>({ articles: 0, stock: 0, theoreticalQty: 0 })

  // Le mode (avec ou sans balises) décide de ce qu'il faut recharger ; on le
  // garde dans une référence pour que `refreshLive` reste stable.
  const usesZonesRef = useRef(false)
  // Même raison pour la portée : `refreshLive` doit rester stable, sans quoi le
  // canal temps réel serait reconstruit à chaque changement de section.
  const scopeRef = useRef(scope)
  useEffect(() => { scopeRef.current = scope }, [scope])
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const chargerLive = useCallback(async (portee: LiveScope) => {
    if (!sessionId) return
    // Rien à l'écran qui bouge : on ne demande rien. Le rafraîchissement compte
    // quand même comme joué — c'est ce qui permet au Rapport de se recaler
    // dessus sans faire recalculer l'avancement dont sa page ne montre rien.
    if (portee === 'aucun') return
    const [z, t, r] = await Promise.all([
      usesZonesRef.current ? getZoneDashboard(sessionId) : Promise.resolve<ZoneDashboardRow[]>([]),
      getCountTotals(sessionId),
      // Le fil des derniers scans n'existe que sur Suivi.
      portee === 'suivi' ? getRecentCounts(sessionId) : Promise.resolve<CountEvent[] | null>(null),
    ])
    if (!aliveRef.current) return
    setZones(z); setTotals(t)
    if (r) setRecent(r)
  }, [sessionId])

  const refreshLive = useCallback(() => chargerLive(scopeRef.current), [chargerLive])

  const refreshMeta = useCallback(async () => {
    if (!sessionId) return
    const [s, m, i, imp] = await Promise.all([
      getSession(sessionId),
      getSessionMembers(sessionId),
      getSessionInvitations(sessionId).catch(() => [] as SessionInvitation[]),
      getImportState(sessionId),
    ])
    if (!aliveRef.current) return
    if (!s) { setNotFound(true); return }
    usesZonesRef.current = s.uses_zones
    setSession(s); setMembers(m); setInvitations(i); setImportState(imp)
  }, [sessionId])

  // Le premier chargement **ignore la portée** : le bandeau de progression est
  // visible dès l'arrivée, y compris sur un lien direct vers le Rapport. S'en
  // remettre à la portée afficherait un bandeau à zéro sur ces sections-là.
  const refreshAll = useCallback(async () => {
    await refreshMeta()
    await chargerLive('suivi')
  }, [refreshMeta, chargerLive])

  useEffect(() => {
    let active = true
    setLoading(true); setError(null); setNotFound(false)
    ;(async () => {
      try {
        await refreshAll()
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [refreshAll])

  return {
    loading, error, notFound, session, zones, totals, members, invitations,
    recent, importState, refreshLive, refreshMeta, refreshAll,
  }
}
