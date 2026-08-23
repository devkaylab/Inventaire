import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Animated, Easing, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { closeSession, deleteSessionInvitation, deleteSessionPermanently, getSession, getSessionCountTotals, getSessionInvitations, getSessionMembers, getZoneDashboard, leaveSession, removeSessionMember, reopenSession } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { AUDIT_COLOR, AUDIT_ON } from '@/constants/colors'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { IDLE_ACTIVITY, useSessionPresence } from '@/lib/presence'
import { PendingBalisesRow } from '@/components/PendingBalisesRow'
import { useNotificationsSurInventaire } from '@/lib/push'
import { ChevronIcon, MenuCard, MenuRow, SectionLabel } from '@/components/ui/MenuList'

const STATUS_LABELS: Record<string, string> = { open: 'Ouverte', counting: 'En cours', closed: 'Clôturée' }

// Icônes SVG (pas d'emoji) ────────────────────────────────────────────────────
function InfoIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Circle cx={12} cy={6.5} r={1.6} fill={color} />
      <Rect x={10.6} y={10} width={2.8} height={8.5} rx={1.4} fill={color} />
    </Svg>
  )
}

// Bouton de rafraîchissement manuel : tourne pendant l'actualisation.
function RefreshGlyph({ spinning, onPress, theme }: { spinning: boolean; onPress: () => void; theme: Theme }) {
  const [spin] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (!spinning) return
    spin.setValue(0)
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    )
    loop.start()
    return () => loop.stop()
  }, [spinning, spin])
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const color = spinning ? theme.accent : theme.textMuted
  return (
    <Pressable onPress={onPress} hitSlop={12} disabled={spinning}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d="M20 11a8 8 0 1 0-2.3 5.6" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
          <Path d="M20 5v5h-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Animated.View>
    </Pressable>
  )
}

export default function SessionDetailScreen() {
  // Les notifications se demandent ici : ouvrir un inventaire est le geste
  // qui leur donne un objet.
  useNotificationsSurInventaire()
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [infoOpen, setInfoOpen] = useState(false)
  const [pulling, setPulling] = useState(false)

  // Présence : le superviseur apparaît « en ligne » sur le tableau de bord web,
  // sans balise puisqu'il ne scanne pas depuis cet écran.
  useSessionPresence(sessionId, IDLE_ACTIVITY)

  // Rafraîchissement MANUEL : le superviseur tape la flèche pour actualiser
  // (pas de sondage automatique → économe en batterie).
  const { data: session, isLoading, refetch } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })
  const live = !!session && session.status !== 'closed'
  const { data: members } = useQuery({
    queryKey: ['session-members', sessionId],
    queryFn: () => getSessionMembers(sessionId),
  })
  const { data: invitations } = useQuery({
    queryKey: ['session-invitations', sessionId],
    queryFn: () => getSessionInvitations(sessionId),
  })
  // Les totaux viennent du serveur : télécharger tous les comptages pour
  // additionner deux nombres coûtait des milliers de lignes par ouverture
  // d'écran, et un plafond de lignes côté API les aurait rabotés en silence.
  const { data: totaux, isFetching: countsFetching } = useQuery({
    queryKey: ['session-counts', sessionId],
    queryFn: () => getSessionCountTotals(sessionId),
  })
  const { data: zoneRows, isFetching: zonesFetching } = useQuery({
    queryKey: ['zone-dashboard', sessionId],
    queryFn: () => getZoneDashboard(sessionId),
    enabled: !!session?.uses_zones,
  })

  // Clôturer ≠ supprimer. La clôture arrête le comptage et conserve tout ;
  // la suppression efface définitivement.
  const closeMutation = useMutation({
    mutationFn: () => closeSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      await queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      Alert.alert(
        'Inventaire clôturé',
        'Plus aucun comptage ne peut y être enregistré. Les données sont conservées et le rapport reste disponible.',
      )
    },
    onError: (e) => { Alert.alert('Erreur', errorMessage(e)) },
  })

  const reopenMutation = useMutation({
    mutationFn: () => reopenSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      await queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      Alert.alert('Inventaire rouvert', 'Le comptage peut reprendre.')
    },
    onError: (e) => { Alert.alert('Erreur', errorMessage(e)) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSessionPermanently(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      Alert.alert('Inventaire supprimé', 'L\'inventaire et toutes ses données ont été supprimés.')
      if (router.canGoBack()) router.back()
      else router.replace('/(supervisor)/')
    },
    onError: (e) => { Alert.alert('Erreur', errorMessage(e)) },
  })

  const leaveMutation = useMutation({
    mutationFn: () => leaveSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      Alert.alert('Inventaire quitté', 'Vous avez quitté cet inventaire. Vos comptages restent enregistrés.')
      if (router.canGoBack()) router.back()
      else router.replace('/(supervisor)/')
    },
    onError: (e) => { Alert.alert('Erreur', errorMessage(e)) },
  })

  const refreshing = countsFetching || zonesFetching

  // Rafraîchit les données de progression (comptages + zones + session).
  const manualRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['session-counts', sessionId] }),
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] }),
      queryClient.invalidateQueries({ queryKey: ['zone-dashboard', sessionId] }),
    ])
  }, [queryClient, sessionId])

  // Rafraîchissement par « tirer » (pull) — même action que la flèche.
  const onRefresh = useCallback(async () => {
    setPulling(true)
    try { await Promise.all([refetch(), manualRefresh()]) } finally { setPulling(false) }
  }, [refetch, manualRefresh])

  const isCreator = !!profile?.id && session?.created_by === profile.id

  async function handleRemoveMember(userId: string, name: string) {
    Alert.alert('Retirer ce membre', `Retirer ${name} de l'inventaire ? Ses comptages déjà saisis sont conservés.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer', style: 'destructive', onPress: async () => {
          try {
            await removeSessionMember(sessionId, userId)
            await queryClient.invalidateQueries({ queryKey: ['session-members', sessionId] })
          } catch (e) { Alert.alert('Erreur', errorMessage(e)) }
        },
      },
    ])
  }

  async function handleDeleteInvite(id: string, label: string) {
    Alert.alert('Annuler l\'invitation', `Annuler l'invitation de ${label} ?`, [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Annuler l\'invitation', style: 'destructive', onPress: async () => {
          try {
            await deleteSessionInvitation(id)
            await queryClient.invalidateQueries({ queryKey: ['session-invitations', sessionId] })
          } catch (e) { Alert.alert('Erreur', errorMessage(e)) }
        },
      },
    ])
  }

  function confirmLeave() {
    Alert.alert(
      'Quitter l\'inventaire',
      'Vous ne verrez plus cet inventaire. Vos comptages et audits déjà saisis restent enregistrés pour l\'équipe.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => leaveMutation.mutate() },
      ],
    )
  }

  function confirmClose() {
    Alert.alert(
      "Clôturer l'inventaire",
      "L'inventaire passe en lecture seule : plus aucun comptage ne pourra y être enregistré, y compris depuis les téléphones encore ouverts sur la session.\n\nToutes les données sont conservées et le rapport reste disponible. Vous pourrez le rouvrir si besoin.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Clôturer', onPress: () => closeMutation.mutate() },
      ]
    )
  }

  function confirmReopen() {
    Alert.alert(
      "Rouvrir l'inventaire",
      'Le comptage pourra reprendre et le rapport évoluera de nouveau.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Rouvrir', onPress: () => reopenMutation.mutate() },
      ]
    )
  }

  function confirmDelete() {
    Alert.alert(
      'Supprimer définitivement',
      'Cette action va supprimer :\n\n• Tous les comptages\n• Le stock théorique\n• Les écarts d\'audit\n• Les membres de la session\n• Le référentiel articles de cet inventaire\n\nPensez à exporter le rapport avant.\n\nCette action est IRRÉVERSIBLE.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Dernière confirmation',
              `Supprimer l'inventaire "${session?.inventory_number}" et toutes ses données ?`,
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Oui, supprimer', style: 'destructive', onPress: () => deleteMutation.mutate() },
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
        message: `Inventaire : ${session?.inventory_number}\nCode inventaire : ${session?.security_code ?? '—'}\nMagasin : ${session?.store_name}`,
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

  // Pièces (unités) scannées par étape — pass 1 = comptage, pass 2 = audit.
  const countedPieces = totaux?.counted ?? 0
  const auditedPieces = totaux?.audited ?? 0

  const zones = zoneRows ?? []
  const zoneTotal = zones.length
  const zoneCounted = zones.filter((z) => z.count_status === 'done').length
  const zoneAudited = zones.filter((z) => z.audit_status === 'done').length
  const zoneMissing = zones.filter((z) => z.count_status !== 'done')
  // ⚠️ **« Manquantes » veut dire « pas encore comptées ».** Sur un inventaire
  // qui vient d'être préparé, cela vaut pour toutes : le bandeau ambre
  // annonçait donc « 10 balises manquantes » à la minute où les 10 venaient
  // d'être définies, et personne n'avait encore compté. Un superviseur qui
  // découvre l'app y lit une perte et part chercher ce qui manque. Même règle
  // que sur /admin le 22 août 2026 : un travail qui n'a pas commencé n'est pas
  // une anomalie. Le bandeau n'a de sens qu'une fois le comptage entamé.
  const comptageCommence = zoneCounted > 0
  const montrerManquantes = comptageCommence && zoneMissing.length > 0
  const toutCompte = comptageCommence && zoneMissing.length === 0
  const auditPct = zoneTotal > 0 ? Math.round((zoneAudited / zoneTotal) * 100) : 0
  const countPct = zoneTotal > 0 ? Math.round((zoneCounted / zoneTotal) * 100) : 0

  const closed = session.status === 'closed'
  const usesZones = !!session.uses_zones

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.textMuted} />}
      >
        {/* Slim info card — opens the info panel (identifiers, members, config) */}
        <Pressable style={styles.infoCard} onPress={() => setInfoOpen(true)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoStore}>{session.name || session.store_name}</Text>
            <Text style={styles.infoHint}>{session.store_name} · infos & configuration</Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusBadgeDot} />
            <Text style={styles.statusBadgeText}>{STATUS_LABELS[session.status]}</Text>
          </View>
          <View style={styles.infoBtn}><InfoIcon color={theme.accent} /></View>
        </Pressable>

        {/* Progression */}
        {usesZones ? (
          <View style={styles.progressBlock}>
            <SectionLabel>Progression</SectionLabel>
            <View style={styles.progressBigRow}>
              <Text style={styles.progressBig}>{countPct}%</Text>
              {live && <RefreshGlyph spinning={refreshing} onPress={manualRefresh} theme={theme} />}
            </View>
            <Text style={styles.progressSub}>{countPct}% des balises comptées</Text>
            <Text style={styles.progressSub}>{auditPct}% des balises auditées</Text>

            {zoneTotal === 0 ? (
              <Text style={styles.zoneEmpty}>Aucune balise affectée. Ouvrez « Zones & balises » depuis le panneau infos.</Text>
            ) : montrerManquantes ? (
              <Pressable style={styles.missingRow} onPress={() => router.push(`/(supervisor)/${sessionId}/missing`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.missingCount}>{zoneMissing.length} balise{zoneMissing.length > 1 ? 's' : ''} pas encore comptée{zoneMissing.length > 1 ? 's' : ''}</Text>
                  <Text style={styles.missingHint}>Voir les emplacements concernés</Text>
                </View>
                <ChevronIcon color={theme.warning} />
              </Pressable>
            ) : toutCompte ? (
              <View style={styles.missingDoneRow}>
                <Text style={styles.missingDone}>Toutes les balises ont été comptées</Text>
              </View>
            ) : (
              <Text style={styles.zoneEmpty}>
                {zoneTotal} balise{zoneTotal > 1 ? 's' : ''} prête{zoneTotal > 1 ? 's' : ''} à être comptée{zoneTotal > 1 ? 's' : ''}.
              </Text>
            )}

            <PendingBalisesRow sessionId={sessionId} target={`/(supervisor)/${sessionId}/pending`} />
          </View>
        ) : (
          <View style={styles.progressBlock}>
            <SectionLabel>Progression</SectionLabel>
            <View style={styles.progressBigRow}>
              <Text style={styles.progressBig}>{countedPieces}</Text>
              {live && <RefreshGlyph spinning={refreshing} onPress={manualRefresh} theme={theme} />}
            </View>
            <Text style={styles.progressSub}>pièce{countedPieces > 1 ? 's' : ''} scannée{countedPieces > 1 ? 's' : ''}</Text>
            <Text style={styles.progressSub}>{auditedPieces} pièce{auditedPieces > 1 ? 's' : ''} auditée{auditedPieces > 1 ? 's' : ''}</Text>
          </View>
        )}

        {/* Comptage / Audit — boutons colorés (mêmes couleurs que côté compteur) */}
        {!closed && (
          <View style={styles.scanBtnRow}>
            <Pressable style={styles.countBtn} onPress={() => router.push(`/(supervisor)/${sessionId}/scan?mode=count`)}>
              <Text style={styles.countBtnText}>Compter des articles</Text>
            </Pressable>
            <Pressable style={styles.auditBtn} onPress={() => router.push(`/(supervisor)/${sessionId}/scan?mode=audit`)}>
              <Text style={styles.auditBtnText}>Auditer des articles</Text>
            </Pressable>
          </View>
        )}

        {/* Menu d'actions */}
        <SectionLabel>Actions</SectionLabel>
        <MenuCard>
          {!closed && (
            <MenuRow label="Inviter une personne" onPress={() => router.push(`/(supervisor)/${sessionId}/invite`)} />
          )}
          <MenuRow label="Écarts d'audit" onPress={() => router.push(`/(supervisor)/${sessionId}/audits`)} />
          <MenuRow label="Rapport inventaire" onPress={() => router.push(`/(supervisor)/${sessionId}/results`)} />
          {!closed && isCreator && (
            <MenuRow label="Clôturer l'inventaire" onPress={confirmClose} />
          )}
          {closed && isCreator && (
            <MenuRow label="Rouvrir l'inventaire" onPress={confirmReopen} />
          )}
          {isCreator && (
            <MenuRow label="Supprimer définitivement" onPress={confirmDelete} danger last />
          )}
          {!closed && !isCreator && (
            <MenuRow label="Quitter l'inventaire" onPress={confirmLeave} danger last />
          )}
        </MenuCard>
      </ScrollView>

      <InfoPanel
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        styles={styles}
        theme={theme}
        session={session}
        members={members}
        invitations={invitations}
        usesZones={usesZones}
        closed={closed}
        canManage={isCreator}
        onRemoveMember={handleRemoveMember}
        onDeleteInvite={handleDeleteInvite}
        onCopy={copyField}
        onShare={shareCredentials}
        onImport={() => { setInfoOpen(false); router.push(`/(supervisor)/${sessionId}/import`) }}
        onZones={() => { setInfoOpen(false); router.push(`/(supervisor)/${sessionId}/zones`) }}
      />
    </SafeAreaView>
  )
}

type SessionData = NonNullable<Awaited<ReturnType<typeof getSession>>>
type MemberData = Awaited<ReturnType<typeof getSessionMembers>>
type InvitationData = Awaited<ReturnType<typeof getSessionInvitations>>

function InfoPanel({
  visible, onClose, styles, theme, session, members, invitations, usesZones, closed,
  canManage, onRemoveMember, onDeleteInvite, onCopy, onShare, onImport, onZones,
}: {
  visible: boolean
  onClose: () => void
  styles: ReturnType<typeof makeStyles>
  theme: Theme
  session: SessionData
  members: MemberData | undefined
  invitations: InvitationData | undefined
  usesZones: boolean
  closed: boolean
  canManage: boolean
  onRemoveMember: (userId: string, name: string) => void
  onDeleteInvite: (id: string, label: string) => void
  onCopy: (label: string, value: string) => void
  onShare: () => void
  onImport: () => void
  onZones: () => void
}) {
  const memberList = members ?? []
  const pendingInvites = invitations ?? []
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{session.name || session.store_name}</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusBadgeDot} />
            <Text style={styles.statusBadgeText}>{STATUS_LABELS[session.status]}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody}>
          <SectionLabel>Identifiants</SectionLabel>
          <CredRow
            styles={styles}
            label="N° d'inventaire"
            value={session.inventory_number}
            onCopy={() => onCopy("N° d'inventaire", session.inventory_number)}
          />
          <CredRow
            styles={styles}
            label="Code inventaire"
            value={session.security_code ?? '—'}
            secret
            onCopy={() => onCopy('Code inventaire', session.security_code ?? '')}
          />
          <Pressable style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareBtnText}>Partager les identifiants</Text>
          </Pressable>

          {/* La configuration passe avant les membres : on prépare un
              inventaire avant d'y mettre des gens. Même ordre que le site,
              où Set up précède Équipe. */}
          {!closed && (
            <>
              <SectionLabel>Configuration</SectionLabel>
              <MenuCard>
                <MenuRow label="Importer les données" onPress={onImport} last={!usesZones} />
                {usesZones && <MenuRow label="Zones & balises" onPress={onZones} last />}
              </MenuCard>
            </>
          )}

          <SectionLabel>Membres ({memberList.length})</SectionLabel>
          {memberList.length === 0 ? (
            <Text style={styles.zoneEmpty}>{"Aucun membre pour l'instant."}</Text>
          ) : memberList.map(m => {
            const mm = m as unknown as { profiles: { full_name: string } | null; role?: string }
            const name = mm.profiles?.full_name ?? 'Inconnu'
            const isOwner = m.user_id === session.created_by
            return (
              <View key={m.user_id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.memberName}>{name}</Text>
                {/* « Créateur » dit un état, « Retirer » supprime quelqu'un.
                    Les deux étaient des pastilles colorées de même taille :
                    rien ne les distinguait au premier coup d'œil. */}
                {isOwner ? (
                  <Text style={styles.memberTag}>Créateur</Text>
                ) : mm.role === 'supervisor' ? (
                  <Text style={styles.memberTag}>Co-superviseur</Text>
                ) : null}
                {canManage && !closed && !isOwner && (
                  <Pressable style={styles.removeBtn} onPress={() => onRemoveMember(m.user_id, name)} hitSlop={8}>
                    <Text style={styles.removeBtnText}>Retirer</Text>
                  </Pressable>
                )}
              </View>
            )
          })}

          {pendingInvites.length > 0 && (
            <>
              <SectionLabel>Invitations en attente ({pendingInvites.length})</SectionLabel>
              {pendingInvites.map(inv => (
                <View key={inv.id} style={styles.memberRow}>
                  <View style={[styles.memberAvatar, styles.memberAvatarPending]}>
                    <Text style={styles.memberAvatarText}>{(inv.full_name || inv.email).charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{inv.full_name || inv.email}</Text>
                    <Text style={styles.invitePendingHint}>{inv.email}{" · en attente d'inscription"}</Text>
                  </View>
                  {inv.role === 'supervisor' && <Text style={styles.memberTag}>Co-superviseur</Text>}
                  {canManage && !closed && (
                    <Pressable style={styles.removeBtn} onPress={() => onDeleteInvite(inv.id, inv.full_name || inv.email)} hitSlop={8}>
                      <Text style={styles.removeBtnText}>Annuler</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </>
          )}

          {!closed && (
            <Pressable style={styles.inviteBtn} onPress={() => { onClose(); router.push(`/(supervisor)/${session.id}/invite`) }}>
              <Text style={styles.inviteBtnText}>Inviter une personne</Text>
            </Pressable>
          )}

        </ScrollView>

        <Pressable style={styles.sheetClose} onPress={onClose}>
          <Text style={styles.sheetCloseText}>Fermer</Text>
        </Pressable>
      </View>
    </Modal>
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

/**
 * Échelle de texte de l'écran — cinq marches, pas sept.
 *
 * La feuille employait 10, 11, 13, 14, 15, 17 et 18, dont plusieurs une seule
 * fois, et son titre (17) était plus petit que le code qu'elle affiche (18) :
 * la hiérarchie était à l'envers. Chaque marche a maintenant un rôle, et une
 * taille qui ne correspond à aucun de ces rôles n'a pas lieu d'exister.
 *
 * Le grand nombre de la progression (56) est à part : c'est un chiffre
 * d'affichage, pas du texte.
 */
const Texte = {
  /** Titre de la feuille. */
  titre: 20,
  /** Les valeurs qu'on vient chercher : le numéro d'inventaire, le code. */
  valeur: 18,
  /** Le texte courant : nom d'un membre, ligne de menu, boutons, « Fermer ». */
  courant: 15,
  /** Le second plan : e-mail en attente, état vide, petits boutons. */
  second: 13,
  /** Les étiquettes : titres de section, statut, « Créateur ». */
  etiquette: 11,
} as const

/**
 * Hauteur des boutons pleine largeur — « Compter », « Auditer »,
 * « Inviter une personne », « Partager les identifiants ». Une seule valeur :
 * la feuille en comptait quatre géométries pour le même genre de travail.
 */
const BTN_H = 48

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.lg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background },

    // Slim info card
    infoCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    infoStore: { fontSize: Texte.valeur, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.3 },
    infoHint: { fontSize: Texte.second, color: t.textMuted, fontFamily: Font.regular, marginTop: 2 },
    infoBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },

    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.successSoft, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    statusBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.success },
    statusBadgeText: { fontSize: Texte.etiquette, fontFamily: Font.semibold, color: t.success },

    // Progression
    progressBigRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    progressBlock: { gap: Spacing.xs },
    progressBig: { fontSize: 56, fontFamily: Font.extrabold, color: t.textPrimary, letterSpacing: -1.5, ...tabular },
    progressSub: { fontSize: Texte.courant, color: t.textSecondary, fontFamily: Font.medium, ...tabular },

    missingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.warningSoft, borderRadius: Radius.md, padding: Spacing.lg, marginTop: Spacing.md },
    missingCount: { fontSize: Texte.courant, fontFamily: Font.bold, color: t.warning },
    missingHint: { fontSize: Texte.second, color: t.textSecondary, fontFamily: Font.medium, marginTop: 2 },
    missingDoneRow: { backgroundColor: t.successSoft, borderRadius: Radius.md, padding: Spacing.lg, marginTop: Spacing.md },
    missingDone: { fontSize: Texte.courant, fontFamily: Font.semibold, color: t.success },
    zoneEmpty: { fontSize: Texte.second, color: t.textMuted, fontFamily: Font.regular, marginLeft: 2 },

    // Boutons Compter / Auditer (couleurs de mode)
    scanBtnRow: { flexDirection: 'row', gap: Spacing.md },
    countBtn: { flex: 1, height: BTN_H, backgroundColor: t.accent, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', ...t.shadowButton },
    countBtnText: { color: t.onAccent, fontSize: Texte.courant, fontFamily: Font.bold },
    auditBtn: { flex: 1, height: BTN_H, backgroundColor: AUDIT_COLOR, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', ...t.shadowButton },
    auditBtnText: { color: AUDIT_ON, fontSize: Texte.courant, fontFamily: Font.bold },


    // Credentials
    credRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: t.hairline, gap: Spacing.md },
    credRowLeft: { flex: 1, gap: 3 },
    credLabel: { fontSize: Texte.etiquette, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    credValue: { fontSize: Texte.valeur, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: 0.5, ...tabular },
    credValueSecret: { color: t.accent, letterSpacing: 2 },
    copyBtn: {
      height: 34, paddingHorizontal: Spacing.lg, borderRadius: Radius.md,
      borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center',
    },
    copyBtnText: { color: t.accent, fontSize: Texte.second, fontFamily: Font.semibold },
    shareBtn: { height: BTN_H, backgroundColor: t.accentSoft, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
    shareBtnText: { color: t.accent, fontSize: Texte.courant, fontFamily: Font.semibold },

    // Members
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: t.hairline },
    memberAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },
    memberAvatarPending: { backgroundColor: t.warningSoft },
    memberAvatarText: { fontSize: Texte.second, fontFamily: Font.bold, color: t.accent },
    memberName: { fontSize: Texte.courant, color: t.textPrimary, fontFamily: Font.medium },
    // Une étiquette, pas un bouton : elle dit un état, elle n'a pas à attirer
    // l'œil ni à ressembler à quelque chose qui se touche.
    memberTag: { fontSize: Texte.etiquette, fontFamily: Font.semibold, color: t.textSecondary, backgroundColor: t.hairline, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' },
    invitePendingHint: { fontSize: Texte.second, color: t.textMuted, fontFamily: Font.regular, marginTop: 1 },
    // Une action, pas une étiquette : du texte, qui se touche.
    removeBtn: { paddingHorizontal: 4, paddingVertical: 4 },
    removeBtnText: { fontSize: Texte.second, fontFamily: Font.semibold, color: t.danger },
    inviteBtn: { height: BTN_H, backgroundColor: t.accent, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs, ...t.shadowButton },
    inviteBtnText: { color: t.onAccent, fontSize: Texte.courant, fontFamily: Font.bold },

    // Info panel sheet
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { backgroundColor: t.background, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingTop: Spacing.sm, maxHeight: '85%' },
    sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.borderStrong, marginBottom: Spacing.sm },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: t.hairline },
    sheetTitle: { fontSize: Texte.titre, fontFamily: Font.bold, color: t.textPrimary, flex: 1, letterSpacing: -0.3 },
    sheetBody: { padding: Spacing.lg, gap: Spacing.sm },
    sheetClose: { paddingVertical: Spacing.lg, alignItems: 'center', borderTopWidth: 1, borderTopColor: t.hairline },
    sheetCloseText: { fontSize: Texte.courant, fontFamily: Font.semibold, color: t.textSecondary },
  })
}
