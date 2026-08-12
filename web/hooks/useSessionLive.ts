'use client'

// Une seule socket par tableau de bord, qui rend trois services :
//
//  1. la présence : qui est connecté, sur quelle balise, dans quel mode ;
//  2. le déclenchement : l'application mobile émet un `sync` après un scan,
//     le site rafraîchit ses agrégats ;
//  3. le repli : un sondage à intervalle régulier, actif uniquement quand
//     l'onglet est visible.
//
// Pourquoi pas `postgres_changes` ? Il faudrait publier `counts` dans
// `supabase_realtime`, passer la table en REPLICA IDENTITY FULL pour que les
// suppressions portent le `session_id` du filtre, et surtout Realtime
// réévaluerait la policy SELECT de `counts` (deux fonctions SECURITY DEFINER,
// dont un `exists` corrélé) pour chaque ligne et chaque abonné — pendant une
// rafale de scans. Le tout pour apprendre « quelque chose a changé », ce que le
// broadcast dit déjà pour rien. Sondage + broadcast laissent l'accès aux
// données exactement là où il est aujourd'hui : PostgREST et ses policies.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import {
  PRESENCE_V, SYNC_EVENT, flattenPresence, presenceTopic,
  type PresencePayload,
} from '@/lib/presence'

const POLL_MS = 8_000
const SYNC_DEBOUNCE_MS = 750

export type LiveState = {
  presence: Record<string, PresencePayload>
  /** Nombre de participants dont la version de contrat est inconnue. */
  unknownVersions: number
  channelReady: boolean
  lastRefreshAt: number
  refreshing: boolean
  refresh: () => void
}

export function useSessionLive(
  sessionId: string | undefined,
  me: { id: string; full_name: string | null; role: string | null } | null,
  onRefresh: () => Promise<void> | void,
  options?: { enabled?: boolean; pollMs?: number },
): LiveState {
  const enabled = options?.enabled ?? true
  const pollMs = options?.pollMs ?? POLL_MS

  const [presence, setPresence] = useState<Record<string, PresencePayload>>({})
  const [unknownVersions, setUnknownVersions] = useState(0)
  const [channelReady, setChannelReady] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now())
  const [refreshing, setRefreshing] = useState(false)

  // `onRefresh` change à chaque rendu du parent ; on garde une référence pour
  // ne pas reconstruire la socket à chaque fois.
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh
  const inFlight = useRef(false)

  const refresh = useCallback(() => {
    if (inFlight.current) return
    inFlight.current = true
    setRefreshing(true)
    void Promise.resolve(refreshRef.current())
      .catch(err => console.error('[live] refresh', err))
      .finally(() => {
        inFlight.current = false
        setRefreshing(false)
        setLastRefreshAt(Date.now())
      })
  }, [])

  // ── Canal : présence + broadcast ───────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !me) return

    let disposed = false
    let debounce: ReturnType<typeof setTimeout> | null = null

    const channel: RealtimeChannel = supabase.channel(presenceTopic(sessionId), {
      config: { presence: { key: me.id } },
    })

    const readPresence = () => {
      if (disposed) return
      const { people, unknownVersions } = flattenPresence(
        channel.presenceState() as unknown as Record<string, unknown[]>,
      )
      setPresence(people)
      setUnknownVersions(unknownVersions)
    }

    channel
      .on('presence', { event: 'sync' }, readPresence)
      .on('presence', { event: 'join' }, readPresence)
      .on('presence', { event: 'leave' }, readPresence)
      .on('broadcast', { event: SYNC_EVENT }, () => {
        // Une rafale de scans ne doit produire qu'un seul rafraîchissement.
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => { if (!disposed) refresh() }, SYNC_DEBOUNCE_MS)
      })
      .subscribe((status) => {
        if (disposed) return
        setChannelReady(status === 'SUBSCRIBED')
        if (status !== 'SUBSCRIBED') return
        const now = Date.now()
        // Le superviseur devant son écran est lui aussi « présent » : les
        // autres superviseurs doivent le voir.
        void channel.track({
          v: PRESENCE_V,
          user_id: me.id,
          full_name: me.full_name ?? 'Sans nom',
          role: me.role ?? 'supervisor',
          device: 'web',
          screen: 'session',
          mode: null,
          balise: null,
          balise_name: null,
          foreground: true,
          since: now,
          beat: now,
        } satisfies PresencePayload)
      })

    return () => {
      disposed = true
      if (debounce) clearTimeout(debounce)
      void channel.untrack()
      void supabase.removeChannel(channel)
      setChannelReady(false)
    }
  }, [sessionId, me, refresh])

  // ── Sondage, uniquement onglet visible ─────────────────────────────────────
  useEffect(() => {
    if (!enabled || !sessionId) return

    const tick = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = setInterval(tick, pollMs)

    // Revenir sur l'onglet doit montrer l'état réel, pas celui d'il y a 20 min.
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, sessionId, pollMs, refresh])

  return useMemo(() => ({
    presence, unknownVersions, channelReady, lastRefreshAt, refreshing, refresh,
  }), [presence, unknownVersions, channelReady, lastRefreshAt, refreshing, refresh])
}
