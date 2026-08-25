import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { defineZoneRange, deleteZone, getSession, getZoneDashboard } from '@/lib/queries'
import type { ZoneDashboardRow } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { BaliseCreator } from '@/components/BaliseCreator'
import { CorbeilleIcon } from '@/components/ui/Icones'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { demander, signaler } from '@/lib/dialogue'

type ZoneGroup = { name: string; total: number; counted: number; audited: number; codes: string[] }

function groupByName(rows: ZoneDashboardRow[]): ZoneGroup[] {
  const map = new Map<string, ZoneGroup>()
  for (const r of rows) {
    const name = r.name ?? '(Sans nom)'
    const g = map.get(name) ?? { name, total: 0, counted: 0, audited: 0, codes: [] }
    g.total += 1
    if (r.count_status === 'done') g.counted += 1
    if (r.audit_status === 'done') g.audited += 1
    g.codes.push(r.code)
    map.set(name, g)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function codeRange(codes: string[]): string {
  const nums = codes.map((c) => parseInt(c, 10)).filter((n) => !isNaN(n)).sort((a, b) => a - b)
  if (nums.length === 0) return codes.join(', ')
  return nums[0] === nums[nums.length - 1] ? String(nums[0]) : `${nums[0]} → ${nums[nums.length - 1]}`
}

export default function ZonesScreen() {
  const { sessionId, from } = useLocalSearchParams<{ sessionId: string; from?: string }>()
  const fromNew = from === 'new'
  const queryClient = useQueryClient()
  const theme = useTheme()
  const styles = makeStyles(theme)

  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const { data: session } = useQuery({ queryKey: ['session', sessionId], queryFn: () => getSession(sessionId) })
  const closed = session?.status === 'closed'

  const { data: rows, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['zone-dashboard', sessionId],
    queryFn: () => getZoneDashboard(sessionId),
  })

  const groups = useMemo(() => groupByName(rows ?? []), [rows])
  const totals = useMemo(() => {
    const list = rows ?? []
    return {
      total: list.length,
      counted: list.filter((r) => r.count_status === 'done').length,
      audited: list.filter((r) => r.audit_status === 'done').length,
    }
  }, [rows])

  const assign = useMutation({
    mutationFn: () => defineZoneRange(sessionId, name.trim(), parseInt(start, 10), parseInt(end, 10)),
    onSuccess: async (result) => {
      if (!result.success) {
        signaler.erreur('Erreur', result.error ?? 'Affectation impossible.')
        return
      }
      setName('')
      setStart('')
      setEnd('')
      await queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
    },
    onError: (e) => signaler.erreur('Erreur', errorMessage(e)),
  })

  const del = useMutation({
    mutationFn: (zoneName: string) => deleteZone(sessionId, zoneName),
    onSuccess: async (result) => {
      if (!result.success) {
        signaler.erreur('Erreur', result.error ?? 'Suppression impossible.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] })
    },
    onError: (e) => signaler.erreur('Erreur', errorMessage(e)),
  })

  function onAssign() {
    const s = parseInt(start, 10)
    const e = parseInt(end, 10)
    // Saisie incomplète : on dit ce qu'il manque, on ne titre pas « Erreur ».
    if (!name.trim()) { signaler.erreur('Nom manquant', 'Donnez un nom à l’emplacement.'); return }
    if (isNaN(s) || isNaN(e)) { signaler.erreur('Plage incomplète', 'Saisissez une balise de début et de fin.'); return }
    if (s > e) { signaler.erreur('Plage à revoir', 'La balise de début doit être inférieure ou égale à celle de fin.'); return }
    assign.mutate()
  }

  function confirmDelete(zoneName: string) {
    void demander({
      titre: 'Retirer l’emplacement ?',
      texte: `L’affectation « ${zoneName} » sera supprimée.`,
      action: 'Retirer',
      ton: 'danger',
    }).then((ok) => { if (ok) del.mutate(zoneName) })
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  const countPct = totals.total > 0 ? Math.round((totals.counted / totals.total) * 100) : 0
  const auditPct = totals.total > 0 ? Math.round((totals.audited / totals.total) * 100) : 0
  const busy = assign.isPending || del.isPending

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {fromNew && (
        <Stack.Screen options={{ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false }} />
      )}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.textMuted} />}
        >
          {totals.total > 0 && (
            <View style={styles.summary}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: theme.passColors[1] }]}>{totals.counted}/{totals.total}</Text>
                <Text style={styles.statLabel}>Comptées · {countPct}%</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: theme.passColors[2] }]}>{totals.audited}/{totals.total}</Text>
                <Text style={styles.statLabel}>Auditées · {auditPct}%</Text>
              </View>
            </View>
          )}

          {!closed && <BaliseCreator context="zones" />}

          {!closed && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Affecter une plage à un emplacement</Text>
              <Text style={styles.hint}>
                Indiquez quelles balises (imprimées et collées) sont à quel endroit.
                Ex. « Réserve » = balises 1 à 10, « Surface de vente » = 11 à 30.
              </Text>
              <Text style={styles.label}>Emplacement</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ex : Réserve"
                placeholderTextColor={theme.textMuted}
              />
              <View style={styles.rangeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Balise début</Text>
                  <TextInput style={[styles.input, tabular]} value={start} onChangeText={setStart} keyboardType="number-pad" placeholder="1" placeholderTextColor={theme.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Balise fin</Text>
                  <TextInput style={[styles.input, tabular]} value={end} onChangeText={setEnd} keyboardType="number-pad" placeholder="10" placeholderTextColor={theme.textMuted} />
                </View>
              </View>
              <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={onAssign} disabled={busy}>
                {assign.isPending ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.buttonText}>Affecter</Text>}
              </Pressable>
            </View>
          )}

          {groups.length > 0 && <Text style={styles.sectionTitle}>Emplacements ({groups.length})</Text>}
          {groups.map((g) => (
            <View key={g.name} style={styles.zoneCard}>
              <View style={styles.zoneHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneName}>{g.name}</Text>
                  <Text style={styles.zoneMeta}>Balises {codeRange(g.codes)} · {g.total}</Text>
                </View>
                {!closed && (
                  <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(g.name)} disabled={busy} hitSlop={6}>
                    <CorbeilleIcon color={theme.danger} />
                  </Pressable>
                )}
              </View>
              <View style={styles.zoneProgress}>
                <View style={[styles.progressChip, { borderColor: theme.passColors[1] }]}>
                  <View style={[styles.progressDot, { backgroundColor: theme.passColors[1] }]} />
                  <Text style={styles.progressText}>Compte {g.counted}/{g.total}</Text>
                </View>
                <View style={[styles.progressChip, { borderColor: theme.passColors[2] }]}>
                  <View style={[styles.progressDot, { backgroundColor: theme.passColors[2] }]} />
                  <Text style={styles.progressText}>Audit {g.audited}/{g.total}</Text>
                </View>
              </View>
            </View>
          ))}

          {groups.length === 0 && (
            <Text style={styles.empty}>Aucun emplacement affecté. Indiquez une première plage de balises ci-dessus.</Text>
          )}

          {fromNew && (
            <Pressable
              style={styles.nextBtn}
              onPress={() => router.replace(`/(supervisor)/${sessionId}/import?from=new`)}
            >
              <Text style={styles.nextBtnText}>Suivant : importer les fichiers</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.md },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background },
    summary: { flexDirection: 'row', gap: Spacing.md },
    stat: { flex: 1, backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    statValue: { fontSize: 24, fontFamily: Font.extrabold, letterSpacing: -0.5, ...tabular },
    statLabel: { fontSize: 12, color: t.textSecondary, marginTop: 2, fontFamily: Font.medium },
    card: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, ...t.shadowCard },
    sectionTitle: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, marginTop: Spacing.xs, letterSpacing: -0.2 },
    hint: { fontSize: 12, color: t.textMuted, lineHeight: 17, fontFamily: Font.regular },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary, marginTop: Spacing.xs },
    input: { borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 12, fontSize: 16, backgroundColor: t.background, color: t.textPrimary, fontFamily: Font.regular },
    rangeRow: { flexDirection: 'row', gap: Spacing.md },
    button: { backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm, ...t.shadowButton },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
    zoneCard: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, ...t.shadowCard },
    zoneHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    zoneName: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary },
    zoneMeta: { fontSize: 12, color: t.textSecondary, marginTop: 2, ...tabular },
    zoneProgress: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    progressChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.background, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
    progressDot: { width: 8, height: 8, borderRadius: 4 },
    progressText: { fontSize: 13, color: t.textPrimary, fontFamily: Font.semibold, ...tabular },
    deleteBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: t.dangerSoft, alignItems: 'center', justifyContent: 'center' },
    empty: { fontSize: 14, color: t.textMuted, textAlign: 'center', marginTop: Spacing.xxl, fontFamily: Font.regular },
    // ⚠️ **Le bouton qui fait avancer ne se confond pas avec les actions de
    // l'écran.** Il était violet plein comme « Créer et imprimer des balises »
    // et « Affecter » : trois boutons identiques, dont un seul mène ailleurs.
    // L'écran d'import distingue déjà le sien en vert — on suit la même règle.
    nextBtn: { backgroundColor: t.success, borderRadius: Radius.lg, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm, ...t.shadowButton },
    nextBtnText: { color: '#fff', fontFamily: Font.bold, fontSize: 16 },
  })
}
