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
import { Colors } from '@/constants/colors'

const STATUS_LABELS: Record<string, string> = {
  validated: 'Validé',
  resolved: 'Arbitré',
  failed: 'Écart',
  pending: 'En attente',
}
const STATUS_COLORS: Record<string, string> = {
  validated: Colors.secondary,
  resolved: Colors.primary,
  failed: Colors.danger,
  pending: Colors.warning,
}

function fmt(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '')
}

export default function AuditsScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const queryClient = useQueryClient()
  const [inputs, setInputs] = useState<Record<string, string>>({})

  const recompute = useMutation({
    mutationFn: () => recomputeAudit(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audits', sessionId] }),
  })

  // Aggregate raw counts into article_audit when the screen opens.
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
    queryFn: () => getArticleLabels(skus),
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
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
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
          <RefreshControl refreshing={isRefetching || recompute.isPending} onRefresh={() => { recompute.mutate(); refetch() }} />
        }
      >
        <View style={styles.summary}>
          <Stat label="Écarts" value={failed.length} color={Colors.danger} />
          <Stat label="En attente" value={pending.length} color={Colors.warning} />
          <Stat label="Réglés" value={settled.length} color={Colors.secondary} />
        </View>
        <Text style={styles.hint}>
          Un écart apparaît quand la passe 1 et la passe 2 diffèrent. Lancez la passe 3 (arbitrage) puis tirez pour rafraîchir, ou saisissez la quantité finale ci-dessous.
        </Text>

        {failed.length > 0 && <Text style={styles.sectionTitle}>Écarts à arbitrer ({failed.length})</Text>}
        {failed.map((a) => (
          <View key={a.sku} style={[styles.card, { borderLeftColor: Colors.danger, borderLeftWidth: 4 }]}>
            <Text style={styles.sku}>{labels?.[a.sku]?.label || a.sku}</Text>
            <Text style={styles.subSku}>SKU : {a.sku}{labels?.[a.sku]?.brand ? ` · ${labels[a.sku].brand}` : ''}</Text>
            <View style={styles.passes}>
              <PassChip n={1} v={fmt(a.qty_pass1)} />
              <PassChip n={2} v={fmt(a.qty_pass2)} />
              <PassChip n={3} v={fmt(a.qty_pass3)} />
            </View>
            <View style={styles.resolveRow}>
              <TextInput
                style={styles.input}
                value={inputs[a.sku] ?? (a.qty_pass3 != null ? String(a.qty_pass3) : '')}
                onChangeText={(t) => setInputs((p) => ({ ...p, [a.sku]: t }))}
                keyboardType="numeric"
                placeholder="Qté finale"
                placeholderTextColor={Colors.textMuted}
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
              <PassChip n={1} v={fmt(a.qty_pass1)} />
              <PassChip n={2} v={fmt(a.qty_pass2)} />
              <PassChip n={3} v={fmt(a.qty_pass3)} />
            </View>
          </View>
        ))}

        {settled.length > 0 && <Text style={styles.sectionTitle}>Réglés ({settled.length})</Text>}
        {settled.map((a) => (
          <View key={a.sku} style={styles.settledRow}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[a.status] }]} />
            <Text style={styles.settledSku} numberOfLines={1}>{labels?.[a.sku]?.label || a.sku}</Text>
            <Text style={styles.settledQty}>{fmt(a.final_qty)}</Text>
            <Text style={[styles.settledStatus, { color: STATUS_COLORS[a.status] }]}>{STATUS_LABELS[a.status]}</Text>
          </View>
        ))}

        {list.length === 0 && (
          <Text style={styles.empty}>Aucun comptage agrégé pour l'instant. Les articles apparaîtront après la passe 1.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function PassChip({ n, v }: { n: number; v: string }) {
  return (
    <View style={styles.passChip}>
      <View style={[styles.passChipDot, { backgroundColor: Object.values(Colors.passColors)[n - 1] }]} />
      <Text style={styles.passChipText}>P{n}: {v}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summary: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  hint: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 6 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  sku: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  subSku: { fontSize: 12, color: Colors.textSecondary },
  passes: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  passChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  passChipDot: { width: 8, height: 8, borderRadius: 4 },
  passChipText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  resolveRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: Colors.background, color: Colors.textPrimary },
  resolveBtn: { backgroundColor: Colors.secondary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 11 },
  resolveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  settledRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  settledSku: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  settledQty: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  settledStatus: { fontSize: 12, fontWeight: '600', width: 70, textAlign: 'right' },
  empty: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 24 },
})
