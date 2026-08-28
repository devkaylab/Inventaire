import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { closeSession, deleteSessionPermanently, getMyAssignedStores, getMyTeamByStore, getSessions } from '@/lib/queries'
import { BandeauDemarrage, etapeCourante, etapesDemarrage } from '@/components/BandeauDemarrage'
import { useJalon, useRepere } from '@/lib/reperes'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import type { Tables } from '@/types/database.types'
import { demander, signaler } from '@/lib/dialogue'

type Session = Tables<'inventory_sessions'>

type Rect = { x: number; y: number; width: number; height: number }

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

/** Cadenas — la clôture ferme l'inventaire, elle ne le détruit pas. */
function CadenasIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13z"
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </Svg>
  )
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

function SessionCard({ session, theme, styles, onDelete, onClose, selection, coche, onToggle, onVoletOuvert, onVoletFerme, indice, onIndiceCompris }: {
  session: Session
  theme: Theme
  styles: ReturnType<typeof makeStyles>
  /** Absent quand on n'a pas le droit de supprimer : la corbeille n'apparaît pas. */
  onDelete?: () => void
  /** Absent sur un inventaire déjà clôturé : il n'y a plus rien à fermer. */
  onClose?: () => void
  /** Signale à l'écran quel volet est ouvert, et où il se trouve. */
  onVoletOuvert?: (methods: SwipeableMethods, rect: Rect) => void
  onVoletFerme?: (methods: SwipeableMethods | null) => void
  /** Vrai quand l'écran est en mode sélection. */
  selection?: boolean
  coche?: boolean
  /** Absent = cet inventaire n'est pas sélectionnable (on ne peut pas le supprimer). */
  onToggle?: () => void
  /** Vrai sur le seul rang qui montre le geste de balayage, une seule fois. */
  indice?: boolean
  onIndiceCompris?: () => void
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
  const conteneur = useRef<View | null>(null)

  /**
   * Le coup d'œil qui enseigne le balayage.
   *
   * Le geste découvre « Clôturer » et « Supprimer » depuis le 22 août 2026, et
   * rien ne le disait. Une phrase seule décrirait le geste ; la carte qui
   * s'entrouvre le montre. Elle se referme d'elle-même : c'est une
   * démonstration, pas un état.
   *
   * ⚠️ **Les volets sont inertes pendant ce temps.** Ils s'ouvrent sans que
   * personne ne les ait demandés — un doigt déjà posé sur l'écran ne doit pas
   * tomber sur « Supprimer ». Ils redeviennent touchables une fois la carte
   * refermée.
   *
   * Le premier délai laisse la liste se poser : ouvrir pendant qu'elle se
   * monte ne se verrait pas.
   */
  const [coupDoeil, setCoupDoeil] = useState(false)
  useEffect(() => {
    if (!indice) return
    const ouvrir = setTimeout(() => { setCoupDoeil(true); balayage.current?.openRight() }, 550)
    const fermer = setTimeout(() => { balayage.current?.close(); setCoupDoeil(false) }, 1750)
    return () => { clearTimeout(ouvrir); clearTimeout(fermer) }
  }, [indice])

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

  // Pas de balayage quand il n'y a rien à y faire, ni pendant une sélection :
  // le geste entrerait en concurrence avec le défilement d'une liste qu'on est
  // en train de cocher.
  if ((!onDelete && !onClose) || selection) return carte

  return (
    <View
      ref={conteneur}
      // Le rang est mesuré à l'ouverture : c'est ce qui permet à l'écran de
      // distinguer « on touche ce volet » de « on touche ailleurs ».
      collapsable={false}
    >
    <ReanimatedSwipeable
      ref={r => { balayage.current = r }}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        const m = balayage.current
        if (!m) return
        conteneur.current?.measureInWindow((x, y, width, height) => {
          onVoletOuvert?.(m, { x, y, width, height })
        })
      }}
      onSwipeableWillClose={() => onVoletFerme?.(balayage.current)}
      renderRightActions={() => (
        <View style={styles.balayageVolets} pointerEvents={coupDoeil ? 'none' : 'auto'}>
          {/* Clôturer avant Supprimer : le geste destructeur est le plus loin
              du doigt, il faut aller le chercher. */}
          {onClose && (
            <Pressable
              style={[styles.balayageAction, styles.balayageCloturer]}
              onPress={() => { balayage.current?.close(); onClose() }}
            >
              <CadenasIcon color="#fff" />
              <Text style={styles.balayageTexte}>Clôturer</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              style={[styles.balayageAction, styles.balayageSupprimer]}
              onPress={() => { balayage.current?.close(); onDelete() }}
            >
              <CorbeilleIcon color="#fff" />
              <Text style={styles.balayageTexte}>Supprimer</Text>
            </Pressable>
          )}
        </View>
      )}
    >
      {carte}
    </ReanimatedSwipeable>

    {/* La bulle nomme le geste que le coup d'œil vient de montrer. « Compris »
        est le seul bouton : quitter l'écran sans répondre la laisse à voir —
        une aide qu'on n'a pas lue n'a pas été donnée. */}
    {indice && (
      <View style={styles.indiceBulle}>
        <Text style={styles.indiceTexte}>
          Balayez une carte vers la gauche pour clôturer ou supprimer un inventaire.
          Chaque geste demande confirmation.
        </Text>
        <Pressable onPress={onIndiceCompris} hitSlop={10} style={styles.indiceBtn}>
          <Text style={styles.indiceCompris}>Compris</Text>
        </Pressable>
      </View>
    )}
    </View>
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

  // Sans magasin affecté, un superviseur ne peut rien créer. Il ne le
  // découvrait qu'après « Nouvel inventaire », deux écrans plus loin : on le
  // lui dit ici, là où il attend quelque chose.
  const { data: magasins, isError: magasinsEnErreur } = useQuery({
    queryKey: ['mes-magasins'],
    queryFn: getMyAssignedStores,
  })
  const sansMagasin = !magasinsEnErreur && magasins !== undefined && magasins.length === 0

  // ── Le bandeau de démarrage ────────────────────────────────────────
  //
  // Il ne vise plus un inventaire mais **le démarrage du superviseur** :
  // imprimer ses balises, se donner des compteurs, lancer son premier
  // inventaire. La préparation d'une session (zones, fichiers, membres) se
  // conduit depuis la session elle-même, où elle est déjà.
  //
  // ⚠️ **Uniquement les inventaires qu'on a CRÉÉS.** La première version
  // regardait le premier inventaire non clôturé de la liste — invités
  // compris. Résultat vu sur l'iPhone de Julien : le guide se cochait sur
  // l'inventaire de quelqu'un d'autre.
  //
  // ⚠️ **Et seulement à quelqu'un qui démarre vraiment.** Au-delà d'un
  // inventaire créé, la personne connaît le produit : lui expliquer comment
  // commencer est du bruit. Le bandeau ne réapparaît jamais.
  const { aVoir: guideAVoir, marquerVu: masquerGuide } = useRepere('guide-demarrage', profile?.id)
  // L'indice de balayage : déclaré le 23 août 2026 et resté sans écran
  // jusqu'au 28. Les conditions d'affichage sont plus bas, avec la liste.
  const { aVoir: balayageAVoir, marquerVu: balayageVu } = useRepere('balayage', profile?.id)
  const mesInventaires = useMemo(
    () => (sessions ?? []).filter(s => s.created_by === profile?.id),
    [sessions, profile?.id],
  )
  const debutant = mesInventaires.length <= 1

  // ⚠️ **Le jalon local, et le piège de ce bandeau.** Une planche de balises
  // est dessinée sur le téléphone et n'écrit rien en base : l'étape ne peut
  // se cocher que sur un repère posé à l'impression. `useJalon` le relit à
  // chaque retour sur l'écran — on revient précisément de la boîte à outils.
  const { pose: balisesImprimees, pret: jalonPret } = useJalon('balises-imprimees', profile?.id)

  const montrerGuide = guideAVoir && jalonPret && debutant && !sansMagasin && sessions !== undefined

  // L'équipe : la même RPC que « Mon équipe », pas un décompte à part.
  const { data: equipe } = useQuery({
    queryKey: ['my-team'],
    queryFn: getMyTeamByStore,
    enabled: montrerGuide,
  })
  // Une invitation en attente compte : le travail est fait, il ne manque que
  // la réponse de la personne. Sans cela l'étape resterait à faire juste
  // après avoir invité quelqu'un — exactement au mauvais moment.
  const equipeConstituee =
    (equipe?.stores ?? []).some(s => s.counters.length > 0) || (equipe?.invitations.length ?? 0) > 0

  const etapes = useMemo(
    () => etapesDemarrage({
      balisesImprimees,
      equipeConstituee,
      inventaireCree: mesInventaires.length > 0,
    }),
    [balisesImprimees, equipeConstituee, mesInventaires.length],
  )

  /**
   * ⚠️ **Le bandeau ne se rejoue pas.**
   *
   * Ses trois étapes se cochent sur des faits relus à chaque ouverture :
   * supprimer ses inventaires remettait la troisième à faire, et le bandeau
   * revenait — à quelqu'un qui connaît le produit depuis longtemps. Constat
   * de Julien, 28 août 2026 : « il s'affiche à chaque fois qu'il n'y a plus
   * d'inventaire en cours ». Un guide de démarrage qui reparaît des semaines
   * après le démarrage ne guide plus rien, il dit qu'on a reculé.
   *
   * La fin du démarrage est donc **notée**, exactement comme la croix la
   * note — le **même repère**, et surtout pas un jalon : « Revoir les
   * repères » doit pouvoir ramener le bandeau, or un jalon ne s'efface pas.
   *
   * Deux façons d'en avoir fini, et il faut les deux : plus rien à faire
   * (les trois étapes cochées), ou plus rien à expliquer (au-delà d'un
   * inventaire créé, la personne connaît le produit). Les gardes de
   * `montrerGuide` sont reprises telles quelles — on ne consomme pas le
   * bandeau de quelqu'un à qui on ne l'a jamais montré, faute de magasin ou
   * de données chargées.
   */
  const demarrageFini =
    sessions !== undefined && jalonPret && !sansMagasin &&
    (!debutant || etapeCourante(etapes) === null)

  useEffect(() => {
    if (guideAVoir && demarrageFini) masquerGuide()
  }, [guideAVoir, demarrageFini, masquerGuide])

  const carteGuide = montrerGuide ? (
    <BandeauDemarrage
      etapes={etapes}
      onMasquer={masquerGuide}
      onAction={(cle) => {
        if (cle === 'balises') router.push('/(compte)/tools')
        else if (cle === 'equipe') router.push('/(compte)/team')
        else router.push('/(supervisor)/new-session')
      }}
    />
  ) : null

  const queryClient = useQueryClient()
  // ⚠️ Tirer pour rafraîchir doit aussi recharger l'équipe : sans elle, le
  // bandeau gardait l'état qu'il avait au premier affichage, et le geste
  // naturel pour « débloquer » un écran figé ne débloquait rien.
  const onRefresh = useCallback(() => {
    refetch()
    queryClient.invalidateQueries({ queryKey: ['my-team'] })
  }, [refetch, queryClient])
  const [selection, setSelection] = useState(false)
  const [coches, setCoches] = useState<string[]>([])

  /**
   * Le volet ouvert, et où il est à l'écran.
   *
   * Un rang balayé doit se refermer dès qu'on touche ailleurs — sinon il reste
   * ouvert dans le dos de la personne, et le prochain appui tombe sur un
   * bouton rouge qu'elle ne regardait plus. On garde donc sa position mesurée
   * à l'ouverture : c'est ce qui permet de distinguer « on touche ce volet »
   * de « on touche ailleurs », et de ne pas fermer sous le doigt de quelqu'un
   * qui vise justement « Supprimer ».
   */
  const voletOuvert = useRef<{ methods: SwipeableMethods; rect: Rect } | null>(null)

  const fermerVolet = useCallback(() => {
    voletOuvert.current?.methods.close()
    voletOuvert.current = null
  }, [])

  const noterVolet = useCallback((methods: SwipeableMethods, rect: Rect) => {
    // Un seul volet ouvert à la fois : ouvrir le suivant referme le précédent.
    if (voletOuvert.current && voletOuvert.current.methods !== methods) {
      voletOuvert.current.methods.close()
    }
    voletOuvert.current = { methods, rect }
  }, [])

  /**
   * Un volet qui se ferme n'efface l'enregistrement que s'il est bien celui
   * qu'on avait noté. Sans cette vérification, ouvrir un rang alors qu'un
   * autre l'était refermait le premier — dont la fermeture effaçait aussitôt
   * l'enregistrement du **nouveau**, qui restait alors ouvert sans que
   * personne ne le sache.
   */
  const oublierVolet = useCallback((methods: SwipeableMethods | null) => {
    if (voletOuvert.current && voletOuvert.current.methods === methods) {
      voletOuvert.current = null
    }
  }, [])

  /**
   * Referme au premier contact hors du volet, **sans prendre le geste** :
   * on renvoie `false`, donc l'élément touché reçoit quand même l'appui. Le
   * `Capture` fait passer ce contrôle avant tout le monde, y compris avant le
   * défilement de la liste.
   */
  const auContact = useCallback((e: GestureResponderEvent) => {
    const o = voletOuvert.current
    if (o) {
      const { pageX, pageY } = e.nativeEvent
      const dedans =
        pageX >= o.rect.x && pageX <= o.rect.x + o.rect.width &&
        pageY >= o.rect.y && pageY <= o.rect.y + o.rect.height
      if (!dedans) fermerVolet()
    }
    return false
  }, [fermerVolet])

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
    void demander({
      titre: `Supprimer « ${nom} » ?`,
      texte: 'Ses comptages, son stock théorique, ses audits, ses membres et son référentiel seront supprimés définitivement.',
      note: enCours ? 'Cet inventaire n’est pas clôturé.' : undefined,
      action: 'Supprimer',
      ton: 'danger',
    }).then(async (ok) => {
      if (!ok) return
      try {
        await deleteSessionPermanently(s.id)
        await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      } catch (e) {
        signaler.erreur('Suppression impossible', errorMessage(e))
      }
    })
  }, [queryClient])

  /**
   * Clôturer depuis la liste.
   *
   * N'est pas réservé au créateur, contrairement à la suppression : clôturer
   * est un geste de terrain que tout superviseur participant peut faire, et
   * que le créateur peut défaire. Même règle que la base et que le site. Un
   * inventaire déjà clôturé n'a rien à fermer : l'action n'apparaît pas.
   */
  const confirmerCloture = useCallback((s: Session) => {
    const nom = s.name || s.store_name
    void demander({
      titre: `Clôturer « ${nom} » ?`,
      texte: 'L’inventaire passe en lecture seule : plus aucun comptage ne pourra y être enregistré, y compris depuis les téléphones encore ouverts dessus.',
      note: 'Toutes les données sont conservées et le rapport reste disponible. Son créateur pourra le rouvrir.',
      action: 'Clôturer',
    }).then(async (ok) => {
      if (!ok) return
      try {
        await closeSession(s.id)
        await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      } catch (e) {
        signaler.erreur('Clôture impossible', errorMessage(e))
      }
    })
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
    void demander({
      titre: choisis.length === 1 ? 'Supprimer cet inventaire ?' : `Supprimer ces ${choisis.length} inventaires ?`,
      texte: liste + reste,
      note: [
        enCours > 0
          ? `${enCours} d'entre eux ${enCours > 1 ? 'ne sont pas clôturés' : "n'est pas clôturé"}.`
          : null,
        'Comptages, stock théorique, audits, membres et référentiel seront supprimés définitivement.',
      ].filter(Boolean).join(' '),
      action: 'Supprimer',
      ton: 'danger',
    }).then(async (ok) => {
      if (!ok) return
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
      // Un échec ne doit pas passer inaperçu derrière un succès global.
      if (echecs.length > 0) {
        signaler.erreur(
          echecs.length === choisis.length ? 'Suppression impossible' : 'Suppression partielle',
          `${choisis.length - echecs.length} sur ${choisis.length} supprimé${choisis.length - echecs.length > 1 ? 's' : ''}. ${echecs.join(' ')}`,
        )
      }
    })
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

  /* ── Le geste caché, montré une fois ──────────────────────────────────────
   *
   * Il ne se joue que sur le premier rang qui porte réellement un volet — un
   * inventaire invité n'en a aucun, et une démonstration sur une carte qui ne
   * bouge pas apprendrait le contraire de ce qu'on veut.
   *
   * ⚠️ **Il attend le deuxième inventaire**, et ce n'est pas une précaution de
   * façade : avec un seul, le bandeau de démarrage occupe encore le haut de
   * l'écran, et l'on ne sert pas deux aides à la fois. C'est aussi le moment
   * où la liste commence à se gérer.
   *
   * Jamais pendant une sélection : le balayage y entre déjà en concurrence
   * avec le défilement d'une liste qu'on est en train de cocher.
   */
  const sessionsAffichees = useMemo(
    () => rows.flatMap(r => (r.kind === 'session' ? [r.session] : [])),
    [rows],
  )
  const premierBalayable = useMemo(
    () => sessionsAffichees.find(s => peutSupprimer(s) || s.status !== 'closed') ?? null,
    [sessionsAffichees, peutSupprimer],
  )
  const montrerIndice =
    balayageAVoir && !montrerGuide && !selection &&
    sessionsAffichees.length >= 2 && premierBalayable !== null

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']} onStartShouldSetResponderCapture={auContact}>
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
                onClose={item.session.status !== 'closed' ? () => confirmerCloture(item.session) : undefined}
                onVoletOuvert={noterVolet}
                onVoletFerme={oublierVolet}
                selection={selection}
                coche={coches.includes(item.session.id)}
                onToggle={peutSupprimer(item.session) ? () => basculer(item.session.id) : undefined}
                indice={montrerIndice && item.session.id === premierBalayable?.id}
                onIndiceCompris={balayageVu}
              />
            )
          }
          contentContainerStyle={styles.list}
          // Faire défiler la liste referme aussi : on ne laisse pas un volet
          // ouvert disparaître vers le haut de l'écran.
          onScrollBeginDrag={fermerVolet}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.textMuted} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {/* Le bandeau se pose au-dessus de la liste, il ne la
                  remplace jamais. Le guide pleine page qui l'a précédé
                  masquait l'inventaire qu'on venait de créer : à 76 px, la
                  question ne se pose plus. */}
              {carteGuide}
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
            sansMagasin ? (
              <View style={styles.videCard}>
                <Text style={styles.videTitre}>
                  {profile?.is_company_admin
                    ? 'Votre entreprise n’a encore aucun magasin'
                    : 'Aucun magasin ne vous est affecté'}
                </Text>
                <Text style={styles.videTexte}>
                  {/* Même piège que sur l'écran Magasins : un administrateur
                      d'entreprise supervise tous les magasins des siens. Lui
                      parler d'affectation le renverrait à lui-même. */}
                  {profile?.is_company_admin
                    ? 'Un inventaire se rattache à un magasin. Demandez à Quantinvo d’en ajouter un depuis la page Magasins du site.'
                    : 'Un inventaire se rattache à un magasin. L’administrateur de votre entreprise vous en affecte un depuis la page Mon équipe du site.'}
                </Text>
              </View>
            ) : (
              <View style={styles.center}>
                <Text style={styles.emptyText}>Aucun inventaire pour l&apos;instant</Text>
              </View>
            )
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
        /* ⚠️ **« + Nouvel inventaire » ne se masque jamais.**
         *
         * Il l'était quand le bandeau en était à l'étape de création et que la
         * liste était vide — pour éviter un doublon. Vu par Julien le 23 août
         * 2026 : l'écran ne portait plus qu'un bandeau, une salutation et
         * « Aucun inventaire pour l'instant ». Le chevron d'un bandeau **ne se
         * lit pas comme un bouton** : on ne sait plus quoi faire.
         *
         * Ce n'est pas non plus le doublon d'autrefois — le guide pleine page
         * portait un bouton violet portant le même libellé. Une rangée de
         * 76 px et un bouton d'action ne se confondent pas.
         */
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
      // La liste espace ses éléments par `gap` : les volets doivent donc faire
      // exactement la hauteur de la carte, sans marge basse qui les
      // raccourcirait.
      width: 96, borderRadius: Radius.lg,
      alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    balayageVolets: { flexDirection: 'row', gap: Spacing.sm, marginLeft: Spacing.sm },
    balayageCloturer: { backgroundColor: t.warning },
    balayageSupprimer: { backgroundColor: t.danger },
    balayageTexte: { color: '#fff', fontSize: 13, fontFamily: Font.semibold },

    /* La bulle de l'indice de balayage. Elle s'inverse — encre sur fond clair,
       clair sur fond d'encre — parce qu'elle doit se détacher d'une liste de
       cartes, dans les deux thèmes. */
    indiceBulle: {
      marginTop: Spacing.sm,
      backgroundColor: t.textPrimary,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    indiceTexte: { color: t.background, fontSize: 13, lineHeight: 18, fontFamily: Font.regular },
    indiceBtn: { alignSelf: 'flex-end' },
    indiceCompris: { color: t.background, fontSize: 13, fontFamily: Font.semibold },
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
    videCard: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: Radius.lg,
      padding: Spacing.xl, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, gap: Spacing.sm },
    videTitre: { color: t.textPrimary, fontSize: 16, fontFamily: Font.semibold },
    videTexte: { color: t.textSecondary, fontSize: 14, fontFamily: Font.regular, lineHeight: 20 },
    fab: {
      position: 'absolute', bottom: Spacing.xxl, left: Spacing.xxl, right: Spacing.xxl,
      backgroundColor: t.accent, borderRadius: Radius.lg, paddingVertical: Spacing.lg,
      alignItems: 'center', ...t.shadowElevated,
    },
    fabText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },
  })
}
