import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyCountTotals, leaveSession } from '@/lib/queries'
import { getSession } from '@/lib/offlineSync'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { AUDIT_COLOR, AUDIT_ON } from '@/constants/colors'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { IDLE_ACTIVITY, useSessionPresence } from '@/lib/presence'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useNotificationsSurInventaire } from '@/lib/push'
import { useRepere } from '@/lib/reperes'
import { useAuth } from '@/lib/auth'
import { baliseSummary } from '@/components/OfflineBanner'

export default function EmployeeProgressScreen() {
  // Les notifications se demandent ici : ouvrir un inventaire est le geste
  // qui leur donne un objet.
  useNotificationsSurInventaire()
  // Rien n'expliquait la différence entre les deux passages à un
  // saisonnier. Deux lignes sous les boutons, tant qu'il n'a rien compté :
  // l'information est à côté du geste, jamais dans une modale.
  const { profile } = useAuth()
  // ⚠️ `marquerVu` était laissé de côté : les deux lignes restaient donc
  // affichées pour toujours. Elles s'effacent au premier « Compter » —
  // la personne a lu, elle agit, l'explication a fait son travail.
  const { aVoir: expliquer, marquerVu: expliqueVu } = useRepere('compter-auditer', profile?.id)
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

  // Comptage (étape 1) et audit (étape 2) — additionnés **sur le serveur**,
  // et pour cette personne seulement. La requête d'avant ne filtrait pas sur
  // l'utilisateur : elle s'en remettait à la sécurité en base, qui rend ses
  // propres lignes à un compteur mais **toute l'équipe** à un superviseur —
  // présentées ici comme son travail à lui.
  const { data: mesTotaux, isLoading: countsLoading } = useQuery({
    queryKey: ['my-count-totals', sessionId],
    queryFn: () => getMyCountTotals(sessionId),
    enabled: !!session,
  })

  // Ce que ce téléphone retient encore. Visible ici pour tout le monde : c'est
  // l'écran qu'on consulte avant de partir, et « ai-je tout remonté ? » est la
  // question qu'on s'y pose.
  const queue = useOfflineQueue(sessionId)

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
    // Partir avec des balises non remontées, c'est perdre le comptage : on le
    // dit avant, pas après.
    const warning = queue.pending > 0
      ? `\n\nAttention : ${queue.pending} balise${queue.pending > 1 ? 's' : ''} (${baliseSummary(queue.balises, 5)}) n'${queue.pending > 1 ? 'ont' : 'a'} pas encore été remontée${queue.pending > 1 ? 's' : ''}. Retrouvez du réseau avant de quitter.`
      : ''
    Alert.alert(
      "Quitter l'inventaire",
      `Vous ne verrez plus cet inventaire. Vos comptages et audits déjà saisis restent enregistrés pour l'équipe.${warning}`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => leaveMutation.mutate() },
      ],
    )
  }

  const countedPieces = mesTotaux?.counted ?? 0
  const auditedPieces = mesTotaux?.audited ?? 0
  const isLoading = sessionLoading || countsLoading

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            {session && (
              <View style={styles.header}>
                <Text style={styles.inventoryNumber}>{session.inventory_number}</Text>
                <Text style={styles.storeName}>{session.store_name}</Text>
                <Text style={styles.summaryLine}>
                  {countedPieces} pièce{countedPieces > 1 ? 's' : ''} comptée{countedPieces > 1 ? 's' : ''} · {auditedPieces} auditée{auditedPieces > 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {queue.pending > 0 && (
              <Pressable
                style={styles.pendingRow}
                onPress={() => router.push(`/(employee)/${sessionId}/pending`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingTitle}>
                    {queue.pending} balise{queue.pending > 1 ? 's' : ''} en attente d&apos;envoi
                  </Text>
                  <Text style={styles.pendingCodes}>{baliseSummary(queue.balises)}</Text>
                  <Text style={styles.pendingHint}>
                    {queue.syncing ? 'Envoi en cours…' : 'Envoi automatique au retour du réseau'}
                  </Text>
                </View>
                <Chevron color={theme.warning} />
              </Pressable>
            )}

            <Pressable
              style={styles.navRow}
              onPress={() => router.push(`/(employee)/${sessionId}/counted`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.navTitle}>Balises comptées</Text>
                <Text style={styles.navHint}>Le détail de ce qui est arrivé sur le serveur</Text>
              </View>
              <Chevron color={theme.textMuted} />
            </Pressable>
          </ScrollView>

          {session && session.status !== 'closed' && (
            <View style={styles.footer}>
              <Pressable style={styles.countBtn} onPress={() => { expliqueVu(); router.push(`/(employee)/${sessionId}/scan?mode=count`) }}>
                <Text style={styles.countBtnText}>Compter des articles</Text>
              </Pressable>
              {expliquer && (
                <Text style={styles.aide}>
                  Premier passage : vous scannez une balise, puis les articles du rayon.
                </Text>
              )}
              <Pressable style={styles.auditBtn} onPress={() => { expliqueVu(); router.push(`/(employee)/${sessionId}/scan?mode=audit`) }}>
                <Text style={styles.auditBtnText}>Auditer des articles</Text>
              </Pressable>
              {expliquer && (
                <Text style={styles.aide}>
                  Second passage, pour vérifier un rayon déjà compté. Votre superviseur vous dira quand.
                </Text>
              )}
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

function Chevron({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    content: { paddingBottom: Spacing.lg },
    header: { backgroundColor: t.surface, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: t.hairline, gap: 4 },
    inventoryNumber: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, ...tabular },
    storeName: { fontSize: 14, color: t.textSecondary, fontFamily: Font.medium },
    summaryLine: { fontSize: 13, color: t.textMuted, fontFamily: Font.medium, marginTop: Spacing.xs, ...tabular },
    pendingRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: t.warningSoft, borderColor: t.warning, borderWidth: 1,
      borderRadius: Radius.lg, padding: Spacing.lg,
      marginHorizontal: Spacing.lg, marginTop: Spacing.lg,
    },
    pendingTitle: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    pendingCodes: { fontSize: 13, fontFamily: Font.bold, color: t.textPrimary, marginTop: 2, ...tabular },
    pendingHint: { fontSize: 12, fontFamily: Font.medium, color: t.textSecondary, marginTop: 2 },
    navRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg,
      borderWidth: 1, borderColor: t.hairline,
      marginHorizontal: Spacing.lg, marginTop: Spacing.md, ...t.shadowCard,
    },
    navTitle: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    navHint: { fontSize: 13, color: t.textSecondary, fontFamily: Font.medium, marginTop: 2 },
    footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg, gap: Spacing.sm, borderTopWidth: 1, borderTopColor: t.hairline, backgroundColor: t.background },
    countBtn: { backgroundColor: t.accent, borderRadius: Radius.lg, paddingVertical: Spacing.lg, alignItems: 'center', ...t.shadowElevated },
    countBtnText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
    auditBtn: { backgroundColor: AUDIT_COLOR, borderRadius: Radius.lg, paddingVertical: Spacing.lg, alignItems: 'center', ...t.shadowElevated },
    auditBtnText: { color: AUDIT_ON, fontSize: 16, fontFamily: Font.bold },
    aide: { color: t.textSecondary, fontSize: 12.5, fontFamily: Font.regular, textAlign: 'center', lineHeight: 17, marginTop: Spacing.xs, marginBottom: Spacing.sm, paddingHorizontal: Spacing.sm },
    leaveBtn: { paddingVertical: Spacing.md, alignItems: 'center' },
    leaveBtnText: { color: t.danger, fontSize: 14, fontFamily: Font.semibold },
  })
}
