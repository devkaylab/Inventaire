import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { getSessions } from '@/lib/queries'
import { Colors } from '@/constants/colors'
import type { Tables } from '@/types/database.types'

type Session = Tables<'inventory_sessions'>

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte',
  counting: 'En cours',
  closed: 'Clôturée',
}

const STATUS_COLORS: Record<string, string> = {
  open: Colors.secondary,
  counting: Colors.warning,
  closed: Colors.textMuted,
}

function SessionCard({ session }: { session: Session }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/(supervisor)/${session.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.inventoryNumber}>{session.inventory_number}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[session.status] + '20' }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLORS[session.status] }]}>
            {STATUS_LABELS[session.status] ?? session.status}
          </Text>
        </View>
      </View>
      <Text style={styles.storeName}>{session.store_name}</Text>
      <Text style={styles.meta}>
        Passe {session.current_pass} · {new Date(session.created_at).toLocaleDateString('fr-FR')}
      </Text>
    </Pressable>
  )
}

export default function SupervisorHomeScreen() {
  const { signOut, profile } = useAuth()
  const { data: sessions, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
  })

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.welcome}>Bonjour, {profile?.full_name}</Text>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Déconnexion</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={s => s.id}
          renderItem={({ item }) => <SessionCard session={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  welcome: { fontSize: 14, color: Colors.textSecondary },
  signOut: { fontSize: 14, color: Colors.danger },
  list: { padding: 16, paddingBottom: 80, gap: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  inventoryNumber: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  storeName: { fontSize: 15, color: Colors.textPrimary, marginBottom: 4 },
  meta: { fontSize: 13, color: Colors.textMuted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
  fab: { position: 'absolute', bottom: 24, left: 24, right: 24, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
