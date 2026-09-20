import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { router, usePathname } from 'expo-router'
import { useTheme } from '@/lib/theme'
import { Font, type Theme } from '@/constants/ink'

/**
 * La barre du bas de l'espace inventoriste — Missions, Planning, Revenus, Profil.
 *
 * ⚠️ **QUATRE DESTINATIONS, ET PAS UNE DE PLUS.** C'est une application qu'on
 * ouvre debout, dans un magasin, souvent d'une main. Le score vit sous le
 * profil : on le consulte, on n'y va pas.
 *
 * ⚠️ **ET ELLE N'EXISTE QUE DANS CE GROUPE.** L'espace du compteur et celui du
 * superviseur n'ont pas de barre d'onglets ; leur navigation est une pile. En
 * poser une ici est un écart assumé : un inventoriste passe de ses missions à
 * ses disponibilités et à ses revenus plusieurs fois par semaine, sans
 * hiérarchie entre les trois.
 */
const ONGLETS = [
  { href: '/(provider)/', libelle: 'Missions', cle: 'index' },
  { href: '/(provider)/planning', libelle: 'Planning', cle: 'planning' },
  { href: '/(provider)/revenus', libelle: 'Revenus', cle: 'revenus' },
  { href: '/(provider)/profil', libelle: 'Profil', cle: 'profil' },
] as const

function Icone({ cle, couleur }: { cle: string; couleur: string }) {
  const commun = { stroke: couleur, strokeWidth: 2, fill: 'none' as const }
  switch (cle) {
    case 'planning':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={8.5} {...commun} />
          <Path d="M12 7.5V12l3 2" {...commun} strokeLinecap="round" />
        </Svg>
      )
    case 'revenus':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d="M4 18V9M10 18V5M16 18v-6M22 18H2" {...commun} strokeLinecap="round" />
        </Svg>
      )
    case 'profil':
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Circle cx={12} cy={8.5} r={3.8} {...commun} />
          <Path d="M4.5 20c0-3.6 3.4-5.5 7.5-5.5s7.5 1.9 7.5 5.5" {...commun} strokeLinecap="round" />
        </Svg>
      )
    default:
      return (
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Rect x={3.5} y={4.5} width={17} height={16} rx={2} {...commun} />
          <Path d="M8 3v3M16 3v3M3.5 10h17" {...commun} strokeLinecap="round" />
        </Svg>
      )
  }
}

export function BarreInventoriste() {
  const theme = useTheme()
  const styles = faireStyles(theme)
  const chemin = usePathname()

  return (
    <View style={styles.barre}>
      {ONGLETS.map((o) => {
        const actif = o.cle === 'index'
          ? chemin === '/' || chemin.endsWith('/(provider)') || chemin === '/(provider)/'
          : chemin.endsWith(o.cle)
        const couleur = actif ? theme.accent : theme.textSecondary
        return (
          <Pressable key={o.cle} style={styles.onglet}
                     accessibilityRole="button"
                     accessibilityState={{ selected: actif }}
                     onPress={() => router.replace(o.href as '/(provider)/')}>
            <Icone cle={o.cle} couleur={couleur} />
            <Text style={[styles.libelle, { color: couleur, fontFamily: actif ? Font.semibold : Font.regular }]}>
              {o.libelle}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const faireStyles = (theme: Theme) => StyleSheet.create({
  barre: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: theme.headerBg, paddingVertical: 8, paddingHorizontal: 8,
  },
  onglet: { alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, minWidth: 64 },
  libelle: { fontSize: 11.5 },
})
