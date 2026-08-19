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
  SYNC_EVENT, flattenPresence, presenceTopic,
  type PresencePayload,
} from '@/lib/presence'

const POLL_MS = 8_000
const SYNC_DEBOUNCE_MS = 750

export type LiveState = {
  /** Une entrée par appareil connecté, indexée par clé de présence anonyme. */
  presence: Record<string, PresencePayload>
  /** Appareils dont la version de contrat est inconnue (mobile pas à jour). */
  unknownVersions: number
  channelReady: boolean
  lastRefreshAt: number
  refreshing: boolean
  refresh: () => void
}

export function useSessionLive(
  sessionId: string | undefined,
  /** Faux tant que la session d'authentification n'est pas prête : s'abonner
   *  avant ferait échouer l'autorisation du canal privé. */
  ready: boolean,
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
    if (!sessionId || !ready) return

    let disposed = false
    let debounce: ReturnType<typeof setTimeout> | null = null

    // Canal **privé** : Realtime évalue alors les policies de
    // `realtime.messages`, qui n'autorisent le topic qu'aux participants de
    // l'inventaire (migration 20260813000009). En public — l'état d'origine —
    // aucune autorisation n'était consultée : connaître l'UUID suffisait à
    // écouter l'activité des compteurs, y compris depuis une autre entreprise,
    // et y compris après avoir été retiré de l'inventaire.
    //
    // Le site **écoute sans publier** : il ne se déclare pas présent. Les
    // appareils comptés sont donc ceux de l'équipe sur le terrain, ce qui est
    // l'information utile — et c'est une émission de moins.
    const channel: RealtimeChannel = supabase.channel(presenceTopic(sessionId), {
      config: { private: true },
    })

    const readPresence = () => {
      if (disposed) return
      const { devices, unknownVersions } = flattenPresence(
        channel.presenceState() as unknown as Record<string, unknown[]>,
      )
      setPresence(devices)
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
      })

    return () => {
      disposed = true
      if (debounce) clearTimeout(debounce)
      void supabase.removeChannel(channel)
      setChannelReady(false)
    }
  }, [sessionId, ready, refresh])

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
