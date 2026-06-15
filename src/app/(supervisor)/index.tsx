import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { getSessions } from '@/lib/queries'
import { passLabel } from '@/constants/colors'
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
        <Text style={styles.inventoryNumber}>{session.inventory_number}</Text>
        <View style={[styles.badge, { backgroundColor: sc.bg }]}>
          <View style={[styles.badgeDot, { backgroundColor: sc.fg }]} />
          <Text style={[styles.badgeText, { color: sc.fg }]}>
            {STATUS_LABELS[session.status] ?? session.status}
          </Text>
        </View>
      </View>
      <Text style={styles.storeName}>{session.store_name}</Text>
      <Text style={styles.meta}>
        {passLabel(session.current_pass)} · {new Date(session.created_at).toLocaleDateString('fr-FR')}
      </Text>
    </Pressable>
  )
}

export default function SupervisorHomeScreen() {
  const { signOut, profile } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { data: sessions, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
  })

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.welcome}>Bonjour, <Text style={styles.welcomeName}>{profile?.full_name}</Text></Text>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Déconnexion</Text>
        </Pressable>
      </View>

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
    topBar: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.hairline,
    },
    welcome: { fontSize: 14, color: t.textSecondary, fontFamily: Font.regular },
    welcomeName: { color: t.textPrimary, fontFamily: Font.semibold },
    signOut: { fontSize: 14, color: t.danger, fontFamily: Font.medium },
    list: { padding: Spacing.lg, paddingBottom: 90, gap: Spacing.md },
    card: {
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: 18,
      borderWidth: 1, borderColor: t.hairline, gap: Spacing.xs, ...t.shadowCard,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    inventoryNumber: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, ...tabular },
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
