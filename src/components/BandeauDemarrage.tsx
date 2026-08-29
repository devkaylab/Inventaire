/**
 * Le bandeau de démarrage — **une seule étape à la fois**, sur une rangée.
 *
 * Il remplace le bloc « Pour démarrer », qui déroulait quatre étapes et
 * occupait le haut de l'écran. Deux choses ont changé, et la seconde est la
 * plus importante :
 *
 * 1. **La forme** : un bandeau de 76 px, cliquable de bout en bout, avec un
 *    chevron et une croix. Il annonce, il n'explique pas — l'explication vit
 *    dans l'écran où l'on atterrit.
 * 2. **L'objet** : il ne vise plus *un inventaire* mais le **démarrage du
 *    superviseur**. Ses trois étapes sont ce qu'il faut avoir fait une fois
 *    pour être en état de travailler — imprimer ses balises, avoir des
 *    compteurs, lancer son premier inventaire — et non la préparation d'une
 *    session, qui se conduit depuis la session elle-même.
 *
 * ⚠️ **Les étapes se cochent sur des faits, jamais à la main.** Deux se
 * lisent en base (l'équipe, les inventaires créés) ; la troisième ne le peut
 * pas : une planche de balises est dessinée sur le téléphone et **ne laisse
 * aucune trace en base**. Elle se coche donc sur un **jalon local**, posé au
 * moment exact où la planche est produite (voir `poserJalon` dans
 * `lib/reperes.ts`). Sans ce jalon, l'étape 1 resterait éternellement à
 * faire — c'est le piège de ce chantier.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { CroixIcon } from '@/components/ui/Icones'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

export type CleEtape = 'balises' | 'equipe' | 'inventaire' | 'magasins' | 'superviseurs'

export type EtapeDemarrage = {
  cle: CleEtape
  titre: string
  faite: boolean
}

/** Les faits qui cochent les étapes. Aucun n'est déclaratif. */
export type FaitsDemarrage = {
  /** Jalon local : une planche a été produite depuis ce téléphone. */
  balisesImprimees: boolean
  /** Au moins un compteur dans un magasin, ou une invitation en attente. */
  equipeConstituee: boolean
  /** Au moins un inventaire créé par cette personne. */
  inventaireCree: boolean
}

/**
 * L'ordre suit le travail réel : on colle ses balises dans le magasin, on se
 * donne des compteurs, puis on lance l'inventaire qui se sert des deux. Les
 * balises viennent en tête parce qu'elles s'impriment, se découpent et se
 * collent — c'est l'étape la plus longue en jours, pas en clics.
 */
export function etapesDemarrage(faits: FaitsDemarrage): EtapeDemarrage[] {
  return [
    { cle: 'balises', titre: 'Générer mes balises', faite: faits.balisesImprimees },
    { cle: 'equipe', titre: 'Constituer mon équipe', faite: faits.equipeConstituee },
    { cle: 'inventaire', titre: 'Créer mon premier inventaire', faite: faits.inventaireCree },
  ]
}

/**
 * ⚠️ **Les faits qui vivent EN BASE suffisent à clore le démarrage.**
 *
 * L'étape des balises se coche sur un jalon LOCAL — une planche dessinée sur
 * le téléphone n'écrit rien en base, aucun fait serveur ne dira jamais qu'elle
 * a été produite. Conséquence : changer d'appareil la remet à faire.
 *
 * Ce qui était acceptable pour l'ordre des étapes ne l'est pas pour la fin du
 * démarrage. Constat de Julien le 29 août 2026, sur un compte qui a une équipe
 * et un inventaire depuis des semaines : « j'en ai assez de voir ce bandeau ».
 * Un jalon d'appareil ne doit **jamais**, à lui seul, ramener un bandeau
 * d'accueil à quelqu'un dont le compte montre qu'il connaît le produit.
 *
 * L'équipe et l'inventaire, eux, se lisent en base et suivent la personne d'un
 * téléphone à l'autre. Les deux faits réunis closent le démarrage.
 */
export function demarrageAcquis(faits: FaitsDemarrage): boolean {
  return faits.equipeConstituee && faits.inventaireCree
}

/** La première étape non faite — celle que le bandeau montre, et la seule. */
export function etapeCourante(etapes: EtapeDemarrage[]): EtapeDemarrage | null {
  return etapes.find(e => !e.faite) ?? null
}

/**
 * Les trois étapes d'un **administrateur d'entreprise**.
 *
 * Elles ne sont pas les mêmes que celles d'un superviseur, et c'est le fond du
 * sujet : il n'imprime pas de balises et ne compte pas. Son démarrage, c'est
 * que ses magasins soient tenus par quelqu'un, puis qu'un premier inventaire
 * parte. Un seul bandeau à l'écran : c'est celui-ci qu'il voit, pas l'autre.
 *
 * ⚠️ « Un superviseur par magasin » **ne se compte pas lui-même** : il a tous
 * les magasins par construction (déclencheurs du 22 août 2026). La RPC
 * l'exclut déjà de `supervisors` ; sans cela l'étape serait cochée d'office et
 * ne dirait rien.
 */
export type FaitsAdmin = {
  magasins: number
  magasinsSansSuperviseur: number
  /** Un inventaire a déjà été créé quelque part dans l'entreprise. */
  inventaireLance: boolean
}

export function etapesAdmin(faits: FaitsAdmin): EtapeDemarrage[] {
  return [
    { cle: 'magasins', titre: 'Vos magasins sont créés', faite: faits.magasins > 0 },
    {
      cle: 'superviseurs',
      titre: 'Un superviseur par magasin',
      faite: faits.magasins > 0 && faits.magasinsSansSuperviseur === 0,
    },
    { cle: 'inventaire', titre: 'Un premier inventaire lancé', faite: faits.inventaireLance },
  ]
}

function IconeEtape({ cle, color }: { cle: CleEtape; color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {/* Les balises : un QR code, ce qu'on imprime réellement. */}
      {cle === 'balises' && (
        <>
          <Rect x="3" y="3" width="7" height="7" rx="1.4" />
          <Rect x="14" y="3" width="7" height="7" rx="1.4" />
          <Rect x="3" y="14" width="7" height="7" rx="1.4" />
          <Path d="M14 14h3v3h-3zM20.5 14v3M14 20.5h7" />
        </>
      )}
      {/* Une devanture : un magasin, pas un bâtiment quelconque. */}
      {cle === 'magasins' && (
        <>
          <Path d="M3.5 9.5 5 4h14l1.5 5.5a2.6 2.6 0 0 1-5 .9 2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-5 0 2.6 2.6 0 0 1-2.5-.9z" />
          <Path d="M5 11.5V20h14v-8.5M10 20v-5h4v5" />
        </>
      )}
      {(cle === 'equipe' || cle === 'superviseurs') && (
        <>
          <Circle cx="9" cy="8" r="3.4" />
          <Path d="M2.6 20a6.4 6.4 0 0 1 12.8 0M18.5 8.2v5.6M15.7 11h5.6" />
        </>
      )}
      {cle === 'inventaire' && (
        <>
          <Rect x="4" y="3" width="16" height="18" rx="2" />
          <Path d="M8 8h8M8 12h8M8 16h5" />
        </>
      )}
    </Svg>
  )
}

/** Le chevron : la carte entière est cliquable, il le dit. */
function ChevronIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  )
}

export function BandeauDemarrage({
  etapes, onAction, onMasquer,
}: {
  etapes: EtapeDemarrage[]
  onAction: (cle: CleEtape) => void
  onMasquer: () => void
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const courante = etapeCourante(etapes)

  // Tout est fait : le bandeau s'efface de lui-même. C'est ce qui rend la
  // croix facultative plutôt qu'obligatoire.
  if (!courante) return null

  const rang = etapes.indexOf(courante) + 1

  return (
    <Pressable
      style={styles.carte}
      onPress={() => onAction(courante.cle)}
      accessibilityRole="button"
      accessibilityLabel={`Pour démarrer, étape ${rang} sur ${etapes.length} : ${courante.titre}`}
    >
      <View style={styles.pastille}>
        <IconeEtape cle={courante.cle} color={theme.accent} />
      </View>

      <View style={styles.texte}>
        <Text style={styles.surtitre} numberOfLines={1}>
          POUR DÉMARRER · <Text style={tabular}>{rang} SUR {etapes.length}</Text>
        </Text>
        <View style={styles.ligne}>
          <Text style={styles.titre} numberOfLines={1}>{courante.titre}</Text>
          <ChevronIcon color={theme.accent} />
        </View>
      </View>

      {/* La croix est loin du chevron, et non au-dessus : à cette hauteur,
          deux cibles superposées se toucheraient l'une pour l'autre. */}
      <Pressable
        style={styles.croix}
        onPress={onMasquer}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Masquer ce guide"
      >
        <CroixIcon color={theme.textMuted} size={13} />
      </Pressable>
    </Pressable>
  )
}

const makeStyles = (t: Theme) => StyleSheet.create({
  carte: {
    minHeight: 76,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: t.surface, borderColor: t.accent, borderWidth: 1, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, paddingLeft: Spacing.md, paddingRight: Spacing.sm,
  },
  pastille: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  texte: { flex: 1, gap: 3 },
  surtitre: { color: t.textMuted, fontSize: 10.5, fontFamily: Font.semibold, letterSpacing: 0.7 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  titre: { color: t.textPrimary, fontSize: 15, fontFamily: Font.semibold, letterSpacing: -0.2, flexShrink: 1 },
  croix: { padding: Spacing.sm },
})
