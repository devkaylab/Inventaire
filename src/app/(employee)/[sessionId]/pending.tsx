import { useLocalSearchParams } from 'expo-router'

import { PendingBalisesView } from '@/components/PendingBalisesView'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'

/**
 * Balises que ce téléphone n'a pas encore remontées.
 *
 * Même écran que côté superviseur : la question posée est identique, et la
 * réponse doit l'être aussi. C'est ce que le compteur consulte avant de quitter
 * le magasin, pour savoir s'il peut partir tranquille.
 */
export default function EmployeePendingScreen() {
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
