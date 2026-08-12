'use client'

// Données partagées par tous les onglets du tableau de bord.
//
// Deux rythmes différents, d'où deux fonctions de rechargement :
//  · `refreshLive` — balises, totaux, activité, derniers scans. Rejoué à chaque
//    battement (sondage ou broadcast), donc il doit rester bon marché.
//  · `refreshMeta` — l'inventaire lui-même, l'équipe, les invitations, l'état
//    des imports. Ne bouge que sur action du superviseur.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCountTotals, getImportState, getSession, getSessionInvitations, getSessionMembers,
  type Member, type Session, type SessionInvitation,
} from '@/lib/inventory'
import { getZoneDashboard, type ZoneDashboardRow } from '@/lib/zones'
import { getRecentCounts, getSessionActivity, type ActivityRow, type CountEvent } from '@/lib/activity'

export type Totals = { counted: number; audited: number; countedSkus: number; auditedSkus: number }

export type SessionData = {
  loading: boolean
  error: string | null
  notFound: boolean
  session: Session | null
  zones: ZoneDashboardRow[]
  totals: Totals
  members: Member[]
  invitations: SessionInvitation[]
  activity: ActivityRow[]
  recent: CountEvent[]
  importState: { articles: number; stock: number }
  refreshLive: () => Promise<void>
  refreshMeta: () => Promise<void>
  refreshAll: () => Promise<void>
}

const EMPTY_TOTALS: Totals = { counted: 0, audited: 0, countedSkus: 0, auditedSkus: 0 }

export function useSessionData(sessionId: string): SessionData {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [zones, setZones] = useState<ZoneDashboardRow[]>([])
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<SessionInvitation[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [recent, setRecent] = useState<CountEvent[]>([])
  const [importState, setImportState] = useState({ articles: 0, stock: 0 })

  // Le mode (avec ou sans balises) décide de ce qu'il faut recharger ; on le
  // garde dans une référence pour que `refreshLive` reste stable.
  const usesZonesRef = useRef(false)
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const refreshLive = useCallback(async () => {
    if (!sessionId) return
    const [z, t, a, r] = await Promise.all([
      usesZonesRef.current ? getZoneDashboard(sessionId) : Promise.resolve<ZoneDashboardRow[]>([]),
      getCountTotals(sessionId),
      getSessionActivity(sessionId),
      getRecentCounts(sessionId),
    ])
    if (!aliveRef.current) return
    setZones(z); setTotals(t); setActivity(a); setRecent(r)
  }, [sessionId])

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

  const refreshAll = useCallback(async () => {
    await refreshMeta()
    await refreshLive()
  }, [refreshMeta, refreshLive])

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
    activity, recent, importState, refreshLive, refreshMeta, refreshAll,
  }
}
