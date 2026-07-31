import { useState } from 'react'
import { Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession, getMyScanEntries, insertCount } from '@/lib/queries'
import type { Article, BaliseMode } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { Scanner } from '@/components/scanner'
import { friendlyInsertCountError } from '@/lib/errors'
import { useTheme } from '@/lib/theme'

export default function EmployeeScanScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const theme = useTheme()
  const [baliseMode, setBaliseMode] = useState<BaliseMode>('count')

  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })

  // En mode zones, la passe découle du mode choisi par le participant
  // (Comptage→1, Audit→2) ; sinon elle suit la passe globale de la session.
  const usesZones = !!session?.uses_zones
  const passNumber = usesZones ? (baliseMode === 'audit' ? 2 : 1) : session?.current_pass ?? 1

  // Persisted scans for this counter/pass — rebuilds the list after navigation.
  const { data: initialScans } = useQuery({
    queryKey: ['scan-entries', sessionId, passNumber, profile?.id],
    queryFn: () => getMyScanEntries(sessionId, passNumber, profile!.id),
    enabled: !!session && !!profile,
    staleTime: 0,
  })

  async function handleArticleResolved(article: Article, qty: number, zoneCode?: string | null) {
    if (!session || !profile) return
    try {
      await insertCount({
        session_id: sessionId,
        sku: article.sku,
        pass_number: passNumber,
        qty,
        counted_by: profile.id,
        zone: zoneCode ?? null,
      })
      await queryClient.invalidateQueries({ queryKey: ['my-counts', sessionId] })
      if (usesZones) await queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
    } catch (e: unknown) {
      console.error('[scan] insertCount', e)
      Alert.alert('Enregistrement impossible', friendlyInsertCountError(e))
    }
  }

  if (!session) return null

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Scanner
        sessionId={sessionId}
        passNumber={passNumber}
        onArticleResolved={handleArticleResolved}
        initialScans={initialScans}
        zoneMode={usesZones}
        mode={baliseMode}
        onModeChange={setBaliseMode}
        countedBy={profile?.id}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
})
