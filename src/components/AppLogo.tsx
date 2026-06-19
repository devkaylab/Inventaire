import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Polygon,
  Path,
  G,
} from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'

interface AppLogoProps {
  size?: number
  /** Animate the scan beam (default true). */
  animated?: boolean
}

/**
 * App icon recreated from the Claude Design handoff (isometric package +
 * electric-blue scan beam). Vector, so it stays crisp at any size.
 *
 * The beam is an overlay Animated.View (not an animated SVG node): animating
 * react-native-svg props via useAnimatedProps is unreliable on Reanimated 4,
 * whereas useAnimatedStyle on a View is rock-solid. The beam stays well inside
 * the rounded icon, so no clipping is needed.
 */
// Enlarge the package+beam within the icon (must match scripts/generate-icons.mjs).
const GLYPH_SCALE = 1.3
const GLYPH_TRANSFORM = `translate(256, 256) scale(${GLYPH_SCALE}) translate(-256, -256)`

export function AppLogo({ size = 340, animated = true }: AppLogoProps) {
  const progress = useSharedValue(0)
  const unit = (size / 512) * GLYPH_SCALE // SVG units → px (scaled like the glyph)

  useEffect(() => {
    if (!animated) return
    // -16 → 16 → -16 (SVG units) over 3.4s, ease-in-out, forever.
    progress.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [animated, progress])

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (-16 + 32 * progress.value) * unit }],
    opacity: animated ? 0.65 + 0.35 * progress.value : 0.9,
  }))

  return (
    <View style={{ width: size, height: size }}>
      {/* Base icon: rounded background + isometric package */}
      <Svg width={size} height={size} viewBox="0 0 512 512">
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#7466F4" />
            <Stop offset="0.52" stopColor="#4636B0" />
            <Stop offset="1" stopColor="#1C153F" />
          </LinearGradient>
          <RadialGradient id="topGlow" cx="0.3" cy="0.12" r="0.95">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.20" />
            <Stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="faceTop" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor="#A99CFA" />
            <Stop offset="1" stopColor="#8E7FF2" />
          </LinearGradient>
          <LinearGradient id="faceLeft" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#6E5DEC" />
            <Stop offset="1" stopColor="#5A49D4" />
          </LinearGradient>
          <LinearGradient id="faceRight" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4A3AA8" />
            <Stop offset="1" stopColor="#3A2C8C" />
          </LinearGradient>
        </Defs>

        <Rect x="6" y="6" width="500" height="500" rx="116" fill="url(#bgGrad)" />
        <Rect x="6" y="6" width="500" height="500" rx="116" fill="url(#topGlow)" />

        <G transform={GLYPH_TRANSFORM}>
          {/* Isometric package — three faces */}
          <Polygon
            points="256,146 352,196 256,246 160,196"
            fill="url(#faceTop)"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <Polygon
            points="160,196 256,246 256,366 160,316"
            fill="url(#faceLeft)"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <Polygon
            points="352,196 352,316 256,366 256,246"
            fill="url(#faceRight)"
            stroke="rgba(0,0,0,0.10)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Closed-flap seams (carton detail) */}
          <Path
            d="M256,146 L256,246 M160,196 L352,196"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </G>
      </Svg>

      {/* Animated scan beam overlay — glow faked with stacked rects */}
      <Animated.View style={[StyleSheet.absoluteFill, beamStyle]}>
        <Svg width={size} height={size} viewBox="0 0 512 512">
          <G transform={GLYPH_TRANSFORM}>
            <Rect x="92" y="278" width="328" height="20" rx="10" fill="#38C9FF" opacity={0.25} />
            <Rect x="92" y="282" width="328" height="12" rx="6" fill="#38C9FF" opacity={0.9} />
            <Rect x="92" y="285.5" width="328" height="5" rx="2.5" fill="#B6ECFF" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  )
}
