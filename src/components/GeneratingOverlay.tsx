import { useEffect } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { AppLogo } from './AppLogo'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

interface Props {
  visible: boolean
  message?: string
  sub?: string
}

/**
 * Overlay de chargement de marque : le logo animé « mouline » dans un anneau qui
 * tourne, avec une pulsation. Les animations Reanimated tournent sur le thread UI,
 * donc l'anneau reste fluide même quand le thread JS est occupé (génération du PDF).
 */
export function GeneratingOverlay({ visible, message = 'Génération en cours…', sub }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const spin = useSharedValue(0)
  const pulse = useSharedValue(0)

  useEffect(() => {
    if (!visible) return
    spin.value = 0
    spin.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.linear }), -1, false)
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true)
  }, [visible, spin, pulse])

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }))
  const innerRingStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 360}deg` }] }))
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.92 + 0.08 * pulse.value }] }))
  const msgStyle = useAnimatedStyle(() => ({ opacity: 0.6 + 0.4 * pulse.value }))

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.ringWrap}>
            {/* anneau extérieur (sens horaire) + anneau intérieur (sens inverse) */}
            <Animated.View style={[styles.ring, ringStyle]} />
            <Animated.View style={[styles.ringInner, innerRingStyle]} />
            <Animated.View style={logoStyle}>
              <AppLogo size={56} />
            </Animated.View>
          </View>
          <Animated.Text style={[styles.msg, msgStyle]}>{message}</Animated.Text>
          {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(6,9,16,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: t.surface,
      borderRadius: Radius.xl,
      paddingVertical: Spacing.xxl,
      paddingHorizontal: Spacing.xxxl,
      alignItems: 'center',
      gap: Spacing.lg,
      borderWidth: 1,
      borderColor: t.hairline,
      ...t.shadowElevated,
    },
    ringWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
    ring: {
      position: 'absolute',
      width: 104,
      height: 104,
      borderRadius: 52,
      borderWidth: 3,
      borderColor: 'transparent',
      borderTopColor: t.accent,
      borderRightColor: t.accent,
    },
    ringInner: {
      position: 'absolute',
      width: 84,
      height: 84,
      borderRadius: 42,
      borderWidth: 2,
      borderColor: 'transparent',
      borderBottomColor: t.success,
    },
    msg: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    sub: { fontSize: 13, fontFamily: Font.regular, color: t.textSecondary, marginTop: -Spacing.sm },
  })
}
