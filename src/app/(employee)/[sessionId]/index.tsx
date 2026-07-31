import { useCallback } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { advancePass, getArticleLabels, getMyCounts, getSession, revertPass } from '@/lib/queries'
import { passLabel } from '@/constants/colors'
import { promptRevertPass } from '@/lib/passControls'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

export default function EmployeeProgressScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { profile } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const queryClient = useQueryClient()

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })

  const revertMutation = useMutation({
    mutationFn: (deleteCounts: boolean) => revertPass(sessionId, deleteCounts),
    onSuccess: async (result) => {
      if (!result.success) {
        Alert.alert('Erreur', result.error ?? 'Impossible de revenir en arrière.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      await queryClient.invalidateQueries({ queryKey: ['my-counts', sessionId] })
      Alert.alert('Étape modifiée', `La session est de nouveau en ${passLabel(result.current_pass ?? 1)}.`)
    },
  })

  const advanceMutation = useMutation({
    mutationFn: () => advancePass(sessionId),
    onSuccess: async (result) => {
      if (!result.success) {
        Alert.alert('Erreur', result.error ?? "Impossible d'avancer l'étape.")
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      await queryClient.invalidateQueries({ queryKey: ['my-counts', sessionId] })
      Alert.alert('Étape suivante', `La session est maintenant en ${passLabel(result.current_pass ?? 2)}.`)
    },
  })

  function confirmAdvance(current: number) {
    Alert.alert(
      `Passer en ${passLabel(current + 1)} ?`,
      `Toute l'équipe passera en ${passLabel(current + 1)} et devra recompter. Continuer ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => advanceMutation.mutate() },
      ]
    )
  }

  const { data: counts, isLoading: countsLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-counts', sessionId, session?.current_pass],
    queryFn: () => getMyCounts(sessionId, session?.current_pass ?? 1),
    enabled: !!session,
  })

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  const skuTotals = new Map<string, number>()
  for (const c of counts ?? []) {
    skuTotals.set(c.sku, (skuTotals.get(c.sku) ?? 0) + c.qty)
  }
  const summaryRows = [...skuTotals.entries()].map(([sku, qty]) => ({ sku, qty }))
  const totalPieces = summaryRows.reduce((sum, r) => sum + r.qty, 0)

  // Article details (libellé / marque / EAN) to enrich each scanned line.
  const { data: labels } = useQuery({
    queryKey: ['my-count-labels', sessionId, summaryRows.length],
    queryFn: () => getArticleLabels(sessionId, summaryRows.map(r => r.sku)),
    enabled: summaryRows.length > 0,
  })

  const isLoading = sessionLoading || countsLoading

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
      ) : (
        <>
          <View style={styles.header}>
            {session && (
              <>
                <Text style={styles.inventoryNumber}>{session.inventory_number}</Text>
                <Text style={styles.storeName}>{session.store_name}</Text>
                <View style={styles.passRow}>
                  <View style={[styles.passDot, { backgroundColor: theme.passColors[session.current_pass as 1 | 2 | 3] }]} />
                  <Text style={styles.passLabel}>
                    {passLabel(session.current_pass)} · {summaryRows.length} référence(s) · {totalPieces} pièce(s)
                  </Text>
                </View>
                {!session.uses_zones && session.status !== 'closed' && session.current_pass > 1 && (
                  <Pressable
                    style={styles.revertBtn}
                    onPress={() => promptRevertPass(session.current_pass, (del) => revertMutation.mutate(del))}
                    disabled={revertMutation.isPending}
                  >
                    <Text style={styles.revertBtnText}>↩  Revenir en {passLabel(session.current_pass - 1)}</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>

          <FlatList
            data={summaryRows}
            keyExtractor={r => r.sku}
            renderItem={({ item }) => {
              const info = labels?.[item.sku]
              const title = info?.label || item.sku
              const meta: string[] = []
              if (info?.ean && info.ean === item.sku) {
                meta.push(`EAN ${info.ean}`)
              } else {
                meta.push(`SKU ${item.sku}`)
                if (info?.ean) meta.push(`EAN ${info.ean}`)
              }
              if (info?.brand) meta.push(info.brand)
              return (
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>{meta.join('  ·  ')}</Text>
                  </View>
                  <View style={styles.qtyWrap}>
                    <Text style={styles.qty}>{item.qty}</Text>
                    <Text style={styles.qtyUnit}>pièce{item.qty > 1 ? 's' : ''}</Text>
                  </View>
                </View>
              )
            }}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>Aucun comptage pour ce {session ? passLabel(session.current_pass).toLowerCase() : 'comptage'}</Text>
              </View>
            }
          />

          {session && session.status !== 'closed' && (
            <View style={styles.footer}>
              <Pressable style={styles.scanBtn} onPress={() => router.push(`/(employee)/${sessionId}/scan`)}>
                <Text style={styles.scanBtnText}>Scanner des articles</Text>
              </Pressable>
              {!session.uses_zones && session.current_pass < 3 && (
                <Pressable
                  style={styles.advanceBtn}
                  onPress={() => confirmAdvance(session.current_pass)}
                  disabled={advanceMutation.isPending}
                >
                  <Text style={styles.advanceBtnText}>Passer en {passLabel(session.current_pass + 1)}</Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    header: { backgroundColor: t.surface, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: t.hairline, gap: 4 },
    inventoryNumber: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, ...tabular },
    storeName: { fontSize: 14, color: t.textSecondary, fontFamily: Font.medium },
    passRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.xs },
    passDot: { width: 8, height: 8, borderRadius: 4 },
    passLabel: { fontSize: 13, color: t.textMuted, fontFamily: Font.medium },
    revertBtn: { marginTop: Spacing.sm, alignSelf: 'flex-start', backgroundColor: t.background, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 8, borderWidth: 1, borderColor: t.hairline },
    revertBtnText: { fontSize: 13, color: t.textSecondary, fontFamily: Font.semibold },
    list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.lg },
    row: { backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    rowLeft: { flex: 1, gap: 3 },
    rowTitle: { fontSize: 15, fontFamily: Font.semibold, color: t.textPrimary },
    rowMeta: { fontSize: 12, color: t.textSecondary, fontFamily: Font.regular, ...tabular },
    qtyWrap: { alignItems: 'flex-end', minWidth: 52 },
    qty: { fontSize: 20, color: t.accent, fontFamily: Font.extrabold, ...tabular },
    qtyUnit: { fontSize: 11, color: t.textMuted, fontFamily: Font.medium },
    emptyText: { color: t.textMuted, fontSize: 15, fontFamily: Font.regular },
    footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: t.hairline, backgroundColor: t.background },
    scanBtn: { backgroundColor: t.accent, borderRadius: Radius.lg, paddingVertical: Spacing.lg, alignItems: 'center', ...t.shadowElevated },
    scanBtnText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
    advanceBtn: { backgroundColor: t.success, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center', ...t.shadowButton },
    advanceBtnText: { color: '#fff', fontSize: 15, fontFamily: Font.bold },
  })
}
