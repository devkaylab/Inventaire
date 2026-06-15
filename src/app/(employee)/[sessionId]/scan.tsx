import { Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession, insertCount } from '@/lib/queries'
import type { Article } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { Scanner } from '@/components/scanner'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'

export default function EmployeeScanScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const theme = useTheme()

  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })

  async function handleArticleResolved(article: Article, qty: number) {
    if (!session || !profile) return
    try {
      await insertCount({
        session_id: sessionId,
        sku: article.sku,
        pass_number: session.current_pass,
        qty,
        counted_by: profile.id,
      })
      await queryClient.invalidateQueries({ queryKey: ['my-counts', sessionId] })
    } catch (e: unknown) {
      console.error('[scan] insertCount', e)
      Alert.alert('Erreur', `Impossible d'enregistrer le comptage : ${errorMessage(e)}`)
    }
  }

  if (!session) return null

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Scanner sessionId={sessionId} passNumber={session.current_pass} onArticleResolved={handleArticleResolved} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
})
