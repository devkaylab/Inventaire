/**
 * L'écran de bienvenue — la première ouverture, une seule fois par appareil.
 *
 * Ce n'est pas un carrousel : personne n'a rien à apprendre de Quantinvo à cet
 * instant. Le compte existe déjà, le rôle est connu, le magasin aussi. L'écran
 * fait trois choses et s'efface :
 *
 *   1. il nomme la personne et sa place — c'est la preuve qu'elle est au bon
 *      endroit, et un saisonnier reconnaît son magasin, pas notre marque ;
 *   2. il donne le modèle mental en trois lignes ;
 *   3. il met au travail, d'un bouton.
 *
 * « Plus tard » mène directement au travail : rien ici n'est obligatoire
 * (règle Apple HIG, reprise dans la maquette du 23 août 2026).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { AppLogo } from '@/components/AppLogo'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

export type RoleBienvenue = 'employee' | 'supervisor' | 'company_admin'

type Ligne = { icone: 'balise' | 'scan' | 'coche' | 'planche' | 'fichier' | 'equipe' | 'magasin' | 'ordi'; titre: string; texte: string }

const TRACES: Record<Ligne['icone'], React.ReactNode> = {
  balise: <><Path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><Rect x="8" y="8" width="8" height="8" rx="1" /></>,
  scan: <Path d="M3 6v12M7 6v12M11 6v12M14 6v12M18 6v12M21 6v12" />,
  coche: <Path d="M5 12l4 4L19 6" />,
  planche: <><Path d="M6 9V4h12v5M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" /><Rect x="6" y="14" width="12" height="6" /></>,
  fichier: <><Path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" /><Path d="M14 3v5h5M8 13h8M8 17h5" /></>,
  equipe: <><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2" /></>,
  magasin: <Path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6" />,
  ordi: <><Rect x="3" y="4" width="18" height="12" rx="2" /><Path d="M8 20h8M12 16v4" /></>,
}

/**
 * Le contenu dépend du rôle, la structure non. On ne demande jamais qui est la
 * personne : `profiles` le sait déjà (règle Material — ne pas demander ce que
 * le système connaît).
 */
function contenu(role: RoleBienvenue, magasin: string | null, entreprise: string | null) {
  if (role === 'employee') {
    return {
      place: magasin
        ? `Vous faites partie de l’équipe d’inventaire de ${magasin}.`
        : 'Vous faites partie d’une équipe d’inventaire.',
      titreListe: 'Ce que vous ferez ici',
      lignes: [
        { icone: 'balise', titre: 'Scanner la balise d’un rayon', texte: 'L’étiquette collée sur l’étagère ouvre la zone.' },
        { icone: 'scan', titre: 'Scanner les articles', texte: 'Chaque lecture ajoute une pièce. La quantité s’ajuste d’un geste.' },
        { icone: 'coche', titre: 'Terminer la balise', texte: 'Et passer au rayon suivant. Votre superviseur voit l’avancement en direct.' },
      ] as Ligne[],
      action: 'Commencer',
    }
  }
  if (role === 'company_admin') {
    return {
      place: entreprise
        ? `Vous administrez ${entreprise}.`
        : 'Vous administrez votre entreprise.',
      titreListe: 'Ce que vous voyez ici',
      lignes: [
        { icone: 'magasin', titre: 'Vos magasins', texte: 'Leurs codes, leurs équipes, leurs inventaires.' },
        { icone: 'equipe', titre: 'Vos superviseurs', texte: 'Ce sont eux qui préparent et lancent les inventaires.' },
        { icone: 'ordi', titre: 'L’administration, sur l’ordinateur', texte: 'Inviter, affecter, lire le journal : sur le site.' },
      ] as Ligne[],
      action: 'Voir mes magasins',
    }
  }
  return {
    place: magasin
      ? `Vous supervisez ${magasin}${entreprise ? ` pour ${entreprise}` : ''}.`
      : 'Vous supervisez un magasin.',
    titreListe: 'Un inventaire, c’est',
    lignes: [
      { icone: 'planche', titre: 'Des balises imprimées', texte: 'Collées sur les rayons, elles découpent le magasin en zones.' },
      { icone: 'fichier', titre: 'Votre référentiel et votre stock', texte: 'Importés depuis l’app ou depuis le site. C’est ce qui rend l’écart lisible.' },
      { icone: 'equipe', titre: 'Vos compteurs', texte: 'Ils scannent depuis leur téléphone ; vous suivez en direct.' },
    ] as Ligne[],
    action: 'Préparer mon premier inventaire',
  }
}

export function Bienvenue({
  prenom, role, magasin, entreprise, onCommencer, onPlusTard,
}: {
  prenom: string | null
  role: RoleBienvenue
  magasin: string | null
  entreprise: string | null
  onCommencer: () => void
  onPlusTard: () => void
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const c = contenu(role, magasin, entreprise)

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.corps}>
        <AppLogo size={40} animated={false} />
        <Text style={styles.eyebrow}>Première ouverture</Text>
        <Text style={styles.titre}>{prenom ? `Bonjour ${prenom}.` : 'Bonjour.'}</Text>
        <Text style={styles.place}>{c.place}</Text>

        <View style={styles.carte}>
          <Text style={styles.carteLabel}>{c.titreListe}</Text>
          {c.lignes.map((l, i) => (
            <View key={l.titre} style={[styles.rang, i > 0 && styles.rangSep]}>
              <View style={styles.icone}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth={2}>
                  {TRACES[l.icone]}
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rangTitre}>{l.titre}</Text>
                <Text style={styles.rangTexte}>{l.texte}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.pied}>
        <Pressable style={styles.btn} onPress={onCommencer}>
          <Text style={styles.btnText}>{c.action}</Text>
        </Pressable>
        <Pressable style={styles.lien} onPress={onPlusTard}>
          <Text style={styles.lienText}>Plus tard</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const makeStyles = (t: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  corps: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, paddingBottom: Spacing.lg },
  eyebrow: { color: t.textMuted, fontSize: 11, fontFamily: Font.semibold, letterSpacing: 1, textTransform: 'uppercase', marginTop: Spacing.xxxl },
  titre: { color: t.textPrimary, fontSize: 30, fontFamily: Font.bold, letterSpacing: -0.6, marginTop: Spacing.xs },
  place: { color: t.textSecondary, fontSize: 15, fontFamily: Font.regular, lineHeight: 22, marginTop: Spacing.sm },
  carte: { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, marginTop: Spacing.xxl },
  carteLabel: { color: t.textMuted, fontSize: 11, fontFamily: Font.semibold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: Spacing.sm },
  rang: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md },
  rangSep: { borderTopWidth: 1, borderTopColor: t.border },
  icone: { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rangTitre: { color: t.textPrimary, fontSize: 14, fontFamily: Font.semibold },
  rangTexte: { color: t.textSecondary, fontSize: 13, fontFamily: Font.regular, lineHeight: 18, marginTop: 1 },
  pied: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.xs },
  btn: { height: 48, borderRadius: Radius.md, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', ...t.shadowButton },
  btnText: { color: t.onAccent, fontSize: 15, fontFamily: Font.semibold },
  lien: { alignItems: 'center', paddingVertical: Spacing.md },
  lienText: { color: t.textSecondary, fontSize: 14, fontFamily: Font.medium },
})
