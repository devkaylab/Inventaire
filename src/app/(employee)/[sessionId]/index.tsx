import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getMyCounts, getSession } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { Colors } from '@/constants/colors'

export default function EmployeeProgressScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { profile } = useAuth()

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
        <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <>
          <View style={styles.header}>
            {session && (
              <>
                <Text style={styles.inventoryNumber}>{session.inventory_number}</Text>
                <Text style={styles.storeName}>{session.store_name}</Text>
                <View style={styles.passRow}>
                  <View style={[styles.passDot, { backgroundColor: Object.values(Colors.passColors)[session.current_pass - 1] }]} />
                  <Text style={styles.passLabel}>Passe {session.current_pass} · {summaryRows.length} référence(s)</Text>
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
            contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>Aucun comptage pour cette passe</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: Colors.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 4 },
  inventoryNumber: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  storeName: { fontSize: 14, color: Colors.textSecondary },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  passDot: { width: 8, height: 8, borderRadius: 4 },
  passLabel: { fontSize: 13, color: Colors.textMuted },
  row: { backgroundColor: Colors.surface, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border },
  sku: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  qty: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
