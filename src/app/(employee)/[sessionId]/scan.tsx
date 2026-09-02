import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Article, BaliseMode } from '@/lib/queries'
import { getScanEntries, getSession, insertCount, primeOfflineCache } from '@/lib/offlineSync'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { OfflineBanner } from '@/components/OfflineBanner'
import { useAuth } from '@/lib/auth'
import { Scanner } from '@/components/scanner'
import { friendlyInsertCountError } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { AUDIT_COLOR, AUDIT_ON } from '@/constants/colors'
import { signaler } from '@/lib/dialogue'

export default function EmployeeScanScreen() {
  const { sessionId, mode } = useLocalSearchParams<{ sessionId: string; mode?: string }>()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const theme = useTheme()
  const [baliseMode, setBaliseMode] = useState<BaliseMode>(mode === 'audit' ? 'audit' : 'count')

  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })

  // La passe découle du mode choisi avant d'entrer sur l'écran de scan
  // (Comptage→1, Audit→2), en mode zones comme sans balise.
  const usesZones = !!session?.uses_zones
  const passNumber = baliseMode === 'audit' ? 2 : 1

  // Persisted scans for this counter/pass — rebuilds the list after navigation.
  const { data: initialScans } = useQuery({
    queryKey: ['scan-entries', sessionId, passNumber, profile?.id],
    queryFn: () => getScanEntries(sessionId, passNumber, profile!.id),
    enabled: !!session && !!profile,
    staleTime: 0,
  })

  const queue = useOfflineQueue(sessionId)

  // Le référentiel doit être en cache AVANT de descendre en réserve : c'est la
  // seule chose qu'on ne peut pas rattraper une fois le réseau perdu. On le
  // remplit à l'entrée sur l'écran de scan, là où il y a encore du signal.
  useEffect(() => {
    if (session) void primeOfflineCache(sessionId)
  }, [session, sessionId])

  async function handleArticleResolved(article: Article, qty: number, zoneCode?: string | null) {
    if (!session || !profile) return
    try {
      const { queued } = await insertCount({
        session_id: sessionId,
        sku: article.sku,
        pass_number: passNumber,
        qty,
        counted_by: profile.id,
        zone: zoneCode ?? null,
      })
      if (queued) {
        // Rien n'est parti : seul le compteur du bandeau doit bouger. Invalider
        // les requêtes referait un aller-retour réseau voué à échouer, et
        // ralentirait le scan suivant.
        await queue.refresh()
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['my-counts', sessionId] })
      // ⚠️ Les deux clés, pas une seule. `my-counts` est la liste des balises
      // comptées ; `my-count-totals` est le « 129 pièces comptées · 34
      // auditées » de « Ma progression ». L'écran reste monté sous le
      // scanner : sans cette invalidation il affiche les chiffres d'avant le
      // comptage — sur l'écran même où l'on vient vérifier ce qu'on a remonté.
      await queryClient.invalidateQueries({ queryKey: ['my-count-totals', sessionId] })
      if (usesZones) await queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
    } catch (e: unknown) {
      console.error('[scan] insertCount', e)
      signaler.erreur('Enregistrement impossible', friendlyInsertCountError(e))
    }
  }

  if (!session) return null

  const audit = baliseMode === 'audit'
  const modeColor = audit ? AUDIT_COLOR : theme.accent
  const onColor = audit ? AUDIT_ON : theme.onAccent

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['bottom']}>
      <Stack.Screen options={{ title: audit ? 'Audit des articles' : 'Comptage des articles', headerStyle: { backgroundColor: modeColor }, headerTintColor: onColor }} />
      <OfflineBanner balises={queue.balises} syncing={queue.syncing} onPress={() => void queue.sync()} />
      <Scanner
        sessionId={sessionId}
        passNumber={passNumber}
        onArticleResolved={handleArticleResolved}
        initialScans={initialScans}
        zoneMode={usesZones}
        mode={baliseMode}
        onModeChange={setBaliseMode}
        lockMode
        countedBy={profile?.id}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
})
