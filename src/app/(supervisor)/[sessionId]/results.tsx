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
import { euros, qte as fmt, qteSignee } from '@/lib/nombres'

/** ⚠️ La liste se lit par pages : voir le commentaire des totaux plus bas. */
const PAGE = 50


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
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.textSecondary} />}
      >
        {/* ⚠️ « REGISTRE » — l'écran fait foi, il se lit comme un document.
            Filets au lieu de cartes, nombres en chasse fixe, titre en serif,
            rayon zéro. C'est la même grammaire que l'onglet Rapport du site.
            Voir `src/constants/ink.ts`, `Font.serif` et `Font.mono`. */}
        <Text style={styles.docTitre}>Rapport d’inventaire</Text>
        <View style={styles.summaryCard}>
          <Row styles={styles} label="Stock théorique" value={fmt(totals.theoreticalUnits)} />
          <Row styles={styles} label="Stock compté" value={fmt(totals.countedUnits)} />
          <Row styles={styles} label="Écart total (unités)" value={qteSignee(totals.varianceUnits)} color={totals.varianceUnits < 0 ? theme.danger : theme.success} />
          <Row styles={styles} label="Écart total (valeur achat)" value={euros(totals.varianceValue)} color={totals.varianceValue < 0 ? theme.danger : theme.success} />
        </View>

        <Pressable
          style={[styles.exportBtn, (exportMutation.isPending || total === 0) && { opacity: 0.6 }]}
          onPress={() => exportMutation.mutate()}
          disabled={exportMutation.isPending || total === 0}
        >
          {exportMutation.isPending
            ? <ActivityIndicator color={theme.onAccent} />
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
        <Cell styles={styles} label="Écart" value={qteSignee(variance)} color={vColor} />
        <Cell styles={styles} label="Valeur" value={euros(Number(row.variance_value))} color={vColor} />
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
    // Le titre du DOCUMENT : la barre de navigation nomme l'inventaire, le
    // document nomme la pièce.
    docTitre: { fontFamily: Font.serif, fontSize: 25, color: t.textPrimary, letterSpacing: -0.2, marginBottom: 2 },
    // La synthèse est un intervalle réglé, plus une carte : deux traits
    // d'encre l'ouvrent et la ferment, comme sur un relevé.
    summaryCard: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.textPrimary, paddingVertical: 4 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 9 },
    summaryLabel: { fontSize: 13, color: t.textSecondary, fontFamily: Font.regular },
    summaryValue: { fontSize: 17, fontFamily: Font.monoMedium, color: t.textPrimary, ...tabular },
    // ⚠️ L'EXPORT PORTE L'ACCENT, PLUS LE VERT DU SUCCÈS. Depuis qu'Ardoise a
    // fait de l'accent un vert forêt, deux verts voisins sur le même écran ne
    // se distinguent plus — et le succès doit rester ce qui a RÉUSSI.
    exportBtn: { backgroundColor: t.accent, borderRadius: Radius.bouton, paddingVertical: Spacing.lg, alignItems: 'center' },
    exportBtnText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },
    // « Voir N de plus » : un bouton en contour, pas un second bouton plein —
    // l'export reste l'action de l'écran, charger la suite est un pas de côté.
    // ⚠️ 48 de haut : la cible tactile minimale d'Android (31 août 2026).
    plusBtn: {
      minHeight: 48, borderRadius: Radius.bouton, borderWidth: 1, borderColor: t.borderStrong,
      alignItems: 'center', justifyContent: 'center',
      marginTop: Spacing.xs,
    },
    plusBtnText: { fontSize: 15, fontFamily: Font.semibold, color: t.accent },
    empty: { fontSize: 14, color: t.textSecondary, textAlign: 'center', marginTop: Spacing.xxl, fontFamily: Font.regular },
    // ⚠️ PAS DE `textMuted` DANS UN DOCUMENT. Mesuré sur le site : ce gris
    // donne 3,06:1 sur le papier, sous le seuil AA — et il portait les
    // en-têtes, les codes-barres et les libellés de colonnes, c'est-à-dire ce
    // qu'on LIT. Ici la hiérarchie vient de la taille et des capitales.
    sectionLabel: { fontSize: 11, fontFamily: Font.semibold, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.md },
    // Une ligne, plus une carte : un filet la sépare de la suivante.
    card: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: t.hairline, gap: 4 },
    brand: { fontSize: 10, fontFamily: Font.mono, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    label: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    // Le SKU et le code-barres sont des codes : ils se lisent comme des nombres.
    meta: { fontSize: 12, fontFamily: Font.mono, color: t.textSecondary, ...tabular },
    qtyRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.xs },
    cell: { flex: 1 },
    cellLabel: { fontSize: 10, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
    cellValue: { fontSize: 15, fontFamily: Font.monoMedium, color: t.textPrimary, marginTop: 2, ...tabular },
  })
}
