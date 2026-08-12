import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getArticleLabels, getMyCounts, getSession, getZones, leaveSession } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { AUDIT_COLOR, AUDIT_ON } from '@/constants/colors'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { IDLE_ACTIVITY, useSessionPresence } from '@/lib/presence'

export default function EmployeeProgressScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const theme = useTheme()
  const styles = makeStyles(theme)

  // Présence : le compteur apparaît « en ligne » sur le tableau de bord du
  // superviseur dès qu'il ouvre l'inventaire, avant même son premier scan.
  useSessionPresence(sessionId, IDLE_ACTIVITY)

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })

  // Comptage (étape 1) — liste détaillée + total des pièces comptées.
  const { data: countRows, isLoading: countsLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-counts', sessionId, 1],
    queryFn: () => getMyCounts(sessionId, 1),
    enabled: !!session,
  })
  // Audit (étape 2) — total des pièces auditées.
  const { data: auditRows } = useQuery({
    queryKey: ['my-counts', sessionId, 2],
    queryFn: () => getMyCounts(sessionId, 2),
    enabled: !!session,
  })

  const queryClient = useQueryClient()
  const leaveMutation = useMutation({
    mutationFn: () => leaveSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      Alert.alert('Inventaire quitté', 'Vous avez quitté cet inventaire. Vos comptages restent enregistrés.')
      if (router.canGoBack()) router.back()
      else router.replace('/(employee)/')
    },
    onError: (e) => { Alert.alert('Erreur', errorMessage(e)) },
  })

  function confirmLeave() {
    Alert.alert(
      'Quitter l\'inventaire',
      'Vous ne verrez plus cet inventaire. Vos comptages et audits déjà saisis restent enregistrés pour l\'équipe.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => leaveMutation.mutate() },
      ],
    )
  }

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function toggle(code: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code); else next.add(code)
      return next
    })
  }

  const usesZones = !!session?.uses_zones

  // Noms des balises (pour afficher « Balise 12341 · Réserve ») en mode zones.
  const { data: zones } = useQuery({
    queryKey: ['zones', sessionId],
    queryFn: () => getZones(sessionId),
    enabled: usesZones,
  })
  const zoneName = new Map<string, string>()
  for (const z of zones ?? []) if (z.name) zoneName.set(z.code, z.name)

  const skuTotals = new Map<string, number>()
  for (const c of countRows ?? []) {
    skuTotals.set(c.sku, (skuTotals.get(c.sku) ?? 0) + c.qty)
  }
  const summaryRows = [...skuTotals.entries()].map(([sku, qty]) => ({ sku, qty }))
  const countedPieces = summaryRows.reduce((sum, r) => sum + r.qty, 0)
  const auditedPieces = (auditRows ?? []).reduce((sum, c) => sum + c.qty, 0)

  // Comptes regroupés par balise (mode zones) : total + articles par balise.
  const baliseMap = new Map<string, { total: number; skus: Map<string, number> }>()
  for (const c of countRows ?? []) {
    const code = (c.zone ?? '').trim() || '—'
    const g = baliseMap.get(code) ?? { total: 0, skus: new Map<string, number>() }
    g.total += c.qty
    g.skus.set(c.sku, (g.skus.get(c.sku) ?? 0) + c.qty)
    baliseMap.set(code, g)
  }
  const sections = [...baliseMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([code, g]) => ({
      code,
      title: zoneName.get(code) ? `Balise ${code} · ${zoneName.get(code)}` : `Balise ${code}`,
      total: g.total,
      data: [...g.skus.entries()]
        .map(([sku, qty]) => ({ sku, qty }))
        .sort((a, b) => b.qty - a.qty),
    }))

  // Article details (libellé / marque / EAN) to enrich each scanned line.
  const { data: labels } = useQuery({
    queryKey: ['my-count-labels', sessionId, summaryRows.length],
    queryFn: () => getArticleLabels(sessionId, summaryRows.map(r => r.sku)),
    enabled: summaryRows.length > 0,
  })

  const isLoading = sessionLoading || countsLoading

  function renderArticle(item: { sku: string; qty: number }) {
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
  }

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
                <Text style={styles.summaryLine}>
                  {countedPieces} pièce{countedPieces > 1 ? 's' : ''} comptée{countedPieces > 1 ? 's' : ''} · {auditedPieces} auditée{auditedPieces > 1 ? 's' : ''}
                </Text>
              </>
            )}
          </View>

          {usesZones ? (
            <FlatList
              data={sections}
              keyExtractor={s => s.code}
              renderItem={({ item }) => {
                const open = expanded.has(item.code)
                return (
                  <View>
                    <Pressable style={styles.baliseRow} onPress={() => toggle(item.code)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.baliseRowTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.baliseRowMeta}>
                          {item.data.length} article{item.data.length > 1 ? 's' : ''} · {item.total} pièce{item.total > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Chevron open={open} color={theme.textMuted} />
                    </Pressable>
                    {open && item.data.map(a => (
                      <View key={a.sku} style={styles.articleUnderBalise}>{renderArticle(a)}</View>
                    ))}
                  </View>
                )
              }}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyText}>{"Aucune pièce comptée pour l'instant"}</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={summaryRows}
              keyExtractor={r => r.sku}
              renderItem={({ item }) => renderArticle(item)}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyText}>{"Aucune pièce comptée pour l'instant"}</Text>
                </View>
              }
            />
          )}

          {session && session.status !== 'closed' && (
            <View style={styles.footer}>
              <Pressable style={styles.countBtn} onPress={() => router.push(`/(employee)/${sessionId}/scan?mode=count`)}>
                <Text style={styles.countBtnText}>Compter des articles</Text>
              </Pressable>
              <Pressable style={styles.auditBtn} onPress={() => router.push(`/(employee)/${sessionId}/scan?mode=audit`)}>
                <Text style={styles.auditBtnText}>Auditer des articles</Text>
              </Pressable>
              <Pressable style={styles.leaveBtn} onPress={confirmLeave}>
                <Text style={styles.leaveBtnText}>{"Quitter l'inventaire"}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  )
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    header: { backgroundColor: t.surface, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: t.hairline, gap: 4 },
    inventoryNumber: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, ...tabular },
    storeName: { fontSize: 14, color: t.textSecondary, fontFamily: Font.medium },
    summaryLine: { fontSize: 13, color: t.textMuted, fontFamily: Font.medium, marginTop: Spacing.xs, ...tabular },
    list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.lg },
    baliseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    baliseRowTitle: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    baliseRowMeta: { fontSize: 13, color: t.textSecondary, fontFamily: Font.medium, marginTop: 2, ...tabular },
    articleUnderBalise: { marginTop: Spacing.sm, marginLeft: Spacing.md },
    row: { backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    rowLeft: { flex: 1, gap: 3 },
    rowTitle: { fontSize: 15, fontFamily: Font.semibold, color: t.textPrimary },
    rowMeta: { fontSize: 12, color: t.textSecondary, fontFamily: Font.regular, ...tabular },
    qtyWrap: { alignItems: 'flex-end', minWidth: 52 },
    qty: { fontSize: 20, color: t.accent, fontFamily: Font.extrabold, ...tabular },
    qtyUnit: { fontSize: 11, color: t.textMuted, fontFamily: Font.medium },
    emptyText: { color: t.textMuted, fontSize: 15, fontFamily: Font.regular },
    footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: t.hairline, backgroundColor: t.background },
    countBtn: { backgroundColor: t.accent, borderRadius: Radius.lg, paddingVertical: Spacing.lg, alignItems: 'center', ...t.shadowElevated },
    countBtnText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
    auditBtn: { backgroundColor: AUDIT_COLOR, borderRadius: Radius.lg, paddingVertical: Spacing.lg, alignItems: 'center', ...t.shadowElevated },
    auditBtnText: { color: AUDIT_ON, fontSize: 16, fontFamily: Font.bold },
    leaveBtn: { paddingVertical: Spacing.md, alignItems: 'center' },
    leaveBtnText: { color: t.danger, fontSize: 14, fontFamily: Font.semibold },
  })
}
