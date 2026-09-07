import { Pressable, StyleSheet, Text } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '@/lib/theme'
import { Font } from '@/constants/ink'

/**
 * La sortie du tunnel de préparation.
 *
 * Après la création d'un inventaire, trois écrans s'enchaînent — Zones &
 * balises, Importer les données, Ajouter des compteurs. Le retour y a été
 * fermé volontairement le 23 août 2026 pour que le tunnel reste linéaire, mais
 * **rien n'a été mis à la place** : on ne pouvait plus en sortir avant la
 * dernière étape. Constat de Julien, 7 septembre 2026 : « page zone & balises
 * ne dispose pas d'un bouton retour, ainsi qu'importer les données, pareil
 * pour ajouter des compteurs ».
 *
 * ⚠️ ELLE NE RAMÈNE PAS À L'ÉTAPE PRÉCÉDENTE, ET C'EST LE POINT. Le tunnel
 * reste linéaire — chaque étape `replace` la suivante, il n'y a rien derrière.
 * Ce qu'on rend, c'est le droit de partir : vers **la fiche de l'inventaire**,
 * là où le tunnel finit de toute façon, et d'où les trois étapes restent
 * accessibles. Un `router.back()` atterrirait sur la liste des inventaires,
 * c'est-à-dire un cran trop loin : on vient d'en créer un, c'est lui qu'on
 * veut voir.
 *
 * ⚠️ « Plus tard », jamais « Retour » : ce qui est vrai ici, ce n'est pas
 * qu'on revient en arrière, c'est que l'étape n'est pas faite. Le mot dit ce
 * qui va se passer, et il ne promet pas un écran précédent qui n'existe pas.
 */
export function SortieTunnel({ sessionId }: { sessionId: string }) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={() => router.replace(`/(supervisor)/${sessionId}`)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Quitter la préparation et ouvrir l’inventaire"
      style={styles.zone}
    >
      <Text style={[styles.libelle, { color: theme.headerText }]}>Plus tard</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  zone: { marginLeft: -4, paddingVertical: 4, paddingHorizontal: 4 },
  libelle: { fontSize: 16, fontFamily: Font.medium },
})
