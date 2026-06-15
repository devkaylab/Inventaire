import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getArticleLabels, getAudits, recomputeAudit, resolveAudit } from '@/lib/queries'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

const STATUS_LABELS: Record<string, string> = {
  validated: 'Validé',
  resolved: 'Arbitré',
  failed: 'Écart',
  pending: 'En attente',
}

function statusColor(t: Theme, status: string): string {
  switch (status) {
    case 'validated': return t.success
    case 'resolved': return t.accent
    case 'failed': return t.danger
    default: return t.warning
  }
}

function fmt(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '')
}

export default function AuditsScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const queryClient = useQueryClient()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [inputs, setInputs] = useState<Record<string, string>>({})

  const recompute = useMutation({
    mutationFn: () => recomputeAudit(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audits', sessionId] }),
  })

  useEffect(() => {
    recompute.mutate()
  }, [sessionId])

  const { data: audits, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['audits', sessionId],
    queryFn: () => getAudits(sessionId),
  })

  const skus = useMemo(() => (audits ?? []).map((a) => a.sku), [audits])
  const { data: labels } = useQuery({
    queryKey: ['audit-labels', sessionId, skus.length],
    queryFn: () => getArticleLabels(sessionId, skus),
    enabled: skus.length > 0,
  })

  const resolve = useMutation({
    mutationFn: ({ sku, qty }: { sku: string; qty: number }) => resolveAudit(sessionId, sku, qty),
    onSuccess: async (result, variables) => {
      if (!result.success) {
        Alert.alert('Erreur', result.error === 'invalid_qty' ? 'Quantité invalide.' : 'Résolution impossible.')
        return
      }
      setInputs((prev) => {
        const next = { ...prev }
        delete next[variables.sku]
        return next
      })
      await queryClient.invalidateQueries({ queryKey: ['audits', sessionId] })
    },
  })

  function onResolve(sku: string, fallback: number | null) {
    const raw = inputs[sku]
    const qty = parseFloat(raw ?? (fallback != null ? String(fallback) : ''))
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Quantité invalide', 'Entrez un nombre positif pour la quantité finale.')
      return
    }
    resolve.mutate({ sku, qty })
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  const list = audits ?? []
  const failed = list.filter((a) => a.status === 'failed')
  const pending = list.filter((a) => a.status === 'pending')
  const settled = list.filter((a) => a.status === 'validated' || a.status === 'resolved')

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefetching || recompute.isPending} onRefresh={() => { recompute.mutate(); refetch() }} tintColor={theme.textMuted} />
        }
      >
        <View style={styles.summary}>
          <Stat styles={styles} label="Écarts" value={failed.length} color={theme.danger} />
          <Stat styles={styles} label="En attente" value={pending.length} color={theme.warning} />
          <Stat styles={styles} label="Réglés" value={settled.length} color={theme.success} />
        </View>
        <Text style={styles.hint}>
          Un écart apparaît quand la passe 1 et la passe 2 diffèrent. Lancez la passe 3 (arbitrage) puis tirez pour rafraîchir, ou saisissez la quantité finale ci-dessous.
        </Text>

        {failed.length > 0 && <Text style={styles.sectionTitle}>Écarts à arbitrer ({failed.length})</Text>}
        {failed.map((a) => (
          <View key={a.sku} style={[styles.card, { borderLeftColor: theme.danger, borderLeftWidth: 4 }]}>
            <Text style={styles.sku}>{labels?.[a.sku]?.label || a.sku}</Text>
            <Text style={styles.subSku}>SKU : {a.sku}{labels?.[a.sku]?.brand ? ` · ${labels[a.sku].brand}` : ''}</Text>
            <View style={styles.passes}>
              <PassChip styles={styles} theme={theme} n={1} v={fmt(a.qty_pass1)} />
              <PassChip styles={styles} theme={theme} n={2} v={fmt(a.qty_pass2)} />
              <PassChip styles={styles} theme={theme} n={3} v={fmt(a.qty_pass3)} />
            </View>
            <View style={styles.resolveRow}>
              <TextInput
                style={styles.input}
                value={inputs[a.sku] ?? (a.qty_pass3 != null ? String(a.qty_pass3) : '')}
                onChangeText={(t) => setInputs((p) => ({ ...p, [a.sku]: t }))}
                keyboardType="numeric"
                placeholder="Qté finale"
                placeholderTextColor={theme.textMuted}
              />
              <Pressable
                style={[styles.resolveBtn, resolve.isPending && { opacity: 0.6 }]}
                onPress={() => onResolve(a.sku, a.qty_pass3 ?? a.qty_pass2)}
                disabled={resolve.isPending}
              >
                <Text style={styles.resolveBtnText}>Valider</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {pending.length > 0 && <Text style={styles.sectionTitle}>Comptage incomplet ({pending.length})</Text>}
        {pending.map((a) => (
          <View key={a.sku} style={styles.card}>
            <Text style={styles.sku}>{labels?.[a.sku]?.label || a.sku}</Text>
            <Text style={styles.subSku}>SKU : {a.sku}</Text>
            <View style={styles.passes}>
              <PassChip styles={styles} theme={theme} n={1} v={fmt(a.qty_pass1)} />
              <PassChip styles={styles} theme={theme} n={2} v={fmt(a.qty_pass2)} />
              <PassChip styles={styles} theme={theme} n={3} v={fmt(a.qty_pass3)} />
            </View>
          </View>
        ))}

        {settled.length > 0 && <Text style={styles.sectionTitle}>Réglés ({settled.length})</Text>}
        {settled.map((a) => (
          <View key={a.sku} style={styles.settledRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(theme, a.status) }]} />
            <Text style={styles.settledSku} numberOfLines={1}>{labels?.[a.sku]?.label || a.sku}</Text>
            <Text style={styles.settledQty}>{fmt(a.final_qty)}</Text>
            <Text style={[styles.settledStatus, { color: statusColor(theme, a.status) }]}>{STATUS_LABELS[a.status]}</Text>
          </View>
        ))}

        {list.length === 0 && (
          <Text style={styles.empty}>Aucun comptage agrégé pour l'instant. Les articles apparaîtront après la passe 1.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ label, value, color, styles }: { label: string; value: number; color: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function PassChip({ n, v, theme, styles }: { n: number; v: string; theme: Theme; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.passChip}>
      <View style={[styles.passChipDot, { backgroundColor: theme.passColors[n as 1 | 2 | 3] }]} />
      <Text style={styles.passChipText}>P{n}: {v}</Text>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.md },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background },
    summary: { flexDirection: 'row', gap: Spacing.md },
    stat: { flex: 1, backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    statValue: { fontSize: 26, fontFamily: Font.extrabold, letterSpacing: -0.5, ...tabular },
    statLabel: { fontSize: 12, color: t.textSecondary, marginTop: 2, fontFamily: Font.medium },
    hint: { fontSize: 12, color: t.textMuted, lineHeight: 17, fontFamily: Font.regular },
    sectionTitle: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, marginTop: Spacing.xs, letterSpacing: -0.2 },
    card: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, ...t.shadowCard },
    sku: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary },
    subSku: { fontSize: 12, color: t.textSecondary, ...tabular },
    passes: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    passChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.background, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: t.hairline },
    passChipDot: { width: 8, height: 8, borderRadius: 4 },
    passChipText: { fontSize: 13, color: t.textPrimary, fontFamily: Font.semibold, ...tabular },
    resolveRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs },
    input: { flex: 1, borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 16, backgroundColor: t.background, color: t.textPrimary, fontFamily: Font.regular, ...tabular },
    resolveBtn: { backgroundColor: t.success, borderRadius: Radius.md, paddingHorizontal: 18, paddingVertical: 11 },
    resolveBtnText: { color: '#fff', fontFamily: Font.bold, fontSize: 15 },
    settledRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    settledSku: { flex: 1, fontSize: 14, color: t.textPrimary, fontFamily: Font.medium },
    settledQty: { fontSize: 14, fontFamily: Font.bold, color: t.textPrimary, ...tabular },
    settledStatus: { fontSize: 12, fontFamily: Font.semibold, width: 70, textAlign: 'right' },
    empty: { fontSize: 14, color: t.textMuted, textAlign: 'center', marginTop: Spacing.xxl, fontFamily: Font.regular },
  })
}
