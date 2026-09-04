import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useEffect, useState } from 'react'
import Svg, { Path } from 'react-native-svg'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { leaveSession } from '@/lib/queries'
import { getMyCountTotals, getSession, isOffline } from '@/lib/offlineSync'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { AUDIT_COLOR, AUDIT_ON } from '@/constants/colors'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { IDLE_ACTIVITY, useSessionPresence } from '@/lib/presence'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useRepere } from '@/lib/reperes'
import { useAuth } from '@/lib/auth'
import { baliseSummary } from '@/components/OfflineBanner'
import { Astuce, Fort } from '@/components/Astuce'
import { demander, signaler } from '@/lib/dialogue'
import { nb } from '@/lib/nombres'

export default function EmployeeProgressScreen() {
  // Les notifications se demandent ici : ouvrir un inventaire est le geste
  // qui leur donne un objet.
  // ⚠️ La demande de notifications a quitté cet écran : elle est amorcée sur
  // la liste des inventaires, par une carte qui dit ce qu'on recevra. Ouvrir
  // la boîte iOS ici la posait sans un mot — et un refus est définitif.
  // Rien n'expliquait la différence entre les deux passages à un
  // saisonnier. Deux lignes sous les boutons, tant qu'il n'a rien compté :
  // l'information est à côté du geste, jamais dans une modale.
  const { profile } = useAuth()
  // ⚠️ `marquerVu` était laissé de côté : les deux lignes restaient donc
  // affichées pour toujours. Elles s'effacent au premier « Compter » —
  // la personne a lu, elle agit, l'explication a fait son travail.
  const { aVoir: expliquer, marquerVu: expliqueVu } = useRepere('compter-auditer', profile?.id)
  // ⚠️ Il ne se montre QUE lorsqu'une balise est réellement en attente. Tant
  // que tout remonte, il n'y a rien à expliquer — et une explication donnée
  // avant le problème n'est pas lue.
  const { aVoir: expliquerFile, marquerVu: fileVue } = useRepere('file-attente', profile?.id)
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
  const { data: mesTotaux } = useQuery({
    queryKey: ['my-count-totals', sessionId],
    queryFn: () => getMyCountTotals(sessionId),
    enabled: !!session,
  })

  // Ce que ce téléphone retient encore. Visible ici pour tout le monde : c'est
  // l'écran qu'on consulte avant de partir, et « ai-je tout remonté ? » est la
  // question qu'on s'y pose.
  const queue = useOfflineQueue(sessionId)
  const horsLigne = isOffline()
  /**
   * « Aucune balise en attente » ne s'affiche qu'après une attente.
   *
   * ⚠️ Demande de Julien, et elle corrige une erreur de dosage de ma part : ce
   * message n'a de sens que comme **résolution**. Affiché en permanence, il
   * annonce un non-événement à quelqu'un qui n'a jamais rien vu attendre — du
   * bruit vert en haut de l'écran, tous les jours.
   *
   * Le verrou se met quand la file se remplit et ne se relâche pas : on voit
   * l'encart ambre, il disparaît, la ligne verte confirme. C'est la séquence
   * entière qui informe, pas la ligne seule — et le libellé est le miroir
   * exact de l'encart qu'il remplace.
   */
  const [attenteVue, setAttenteVue] = useState(false)
  useEffect(() => { if (queue.pending > 0) setAttenteVue(true) }, [queue.pending])

  const queryClient = useQueryClient()
  const leaveMutation = useMutation({
    mutationFn: () => leaveSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      signaler.succes('Inventaire quitté', 'Vous avez quitté cet inventaire. Vos comptages restent enregistrés.')
      if (router.canGoBack()) router.back()
      else router.replace('/(employee)/')
    },
    onError: (e) => { signaler.erreur('Erreur', errorMessage(e)) },
  })

  function confirmLeave() {
    // Partir avec des balises non remontées, c'est perdre le comptage : on le
    // dit avant, pas après.
    const warning = queue.pending > 0
      ? `\n\nAttention : ${queue.pending} balise${queue.pending > 1 ? 's' : ''} (${baliseSummary(queue.balises, 5)}) n'${queue.pending > 1 ? 'ont' : 'a'} pas encore été remontée${queue.pending > 1 ? 's' : ''}. Retrouvez du réseau avant de quitter.`
      : ''
    void demander({
      titre: 'Quitter l’inventaire ?',
      texte: `Vous ne verrez plus cet inventaire. Vos comptages et audits déjà saisis restent enregistrés pour l'équipe.${warning}`,
      action: 'Quitter',
      ton: 'danger',
    }).then((ok) => { if (ok) leaveMutation.mutate() })
  }

  const totaux = mesTotaux ?? null
  const countedPieces = totaux?.counted ?? 0
  const auditedPieces = totaux?.audited ?? 0

  /**
   * ⚠️ SEULE LA FICHE DE L'INVENTAIRE RETIENT L'ÉCRAN, ET ELLE VIENT DU CACHE.
   *
   * Les totaux du serveur attendaient ici aussi : hors ligne leur requête
   * échoue, React Query la rejoue, et l'écran entier restait derrière — avec
   * le bouton « Compter des articles », qui est justement ce qu'on vient
   * chercher en réserve. Constat de Julien, 4 septembre 2026. Un chiffre
   * d'affichage ne bloque pas un geste.
   */
  const isLoading = sessionLoading

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
                {/* ⚠️ Sans totaux connus, « — » et jamais « 0 » : annoncer
                    zéro pièce à quelqu'un qui vient d'en compter cent est le
                    genre de chiffre qu'on croit. */}
                <Text style={styles.summaryLine}>
                  {totaux
                    ? `${nb(countedPieces)} pièce${countedPieces > 1 ? 's' : ''} comptée${countedPieces > 1 ? 's' : ''} · ${nb(auditedPieces)} auditée${auditedPieces > 1 ? 's' : ''}`
                    : '— pièce comptée · — auditée'}
                </Text>
                {totaux && horsLigne && (
                  <Text style={styles.summaryDate}>
                    Au dernier passage du réseau. Ce qui attend sur ce téléphone n&apos;y est pas encore.
                  </Text>
                )}
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

            {/* C1 — la seule question qui compte avant de quitter le magasin.
                Les deux écrans existent depuis toujours ; leur différence
                n'était écrite nulle part. */}
            {queue.pending > 0 && expliquerFile && (
              <View style={styles.astuceEncart}>
                <Astuce titre="Deux listes, et la différence compte" onCompris={fileVue}>
                  <Fort>Balises comptées</Fort> vient du serveur&nbsp;: ce travail est sauvé, même si
                  vous perdez le téléphone. <Fort>En attente</Fort> est encore ici, sur cet
                  appareil. Retrouvez du réseau avant de partir&nbsp;; l&apos;envoi se fait tout seul.
                </Astuce>
              </View>
            )}

            {/* C2 — l'état inverse, et c'est lui qui rend l'autre lisible :
                sans un « tout est remonté » franc, « en attente » ne se
                remarque jamais. Ce n'est pas un repère, il revient à chaque
                fois que la file se vide. */}
            {queue.pending === 0 && attenteVue && (
              <View style={styles.astuceEncart}>
                {/* ⚠️ Une ligne, pas un paragraphe. C'est un état PERMANENT :
                    il se lit à chaque ouverture, donc il doit se lire d'un
                    coup d'œil. Le miroir exact de l'encart ambre d'en face
                    (« N balises en attente d'envoi ») — même mot, même
                    grammaire, la comparaison se fait sans y penser. */}
                <Astuce titre="Aucune balise en attente" ton="succes" />
              </View>
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
    summaryDate: { fontSize: 12, color: t.textMuted, fontFamily: Font.medium, marginTop: 2 },
    pendingRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: t.warningSoft, borderColor: t.warning, borderWidth: 1,
      borderRadius: Radius.lg, padding: Spacing.lg,
      marginHorizontal: Spacing.lg, marginTop: Spacing.lg,
    },
    pendingTitle: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    pendingCodes: { fontSize: 13, fontFamily: Font.bold, color: t.textPrimary, marginTop: 2, ...tabular },
    pendingHint: { fontSize: 12, fontFamily: Font.medium, color: t.textSecondary, marginTop: 2 },
    // Mêmes marges que `pendingRow` et `navRow` — l'astuce s'aligne sur les
    // cartes de l'écran, elle ne crée pas une seconde gouttière.
    astuceEncart: { marginHorizontal: Spacing.lg, marginTop: Spacing.md },
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
    leaveBtn: { paddingVertical: Spacing.md, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    leaveBtnText: { color: t.danger, fontSize: 14, fontFamily: Font.semibold },
  })
}
