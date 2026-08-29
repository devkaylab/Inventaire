import { useMemo } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { getZoneDashboard } from '@/lib/queries'
import type { ZoneDashboardRow } from '@/lib/queries'
import { CocheIcon } from '@/components/ui/Icones'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

type MissingGroup = { name: string; codes: string[] }

// Balises non comptées, regroupées par emplacement (name). Même logique que
// groupByName dans zones.tsx, mais filtrée sur les balises manquantes.
function groupMissing(rows: ZoneDashboardRow[]): MissingGroup[] {
  const map = new Map<string, MissingGroup>()
  for (const r of rows) {
    if (r.count_status === 'done') continue
    const name = r.name ?? 'Non affectées'
    const g = map.get(name) ?? { name, codes: [] }
    g.codes.push(r.code)
    map.set(name, g)
  }
  for (const g of map.values()) {
    g.codes.sort((a, b) => {
      const na = parseInt(a, 10), nb = parseInt(b, 10)
      return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb
    })
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export default function MissingBalisesScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const theme = useTheme()
  const styles = makeStyles(theme)

  const { data: rows, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['zone-dashboard', sessionId],
    queryFn: () => getZoneDashboard(sessionId),
  })

  const groups = useMemo(() => groupMissing(rows ?? []), [rows])
  const totalMissing = groups.reduce((sum, g) => sum + g.codes.length, 0)

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.textMuted} />}
      >
        {totalMissing === 0 ? (
          <View style={styles.doneCard}>
            <CocheIcon color={theme.success} size={18} />
            <Text style={styles.doneText}>Toutes les balises ont été comptées</Text>
          </View>
        ) : (
          <>
            <Text style={styles.intro}>
              {totalMissing} balise{totalMissing > 1 ? 's' : ''} n'{totalMissing > 1 ? 'ont' : 'a'} pas encore été comptée{totalMissing > 1 ? 's' : ''}.
              Rendez-vous aux emplacements ci-dessous.
            </Text>
            {groups.map((g) => (
              <View key={g.name} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.zoneName}>{g.name}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{g.codes.length}</Text>
                  </View>
                </View>
                <Text style={styles.codes}>{g.codes.join(' · ')}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.md },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background },

    intro: { fontSize: 14, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 20 },
    card: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, ...t.shadowCard },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
    zoneName: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, flex: 1 },
    countBadge: { backgroundColor: t.warningSoft, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
    countBadgeText: { fontSize: 13, fontFamily: Font.bold, color: t.warning, ...tabular },
    codes: { fontSize: 14, color: t.textSecondary, lineHeight: 22, fontFamily: Font.medium, ...tabular },

    // L'icône était un « ✓ » collé au texte : en rangée, elle reste devant
    // la phrase comme avant, au lieu de se poser au-dessus.
    doneCard: {
      backgroundColor: t.successSoft, borderRadius: Radius.lg, padding: Spacing.xl,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    },
    doneText: { fontSize: 15, fontFamily: Font.semibold, color: t.success },
  })
}
