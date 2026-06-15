import { useCallback } from 'react'
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { advancePass, closeSession, getSession, getSessionCounts, getSessionMembers } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { passLabel } from '@/constants/colors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

const STATUS_LABELS: Record<string, string> = { open: 'Ouverte', counting: 'En cours', closed: 'Clôturée' }

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const queryClient = useQueryClient()
  const theme = useTheme()
  const styles = makeStyles(theme)

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
      Alert.alert('Étape avancée', `La session est maintenant en ${passLabel(result.current_pass ?? 1)}.`)
    },
  })

  const closeMutation = useMutation({
    mutationFn: () => closeSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      Alert.alert('Session supprimée', 'L\'inventaire et toutes ses données ont été supprimés.')
      router.replace('/(supervisor)/')
    },
    onError: (e) => {
      Alert.alert('Erreur', errorMessage(e))
    },
  })

  const onRefresh = useCallback(() => { refetch() }, [refetch])

  function confirmAdvance() {
    Alert.alert(
      'Avancer l\'étape',
      `Démarrer le ${passLabel((session?.current_pass ?? 0) + 1).toLowerCase()} ? Les membres de l'équipe devront recompter.`,
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Confirmer', onPress: () => advanceMutation.mutate() }]
    )
  }

  function confirmClose() {
    Alert.alert(
      '⚠️ Clôturer l\'inventaire',
      'Cette action va supprimer définitivement :\n\n• Tous les comptages\n• Le stock théorique\n• Les audits & écarts\n• Les membres de la session\n\nLe référentiel articles (catalogue) est conservé.\n\nCette action est IRRÉVERSIBLE.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Dernière confirmation',
              `Supprimer l'inventaire "${session?.inventory_number}" et toutes ses données ?`,
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Oui, supprimer', style: 'destructive', onPress: () => closeMutation.mutate() },
              ]
            )
          },
        },
      ]
    )
  }

  async function shareCredentials() {
    try {
      await Share.share({
        message: `Inventaire : ${session?.inventory_number}\nCode de sécurité : ${session?.security_code ?? '—'}\nMagasin : ${session?.store_name}`,
      })
    } catch { /* user dismissed */ }
  }

  async function copyField(label: string, value: string) {
    try {
      await Share.share({ message: value })
    } catch { /* user dismissed */ }
    Alert.alert(`${label} copié`, value, [{ text: 'OK' }])
  }

  if (isLoading || !session) {
    return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
  }

  const passCountMap: Record<number, number> = {}
  for (const c of counts ?? []) {
    passCountMap[c.pass_number] = (passCountMap[c.pass_number] ?? 0) + 1
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
      >
        {/* Credentials card */}
        <View style={styles.credCard}>
          <View style={styles.credHeader}>
            <Text style={styles.storeName}>{session.store_name}</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusBadgeDot} />
              <Text style={styles.statusBadgeText}>{STATUS_LABELS[session.status]}</Text>
            </View>
          </View>

          <CredRow
            styles={styles}
            label="N° d'inventaire"
            value={session.inventory_number}
            onCopy={() => copyField("N° d'inventaire", session.inventory_number)}
          />
          <CredRow
            styles={styles}
            label="Code de sécurité"
            value={session.security_code ?? '—'}
            secret
            onCopy={() => copyField('Code de sécurité', session.security_code ?? '')}
          />

          <Pressable style={styles.shareBtn} onPress={shareCredentials}>
            <Text style={styles.shareBtnText}>Partager les identifiants</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Comptages par étape</Text>
        {[1, 2, 3].map(p => (
          <View key={p} style={styles.passRow}>
            <View style={[styles.passDot, { backgroundColor: theme.passColors[p as 1 | 2 | 3] }]} />
            <Text style={styles.passLabel}>{passLabel(p)}</Text>
            {session.current_pass === p && (
              <View style={styles.passCurrentBadge}><Text style={styles.passCurrentText}>En cours</Text></View>
            )}
            <Text style={styles.passCount}>{passCountMap[p] ?? 0} scan{(passCountMap[p] ?? 0) > 1 ? 's' : ''}</Text>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Membres ({members?.length ?? 0})</Text>
        {members?.map(m => (
          <View key={m.user_id} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>
                {((m as unknown as { profiles: { full_name: string } }).profiles?.full_name ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.memberName}>{(m as unknown as { profiles: { full_name: string } }).profiles?.full_name ?? 'Inconnu'}</Text>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Actions</Text>
        <View style={styles.actions}>
          {session.status !== 'closed' && (
            <>
              <Pressable
                style={[styles.actionBtn, styles.actionSecondary]}
                onPress={() => router.push(`/(supervisor)/${sessionId}/import`)}
              >
                <Text style={styles.actionSecondaryText}>Importer les données</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={() => router.push(`/(supervisor)/${sessionId}/scan`)}
              >
                <Text style={styles.actionPrimaryText}>Scanner des articles</Text>
              </Pressable>

              {session.current_pass < 3 && (
                <Pressable
                  style={[styles.actionBtn, styles.actionSuccess]}
                  onPress={confirmAdvance}
                  disabled={advanceMutation.isPending}
                >
                  <Text style={styles.actionSuccessText}>Passer en {passLabel(session.current_pass + 1)}</Text>
                </Pressable>
              )}
            </>
          )}

          <Pressable
            style={[styles.actionBtn, styles.actionWarning]}
            onPress={() => router.push(`/(supervisor)/${sessionId}/audits`)}
          >
            <Text style={styles.actionWarningText}>Audits & écarts de comptage</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, styles.actionSecondary]}
            onPress={() => router.push(`/(supervisor)/${sessionId}/results`)}
          >
            <Text style={styles.actionSecondaryText}>Résultats & rapport Excel</Text>
          </Pressable>

          {session.status !== 'closed' && (
            <Pressable
              style={[styles.actionBtn, styles.actionDanger]}
              onPress={confirmClose}
              disabled={closeMutation.isPending}
            >
              <Text style={styles.actionDangerText}>Clôturer l'inventaire</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function CredRow({ label, value, secret, onCopy, styles }: { label: string; value: string; secret?: boolean; onCopy: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.credRow}>
      <View style={styles.credRowLeft}>
        <Text style={styles.credLabel}>{label}</Text>
        <Text style={[styles.credValue, secret && styles.credValueSecret]} selectable>
          {value}
        </Text>
      </View>
      <Pressable style={styles.copyBtn} onPress={onCopy}>
        <Text style={styles.copyBtnText}>Copier</Text>
      </Pressable>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.lg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background },

    credCard: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: 18, borderWidth: 1, borderColor: t.hairline, gap: Spacing.md, ...t.shadowCard },
    credHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    storeName: { fontSize: 17, fontFamily: Font.bold, color: t.textPrimary, flex: 1, letterSpacing: -0.3 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.successSoft, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    statusBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.success },
    statusBadgeText: { fontSize: 11, fontFamily: Font.semibold, color: t.success },
    credRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: t.hairline, gap: Spacing.md },
    credRowLeft: { flex: 1, gap: 3 },
    credLabel: { fontSize: 10, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    credValue: { fontSize: 18, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: 0.5, ...tabular },
    credValueSecret: { color: t.accent, letterSpacing: 2 },
    copyBtn: { backgroundColor: t.accent, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 8 },
    copyBtnText: { color: t.onAccent, fontSize: 13, fontFamily: Font.semibold },
    shareBtn: { backgroundColor: t.accentSoft, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
    shareBtnText: { color: t.accent, fontSize: 14, fontFamily: Font.semibold },

    sectionLabel: { fontSize: 11, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.xs, marginLeft: 2 },
    passRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: Radius.md, padding: 13, borderWidth: 1, borderColor: t.hairline, gap: Spacing.md, ...t.shadowCard },
    passDot: { width: 10, height: 10, borderRadius: 5 },
    passLabel: { flex: 1, fontSize: 14, color: t.textPrimary, fontFamily: Font.semibold },
    passCurrentBadge: { backgroundColor: t.accentSoft, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
    passCurrentText: { fontSize: 11, fontFamily: Font.semibold, color: t.accent },
    passCount: { fontSize: 14, color: t.textSecondary, fontFamily: Font.medium, ...tabular },

    memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    memberAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },
    memberAvatarText: { fontSize: 13, fontFamily: Font.bold, color: t.accent },
    memberName: { fontSize: 14, color: t.textPrimary, fontFamily: Font.medium },

    actions: { gap: Spacing.md, marginTop: Spacing.xs },
    actionBtn: { borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center' },
    actionPrimary: { backgroundColor: t.accent, ...t.shadowButton },
    actionPrimaryText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },
    actionSuccess: { backgroundColor: t.success },
    actionSuccessText: { color: '#fff', fontSize: 15, fontFamily: Font.bold },
    actionWarning: { backgroundColor: t.warningSoft },
    actionWarningText: { color: t.warning, fontSize: 15, fontFamily: Font.bold },
    actionSecondary: { backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong, ...t.shadowCard },
    actionSecondaryText: { color: t.textPrimary, fontSize: 15, fontFamily: Font.semibold },
    actionDanger: { backgroundColor: t.dangerSoft },
    actionDangerText: { color: t.danger, fontSize: 15, fontFamily: Font.bold },
  })
}
