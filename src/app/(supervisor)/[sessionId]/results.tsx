import { useMemo } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import {
  getAllRapportRows, getRapportPage, getRapportResume, getSession, getSessionDetail,
  recomputeAudit, type SessionResultRow,
} from '@/lib/queries'
import { exportResultsToExcel } from '@/lib/report'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { signaler } from '@/lib/dialogue'

/** ⚠️ La liste se lit par pages : voir le commentaire des totaux plus bas. */
const PAGE = 50

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

  /**
   * ⚠️ LES TOTAUX VIENNENT DE LA BASE, la liste PAR PAGES (3 septembre 2026).
   *
   * L'écran additionnait les 400 000 lignes qu'il venait de télécharger. Sur un
   * téléphone c'est pire que sur un ordinateur : la réponse ne tient pas en
   * mémoire, et le serveur ne la rend pas dans les 8 s qu'il s'accorde.
   *
   * Les totaux portent sur TOUT l'inventaire — des chiffres qui changeraient en
   * faisant défiler ne voudraient rien dire.
   */
  const { data: resume, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['rapport-resume', sessionId],
    queryFn: async () => {
      await recomputeAudit(sessionId)
      return getRapportResume(sessionId)
    },
  })

  const {
    data: pages, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['rapport-page', sessionId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getRapportPage(sessionId, pageParam, PAGE),
    getNextPageParam: (derniere, toutes) => {
      const vus = toutes.reduce((n, p) => n + p.rows.length, 0)
      return vus >= derniere.total ? undefined : vus
    },
    enabled: !!resume,
  })

  const totals = useMemo(() => ({
    theoreticalUnits: resume?.theorique ?? 0,
    countedUnits: resume?.compte ?? 0,
    varianceUnits: resume?.ecart_unites ?? 0,
    varianceValue: resume?.ecart_valeur ?? 0,
  }), [resume])

  const exportMutation = useMutation({
    mutationFn: async () => {
      // ⚠️ L'export contient TOUT : c'est ce que le client reçoit. Il parcourt
      // les pages par tranches, au lieu d'exiger l'ensemble en une réponse.
      // Le détail par zone n'est chargé qu'au moment de l'export.
      const tout = await getAllRapportRows(sessionId)
      const detail = await getSessionDetail(sessionId)
      return exportResultsToExcel(session?.inventory_number ?? 'inventaire', tout, detail)
    },
    onSuccess: (result) => {
      if (!result.shared) {
        signaler.succes('Rapport généré', `Le fichier ${result.filename} a été créé mais le partage n'est pas disponible sur cette plateforme.`)
      }
    },
    onError: () => signaler.erreur('Erreur', "La génération du rapport Excel a échoué."),
  })

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  const list = (pages?.pages ?? []).flatMap(p => p.rows)
  const total = resume?.lignes ?? 0

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
          style={[styles.exportBtn, (exportMutation.isPending || total === 0) && { opacity: 0.6 }]}
          onPress={() => exportMutation.mutate()}
          disabled={exportMutation.isPending || total === 0}
        >
          {exportMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.exportBtnText}>Exporter le rapport Excel</Text>}
        </Pressable>

        {total === 0 && (
          <Text style={styles.empty}>Aucun résultat. Importez le stock théorique et effectuez les comptages.</Text>
        )}

        {total > 0 && (
          <Text style={styles.sectionLabel}>
            Détail par article · {list.length} sur {total}
          </Text>
        )}
        {list.map((r) => <ResultCard key={r.sku} row={r} theme={theme} styles={styles} />)}

        {hasNextPage && (
          <Pressable
            style={[styles.plusBtn, isFetchingNextPage && { opacity: 0.6 }]}
            onPress={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage
              ? <ActivityIndicator color={theme.accent} />
              : <Text style={styles.plusBtnText}>Voir {Math.min(PAGE, total - list.length)} de plus</Text>}
          </Pressable>
        )}
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
    // « Voir N de plus » : un bouton en contour, pas un second bouton plein —
    // l'export reste l'action de l'écran, charger la suite est un pas de côté.
    // ⚠️ 48 de haut : la cible tactile minimale d'Android (31 août 2026).
    plusBtn: {
      minHeight: 48, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.hairline,
      backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center',
      marginTop: Spacing.xs,
    },
    plusBtnText: { fontSize: 15, fontFamily: Font.semibold, color: t.accent },
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
