import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { getSessions } from '@/lib/queries'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import type { Tables } from '@/types/database.types'

type Session = Tables<'inventory_sessions'>

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  counting: 'En cours',
  closed: 'Clôturée',
}

function statusColors(t: Theme): Record<string, { fg: string; bg: string }> {
  return {
    open: { fg: t.success, bg: t.successSoft },
    counting: { fg: t.warning, bg: t.warningSoft },
    closed: { fg: t.textMuted, bg: t.accentSoft },
  }
}

function SessionCard({ session, theme, styles }: { session: Session; theme: Theme; styles: ReturnType<typeof makeStyles> }) {
  const sc = statusColors(theme)[session.status] ?? { fg: theme.textMuted, bg: theme.accentSoft }
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/(supervisor)/${session.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.sessionName} numberOfLines={1}>{session.name || session.store_name}</Text>
        <View style={[styles.badge, { backgroundColor: sc.bg }]}>
          <View style={[styles.badgeDot, { backgroundColor: sc.fg }]} />
          <Text style={[styles.badgeText, { color: sc.fg }]}>
            {STATUS_LABELS[session.status] ?? session.status}
          </Text>
        </View>
      </View>
      <Text style={styles.storeName}>{session.store_name}</Text>
      <Text style={styles.meta}>
        {session.inventory_number} · {new Date(session.created_at).toLocaleDateString('fr-FR')}
      </Text>
    </Pressable>
  )
}

export default function SupervisorHomeScreen() {
  const { profile } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { data: sessions, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
  })

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  // Inventaires en cours (partagés) regroupés par magasin — accessibles à tous les
  // superviseurs affectés au magasin.
  const active = (sessions ?? []).filter(s => s.status !== 'closed')

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={s => s.id}
          renderItem={({ item }) => <SessionCard session={item} theme={theme} styles={styles} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.greeting}>Bonjour, <Text style={styles.greetingName}>{profile?.full_name}</Text></Text>

              {active.length > 0 && (
                <View style={styles.liveBlock}>
                  <Text style={styles.sectionLabel}>En cours</Text>
                  {active.map(s => (
                    <Pressable key={s.id} style={styles.liveCard} onPress={() => router.push(`/(supervisor)/${s.id}`)}>
                      <View style={styles.liveHead}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveLabel}>Inventaire en cours</Text>
                      </View>
                      <Text style={styles.liveStore}>{s.name || s.inventory_number}</Text>
                      <Text style={styles.liveMeta}>
                        {s.store_name} · {STATUS_LABELS[s.status] ?? s.status}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.sectionLabel}>Sessions</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Aucune session d'inventaire</Text>
            </View>
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/(supervisor)/new-session')}>
        <Text style={styles.fabText}>+ Nouvelle session</Text>
      </Pressable>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    listHeader: { gap: Spacing.sm },
    greeting: { fontSize: 26, color: t.textSecondary, fontFamily: Font.regular, letterSpacing: -0.4 },
    liveBlock: { gap: Spacing.sm, marginTop: Spacing.sm },
    liveCard: {
      backgroundColor: t.accentSoft, borderRadius: Radius.lg, padding: 18,
      borderWidth: 1, borderColor: t.accent, gap: 4,
    },
    liveHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent },
    liveLabel: { fontSize: 11, fontFamily: Font.bold, color: t.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
    liveStore: { fontSize: 17, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.3 },
    liveMeta: { fontSize: 13, color: t.textSecondary, fontFamily: Font.medium, ...tabular },
    greetingName: { color: t.textPrimary, fontFamily: Font.bold },
    sectionLabel: { fontSize: 12, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
    list: { padding: Spacing.lg, paddingBottom: 90, gap: Spacing.md },
    card: {
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: 18,
      borderWidth: 1, borderColor: t.hairline, gap: Spacing.xs, ...t.shadowCard,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sessionName: { flex: 1, fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2, marginRight: Spacing.sm },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4,
    },
    badgeDot: { width: 7, height: 7, borderRadius: 4 },
    badgeText: { fontSize: 11, fontFamily: Font.semibold },
    storeName: { fontSize: 15, color: t.textPrimary, fontFamily: Font.medium },
    meta: { fontSize: 12, color: t.textMuted, ...tabular },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyText: { color: t.textMuted, fontSize: 15, fontFamily: Font.regular },
    fab: {
      position: 'absolute', bottom: Spacing.xxl, left: Spacing.xxl, right: Spacing.xxl,
      backgroundColor: t.accent, borderRadius: Radius.lg, paddingVertical: Spacing.lg,
      alignItems: 'center', ...t.shadowElevated,
    },
    fabText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },
  })
}
