import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated'
import { AppLogo } from './AppLogo'
import { Font } from '@/constants/ink'

interface SplashAnimationProps {
  /** Called once the intro has played and the screen has faded out. */
  onFinish: () => void
}

const HOLD_MS = 1700 // time the logo stays fully visible before fading out

/**
 * Full-screen animated loading screen shown over the app at launch.
 * Dark radial background + the animated scan-beam logo, fading itself out
 * when done so the app underneath is revealed.
 */
export function SplashAnimation({ onFinish }: SplashAnimationProps) {
  const { width, height } = useWindowDimensions()
  const logoSize = Math.min(width * 0.5, 200)

  const enter = useSharedValue(0) // 0 → 1 fade/scale in
  const exit = useSharedValue(0) // 0 → 1 fade the whole screen out

  useEffect(() => {
    enter.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) })
    // After the hold, fade the screen out, then hand control back to the app.
    exit.value = withDelay(
      650 + HOLD_MS,
      withTiming(1, { duration: 450, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(onFinish)()
      }),
    )
  }, [enter, exit, onFinish])

  const screenStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
  }))

  const logoStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.86 + 0.14 * enter.value }],
  }))

  const wordStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
  }))

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, screenStyle]}>
      {/* Radial background matching the design (light top-center → near-black) */}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          {/* ⚠️ L'ENCRE D'ARDOISE, PLUS LE VIOLET. Le dégradé partait de
              #161228 — un mauve sombre, reste de l'identité d'avant. Il part
              maintenant du gris minéral de la charte et s'éteint vers son
              encre : c'est le même noir que le bandeau de l'application et que
              la tuile du logo. */}
          <RadialGradient id="bg" cx="0.5" cy="0" r="1.1">
            <Stop offset="0" stopColor="#1B1F1E" />
            <Stop offset="0.6" stopColor="#0E1110" />
            <Stop offset="1" stopColor="#080A09" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#bg)" />
      </Svg>

      {/* ⚠️ ELLE BALAIE À L'OUVERTURE (demande de Julien, 6 septembre 2026).
          C'est le premier geste que l'application montre : l'allée pleine
          saute d'une position à l'autre dans le cadre, comme on compte une
          zone puis la suivante. Le système peut la couper — voir `AppLogo`. */}
      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <AppLogo size={logoSize} animated />
      </Animated.View>

      <Animated.Text style={[styles.wordmark, wordStyle]}>QUANTINVO</Animated.Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0E1110',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  logoWrap: {
    // ⚠️ PLUS DE LUEUR SOUS LE LOGO. Elle était en #6C5CE7 — l'indigo d'avant,
    // le même que le halo retiré du site le matin du 6 septembre. Une marque
    // monochrome n'a pas besoin d'un fond pour exister ; c'est la règle
    // d'Ardoise, où rien ne se dit par la profondeur.
  },
  wordmark: {
    marginTop: 28,
    fontFamily: Font.semibold,
    fontSize: 13,
    letterSpacing: 6,
    color: '#8A82B8',
  },
})
