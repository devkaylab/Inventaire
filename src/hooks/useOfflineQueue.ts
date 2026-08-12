import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { pendingCount, syncNow } from '@/lib/offlineSync'

/**
 * Suit la file d'attente d'un inventaire et la vide dès que possible.
 *
 * Trois déclencheurs, choisis pour couvrir la façon dont on remonte de réserve :
 *
 * - **le retour au premier plan** : le geste réel est de ressortir avec le
 *   téléphone en poche puis de le rallumer. C'est le déclencheur qui sert le
 *   plus souvent ;
 * - **une tentative périodique** : le compteur peut rester dans l'app en
 *   marchant, l'écran allumé, sans jamais la quitter ;
 * - **l'appel manuel** exposé par `sync`, pour le bouton « Envoyer ».
 *
 * Il n'y a volontairement aucun module de connectivité : une tentative d'envoi
 * qui échoue coûte un aller-retour réseau raté, s'arrête à la première
 * opération et conserve l'ordre. C'est moins cher qu'une dépendance native de
 * plus, qui imposerait un `pod install` — lequel écrase à chaque fois le
 * correctif du chemin contenant un espace.
 *
 * Le compteur d'attente passe par React Query plutôt que par un `useState`
 * alimenté depuis un effet : c'est l'outil déjà utilisé partout dans l'app, et
 * ça évite d'écrire l'état React depuis le corps d'un effet.
 */
const RETRY_MS = 20_000

export type OfflineQueueState = {
  /** Opérations encore à envoyer. `0` quand tout est remonté. */
  pending: number
  /** `true` pendant un envoi, pour l'indicateur d'activité. */
  syncing: boolean
  /** Force une tentative d'envoi immédiate. */
  sync: () => Promise<void>
  /** À appeler après un scan mis en attente, pour rafraîchir le compteur. */
  refresh: () => Promise<void>
}

export function useOfflineQueue(sessionId: string | undefined): OfflineQueueState {
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  // Une seule synchro à la fois : les trois déclencheurs peuvent tomber ensemble
  // (retour au premier plan pendant un tic du minuteur), et deux passages
  // concurrents sur la même file enverraient deux fois les mêmes opérations.
  const busy = useRef(false)

  const key = ['offline-pending', sessionId]

  const { data: pending = 0 } = useQuery({
    queryKey: key,
    queryFn: () => pendingCount(sessionId!),
    enabled: !!sessionId,
    // La valeur ne change que par nos propres actions : pas de sondage inutile.
    staleTime: Infinity,
  })

  const refresh = useCallback(async () => {
    if (!sessionId) return
    await queryClient.invalidateQueries({ queryKey: ['offline-pending', sessionId] })
  }, [queryClient, sessionId])

  const sync = useCallback(async () => {
    if (!sessionId || busy.current) return
    busy.current = true
    setSyncing(true)
    try {
      const r = await syncNow(sessionId)
      queryClient.setQueryData(['offline-pending', sessionId], r.pending)
    } catch (e) {
      console.warn('[offline] synchronisation impossible', e)
      await refresh()
    } finally {
      busy.current = false
      setSyncing(false)
    }
  }, [queryClient, sessionId, refresh])

  useEffect(() => {
    if (!sessionId) return
    let alive = true

    const attempt = () => {
      if (alive) void sync()
    }

    const timer = setInterval(attempt, RETRY_MS)
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') attempt()
    })

    return () => {
      alive = false
      clearInterval(timer)
      sub.remove()
    }
  }, [sessionId, sync])

  return { pending, syncing, sync, refresh }
}
