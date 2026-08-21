import { useCallback, useMemo } from 'react'
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

type Row =
  | { kind: 'header'; label: string; hint?: string }
  | { kind: 'session'; session: Session }

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

  /**
   * Deux listes, pas une : ce qu'on a créé, et ce à quoi on a été invité.
   *
   * L'écran mélangeait les deux, et affichait en plus les inventaires en cours
   * une seconde fois dans un bloc « En cours » — le statut étant déjà sur
   * chaque tuile, la répétition n'apprenait rien. Un inventaire invité ne se
   * rouvre pas et ne se supprime pas : le dire par la mise en page évite de le
   * découvrir au moment du refus. Même découpage que le site.
   */
  const rows = useMemo<Row[]>(() => {
    const all = sessions ?? []
    const rang = (s: Session) => (s.status === 'closed' ? 1 : 0)
    const trier = (list: Session[]) => [...list].sort((a, b) => rang(a) - rang(b))
    const miens = trier(all.filter(s => s.created_by === profile?.id))
    const invites = trier(all.filter(s => s.created_by !== profile?.id))

    const out: Row[] = []
    if (miens.length > 0) {
      out.push({ kind: 'header', label: 'Mes inventaires' })
      for (const s of miens) out.push({ kind: 'session', session: s })
    }
    if (invites.length > 0) {
      out.push({
        kind: 'header',
        label: 'Inventaires invités',
        hint: 'Vous y participez sans les avoir créés : vous pouvez compter et consulter le rapport, leur clôture définitive et leur réouverture appartiennent à leur créateur.',
      })
      for (const s of invites) out.push({ kind: 'session', session: s })
    }
    return out
  }, [sessions, profile?.id])

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => (r.kind === 'header' ? `h-${r.label}` : r.session.id)}
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>{item.label}</Text>
                {!!item.hint && <Text style={styles.sectionHint}>{item.hint}</Text>}
              </View>
            ) : (
              <SessionCard session={item.session} theme={theme} styles={styles} />
            )
          }
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.greeting}>Bonjour, <Text style={styles.greetingName}>{profile?.full_name}</Text></Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Aucun inventaire pour l&apos;instant</Text>
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
    sectionBlock: { gap: 4, marginTop: Spacing.md },
    sectionHint: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular, lineHeight: 17 },
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
