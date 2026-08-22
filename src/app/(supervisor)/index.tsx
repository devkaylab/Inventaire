import { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { deleteSessionPermanently, getSessions } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
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

/** Corbeille — un tracé, comme toutes les icônes de l'app. */
function CorbeilleIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M4 7h16M10 7V5h4v2M6 7l1 12h10l1-12M10 11v5M14 11v5"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </Svg>
  )
}

/** Case à cocher — dessinée, pour ne pas dépendre d'un caractère. */
function Case({ coche, theme }: { coche: boolean; theme: Theme }) {
  return (
    <View style={{
      width: 22, height: 22, borderRadius: 6, borderWidth: 1.6,
      borderColor: coche ? theme.accent : theme.borderStrong,
      backgroundColor: coche ? theme.accent : 'transparent',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {coche && (
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path d="M5 13l4 4L19 7" stroke={theme.onAccent} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      )}
    </View>
  )
}

function SessionCard({ session, theme, styles, onDelete, selection, coche, onToggle }: {
  session: Session
  theme: Theme
  styles: ReturnType<typeof makeStyles>
  /** Absent quand on n'a pas le droit de supprimer : la corbeille n'apparaît pas. */
  onDelete?: () => void
  /** Vrai quand l'écran est en mode sélection. */
  selection?: boolean
  coche?: boolean
  /** Absent = cet inventaire n'est pas sélectionnable (on ne peut pas le supprimer). */
  onToggle?: () => void
}) {
  const sc = statusColors(theme)[session.status] ?? { fg: theme.textMuted, bg: theme.accentSoft }
  // En mode sélection, toucher la carte coche au lieu d'ouvrir : on ne veut pas
  // quitter l'écran au milieu d'une sélection.
  const selectionnable = selection && !!onToggle

  /**
   * L'appui long a déjà fait son travail — le relâchement ne doit rien faire.
   *
   * Anomalie relevée par Julien le 22 août 2026 : « la tuile est sélectionnée
   * puis elle se désélectionne ». L'appui long cochait la carte et faisait
   * passer l'écran en mode sélection ; au relâchement, `onPress` partait — et
   * comme l'écran était désormais en sélection, il **décochait**. Deux
   * bascules pour un seul geste.
   *
   * Le drapeau est remis à faux à chaque nouvel appui : si la plateforme
   * n'envoie pas `onPress` après un appui long, il ne reste pas armé et ne
   * mange pas le geste suivant.
   */
  const appuiLong = useRef(false)
  const balayage = useRef<SwipeableMethods | null>(null)

  const carte = (
    <Pressable
      style={[styles.card, coche && styles.cardSelected, selection && !selectionnable && styles.cardDimmed]}
      onPressIn={() => { appuiLong.current = false }}
      onLongPress={() => {
        if (!onToggle) return
        appuiLong.current = true
        onToggle()
      }}
      onPress={() => {
        if (appuiLong.current) { appuiLong.current = false; return }
        if (selection) onToggle?.()
        else router.push(`/(supervisor)/${session.id}`)
      }}
      delayLongPress={350}
    >
      <View style={styles.cardHeader}>
        {selection && (
          <View style={{ marginRight: 10 }}>
            {selectionnable
              ? <Case coche={!!coche} theme={theme} />
              : <View style={{ width: 22, height: 22 }} />}
          </View>
        )}
        <Text style={styles.sessionName} numberOfLines={1}>{session.name || session.store_name}</Text>
        <View style={[styles.badge, { backgroundColor: sc.bg }]}>
          <View style={[styles.badgeDot, { backgroundColor: sc.fg }]} />
          <Text style={[styles.badgeText, { color: sc.fg }]}>
            {STATUS_LABELS[session.status] ?? session.status}
          </Text>
        </View>
        {/* Comme sur le site : la corbeille n'apparaît que sur ce qu'on peut
            réellement supprimer, plutôt que de laisser découvrir le refus
            après coup. */}
        {onDelete && !selection && (
          <Pressable style={styles.trashBtn} onPress={onDelete} hitSlop={10}>
            <CorbeilleIcon color={theme.textMuted} />
          </Pressable>
        )}
      </View>
      <Text style={styles.storeName}>{session.store_name}</Text>
      <Text style={styles.meta}>
        {session.inventory_number} · {new Date(session.created_at).toLocaleDateString('fr-FR')}
      </Text>
    </Pressable>
  )

  // Pas de balayage sur ce qu'on ne peut pas supprimer, ni pendant une
  // sélection : le geste entrerait en concurrence avec le défilement d'une
  // liste qu'on est en train de cocher.
  if (!onDelete || selection) return carte

  return (
    <ReanimatedSwipeable
      ref={r => { balayage.current = r }}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          style={styles.balayageAction}
          onPress={() => { balayage.current?.close(); onDelete() }}
        >
          <CorbeilleIcon color="#fff" />
          <Text style={styles.balayageTexte}>Supprimer</Text>
        </Pressable>
      )}
    >
      {carte}
    </ReanimatedSwipeable>
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

  const queryClient = useQueryClient()
  const onRefresh = useCallback(() => { refetch() }, [refetch])
  const [selection, setSelection] = useState(false)
  const [coches, setCoches] = useState<string[]>([])

  /**
   * Qui peut supprimer : le créateur, et l'administrateur de l'entreprise pour
   * tous les siens. Même règle que la base (`delete_session`) et que le site —
   * la corbeille n'apparaît nulle part ailleurs.
   */
  const peutSupprimer = useCallback(
    (s: Session) => !!profile?.is_company_admin || s.created_by === profile?.id,
    [profile?.is_company_admin, profile?.id],
  )

  /**
   * La confirmation **nomme** l'inventaire et signale s'il est encore en
   * cours : sur un téléphone, une corbeille se touche vite, et la suppression
   * emporte comptages, stock théorique, audits, membres et référentiel.
   */
  const confirmerSuppression = useCallback((s: Session) => {
    const nom = s.name || s.store_name
    const enCours = s.status !== 'closed'
    Alert.alert(
      `Supprimer « ${nom} » ?`,
      [
        enCours ? 'Cet inventaire n’est pas clôturé.' : null,
        'Ses comptages, son stock théorique, ses audits, ses membres et son référentiel seront supprimés définitivement.',
      ].filter(Boolean).join('\n\n'),
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSessionPermanently(s.id)
              await queryClient.invalidateQueries({ queryKey: ['sessions'] })
            } catch (e) {
              Alert.alert('Suppression impossible', errorMessage(e))
            }
          },
        },
      ],
    )
  }, [queryClient])

  const selectionnables = useMemo(
    () => (sessions ?? []).filter(peutSupprimer).map(s => s.id),
    [sessions, peutSupprimer],
  )
  const toutCoche = selectionnables.length > 0 && coches.length === selectionnables.length

  const basculer = useCallback((id: string) => {
    setSelection(true)
    setCoches(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]))
  }, [])

  const quitterSelection = useCallback(() => { setSelection(false); setCoches([]) }, [])

  /**
   * Suppression groupée — il n'existe pas de RPC pour cela.
   *
   * On appelle `delete_session` une fois par inventaire et **on rapporte les
   * échecs** au lieu d'annoncer un succès global : sur dix inventaires, un
   * refus ne doit pas passer inaperçu. Même règle que le site.
   */
  const supprimerSelection = useCallback(() => {
    const choisis = (sessions ?? []).filter(s => coches.includes(s.id))
    if (choisis.length === 0) return
    const noms = choisis.map(s => s.name || s.store_name)
    // La confirmation nomme ce qu'on supprime — huit au plus, sinon la boîte
    // de dialogue devient illisible sur un téléphone.
    const liste = noms.slice(0, 8).map(n => `• ${n}`).join('\n')
    const reste = noms.length > 8 ? `\n• et ${noms.length - 8} autre${noms.length - 8 > 1 ? 's' : ''}` : ''
    const enCours = choisis.filter(s => s.status !== 'closed').length
    Alert.alert(
      choisis.length === 1 ? 'Supprimer cet inventaire ?' : `Supprimer ces ${choisis.length} inventaires ?`,
      [
        liste + reste,
        enCours > 0
          ? `${enCours} d'entre eux ${enCours > 1 ? 'ne sont pas clôturés' : "n'est pas clôturé"}.`
          : null,
        'Comptages, stock théorique, audits, membres et référentiel seront supprimés définitivement.',
      ].filter(Boolean).join('\n\n'),
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const echecs: string[] = []
            for (const s of choisis) {
              try {
                await deleteSessionPermanently(s.id)
              } catch (e) {
                echecs.push(`${s.name || s.store_name} : ${errorMessage(e)}`)
              }
            }
            await queryClient.invalidateQueries({ queryKey: ['sessions'] })
            quitterSelection()
            if (echecs.length > 0) {
              Alert.alert(
                echecs.length === choisis.length ? 'Suppression impossible' : 'Suppression partielle',
                `${choisis.length - echecs.length} sur ${choisis.length} supprimé${choisis.length - echecs.length > 1 ? 's' : ''}.\n\n${echecs.join('\n')}`,
              )
            }
          },
        },
      ],
    )
  }, [sessions, coches, queryClient, quitterSelection])

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
              <SessionCard
                session={item.session}
                theme={theme}
                styles={styles}
                onDelete={peutSupprimer(item.session) ? () => confirmerSuppression(item.session) : undefined}
                selection={selection}
                coche={coches.includes(item.session.id)}
                onToggle={peutSupprimer(item.session) ? () => basculer(item.session.id) : undefined}
              />
            )
          }
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.greeting}>Bonjour, <Text style={styles.greetingName}>{profile?.full_name}</Text></Text>
              {/* Le mode sélection s'ouvre aussi par un appui long sur une
                  carte ; ce bouton le rend découvrable, l'appui long ne
                  s'invente pas. */}
              {selectionnables.length > 0 && !selection && (
                <Pressable style={styles.selBtn} onPress={() => setSelection(true)} hitSlop={8}>
                  <Text style={styles.selBtnText}>Sélectionner</Text>
                </Pressable>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Aucun inventaire pour l&apos;instant</Text>
            </View>
          }
        />
      )}

      {selection ? (
        <View style={styles.barre}>
          <View style={styles.barreRangee}>
            <Text style={styles.barreCompte} numberOfLines={1}>
              {coches.length === 0
                ? 'Rien de sélectionné'
                : `${coches.length} sélectionné${coches.length > 1 ? 's' : ''}`}
            </Text>
            <Pressable hitSlop={8} onPress={() => setCoches(toutCoche ? [] : selectionnables)}>
              <Text style={styles.barreLien}>{toutCoche ? 'Tout décocher' : 'Tout sélectionner'}</Text>
            </Pressable>
          </View>
          <View style={styles.barreRangee}>
            <Pressable hitSlop={8} onPress={quitterSelection} style={{ paddingHorizontal: Spacing.sm }}>
              <Text style={styles.barreLien}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.barreSuppr, coches.length === 0 && styles.barreSupprOff]}
              disabled={coches.length === 0}
              onPress={supprimerSelection}
            >
              <Text style={styles.barreSupprText}>
                Supprimer{coches.length > 0 ? ` (${coches.length})` : ''}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.fab} onPress={() => router.push('/(supervisor)/new-session')}>
          <Text style={styles.fabText}>+ Nouvel inventaire</Text>
        </Pressable>
      )}
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
    trashBtn: { padding: 2, marginLeft: 2 },
    // Le volet rouge découvert par le balayage. Il ne supprime pas tout seul :
    // il ouvre la même confirmation nommée que la corbeille — un inventaire
    // emporte comptages, audits et référentiel, un geste de travers ne doit
    // pas suffire.
    balayageAction: {
      // La liste espace ses éléments par `gap` : le volet doit donc faire
      // exactement la hauteur de la carte, sans marge basse qui le
      // raccourcirait.
      width: 104, marginLeft: Spacing.sm,
      borderRadius: Radius.lg, backgroundColor: t.danger,
      alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    balayageTexte: { color: '#fff', fontSize: 13, fontFamily: Font.semibold },
    cardSelected: { borderColor: t.accent, backgroundColor: t.accentSoft },
    // Ce qu'on ne peut pas supprimer reste lisible, mais s'efface : la
    // sélection ne le concerne pas.
    cardDimmed: { opacity: 0.55 },
    // Deux rangées, pas une : à quatre éléments sur la largeur d'un téléphone,
    // « 1 sélectionné » se cassait sur trois lignes.
    barre: {
      position: 'absolute', left: 0, right: 0, bottom: 0, gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xxl,
      backgroundColor: t.surface, borderTopWidth: 1, borderTopColor: t.hairline,
    },
    barreRangee: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    barreCompte: { flex: 1, fontSize: 14, fontFamily: Font.semibold, color: t.textPrimary },
    barreLien: { fontSize: 14, fontFamily: Font.semibold, color: t.accent },
    barreSuppr: {
      flex: 1, height: 44, borderRadius: Radius.md,
      backgroundColor: t.danger, alignItems: 'center', justifyContent: 'center',
    },
    barreSupprText: { fontSize: 14, fontFamily: Font.bold, color: '#fff' },
    barreSupprOff: { opacity: 0.4 },
    selBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
    selBtnText: { fontSize: 14, fontFamily: Font.semibold, color: t.accent },
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
