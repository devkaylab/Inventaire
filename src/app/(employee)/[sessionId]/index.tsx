import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getMyCounts, getSession } from '@/lib/queries'
import { passLabel } from '@/constants/colors'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

export default function EmployeeProgressScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { profile } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })

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
                  <Text style={styles.passLabel}>{passLabel(session.current_pass)} · {summaryRows.length} référence(s)</Text>
                </View>
              </>
            )}
          </View>

          <FlatList
            data={summaryRows}
            keyExtractor={r => r.sku}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.sku}>{item.sku}</Text>
                <Text style={styles.qty}>{item.qty}</Text>
              </View>
            )}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>Aucun comptage pour ce {session ? passLabel(session.current_pass).toLowerCase() : 'comptage'}</Text>
              </View>
            }
          />

          {session?.status !== 'closed' && (
            <Pressable style={styles.fab} onPress={() => router.push(`/(employee)/${sessionId}/scan`)}>
              <Text style={styles.fabText}>Scanner des articles</Text>
            </Pressable>
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
    list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 100 },
    row: { backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    sku: { fontSize: 14, fontFamily: Font.semibold, color: t.textPrimary, ...tabular },
    qty: { fontSize: 14, color: t.accent, fontFamily: Font.bold, ...tabular },
    emptyText: { color: t.textMuted, fontSize: 15, fontFamily: Font.regular },
    fab: { position: 'absolute', bottom: Spacing.xxl, left: Spacing.xxl, right: Spacing.xxl, backgroundColor: t.accent, borderRadius: Radius.lg, paddingVertical: Spacing.lg, alignItems: 'center', ...t.shadowElevated },
    fabText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
  })
}
