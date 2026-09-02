/**
 * Les deux surfaces qui remplacent `Alert.alert` : la carte qui pose une
 * question, et le bandeau qui annonce ce qui vient de se passer.
 *
 * Direction retenue avec Julien le 24 août 2026 (canevas B). Le raisonnement
 * et le partage entre les deux vivent dans `lib/dialogue.ts` ; ici, il n'y a
 * que le dessin et ce qu'il a fallu apprendre pour le poser.
 *
 * ── Trois choix qui ne sont pas des goûts ───────────────────────────────────
 *
 * **La carte est un `Modal`, le bandeau non.** Une question doit passer
 * au-dessus de tout, y compris des quatre `Modal` de l'app (fiche d'un
 * inventaire, formulaire de balises, les deux volets du scanner) — et sur iOS
 * rien ne passe au-dessus d'un `Modal` sans en être un. Le bandeau, lui, ne
 * bloque rien et n'a pas à couvrir : il reste une surcouche du layout racine.
 * Conséquence assumée : un bandeau déclenché pendant qu'un `Modal` est ouvert
 * ne se verra qu'à sa fermeture.
 *
 * **La réponse part au démontage, pas au toucher.** `onDismiss` (iOS) attend
 * que la carte ait fini de disparaître. Sans cela, une action qui ouvre une
 * feuille de partage juste après un « oui » se heurterait au refus d'iOS
 * « présentation déjà en cours » — la panne qui avait rendu l'impression des
 * balises inutilisable. Le repli minuté couvre Android, qui n'a pas
 * `onDismiss`.
 *
 * **Le voile ne referme rien.** Toucher à côté n'est pas une réponse : sur une
 * suppression, ce serait ambigu, et sur un refus du serveur, ce serait perdre
 * l'explication d'un geste de travers. On répond par un bouton.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import {
  DUREES,
  abonnerDialogue,
  lireDialogue,
  questionRefermee,
  retirerNouvelle,
  type Nouvelle,
  type Reponse,
  type TonNouvelle,
} from '@/lib/dialogue'
import { useTheme } from '@/lib/theme'
import { AlerteIcon, CocheIcon, AstuceIcon } from '@/components/ui/Icones'

/** Repli pour Android, qui n'a pas `onDismiss` : la durée du fondu, plus une marge. */
const FERMETURE_MS = 260

export function Dialogues() {
  const etat = useSyncExternalStore(abonnerDialogue, lireDialogue, lireDialogue)
  return (
    <>
      <CarteQuestion question={etat.question} />
      <Bandeaux nouvelles={etat.nouvelles} />
    </>
  )
}

// ─────────────────────────────────────────────────────────── La question ────

type QuestionPosee = ReturnType<typeof lireDialogue>['question']

function CarteQuestion({ question }: { question: QuestionPosee }) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  // La réponse est retenue le temps que la carte disparaisse.
  const reponse = useRef<{ id: number; choix: Reponse } | null>(null)
  // ⚠️ **Rien ne synchronise `visible` sur `question` dans un effet.** Un
  // `setState` dans un effet déclenche un rendu en cascade (la règle
  // `react-hooks/set-state-in-effect`, déjà rencontrée sur ce projet). La
  // visibilité se DÉDUIT : il y a une question, et on n'est pas en train de
  // la refermer. Seule la fermeture est un état, parce qu'elle dure le temps
  // du fondu — c'est elle qui laisse `onDismiss` arriver.
  const [fermeture, setFermeture] = useState(false)

  const repondre = (choix: Reponse) => {
    if (!question) return
    reponse.current = { id: question.id, choix }
    setFermeture(true)
    // Android n'appelle pas `onDismiss` : on relaie à la main.
    if (Platform.OS !== 'ios') setTimeout(vider, FERMETURE_MS)
  }

  const vider = () => {
    const r = reponse.current
    if (!r) return
    reponse.current = null
    setFermeture(false)
    questionRefermee(r.id, r.choix)
  }

  if (!question) return null

  const danger = question.ton === 'danger'
  const teinte = danger ? theme.danger : theme.accent
  const surtitre = question.surtitre ?? (danger ? 'Action définitive' : 'Confirmation')

  return (
    <Modal
      visible={!!question && !fermeture}
      transparent
      animationType="fade"
      onDismiss={vider}
      // Le retour matériel d'Android vaut « Annuler » : c'est la réponse sûre.
      onRequestClose={() => repondre('annuler')}
      statusBarTranslucent
    >
      <View style={styles.voile}>
        <View style={styles.carte}>
          <Text style={[styles.surtitre, { color: teinte }]}>{surtitre.toUpperCase()}</Text>
          <Text style={styles.titre}>{question.titre}</Text>
          {!!question.texte && <Text style={styles.texte}>{question.texte}</Text>}
          {!!question.note && (
            <>
              <View style={styles.filet} />
              <Text style={styles.note}>{question.note}</Text>
            </>
          )}
          {/* ⚠️ Trois choix s'EMPILENT, deux restent côte à côte. Sur la
              largeur d'un téléphone, trois pastilles cassent leurs libellés sur
              trois lignes — et l'ordre compte : le geste qui ne détruit rien
              d'abord, le destructeur qu'on va chercher ensuite, la sortie en
              dernier. Même règle que les volets de la liste d'inventaires. */}
          <View style={question.alternative ? styles.boutonsColonne : styles.boutons}>
            <Pressable
              style={({ pressed }) => [
                styles.btnPlein,
                question.alternative && styles.btnLarge,
                { backgroundColor: teinte },
                pressed && styles.presse,
              ]}
              onPress={() => repondre('action')}
              accessibilityRole="button"
            >
              <Text style={styles.btnPleinText}>{question.action ?? 'Confirmer'}</Text>
            </Pressable>
            {!!question.alternative && (
              <Pressable
                style={({ pressed }) => [
                  styles.btnContour, styles.btnLarge,
                  { borderColor: theme.danger },
                  pressed && styles.presse,
                ]}
                onPress={() => repondre('alternative')}
                accessibilityRole="button"
              >
                <Text style={[styles.btnContourText, { color: theme.danger }]}>
                  {question.alternative}
                </Text>
              </Pressable>
            )}
            {/* Un avertissement n'a rien à refuser : son bouton prend toute
                la largeur plutôt que de laisser un vide à côté. */}
            {!question.seul && (
              <Pressable
                style={({ pressed }) => [
                  question.alternative ? styles.btnFantome : styles.btnContour,
                  question.alternative && styles.btnLarge,
                  pressed && styles.presse,
                ]}
                onPress={() => repondre('annuler')}
                accessibilityRole="button"
              >
                <Text style={styles.btnContourText}>{question.annuler ?? 'Annuler'}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────── Les nouvelles ──

function Bandeaux({ nouvelles }: { nouvelles: Nouvelle[] }) {
  const insets = useSafeAreaInsets()
  if (!nouvelles.length) return null
  return (
    // `box-none` : la zone ne prend pas les touchers, seuls les bandeaux le font.
    <View
      pointerEvents="box-none"
      style={[stylesFixes.pile, { paddingBottom: insets.bottom + Spacing.lg }]}
    >
      {nouvelles.map((n) => (
        <Bandeau key={n.id} nouvelle={n} />
      ))}
    </View>
  )
}

function Bandeau({ nouvelle }: { nouvelle: Nouvelle }) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [anim] = useState(() => new Animated.Value(0))
  const partie = useRef(false)

  useEffect(() => {
    const partir = () => {
      if (partie.current) return
      partie.current = true
      Animated.timing(anim, {
        toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(() => retirerNouvelle(nouvelle.id))
    }
    Animated.timing(anim, {
      toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start()
    const t = setTimeout(partir, DUREES[nouvelle.ton])
    return () => clearTimeout(t)
  }, [anim, nouvelle.id, nouvelle.ton])

  const teintes: Record<TonNouvelle, string> = {
    succes: theme.success,
    erreur: theme.danger,
    info: theme.accent,
  }
  const fonds: Record<TonNouvelle, string> = {
    succes: theme.successSoft,
    erreur: theme.dangerSoft,
    info: theme.accentSoft,
  }
  const teinte = teintes[nouvelle.ton]
  const Trace = nouvelle.ton === 'succes' ? CocheIcon : nouvelle.ton === 'erreur' ? AlerteIcon : AstuceIcon

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.bandeau,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      {/* Toucher un bandeau le renvoie : on n'attend pas la fin du minuteur. */}
      <Pressable style={styles.bandeauCorps} onPress={() => retirerNouvelle(nouvelle.id)}>
        <View style={[styles.bandeauIcone, { backgroundColor: fonds[nouvelle.ton] }]}>
          <Trace color={teinte} size={16} />
        </View>
        <View style={styles.bandeauTextes}>
          <Text style={styles.bandeauTitre} numberOfLines={2}>{nouvelle.titre}</Text>
          {!!nouvelle.texte && (
            <Text style={styles.bandeauTexte} numberOfLines={3}>{nouvelle.texte}</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  )
}

const stylesFixes = StyleSheet.create({
  pile: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    // Au-dessus de la porte de bienvenue (50), sous le splash (100).
    zIndex: 60,
  },
})

const makeStyles = (t: Theme) => StyleSheet.create({
  voile: {
    flex: 1,
    backgroundColor: 'rgba(5,7,13,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  carte: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: t.surfaceElevated,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    ...t.shadowElevated,
  },
  surtitre: { fontSize: 11, fontFamily: Font.semibold, letterSpacing: 1 },
  titre: {
    color: t.textPrimary, fontSize: 19, fontFamily: Font.bold,
    letterSpacing: -0.3, lineHeight: 25, marginTop: Spacing.sm,
  },
  texte: {
    color: t.textSecondary, fontSize: 14, fontFamily: Font.regular,
    lineHeight: 20, marginTop: Spacing.sm,
  },
  filet: { height: 1, backgroundColor: t.border, marginTop: Spacing.lg },
  note: {
    color: t.textMuted, fontSize: 13, fontFamily: Font.regular,
    lineHeight: 18, marginTop: Spacing.md,
  },
  // ⚠️ `row-reverse`, et ce n'est pas une coquetterie. Le balisage écrit le
  // bouton plein EN PREMIER, parce que c'est l'ordre d'une colonne à trois
  // choix. En rangée, le plein doit rester à DROITE comme partout ailleurs
  // dans l'application : l'inversion le remet à sa place sans qu'on ait à
  // écrire deux fois les mêmes boutons.
  boutons: { flexDirection: 'row-reverse', gap: Spacing.sm + 2, marginTop: Spacing.xl },
  boutonsColonne: { flexDirection: 'column', gap: Spacing.sm, marginTop: Spacing.xl },
  // Empilé, un bouton prend toute la largeur : `flex: 1` étirerait la hauteur.
  btnLarge: { flex: 0, alignSelf: 'stretch', minHeight: 48 },
  btnFantome: {
    flex: 1, minHeight: 44, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
  },
  // 44 px : la cible tactile minimale, et la hauteur des boutons de la charte.
  //
  // ⚠️ **`minHeight`, pas `height`.** Les deux boutons sont à `flex: 1`, donc
  // à largeur égale quelle que soit la longueur des libellés : sur la largeur
  // d'un téléphone, « Compter quand même » passe à la ligne. Avec une hauteur
  // figée, le texte débordait de la pastille — vu au simulateur le 25 août
  // 2026. Il fait maintenant grandir le bouton, et le `stretch` de la rangée
  // donne la même hauteur à son voisin. Le rembourrage horizontal et le
  // centrage vont avec : sans eux, un libellé sur deux lignes se colle au
  // bord.
  btnContour: {
    flex: 1, minHeight: 44, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: t.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  btnContourText: {
    color: t.textSecondary, fontSize: 15, fontFamily: Font.medium, textAlign: 'center',
  },
  btnPlein: {
    flex: 1, minHeight: 44, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPleinText: {
    color: t.onAccent, fontSize: 15, fontFamily: Font.semibold, textAlign: 'center',
  },
  presse: { opacity: 0.75 },

  bandeau: {
    backgroundColor: t.surfaceElevated,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: Radius.lg,
    ...t.shadowElevated,
  },
  bandeauCorps: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  bandeauIcone: {
    width: 32, height: 32, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  bandeauTextes: { flex: 1, gap: 2 },
  bandeauTitre: { color: t.textPrimary, fontSize: 14.5, fontFamily: Font.semibold },
  bandeauTexte: { color: t.textSecondary, fontSize: 13, fontFamily: Font.regular, lineHeight: 18 },
})
