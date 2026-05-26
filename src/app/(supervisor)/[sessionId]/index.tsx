import { useCallback } from 'react'
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { advancePass, closeSession, getSession, getSessionCounts, getSessionMembers } from '@/lib/queries'
import { Colors } from '@/constants/colors'

const STATUS_LABELS: Record<string, string> = { open: 'Ouverte', counting: 'En cours', closed: 'Clôturée' }

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const queryClient = useQueryClient()

  const { data: session, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })
  const { data: members } = useQuery({
    queryKey: ['session-members', sessionId],
    queryFn: () => getSessionMembers(sessionId),
  })
  const { data: counts } = useQuery({
    queryKey: ['session-counts', sessionId],
    queryFn: () => getSessionCounts(sessionId),
  })

  const advanceMutation = useMutation({
    mutationFn: () => advancePass(sessionId),
    onSuccess: async (result) => {
      if (!result.success) {
        Alert.alert('Erreur', result.error ?? 'Impossible d\'avancer la passe.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      Alert.alert('Passe avancée', `La session est maintenant à la passe ${result.current_pass}.`)
    },
  })

  const closeMutation = useMutation({
    mutationFn: () => closeSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      Alert.alert('Session clôturée', 'L\'inventaire a été clôturé.')
    },
  })

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  function confirmAdvance() {
    Alert.alert(
      'Avancer la passe',
      `Démarrer la passe ${(session?.current_pass ?? 0) + 1} ? Les membres de l'équipe devront recompter.`,
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Confirmer', onPress: () => advanceMutation.mutate() }]
    )
  }

  function confirmClose() {
    Alert.alert(
      'Clôturer l\'inventaire',
      'Cette action est irréversible. Confirmer la clôture ?',
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Clôturer', style: 'destructive', onPress: () => closeMutation.mutate() }]
    )
  }

  if (isLoading || !session) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
  }

  const passCountMap: Record<number, number> = {}
  for (const c of counts ?? []) {
    passCountMap[c.pass_number] = (passCountMap[c.pass_number] ?? 0) + 1
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
      >
        <View style={styles.card}>
          <Text style={styles.inventoryNumber}>{session.inventory_number}</Text>
          <Text style={styles.storeName}>{session.store_name}</Text>
          <View style={styles.row}>
            <Text style={styles.meta}>Statut : <Text style={{ color: Colors.primary }}>{STATUS_LABELS[session.status]}</Text></Text>
            <Text style={styles.meta}>Passe actuelle : {session.current_pass}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Comptages par passe</Text>
        {[1, 2, 3].map(p => (
          <View key={p} style={styles.passRow}>
            <View style={[styles.passDot, { backgroundColor: Object.values(Colors.passColors)[p - 1] }]} />
            <Text style={styles.passLabel}>Passe {p}</Text>
            <Text style={styles.passCount}>{passCountMap[p] ?? 0} scan(s)</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Membres ({members?.length ?? 0})</Text>
        {members?.map(m => (
          <View key={m.user_id} style={styles.memberRow}>
            <Text style={styles.memberName}>{(m as unknown as { profiles: { full_name: string } }).profiles?.full_name ?? 'Inconnu'}</Text>
          </View>
        ))}

        {session.status !== 'closed' && (
          <View style={styles.actions}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => router.push(`/(supervisor)/${sessionId}/scan`)}
            >
              <Text style={styles.actionBtnText}>Scanner des articles</Text>
            </Pressable>

            <Pressable
              style={styles.actionBtn}
              onPress={() => router.push(`/(supervisor)/${sessionId}/import`)}
            >
              <Text style={styles.actionBtnText}>Importer les données</Text>
            </Pressable>

            {session.current_pass < 3 && (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: Colors.secondary }]}
                onPress={confirmAdvance}
                disabled={advanceMutation.isPending}
              >
                <Text style={styles.actionBtnText}>Avancer à la passe {session.current_pass + 1}</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.actionBtn, { backgroundColor: Colors.danger }]}
              onPress={confirmClose}
              disabled={closeMutation.isPending}
            >
              <Text style={styles.actionBtnText}>Clôturer l'inventaire</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  inventoryNumber: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  storeName: { fontSize: 16, color: Colors.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  meta: { fontSize: 13, color: Colors.textMuted },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  passRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  passDot: { width: 10, height: 10, borderRadius: 5 },
  passLabel: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  passCount: { fontSize: 14, color: Colors.textSecondary },
  memberRow: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  memberName: { fontSize: 14, color: Colors.textPrimary },
  actions: { gap: 10, marginTop: 8 },
  actionBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
