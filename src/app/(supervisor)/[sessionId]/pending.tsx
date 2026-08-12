import { useLocalSearchParams } from 'expo-router'

import { PendingBalisesView } from '@/components/PendingBalisesView'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'

/**
 * Balises que **ce téléphone** n'a pas encore remontées.
 *
 * Le superviseur compte lui aussi : son propre appareil peut donc retenir des
 * balises. La file est locale à l'appareil — cet écran ne montre pas ce que
 * retiennent les téléphones de l'équipe, qui se voit dans le suivi en ligne.
 */
export default function SupervisorPendingScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const queue = useOfflineQueue(sessionId)

  return (
    <PendingBalisesView
      balises={queue.balises}
      syncing={queue.syncing}
      offline={queue.offline}
      onSync={() => void queue.sync()}
    />
  )
}
