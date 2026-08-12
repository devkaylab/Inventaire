import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Font, Spacing } from '@/constants/ink'
import { isOffline, subscribeNetwork } from '@/lib/offlineSync'
import { useTheme } from '@/lib/theme'

/**
 * Bandeau « hors ligne », en haut de toutes les pages.
 *
 * Monté dans le layout racine, au-dessus des en-têtes d'écran : perdre le réseau
 * doit se voir depuis n'importe quelle page, pas seulement pendant le scan.
 *
 * ── Ce qu'il ne doit surtout pas faire ──────────────────────────────────────
 *
 * **Ne pas toucher à la barre d'état.** Une première version peignait toute la
 * zone haute, heure et batterie comprises : le texte finissait collé à l'horloge
 * et passait sous la Dynamic Island. La zone sûre garde donc la couleur de
 * l'en-tête, exactement comme sans bandeau, et l'alerte occupe une bande
 * distincte en dessous. Visuellement, rien ne bouge tant qu'on est en ligne.
 *
 * **Ne pas dépendre d'un texte long.** Le message doit tenir sur une ligne au
 * plus étroit des iPhone. D'où une phrase courte : le détail (« tout remonte au
 * retour du réseau ») vit sur les écrans qui listent les balises en attente,
 * là où quelqu'un cherche vraiment à savoir ce que devient son travail.
 *
 * Le glissement reprend le geste des navigateurs : une bande discrète qui
 * pousse le contenu, apparaît sans brusquerie, et se replie de la même façon.
 */

/** Hauteur de la bande d'alerte, hors zone sûre. */
const BAR_H = 30

/**
 * Encre de la bande, volontairement fixe et non tirée du thème.
 *
 * L'orange d'alerte est clair dans les deux thèmes (`#D97706` en clair,
 * `#F59E0B` en sombre). Utiliser `textPrimary` donnerait du blanc cassé sur
 * orange vif en thème sombre — un contraste d'environ 1,9:1, illisible. Cette
 * encre sombre tient au-dessus de 5:1 sur les deux fonds.
 */
const BAR_INK = '#0B0F19'

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
      duration: offline ? 280 : 220,
      easing: offline ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      // La hauteur n'est pas animable par le pilote natif, et c'est elle qui
      // fait le glissement : la bande pousse le contenu au lieu de le couvrir.
      useNativeDriver: false,
    }).start()
  }, [offline, slide])

  // Tout se replie à zéro, **zone sûre comprise**. C'est la condition pour que
  // rien ne bouge quand on est en ligne : si la réserve de barre d'état restait
  // là en permanence, elle décalerait l'en-tête de chaque écran en
  // fonctionnement normal.
  const total = insets.top + BAR_H
  const height = slide.interpolate({ inputRange: [0, 1], outputRange: [0, total] })
  const opacity = slide.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] })

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      // Le fond reprend la couleur de l'en-tête : déplié, la barre d'état garde
      // l'aspect qu'elle a sans bandeau, heure et batterie lisibles comme
      // d'habitude. Seule la bande du bas passe en orange.
      style={[styles.wrap, { height, backgroundColor: theme.headerBg }]}
    >
      <View style={[styles.bar, { height: BAR_H, backgroundColor: theme.warning }]}>
        <Animated.View style={[styles.row, { opacity }]}>
          <View style={styles.dot} />
          <Text style={styles.text} numberOfLines={1}>
            Hors ligne — le comptage continue
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // `justifyContent: flex-end` fait glisser la bande depuis le haut : pendant
  // l'animation elle est révélée par le bas du conteneur, jamais tronquée.
  wrap: { overflow: 'hidden', justifyContent: 'flex-end' },
  // `flexShrink: 0` : pendant le glissement le conteneur est plus court que la
  // bande, et sans ça flexbox la comprimerait au lieu de la révéler.
  bar: { justifyContent: 'center', flexShrink: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: BAR_H,
    paddingHorizontal: Spacing.lg,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BAR_INK },
  text: { fontFamily: Font.semibold, fontSize: 13, flexShrink: 1, color: BAR_INK },
})
