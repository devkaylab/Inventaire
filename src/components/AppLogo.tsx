import { useEffect } from 'react'
import { View } from 'react-native'
import Svg, { Rect } from 'react-native-svg'
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

interface AppLogoProps {
  size?: number
  /** Fait balayer l'allée pleine (défaut : oui). */
  animated?: boolean
  /**
   * La couleur de la marque. Elle est MONOCHROME : elle prend la couleur du
   * texte qui l'entoure, comme sur le site (`currentColor`).
   */
  color?: string
  /**
   * Pose la tuile d'encre derrière la marque — l'icône de l'application, et
   * elle seule. Partout ailleurs le fond de l'écran suffit.
   */
  tuile?: boolean
}

/**
 * La marque Quantinvo — « la zone ».
 *
 * Un plan de magasin réduit à son minimum : le cadre, trois allées, et celle
 * qu'on est en train de compter, pleine. C'est le différenciateur du produit —
 * une zone par semaine, pas un grand week-end par an.
 *
 * ⚠️ LE CUBE ISOMÉTRIQUE ET SON FAISCEAU BLEU ONT DISPARU LE 6 SEPTEMBRE 2026,
 * sur décision de Julien, et avec eux l'indigo. La marque ne porte plus aucun
 * dégradé, aucun accent : c'est cohérent avec Ardoise, où l'accent ne sert
 * qu'à ce qui engage — un logo n'engage rien, il nomme.
 *
 * ⚠️ LA GÉOMÉTRIE EST CELLE DE `web/components/Logo.tsx`, AU DIXIÈME PRÈS.
 * Elle a été reprise telle quelle de la planche de Julien après qu'une version
 * épaissie lui a été présentée. Ce qu'il faut savoir avant d'y toucher, parce
 * que c'est mesuré et que ça ne se voit qu'aux petites tailles :
 *   · le bloc plein (x 3→11) et la première allée fine (x 11→14) SE TOUCHENT,
 *     donc ils se lisent comme une seule forme de 11 de large dès 192 px ;
 *   · les allées font 3 unités sur 36, soit un douzième — à 16 px il en reste
 *     1,3 px et la marque devient une tache. D'où la tuile de l'icône.
 *
 * ⚠️ ET L'ANIMATION N'EST PAS UNE ROUE QUI TOURNE. L'allée pleine saute d'une
 * position à l'autre dans le cadre : c'est le geste du produit, on compte une
 * zone puis la suivante. Une roue dit « ça charge » ; ceci dit « Quantinvo
 * travaille ».
 */

/** Les trois positions de l'allée pleine, en unités du viewBox. */
const POSITIONS = [0, 11, 22]
/** Le temps d'un cycle complet, aligné sur la planche animée de Julien. */
const CYCLE_MS = 900

export function AppLogo({ size = 340, animated = true, color = '#ECEFEC', tuile = false }: AppLogoProps) {
  const pas = useSharedValue(0)

  useEffect(() => {
    if (!animated) {
      pas.value = 0
      return
    }
    // 0 → 3 en continu ; c'est `Math.floor` qui fait les trois paliers.
    pas.value = 0
    pas.value = withRepeat(
      withTiming(POSITIONS.length, {
        duration: CYCLE_MS,
        easing: Easing.linear,
        // ⚠️ La préférence système coupe l'animation, comme le
        // `prefers-reduced-motion` du site. Une marque qui bouge sans qu'on
        // l'ait demandé est exactement ce que ce réglage vise.
        reduceMotion: ReduceMotion.Always,
      }),
      -1,
      false,
    )
  }, [animated, pas])

  // ⚠️ LE DÉCALAGE EST EN PIXELS, PAS EN UNITÉS DE VIEWBOX. Le SVG est rendu à
  // `size` : une unité vaut `size / 36`. C'est le piège symétrique du
  // `transform-box: view-box` qu'il a fallu poser côté web.
  const unite = size / 36
  const balayage = useAnimatedStyle(() => {
    const i = Math.min(Math.floor(pas.value), POSITIONS.length - 1)
    return { transform: [{ translateX: POSITIONS[i] * unite }] }
  })

  const marge = tuile ? size * 0.18 : 0
  const interieur = size - marge * 2

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: tuile ? size * 0.226 : 0,
        backgroundColor: tuile ? '#14181A' : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: interieur, height: interieur }}>
        <Svg width={interieur} height={interieur} viewBox="0 0 36 36">
          {/* Le magasin. */}
          <Rect x="1.5" y="1.5" width="33" height="33" fill="none" stroke={color} strokeWidth="3" />
          {/* Les deux allées qu'on ne compte pas maintenant. */}
          <Rect x="11" y="3" width="3" height="30" fill={color} />
          <Rect x="22" y="3" width="3" height="30" fill={color} />
        </Svg>

        {/* Celle qu'on compte. Dans sa propre couche : elle passe au-dessus
            des autres quand elle se déplace, et c'est une View qu'on anime —
            animer une prop de react-native-svg par useAnimatedProps est
            capricieux sur Reanimated 4, useAnimatedStyle ne l'est pas. */}
        <Animated.View
          style={[
            { position: 'absolute', left: 0, top: 0, width: interieur, height: interieur },
            balayage,
          ]}
        >
          <Svg width={interieur} height={interieur} viewBox="0 0 36 36">
            <Rect x="3" y="3" width="8" height="30" fill={color} />
          </Svg>
        </Animated.View>
      </View>
    </View>
  )
}
