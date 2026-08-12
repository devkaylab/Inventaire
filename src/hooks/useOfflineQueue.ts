import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  isOffline,
  pendingBalises,
  probeNetwork,
  subscribeNetwork,
  syncNow,
  type PendingBalise,
} from '@/lib/offlineSync'

/**
 * Suit les balises en attente d'un inventaire et les fait remonter seules.
 *
 * **La remontée ne doit dépendre d'aucun geste.** Une équipe d'inventaire ne
 * pensera pas à appuyer sur un bouton en remontant de réserve : le travail
 * resterait sur les téléphones et le superviseur clôturerait un inventaire
 * incomplet sans le savoir. Le bouton du bandeau n'est qu'un raccourci de
 * confort ; ce sont les déclencheurs automatiques qui font foi.
 *
 * Trois déclencheurs, choisis pour couvrir la façon dont on remonte de réserve :
 *
 * - **le retour au premier plan** : le geste réel est de ressortir avec le
 *   téléphone en poche puis de le rallumer. C'est le plus fréquent ;
 * - **une tentative périodique** : le compteur peut rester dans l'app en
 *   marchant, écran allumé, sans jamais la quitter. L'intervalle se resserre
 *   quand il y a quelque chose à envoyer ;
 * - **l'appui manuel**, pour qui veut forcer.
 *
 * Aucun module de connectivité : une tentative ratée coûte un aller-retour
 * réseau, s'arrête à la première opération et conserve l'ordre. C'est moins cher
 * qu'une dépendance native de plus, qui imposerait un `pod install` — lequel
 * écrase à chaque fois le correctif du chemin contenant un espace.
 */

/** File non vide, ou hors ligne : on retente vite, c'est là que ça compte. */
const ACTIVE_MS = 8_000
/** Tout est remonté et le réseau répond : simple veille. */
const IDLE_MS = 45_000

export type OfflineQueueState = {
  /** Balises ayant encore quelque chose à envoyer, avec leur numéro. */
  balises: PendingBalise[]
  /** Nombre de balises en attente. `0` quand tout est remonté. */
  pending: number
  /** `true` quand le serveur est injoignable. */
  offline: boolean
  /** `true` pendant un envoi. */
  syncing: boolean
  /** Force une tentative d'envoi immédiate. */
  sync: () => Promise<void>
  /** À appeler après un scan mis en attente, pour rafraîchir la liste. */
  refresh: () => Promise<void>
}

export function useOfflineQueue(sessionId: string | undefined): OfflineQueueState {
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [offline, setOfflineState] = useState(isOffline)
  // Une seule synchro à la fois : les déclencheurs peuvent tomber ensemble
  // (retour au premier plan pendant un tic du minuteur), et deux passages
  // concurrents sur la même file enverraient deux fois les mêmes opérations.
  const busy = useRef(false)

  const { data: balises = [] } = useQuery({
    queryKey: ['offline-balises', sessionId],
    queryFn: () => pendingBalises(sessionId!),
    enabled: !!sessionId,
    // La valeur ne change que par nos propres actions : pas de sondage inutile.
    staleTime: Infinity,
  })

  useEffect(() => subscribeNetwork(setOfflineState), [])

  const refresh = useCallback(async () => {
    if (!sessionId) return
    await queryClient.invalidateQueries({ queryKey: ['offline-balises', sessionId] })
  }, [queryClient, sessionId])

  const sync = useCallback(async () => {
    if (!sessionId || busy.current) return
    busy.current = true
    setSyncing(true)
    try {
      const r = await syncNow(sessionId)
      queryClient.setQueryData(['offline-balises', sessionId], r.balises)
      // Une balise entièrement remontée change ce que voit le superviseur :
      // on rafraîchit l'avancement plutôt que d'attendre le prochain passage.
      if (r.balisesSent.length > 0) {
        await queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
      }
    } catch (e) {
      console.warn('[offline] synchronisation impossible', e)
      await refresh()
    } finally {
      busy.current = false
      setSyncing(false)
    }
  }, [queryClient, sessionId, refresh])

  const pending = balises.length

  useEffect(() => {
    if (!sessionId) return
    let alive = true

    const attempt = () => {
      if (!alive) return
      // File vide : rien à envoyer, mais il faut quand même savoir si le réseau
      // est revenu — sinon le bandeau resterait affiché à tort.
      if (pending === 0) void probeNetwork(sessionId)
      else void sync()
    }

    const timer = setInterval(attempt, pending > 0 || offline ? ACTIVE_MS : IDLE_MS)
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') attempt()
    })

    return () => {
      alive = false
      clearInterval(timer)
      sub.remove()
    }
  }, [sessionId, sync, pending, offline])

  return { balises, pending, offline, syncing, sync, refresh }
}
