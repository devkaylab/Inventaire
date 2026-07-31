import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import type { Step } from './tutorialData'

interface Props {
  step: Step
  roleColor: string
}

export function StepPage({ step, roleColor }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { width, height } = useWindowDimensions()

  // Cap the hero so image + text always fit / scroll nicely on shorter screens
  // (iPhone 16 is shorter than the 16 Pro Max the layout was first tuned on).
  const heroMaxH = Math.min(380, height * 0.42)

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero image area */}
      <View style={[styles.heroWrap, { maxHeight: heroMaxH }]}>
        <Image source={step.image} style={styles.hero} resizeMode="contain" />
      </View>

      {/* Title */}
      <View style={styles.titleRow}>
        <Text style={styles.icon}>{step.icon}</Text>
        <Text style={[styles.title, { color: roleColor }]} numberOfLines={2}>
          {step.title}
        </Text>
      </View>

      {/* Body */}
      <Text style={styles.body}>{step.body}</Text>

      {/* Optional tip */}
      {step.tip && (
        <View style={[styles.tip, { borderLeftColor: roleColor }]}>
          <Text style={styles.tipText}>💡 {step.tip}</Text>
        </View>
      )}
    </ScrollView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    page: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.xl, gap: Spacing.lg },
    heroWrap: {
      width: '100%', aspectRatio: 9 / 14,
      backgroundColor: t.background, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: t.hairline,
      overflow: 'hidden', position: 'relative',
      alignSelf: 'center',
    },
    hero: { width: '100%', height: '100%' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 6 },
    icon: { fontSize: 24 },
    title: { fontSize: 19, fontFamily: Font.extrabold, flex: 1, lineHeight: 24, letterSpacing: -0.3 },
    body: { fontSize: 14, lineHeight: 21, color: t.textSecondary, fontFamily: Font.regular },
    tip: {
      backgroundColor: t.surface, padding: Spacing.md, borderRadius: Radius.md,
      borderLeftWidth: 3, borderWidth: 1, borderColor: t.hairline,
    },
    tipText: { fontSize: 13, color: t.textPrimary, lineHeight: 19, fontFamily: Font.regular },
  })
}
