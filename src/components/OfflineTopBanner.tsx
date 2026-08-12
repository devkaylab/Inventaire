import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Font, Spacing } from '@/constants/ink'
import { isOffline, subscribeNetwork } from '@/lib/offlineSync'
import { useTheme } from '@/lib/theme'

/**
 * Bandeau « hors ligne », en haut de toutes les pages.
 *
 * Monté dans le layout racine, au-dessus des en-têtes d'écran : l'information
 * ne doit pas dépendre de la page où se trouve le compteur. Quelqu'un qui perd
 * le réseau en consultant sa progression doit le voir aussi vite que s'il était
 * en train de scanner.
 *
 * Le ton est celui d'un avertissement, pas d'une erreur : le comptage continue,
 * rien n'est perdu. Le dire explicitement évite le réflexe qui fausse un
 * inventaire — rescanner « au cas où » et créer des doublons.
 *
 * L'apparition glisse vers le bas plutôt que d'apparaître d'un coup : un
 * élément qui pousse le contenu sans transition donne l'impression d'un défaut
 * d'affichage.
 */
export function OfflineTopBanner() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [offline, setOffline] = useState(isOffline)
  // `useState` avec initialiseur paresseux plutôt qu'une ref : la valeur animée
  // est créée une seule fois, sans être lue pendant le rendu.
  const [slide] = useState(() => new Animated.Value(isOffline() ? 1 : 0))

  useEffect(() => subscribeNetwork(setOffline), [])

  useEffect(() => {
    Animated.timing(slide, {
      toValue: offline ? 1 : 0,
      duration: offline ? 260 : 200,
      easing: offline ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      // La hauteur n'est pas animable par le pilote natif, et c'est elle qui
      // fait le glissement : le bandeau pousse le contenu au lieu de le couvrir.
      useNativeDriver: false,
    }).start()
  }, [offline, slide])

  // Toujours monté, replié à hauteur nulle quand tout va bien : ça évite
  // d'écrire l'état React depuis un effet juste pour gérer le démontage, et le
  // repli reste animé jusqu'au bout.
  const height = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 34 + insets.top] })

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { height, backgroundColor: theme.warning, paddingTop: insets.top }]}
    >
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: theme.textPrimary }]} />
        <Text style={[styles.text, { color: theme.textPrimary }]} numberOfLines={1}>
          Hors ligne — le comptage continue, tout remonte au retour du réseau
        </Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', justifyContent: 'flex-end' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 34,
    paddingHorizontal: Spacing.lg,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontFamily: Font.semibold, fontSize: 13, flexShrink: 1 },
})
