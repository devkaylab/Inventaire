// Contrat de présence temps réel — CÔTÉ APPLICATION MOBILE.
//
// ⚠️ À GARDER SYNCHRONISÉ AVEC web/lib/presence.ts (site).
// Les deux paquets npm sont séparés (Expo/React 19 ici, Next/React 18 là-bas) :
// ce fichier est donc dupliqué volontairement. Une dérive de ce contrat serait
// silencieuse — le site afficherait « personne connectée » sans que rien ne
// signale l'erreur. D'où le champ `v` : le site écarte les charges dont il ne
// connaît pas la version et l'affiche explicitement.
//
// Rien à configurer côté serveur : présence et broadcast passent par le service
// Realtime et ne touchent pas à la réplication logique de Postgres.

import { useEffect, useRef } from 'react'
import { AppState, Platform } from 'react-native'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export const PRESENCE_V = 1

export const presenceTopic = (sessionId: string) => `session:${sessionId}:presence`

export const SYNC_EVENT = 'sync'

/** Cadence des battements. Le site considère une présence périmée au-delà de
 *  trois battements manqués (90 s). */
const BEAT_MS = 30_000

export type PresenceMode = 'count' | 'audit' | null

export type PresenceActivity = {
  screen: 'session' | 'scan'
  mode: PresenceMode
  balise: string | null
  baliseName: string | null
}

export const IDLE_ACTIVITY: PresenceActivity = {
  screen: 'session', mode: null, balise: null, baliseName: null,
}

function signature(a: PresenceActivity): string {
  return `${a.screen}|${a.mode}|${a.balise}`
}

/**
 * Publie la présence de l'utilisateur courant sur un inventaire.
 *
 * Le superviseur voit alors, depuis le site et en direct, qui est connecté et
 * sur quelle balise chacun travaille. Sans effet si l'inventaire ou le profil
 * manquent — l'appel est donc sûr en tête de composant.
 */
export function useSessionPresence(sessionId: string | undefined, activity: PresenceActivity) {
  const { profile } = useAuth()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const sinceRef = useRef(Date.now())
  const signatureRef = useRef('')
  const activityRef = useRef(activity)
  const foregroundRef = useRef(true)
  activityRef.current = activity

  const userId = profile?.id
  const fullName = profile?.full_name ?? 'Sans nom'
  const role = profile?.role ?? 'employee'

  // Construit la charge à partir des refs : appelable depuis un timer ou un
  // écouteur sans capturer de valeur périmée.
  const buildRef = useRef(() => ({}) as Record<string, unknown>)
  buildRef.current = () => ({
    v: PRESENCE_V,
    user_id: userId,
    full_name: fullName,
    role,
    device: Platform.OS === 'ios' ? 'ios' : 'android',
    screen: activityRef.current.screen,
    mode: activityRef.current.mode,
    balise: activityRef.current.balise,
    balise_name: activityRef.current.baliseName,
    foreground: foregroundRef.current,
    since: sinceRef.current,
    beat: Date.now(),
  })

  // ── Canal : reconstruit seulement si l'inventaire ou l'utilisateur change ──
  useEffect(() => {
    if (!sessionId || !userId) return

    const channel = supabase.channel(presenceTopic(sessionId), {
      config: { presence: { key: userId } },
    })
    channelRef.current = channel

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.track(buildRef.current())
    })

    const beat = setInterval(() => { void channelRef.current?.track(buildRef.current()) }, BEAT_MS)

    // Un téléphone en poche n'est pas quelqu'un au travail : on le dit.
    const appState = AppState.addEventListener('change', (state) => {
      foregroundRef.current = state === 'active'
      void channelRef.current?.track(buildRef.current())
    })

    return () => {
      clearInterval(beat)
      appState.remove()
      void channel.untrack()
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [sessionId, userId])

  // ── Activité : republication immédiate, et remise à zéro de `since` ────────
  useEffect(() => {
    const sig = signature(activity)
    // `since` ne repart que si l'activité change réellement. Sinon chaque
    // battement redémarrerait le « depuis 4 min » affiché au superviseur.
    if (sig !== signatureRef.current) {
      signatureRef.current = sig
      sinceRef.current = Date.now()
    }
    void channelRef.current?.track(buildRef.current())
  }, [activity])
}

/**
 * Signale au site qu'il y a du nouveau (scan enregistré, balise ouverte…).
 * Émission au mieux : si le canal n'est pas ouvert, on ne fait rien — le site
 * a de toute façon son sondage de repli.
 */
export function pingSession(sessionId: string, kind: 'count' | 'balise'): void {
  const topic = presenceTopic(sessionId)
  const channel = supabase.getChannels().find(c => c.topic === `realtime:${topic}` || c.topic === topic)
  void channel?.send({ type: 'broadcast', event: SYNC_EVENT, payload: { kind, at: Date.now() } })
}
