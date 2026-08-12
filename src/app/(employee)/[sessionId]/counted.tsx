import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'

import { CountedBalisesList } from '@/components/CountedBalisesList'
import { getSession } from '@/lib/queries'

/**
 * Les balises que ce compteur a scannées **et qui sont arrivées sur le
 * serveur**. Le détail vivait auparavant sur l'écran de progression, qui
 * mélangeait le résumé et la liste complète ; le séparer laisse la progression
 * lisible d'un coup d'œil et donne à ce détail la place qu'il mérite.
 */
export default function EmployeeCountedScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })

  return <CountedBalisesList sessionId={sessionId} usesZones={!!session?.uses_zones} />
}
