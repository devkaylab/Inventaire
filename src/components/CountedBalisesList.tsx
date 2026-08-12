import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useQuery } from '@tanstack/react-query'

import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { getArticleLabels, getMyCounts, getZones } from '@/lib/queries'
import { useTheme } from '@/lib/theme'

/**
 * Ce que ce compteur a déjà compté **et qui est bien arrivé sur le serveur**.
 *
 * La distinction est le point important : cette liste vient de la base, pas du
 * téléphone. Une balise comptée hors ligne n'y figure donc pas encore — elle est
 * sur l'écran « balises en attente ». Mélanger les deux ferait croire qu'un
 * travail est sécurisé alors qu'il ne l'est pas, et c'est précisément ce qu'un
 * compteur a besoin de savoir avant de quitter le magasin.
 */
export function CountedBalisesList({
  sessionId,
  usesZones,
}: {
  sessionId: string
  usesZones: boolean
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: countRows, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-counts', sessionId, 1],
    queryFn: () => getMyCounts(sessionId, 1),
  })

  const { data: zones } = useQuery({
    queryKey: ['zones', sessionId],
    queryFn: () => getZones(sessionId),
    enabled: usesZones,
  })

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  function toggle(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const zoneName = new Map<string, string>()
  for (const z of zones ?? []) if (z.name) zoneName.set(z.code, z.name)

  const skuTotals = new Map<string, number>()
  for (const c of countRows ?? []) skuTotals.set(c.sku, (skuTotals.get(c.sku) ?? 0) + c.qty)
  const summaryRows = [...skuTotals.entries()].map(([sku, qty]) => ({ sku, qty }))

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
      data: [...g.skus.entries()].map(([sku, qty]) => ({ sku, qty })).sort((a, b) => b.qty - a.qty),
    }))

  const { data: labels } = useQuery({
    queryKey: ['my-count-labels', sessionId, summaryRows.length],
    queryFn: () => getArticleLabels(sessionId, summaryRows.map((r) => r.sku)),
    enabled: summaryRows.length > 0,
  })

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

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  const empty = (
    <View style={styles.center}>
      <Text style={styles.emptyText}>Aucune pièce remontée pour l&apos;instant</Text>
    </View>
  )

  if (!usesZones) {
    return (
      <FlatList
        style={styles.safe}
        data={summaryRows}
        keyExtractor={(r) => r.sku}
        renderItem={({ item }) => renderArticle(item)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
        ListEmptyComponent={empty}
      />
    )
  }

  return (
    <FlatList
      style={styles.safe}
      data={sections}
      keyExtractor={(s) => s.code}
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
            {open && item.data.map((a) => (
              <View key={a.sku} style={styles.articleUnderBalise}>{renderArticle(a)}</View>
            ))}
          </View>
        )
      }}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
      ListEmptyComponent={empty}
    />
  )
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
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
  })
