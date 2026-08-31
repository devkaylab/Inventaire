import { StyleSheet, Text, View, Pressable } from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'

import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { useTheme } from '@/lib/theme'

/**
 * Une astuce : ce que l'écran ne dit pas, dit une fois, à sa place.
 *
 * Le volet du scanner (`scanner.tsx`) reste le format des deux repères du
 * premier scan : il couvre l'écran parce qu'il annonce un événement. Celui-ci
 * est l'autre moitié du vocabulaire — il **explique ce qu'on a sous les yeux**,
 * donc il vit dans le flux, à côté de ce dont il parle, et ne masque rien.
 *
 * ⚠️ **Il n'invente aucun style.** Fond `surface`, filet `hairline`, rayon
 * `lg` : la même carte que `navRow` et les blocs des autres écrans. Un repère
 * qui se dessine autrement que le reste se lit comme une publicité.
 *
 * @param ton      `info` (accent) ou `succes` (vert) — le second ne sert qu'à
 *                 un état, pas à une explication.
 * @param onCompris  absent = l'astuce est un **état**, elle revient quand les
 *                 faits reviennent et ne se marque pas. Présent = c'est un
 *                 **repère**, il se ferme et ne revient plus.
 */
export function Astuce({
  titre,
  children,
  ton = 'info',
  onCompris,
  libelleCompris = 'Compris',
}: {
  titre: string
  children: React.ReactNode
  ton?: 'info' | 'succes'
  onCompris?: () => void
  libelleCompris?: string
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const couleur = ton === 'succes' ? theme.success : theme.accent

  return (
    <View style={[styles.carte, ton === 'succes' && styles.carteSucces]}>
      <View style={styles.tete}>
        <View style={[styles.icone, { borderColor: couleur + '59', backgroundColor: couleur + '22' }]}>
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={2.2}
               strokeLinecap="round" strokeLinejoin="round">
            {ton === 'succes' ? (
              <Path d="M20 6 9 17l-5-5" />
            ) : (
              <>
                <Circle cx={12} cy={12} r={9} />
                <Path d="M12 11v5M12 8h.01" />
              </>
            )}
          </Svg>
        </View>
        {/* `flex: 1` + `flexShrink` : sans eux un titre long pousse l'icône
            hors de la carte au lieu de passer à la ligne. */}
        <Text style={styles.titre}>{titre}</Text>
      </View>
      <Text style={styles.texte}>{children}</Text>
      {onCompris && (
        <Pressable
          style={styles.bouton}
          onPress={onCompris}
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
        >
          <Text style={styles.boutonTexte}>{libelleCompris}</Text>
        </Pressable>
      )}
    </View>
  )
}

/** Le fragment mis en avant dans une astuce, sans changer de taille. */
export function Fort({ children }: { children: React.ReactNode }) {
  const theme = useTheme()
  return <Text style={{ color: theme.textPrimary, fontFamily: Font.semibold }}>{children}</Text>
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    carte: {
      backgroundColor: t.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: t.hairline,
      padding: Spacing.lg,
      gap: Spacing.xs,
    },
    carteSucces: { borderColor: t.success + '59', backgroundColor: t.successSoft },
    // ⚠️ `flex-start` + un décalage négatif de la moitié de l'écart entre
    // l'icône (30) et l'interligne (20) : l'icône se centre sur la PREMIÈRE
    // ligne, quel que soit le nombre de lignes du titre. Avec `center` elle
    // flottait au milieu d'un titre de trois lignes, loin du mot qu'elle
    // annonce.
    tete: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    icone: {
      width: 30, height: 30, borderRadius: 999, borderWidth: 1, marginTop: -5,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    titre: {
      flex: 1, flexShrink: 1,
      color: t.textPrimary, fontSize: 15, fontFamily: Font.semibold, letterSpacing: -0.2, lineHeight: 20,
    },
    texte: { color: t.textSecondary, fontSize: 13.5, fontFamily: Font.regular, lineHeight: 19.5 },
    // La cible fait 44 pt de haut avec le `hitSlop` : un lien de fermeture se
    // touche au pouce, en marchant, comme le reste de cet écran.
    bouton: { alignSelf: 'flex-start', paddingVertical: Spacing.xs, marginTop: 2 },
    boutonTexte: { color: t.accent, fontSize: 14, fontFamily: Font.semibold },
  })
