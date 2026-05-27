import { useMemo } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getSession, getSessionResults, recomputeAudit, type SessionResultRow } from '@/lib/queries'
import { exportResultsToExcel } from '@/lib/report'
import { Colors } from '@/constants/colors'

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '')
}
function money(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ResultsScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()

  const { data: session } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })

  const { data: rows, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['results', sessionId],
    queryFn: async () => {
      await recomputeAudit(sessionId)
      return getSessionResults(sessionId)
    },
  })

  const totals = useMemo(() => {
    const r = rows ?? []
    return {
      lines: r.length,
      varianceUnits: r.reduce((s, x) => s + Number(x.variance_units), 0),
      varianceValue: r.reduce((s, x) => s + Number(x.variance_value), 0),
      shrinkValue: r.reduce((s, x) => s + Math.min(0, Number(x.variance_value)), 0),
    }
  }, [rows])

  const exportMutation = useMutation({
    mutationFn: () => exportResultsToExcel(session?.inventory_number ?? 'inventaire', rows ?? []),
    onSuccess: (result) => {
      if (!result.shared) {
        Alert.alert('Rapport généré', `Le fichier ${result.filename} a été créé mais le partage n'est pas disponible sur cette plateforme.`)
      }
    },
    onError: () => Alert.alert('Erreur', "La génération du rapport Excel a échoué."),
  })

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
  }

  const list = rows ?? []

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Synthèse des écarts</Text>
          <Row label="Articles" value={String(totals.lines)} />
          <Row label="Écart total (unités)" value={fmt(totals.varianceUnits)} color={totals.varianceUnits < 0 ? Colors.danger : Colors.secondary} />
          <Row label="Écart total (valeur achat)" value={`${money(totals.varianceValue)} €`} color={totals.varianceValue < 0 ? Colors.danger : Colors.secondary} />
          <Row label="Démarque (écarts négatifs)" value={`${money(totals.shrinkValue)} €`} color={Colors.danger} />
        </View>

        <Pressable
          style={[styles.exportBtn, (exportMutation.isPending || list.length === 0) && { opacity: 0.6 }]}
          onPress={() => exportMutation.mutate()}
          disabled={exportMutation.isPending || list.length === 0}
        >
          {exportMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.exportBtnText}>Exporter le rapport Excel</Text>}
        </Pressable>

        {list.length === 0 && (
          <Text style={styles.empty}>Aucun résultat. Importez le stock théorique et effectuez les comptages.</Text>
        )}

        {list.map((r) => <ResultCard key={r.sku} row={r} />)}
      </ScrollView>
    </SafeAreaView>
  )
}

function ResultCard({ row }: { row: SessionResultRow }) {
  const variance = Number(row.variance_units)
  const vColor = variance === 0 ? Colors.textSecondary : variance < 0 ? Colors.danger : Colors.secondary
  return (
    <View style={styles.card}>
      <Text style={styles.label} numberOfLines={1}>{row.label || row.sku}</Text>
      <Text style={styles.meta}>SKU : {row.sku}{row.ean ? ` · EAN : ${row.ean}` : ''}</Text>
      <View style={styles.qtyRow}>
        <Cell label="Théorique" value={fmt(Number(row.theoretical_qty))} />
        <Cell label="Compté" value={fmt(Number(row.counted_qty))} />
        <Cell label="Écart" value={(variance > 0 ? '+' : '') + fmt(variance)} color={vColor} />
        <Cell label="Valeur" value={`${money(Number(row.variance_value))} €`} color={vColor} />
      </View>
    </View>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
    </View>
  )
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, color ? { color } : null]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  exportBtn: { backgroundColor: Colors.secondary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  empty: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 24 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  label: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  meta: { fontSize: 12, color: Colors.textSecondary },
  qtyRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cell: { flex: 1, alignItems: 'center', backgroundColor: Colors.background, borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  cellLabel: { fontSize: 11, color: Colors.textMuted },
  cellValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
})
