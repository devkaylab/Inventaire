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
import { getSession, getSessionDetail, getSessionResults, recomputeAudit, type SessionResultRow } from '@/lib/queries'
import { exportResultsToExcel } from '@/lib/report'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '')
}
function money(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ResultsScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const theme = useTheme()
  const styles = makeStyles(theme)

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
      theoreticalUnits: r.reduce((s, x) => s + Number(x.theoretical_qty), 0),
      countedUnits: r.reduce((s, x) => s + Number(x.counted_qty), 0),
      varianceUnits: r.reduce((s, x) => s + Number(x.variance_units), 0),
      varianceValue: r.reduce((s, x) => s + Number(x.variance_value), 0),
    }
  }, [rows])

  const exportMutation = useMutation({
    mutationFn: async () => {
      // Le détail par zone n'est chargé qu'au moment de l'export.
      const detail = await getSessionDetail(sessionId)
      return exportResultsToExcel(session?.inventory_number ?? 'inventaire', rows ?? [], detail)
    },
    onSuccess: (result) => {
      if (!result.shared) {
        Alert.alert('Rapport généré', `Le fichier ${result.filename} a été créé mais le partage n'est pas disponible sur cette plateforme.`)
      }
    },
    onError: () => Alert.alert('Erreur', "La génération du rapport Excel a échoué."),
  })

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  const list = rows ?? []

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.textMuted} />}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Synthèse</Text>
          <Row styles={styles} label="Stock théorique" value={fmt(totals.theoreticalUnits)} />
          <Row styles={styles} label="Stock compté" value={fmt(totals.countedUnits)} />
          <Row styles={styles} label="Écart total (unités)" value={(totals.varianceUnits > 0 ? '+' : '') + fmt(totals.varianceUnits)} color={totals.varianceUnits < 0 ? theme.danger : theme.success} />
          <Row styles={styles} label="Écart total (valeur achat)" value={`${money(totals.varianceValue)} €`} color={totals.varianceValue < 0 ? theme.danger : theme.success} />
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

        {list.length > 0 && <Text style={styles.sectionLabel}>Détail par article</Text>}
        {list.map((r) => <ResultCard key={r.sku} row={r} theme={theme} styles={styles} />)}
      </ScrollView>
    </SafeAreaView>
  )
}

function ResultCard({ row, theme, styles }: { row: SessionResultRow; theme: Theme; styles: ReturnType<typeof makeStyles> }) {
  const variance = Number(row.variance_units)
  const vColor = variance === 0 ? theme.textSecondary : variance < 0 ? theme.danger : theme.success
  return (
    <View style={styles.card}>
      {row.brand ? <Text style={styles.brand}>{row.brand}</Text> : null}
      <Text style={styles.label} numberOfLines={2}>{row.label || row.sku}</Text>
      <Text style={styles.meta}>SKU : {row.sku}{row.ean ? ` · EAN : ${row.ean}` : ''}</Text>
      <View style={styles.qtyRow}>
        <Cell styles={styles} label="Théorique" value={fmt(Number(row.theoretical_qty))} />
        <Cell styles={styles} label="Compté" value={fmt(Number(row.counted_qty))} />
        <Cell styles={styles} label="Écart" value={(variance > 0 ? '+' : '') + fmt(variance)} color={vColor} />
        <Cell styles={styles} label="Valeur" value={`${money(Number(row.variance_value))} €`} color={vColor} />
      </View>
    </View>
  )
}

function Row({ label, value, color, styles }: { label: string; value: string; color?: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, color ? { color } : null]}>{value}</Text>
    </View>
  )
}

function Cell({ label, value, color, styles }: { label: string; value: string; color?: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, color ? { color } : null]}>{value}</Text>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.md },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background },
    summaryCard: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: 18, borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    summaryTitle: { fontSize: 11, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.md },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: t.hairline },
    summaryLabel: { fontSize: 13, color: t.textSecondary, fontFamily: Font.regular },
    summaryValue: { fontSize: 17, fontFamily: Font.bold, color: t.textPrimary, ...tabular },
    exportBtn: { backgroundColor: t.success, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center' },
    exportBtnText: { color: '#fff', fontSize: 15, fontFamily: Font.bold },
    empty: { fontSize: 14, color: t.textMuted, textAlign: 'center', marginTop: Spacing.xxl, fontFamily: Font.regular },
    sectionLabel: { fontSize: 11, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.xs, marginLeft: 2 },
    card: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, gap: 4, ...t.shadowCard },
    brand: { fontSize: 10, fontFamily: Font.bold, color: t.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
    label: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    meta: { fontSize: 12, color: t.textMuted, ...tabular },
    qtyRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
    cell: { flex: 1, alignItems: 'center', backgroundColor: t.background, borderRadius: Radius.sm, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: t.hairline },
    cellLabel: { fontSize: 10, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
    cellValue: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, marginTop: 2, ...tabular },
  })
}
