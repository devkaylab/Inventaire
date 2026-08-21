import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import {
  deleteInvitation,
  getMyAssignedStores,
  getMyCompany,
  getMySessions,
  getTeamInvitations,
  getTeamMembers,
  type Invitation,
  type Profile,
} from '@/lib/queries'
import { exportBaliseSheet } from '@/lib/balises'
import type { BaliseSeries } from '@/lib/baliseSeries'
import { BaliseSheetModal } from '@/components/BaliseSheetModal'
import { GeneratingOverlay } from '@/components/GeneratingOverlay'
import { DeleteAccountButton } from '@/components/DeleteAccountButton'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

type Row =
  | { kind: 'member'; profile: Profile }
  | { kind: 'invite'; invitation: Invitation }

export default function SupervisorProfileScreen() {
  const { profile, session, signOut } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const queryClient = useQueryClient()

  const { data: company } = useQuery({ queryKey: ['my-company'], queryFn: getMyCompany })
  const { data: myStores } = useQuery({ queryKey: ['my-stores'], queryFn: getMyAssignedStores })
  const { data: mySessions } = useQuery({ queryKey: ['my-sessions'], queryFn: getMySessions })
  const {
    data: members,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({ queryKey: ['team-members'], queryFn: getTeamMembers })
  const { data: invitations, refetch: refetchInvites } = useQuery({
    queryKey: ['team-invitations'],
    queryFn: getTeamInvitations,
  })

  const onRefresh = useCallback(() => { refetch(); refetchInvites() }, [refetch, refetchInvites])

  // ── Balises ─────────────────────────────────────────────────────────────────
  // Pas de stock à tenir : le superviseur choisit la numérotation et imprime.
  const [baliseModal, setBaliseModal] = useState(false)
  const print = useMutation({
    mutationFn: (series: BaliseSeries) =>
      exportBaliseSheet(`${series.from}-${series.to}`, series.codes.map((code) => ({ code }))),
    onSuccess: (r) => { if (!r.shared) Alert.alert('PDF généré', `Le fichier ${r.filename} a été créé.`) },
    onError: (e) => Alert.alert('Erreur', errorMessage(e)),
  })

  const email = session?.user.email ?? '—'

  /**
   * Transmettre un code magasin.
   *
   * C'est le seul usage prévu : le code accompagne la demande d'accès d'un
   * futur superviseur du magasin, déposée sur le site. Il ne doit jamais
   * circuler auprès des compteurs.
   */
  async function shareStoreCode(name: string, code: string) {
    try {
      await Share.share({
        message:
          `Code du magasin « ${name} » : ${code}\n\n` +
          'À utiliser pour demander un accès superviseur sur quantinvo.vercel.app/superviseur. ' +
          'Ce code est confidentiel : ne le communiquez pas aux compteurs.',
      })
    } catch (e) {
      Alert.alert('Partage impossible', errorMessage(e))
    }
  }

  const INV_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
    open: { label: 'Ouverte', fg: theme.success, bg: theme.successSoft },
    counting: { label: 'En cours', fg: theme.warning, bg: theme.warningSoft },
    closed: { label: 'Clôturée', fg: theme.textMuted, bg: theme.accentSoft },
  }

  const rows: Row[] = [
    ...(members ?? []).map((p): Row => ({ kind: 'member', profile: p })),
    ...(invitations ?? []).map((i): Row => ({ kind: 'invite', invitation: i })),
  ]

  function handleCancelInvite(inv: Invitation) {
    Alert.alert(
      'Annuler l\'invitation ?',
      `${inv.full_name || inv.email} ne pourra plus créer son compte.`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler l\'invitation',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInvitation(inv.id)
              await queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
            } catch (e) {
              Alert.alert('Erreur', errorMessage(e))
            }
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <GeneratingOverlay
        visible={print.isPending}
        message="Préparation de l’impression…"
        sub="Création du PDF des balises"
      />
      <FlatList
        data={rows}
        keyExtractor={r => (r.kind === 'member' ? `m-${r.profile.id}` : `i-${r.invitation.id}`)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* Carte superviseur */}
            <View style={styles.identityCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(profile?.full_name ?? '?')}</Text>
              </View>
              <Text style={styles.name}>{profile?.full_name || 'Superviseur'}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>Superviseur</Text>
              </View>
              <Text style={styles.email}>{email}</Text>
            </View>

            {/* Carte entreprise + rejoindre un magasin */}
            <Text style={styles.sectionTitle}>Entreprise</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Entreprise</Text>
                <Text style={styles.infoValue}>{company?.name ?? '—'}</Text>
              </View>
            </View>
            {/* Mes magasins et leurs codes */}
            <Text style={styles.sectionTitle}>Mes magasins</Text>
            {(myStores?.length ?? 0) === 0 ? (
              <Text style={styles.emptyInv}>
                Vous n&apos;êtes affecté à aucun magasin. Contactez l&apos;administrateur Quantinvo.
              </Text>
            ) : (
              <View style={styles.infoCard}>
                {myStores!.map((s, i) => (
                  <View key={s.id} style={[styles.storeRow, i > 0 && styles.storeRowSep]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoValue}>{s.name}</Text>
                      <Text style={[styles.storeCode, tabular]}>{s.join_code ?? '—'}</Text>
                    </View>
                    {!!s.join_code && (
                      <Pressable
                        style={styles.shareCodeBtn}
                        onPress={() => shareStoreCode(s.name, s.join_code!)}
                      >
                        <Text style={styles.shareCodeBtnText}>Partager</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.baliseHint}>
              Le code magasin sert aux demandes d&apos;accès superviseur sur le site. Il est
              confidentiel : ne le communiquez jamais aux compteurs.
            </Text>

            {/* Balises */}
            <Text style={styles.sectionTitle}>Balises</Text>
            <Pressable
              style={[styles.baliseBtn, styles.baliseBtnPrimary]}
              onPress={() => setBaliseModal(true)}
              disabled={print.isPending}
            >
              {print.isPending
                ? <ActivityIndicator color={theme.onAccent} />
                : <Text style={styles.baliseBtnPrimaryText}>Créer des balises</Text>}
            </Pressable>
            <Text style={styles.baliseHint}>
              Choisissez la numérotation et le nombre, puis imprimez sur des planches autocollantes
              Avery L7160 (à 100 %). Collez-les, puis affectez les plages aux emplacements dans chaque inventaire.
            </Text>

            {/* Mes inventaires (créés par moi) */}
            <Text style={styles.sectionTitle}>Mes inventaires</Text>
            {(mySessions?.length ?? 0) === 0 ? (
              <Text style={styles.emptyInv}>Vous n'avez pas encore créé d'inventaire.</Text>
            ) : (
              <View style={styles.invList}>
                {mySessions!.map(s => {
                  const sc = INV_STATUS[s.status] ?? { label: s.status, fg: theme.textMuted, bg: theme.accentSoft }
                  return (
                    <Pressable key={s.id} style={styles.invRow} onPress={() => router.push(`/(supervisor)/${s.id}`)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.invName} numberOfLines={1}>{s.name || s.store_name}</Text>
                        <Text style={styles.invMeta}>{s.store_name} · {s.inventory_number}</Text>
                      </View>
                      <View style={[styles.invBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.invBadgeText, { color: sc.fg }]}>{sc.label}</Text>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {/* En-tête équipe */}
            <View style={styles.teamHeader}>
              <Text style={styles.sectionTitle}>Équipe</Text>
              <Pressable style={styles.addBtn} onPress={() => router.push('/(supervisor)/new-member')}>
                <Text style={styles.addBtnText}>+ Ajouter un membre</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'member' ? (
            <MemberRow member={item.profile} isSelf={item.profile.id === profile?.id} styles={styles} />
          ) : (
            <InviteRow invitation={item.invitation} onCancel={() => handleCancelInvite(item.invitation)} styles={styles} />
          )
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.xl }} />
          ) : (
            <Text style={styles.emptyText}>Aucun membre pour l'instant.</Text>
          )
        }
        ListFooterComponent={
          <>
            <Pressable style={styles.logoutBtn} onPress={signOut}>
              <Text style={styles.logoutBtnText}>Déconnexion</Text>
            </Pressable>
            <DeleteAccountButton />
          </>
        }
      />
      <BaliseSheetModal
        visible={baliseModal}
        onClose={() => setBaliseModal(false)}
        onSubmit={(series) => print.mutate(series)}
      />
    </SafeAreaView>
  )
}

function MemberRow({
  member,
  isSelf,
  styles,
}: {
  member: Profile
  isSelf: boolean
  styles: ReturnType<typeof makeStyles>
}) {
  const isSupervisor = member.role === 'supervisor'
  return (
    <View style={styles.memberRow}>
      <View style={[styles.memberAvatar, isSupervisor && styles.memberAvatarSup]}>
        <Text style={styles.memberAvatarText}>{initials(member.full_name || '?')}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName}>
          {member.full_name || 'Sans nom'}
          {isSelf ? '  (vous)' : ''}
        </Text>
        <Text style={styles.memberRole}>{isSupervisor ? 'Superviseur' : 'Employé'}</Text>
      </View>
    </View>
  )
}

function InviteRow({
  invitation,
  onCancel,
  styles,
}: {
  invitation: Invitation
  onCancel: () => void
  styles: ReturnType<typeof makeStyles>
}) {
  return (
    <View style={[styles.memberRow, styles.inviteRow]}>
      <View style={[styles.memberAvatar, styles.inviteAvatar]}>
        <Text style={styles.memberAvatarText}>{initials(invitation.full_name || invitation.email)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName}>{invitation.full_name || invitation.email}</Text>
        <Text style={styles.memberRole}>{invitation.email}</Text>
      </View>
      <View style={styles.pendingBadge}>
        <Text style={styles.pendingBadgeText}>En attente</Text>
      </View>
      <Pressable style={styles.cancelBtn} onPress={onCancel} hitSlop={6}>
        <Text style={styles.cancelBtnText}>✕</Text>
      </Pressable>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    list: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.sm },
    headerBlock: { gap: Spacing.md, marginBottom: Spacing.sm },

    identityCard: {
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.xl,
      borderWidth: 1, borderColor: t.hairline, alignItems: 'center', gap: Spacing.xs, ...t.shadowCard,
    },
    avatar: {
      width: 68, height: 68, borderRadius: 34, backgroundColor: t.accent,
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs,
    },
    avatarText: { fontSize: 26, fontFamily: Font.bold, color: t.onAccent },
    name: { fontSize: 20, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.3 },
    roleBadge: {
      backgroundColor: t.accentSoft, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md, paddingVertical: 3,
    },
    roleBadgeText: { fontSize: 11, fontFamily: Font.bold, color: t.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
    email: { fontSize: 14, color: t.textSecondary, fontFamily: Font.regular, marginTop: 2 },

    sectionTitle: {
      fontSize: 12, fontFamily: Font.semibold, color: t.textMuted,
      textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.sm,
    },
    infoCard: {
      backgroundColor: t.surface, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg,
      borderWidth: 1, borderColor: t.hairline, ...t.shadowCard,
    },
    infoRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: Spacing.md,
    },
    infoDivider: { height: 1, backgroundColor: t.hairline },
    infoLabel: { fontSize: 14, color: t.textSecondary, fontFamily: Font.regular },
    infoValue: { fontSize: 15, color: t.textPrimary, fontFamily: Font.semibold, flexShrink: 1, textAlign: 'right' },
    code: { letterSpacing: 2, ...tabular },

    storeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
    storeRowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline, marginTop: Spacing.sm },
    storeCode: {
      fontSize: 18, color: t.accent, fontFamily: Font.bold, letterSpacing: 4, marginTop: 2,
    },
    shareCodeBtn: {
      backgroundColor: t.accentSoft, borderRadius: Radius.md,
      paddingVertical: 10, paddingHorizontal: Spacing.lg,
    },
    shareCodeBtnText: { color: t.accent, fontSize: 14, fontFamily: Font.bold },

    baliseBtn: { borderRadius: Radius.md, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
    baliseBtnPrimary: { backgroundColor: t.accent, ...t.shadowButton },
    baliseBtnPrimaryText: { color: t.onAccent, fontSize: 14, fontFamily: Font.bold },
    baliseHint: { fontSize: 12, color: t.textMuted, lineHeight: 17, fontFamily: Font.regular, marginTop: 2 },

    emptyInv: { fontSize: 13, color: t.textMuted, fontFamily: Font.regular, marginLeft: 2 },
    invList: { gap: Spacing.sm },
    invRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.md,
      borderWidth: 1, borderColor: t.hairline, ...t.shadowCard,
    },
    invName: { fontSize: 15, fontFamily: Font.semibold, color: t.textPrimary },
    invMeta: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular, ...tabular },
    invBadge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    invBadgeText: { fontSize: 11, fontFamily: Font.semibold },

    teamHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    addBtn: {
      backgroundColor: t.accent, borderRadius: Radius.md,
      paddingHorizontal: Spacing.md, paddingVertical: 8, ...t.shadowButton,
    },
    addBtnText: { color: t.onAccent, fontSize: 13, fontFamily: Font.bold },

    memberRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.md,
      borderWidth: 1, borderColor: t.hairline, ...t.shadowCard,
    },
    memberAvatar: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: t.borderStrong,
      alignItems: 'center', justifyContent: 'center',
    },
    memberAvatarSup: { backgroundColor: t.accentSoft },
    memberAvatarText: { fontSize: 14, fontFamily: Font.bold, color: t.textPrimary },
    memberName: { fontSize: 15, fontFamily: Font.semibold, color: t.textPrimary },
    memberRole: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular },

    inviteRow: { borderStyle: 'dashed', borderColor: t.borderStrong, backgroundColor: 'transparent' },
    inviteAvatar: { backgroundColor: t.warningSoft },
    pendingBadge: {
      backgroundColor: t.warningSoft, borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm, paddingVertical: 3,
    },
    pendingBadgeText: { fontSize: 10, fontFamily: Font.bold, color: t.warning, textTransform: 'uppercase', letterSpacing: 0.4 },
    cancelBtn: {
      width: 28, height: 28, borderRadius: 14, backgroundColor: t.dangerSoft,
      alignItems: 'center', justifyContent: 'center',
    },
    cancelBtnText: { fontSize: 12, color: t.danger, fontFamily: Font.bold },

    emptyText: { color: t.textMuted, fontSize: 14, textAlign: 'center', marginTop: Spacing.xl, fontFamily: Font.regular },

    logoutBtn: {
      marginTop: Spacing.xl, borderRadius: Radius.md, paddingVertical: Spacing.lg,
      alignItems: 'center', backgroundColor: t.dangerSoft,
    },
    logoutBtnText: { color: t.danger, fontSize: 15, fontFamily: Font.bold },
  })
}
