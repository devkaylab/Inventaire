import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { advancePass, closeSession, getSession, getSessionCounts, getSessionMembers, getZoneDashboard, revertPass } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { passLabel } from '@/constants/colors'
import { promptRevertPass } from '@/lib/passControls'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

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

function ChevronIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  )
}

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const queryClient = useQueryClient()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [infoOpen, setInfoOpen] = useState(false)

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
  const { data: zoneRows } = useQuery({
    queryKey: ['zone-dashboard', sessionId],
    queryFn: () => getZoneDashboard(sessionId),
    enabled: !!session?.uses_zones,
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

  const revertMutation = useMutation({
    mutationFn: (deleteCounts: boolean) => revertPass(sessionId, deleteCounts),
    onSuccess: async (result) => {
      if (!result.success) {
        Alert.alert('Erreur', result.error ?? 'Impossible de revenir en arrière.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      await queryClient.invalidateQueries({ queryKey: ['session-counts', sessionId] })
      Alert.alert('Étape modifiée', `La session est de nouveau en ${passLabel(result.current_pass ?? 1)}.`)
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

  const zones = zoneRows ?? []
  const zoneTotal = zones.length
  const zoneCounted = zones.filter((z) => z.count_status === 'done').length
  const zoneAudited = zones.filter((z) => z.audit_status === 'done').length
  const zoneMissing = zones.filter((z) => z.count_status !== 'done')
  const auditPct = zoneTotal > 0 ? Math.round((zoneAudited / zoneTotal) * 100) : 0
  const countPct = zoneTotal > 0 ? Math.round((zoneCounted / zoneTotal) * 100) : 0

  const closed = session.status === 'closed'
  const usesZones = !!session.uses_zones

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
      >
        {/* Slim info card — opens the info panel (identifiers, members, config) */}
        <Pressable style={styles.infoCard} onPress={() => setInfoOpen(true)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoStore}>{session.store_name}</Text>
            <Text style={styles.infoHint}>Identifiants · membres · configuration</Text>
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
            <Text style={styles.sectionLabel}>Progression</Text>
            <Text style={styles.progressBig}>{countPct}%</Text>
            <Text style={styles.progressSub}>{countPct}% des balises comptées</Text>
            <Text style={styles.progressSub}>{auditPct}% des balises auditées</Text>

            {zoneTotal === 0 ? (
              <Text style={styles.zoneEmpty}>Aucune balise affectée. Ouvrez « Zones & balises » depuis le panneau infos.</Text>
            ) : zoneMissing.length > 0 ? (
              <Pressable style={styles.missingRow} onPress={() => router.push(`/(supervisor)/${sessionId}/missing`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.missingCount}>{zoneMissing.length} balise{zoneMissing.length > 1 ? 's' : ''} manquante{zoneMissing.length > 1 ? 's' : ''}</Text>
                  <Text style={styles.missingHint}>Voir les emplacements concernés</Text>
                </View>
                <ChevronIcon color={theme.warning} />
              </Pressable>
            ) : (
              <View style={styles.missingDoneRow}>
                <Text style={styles.missingDone}>✓ Toutes les balises ont été comptées</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.progressBlock}>
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
          </View>
        )}

        {/* Menu d'actions */}
        <Text style={styles.sectionLabel}>Actions</Text>
        <View style={styles.menuCard}>
          {!closed && usesZones && (
            <>
              <ActionRow styles={styles} theme={theme} label="Compter des articles" onPress={() => router.push(`/(supervisor)/${sessionId}/scan?mode=count`)} />
              <ActionRow styles={styles} theme={theme} label="Auditer des articles" onPress={() => router.push(`/(supervisor)/${sessionId}/scan?mode=audit`)} />
            </>
          )}
          {!closed && !usesZones && (
            <ActionRow styles={styles} theme={theme} label="Scanner des articles" onPress={() => router.push(`/(supervisor)/${sessionId}/scan`)} />
          )}
          <ActionRow styles={styles} theme={theme} label="Audit et écart de comptage" onPress={() => router.push(`/(supervisor)/${sessionId}/audits`)} />
          <ActionRow styles={styles} theme={theme} label="Rapport inventaire" onPress={() => router.push(`/(supervisor)/${sessionId}/results`)} last={closed} />
          {!closed && (
            <ActionRow styles={styles} theme={theme} label="Clôturer l'inventaire" onPress={confirmClose} danger last />
          )}
        </View>
      </ScrollView>

      <InfoPanel
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
        styles={styles}
        theme={theme}
        session={session}
        members={members}
        usesZones={usesZones}
        closed={closed}
        onCopy={copyField}
        onShare={shareCredentials}
        onImport={() => { setInfoOpen(false); router.push(`/(supervisor)/${sessionId}/import`) }}
        onZones={() => { setInfoOpen(false); router.push(`/(supervisor)/${sessionId}/zones`) }}
        onAdvance={() => { setInfoOpen(false); confirmAdvance() }}
        onRevert={() => { setInfoOpen(false); promptRevertPass(session.current_pass, (del) => revertMutation.mutate(del)) }}
        advancePending={advanceMutation.isPending}
        revertPending={revertMutation.isPending}
      />
    </SafeAreaView>
  )
}

function ActionRow({ label, onPress, danger, last, styles, theme }: { label: string; onPress: () => void; danger?: boolean; last?: boolean; styles: ReturnType<typeof makeStyles>; theme: Theme }) {
  return (
    <Pressable style={[styles.menuRow, !last && styles.menuRowBorder]} onPress={onPress}>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      <ChevronIcon color={danger ? theme.danger : theme.textMuted} />
    </Pressable>
  )
}

type SessionData = NonNullable<Awaited<ReturnType<typeof getSession>>>
type MemberData = Awaited<ReturnType<typeof getSessionMembers>>

function InfoPanel({
  visible, onClose, styles, theme, session, members, usesZones, closed,
  onCopy, onShare, onImport, onZones, onAdvance, onRevert, advancePending, revertPending,
}: {
  visible: boolean
  onClose: () => void
  styles: ReturnType<typeof makeStyles>
  theme: Theme
  session: SessionData
  members: MemberData | undefined
  usesZones: boolean
  closed: boolean
  onCopy: (label: string, value: string) => void
  onShare: () => void
  onImport: () => void
  onZones: () => void
  onAdvance: () => void
  onRevert: () => void
  advancePending: boolean
  revertPending: boolean
}) {
  const memberList = members ?? []
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{session.store_name}</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusBadgeDot} />
            <Text style={styles.statusBadgeText}>{STATUS_LABELS[session.status]}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody}>
          <Text style={styles.sectionLabel}>Identifiants</Text>
          <CredRow
            styles={styles}
            label="N° d'inventaire"
            value={session.inventory_number}
            onCopy={() => onCopy("N° d'inventaire", session.inventory_number)}
          />
          <CredRow
            styles={styles}
            label="Code de sécurité"
            value={session.security_code ?? '—'}
            secret
            onCopy={() => onCopy('Code de sécurité', session.security_code ?? '')}
          />
          <Pressable style={styles.shareBtn} onPress={onShare}>
            <Text style={styles.shareBtnText}>Partager les identifiants</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>Membres ({memberList.length})</Text>
          {memberList.length === 0 ? (
            <Text style={styles.zoneEmpty}>Aucun membre pour l'instant.</Text>
          ) : memberList.map(m => (
            <View key={m.user_id} style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {((m as unknown as { profiles: { full_name: string } }).profiles?.full_name ?? '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.memberName}>{(m as unknown as { profiles: { full_name: string } }).profiles?.full_name ?? 'Inconnu'}</Text>
            </View>
          ))}

          {!closed && (
            <>
              <Text style={styles.sectionLabel}>Configuration</Text>
              <View style={styles.menuCard}>
                <ActionRow styles={styles} theme={theme} label="Importer les données" onPress={onImport} />
                {usesZones && (
                  <ActionRow styles={styles} theme={theme} label="Zones & balises" onPress={onZones} last />
                )}
                {!usesZones && session.current_pass < 3 && (
                  <ActionRow styles={styles} theme={theme} label={`Passer en ${passLabel(session.current_pass + 1)}`} onPress={onAdvance} />
                )}
                {!usesZones && session.current_pass > 1 && (
                  <ActionRow styles={styles} theme={theme} label={`Revenir en ${passLabel(session.current_pass - 1)}`} onPress={onRevert} last />
                )}
              </View>
              {(advancePending || revertPending) && (
                <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.sm }} />
              )}
            </>
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

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.lg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.background },

    // Slim info card
    infoCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: t.hairline, ...t.shadowCard },
    infoStore: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.3 },
    infoHint: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular, marginTop: 2 },
    infoBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },

    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.successSoft, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    statusBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.success },
    statusBadgeText: { fontSize: 11, fontFamily: Font.semibold, color: t.success },

    // Progression
    progressBlock: { gap: Spacing.xs },
    sectionLabel: { fontSize: 11, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: Spacing.xs, marginLeft: 2 },
    progressBig: { fontSize: 56, fontFamily: Font.extrabold, color: t.textPrimary, letterSpacing: -1.5, ...tabular },
    progressSub: { fontSize: 14, color: t.textSecondary, fontFamily: Font.medium, ...tabular },

    missingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.warningSoft, borderRadius: Radius.md, padding: Spacing.lg, marginTop: Spacing.md },
    missingCount: { fontSize: 15, fontFamily: Font.bold, color: t.warning },
    missingHint: { fontSize: 12, color: t.textSecondary, fontFamily: Font.medium, marginTop: 2 },
    missingDoneRow: { backgroundColor: t.successSoft, borderRadius: Radius.md, padding: Spacing.lg, marginTop: Spacing.md },
    missingDone: { fontSize: 14, fontFamily: Font.semibold, color: t.success },
    zoneEmpty: { fontSize: 13, color: t.textMuted, fontFamily: Font.regular, marginLeft: 2 },

    // Pass rows (non-zones fallback)
    passRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: Radius.md, padding: 13, borderWidth: 1, borderColor: t.hairline, gap: Spacing.md, marginTop: Spacing.xs, ...t.shadowCard },
    passDot: { width: 10, height: 10, borderRadius: 5 },
    passLabel: { flex: 1, fontSize: 14, color: t.textPrimary, fontFamily: Font.semibold },
    passCurrentBadge: { backgroundColor: t.accentSoft, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
    passCurrentText: { fontSize: 11, fontFamily: Font.semibold, color: t.accent },
    passCount: { fontSize: 14, color: t.textSecondary, fontFamily: Font.medium, ...tabular },

    // Menu (grouped list)
    menuCard: { backgroundColor: t.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.hairline, overflow: 'hidden', ...t.shadowCard },
    menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
    menuRowBorder: { borderBottomWidth: 1, borderBottomColor: t.hairline },
    menuLabel: { fontSize: 15, color: t.textPrimary, fontFamily: Font.semibold },
    menuLabelDanger: { color: t.danger },

    // Credentials
    credRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: t.hairline, gap: Spacing.md },
    credRowLeft: { flex: 1, gap: 3 },
    credLabel: { fontSize: 10, fontFamily: Font.semibold, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    credValue: { fontSize: 18, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: 0.5, ...tabular },
    credValueSecret: { color: t.accent, letterSpacing: 2 },
    copyBtn: { backgroundColor: t.accent, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 8 },
    copyBtnText: { color: t.onAccent, fontSize: 13, fontFamily: Font.semibold },
    shareBtn: { backgroundColor: t.accentSoft, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
    shareBtnText: { color: t.accent, fontSize: 14, fontFamily: Font.semibold },

    // Members
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: t.background, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: t.hairline },
    memberAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },
    memberAvatarText: { fontSize: 13, fontFamily: Font.bold, color: t.accent },
    memberName: { fontSize: 14, color: t.textPrimary, fontFamily: Font.medium },

    // Info panel sheet
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheet: { backgroundColor: t.background, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingTop: Spacing.sm, maxHeight: '85%' },
    sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.borderStrong, marginBottom: Spacing.sm },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: t.hairline },
    sheetTitle: { fontSize: 17, fontFamily: Font.bold, color: t.textPrimary, flex: 1, letterSpacing: -0.3 },
    sheetBody: { padding: Spacing.lg, gap: Spacing.sm },
    sheetClose: { paddingVertical: Spacing.lg, alignItems: 'center', borderTopWidth: 1, borderTopColor: t.hairline },
    sheetCloseText: { fontSize: 15, fontFamily: Font.semibold, color: t.textSecondary },
  })
}
