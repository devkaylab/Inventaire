import { useState } from 'react'
import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { Annotation } from './Annotation'
import type { Step } from './tutorialData'

// All tutorial screenshots come from the iPhone 17 Pro simulator → 1179×2556 px
const IMG_W = 1179
const IMG_H = 2556
const IMG_RATIO = IMG_W / IMG_H   // ≈ 0.461

interface Props {
  step: Step
  roleColor: string
}

export function StepPage({ step, roleColor }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { width } = useWindowDimensions()
  const [imgBox, setImgBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  function onImgLayout(e: LayoutChangeEvent) {
    const { width: w, height: h } = e.nativeEvent.layout
    setImgBox({ w, h })
  }

  // ── Calculate where the image actually renders inside heroWrap (resizeMode="contain")
  // If IMG_RATIO < container_ratio → pillarboxed (padding left/right, image fills full height)
  // If IMG_RATIO > container_ratio → letterboxed (padding top/bottom, image fills full width)
  const containerRatio = imgBox.h > 0 ? imgBox.w / imgBox.h : IMG_RATIO
  let imgDisplayW: number, imgDisplayH: number, imgOffsetX: number, imgOffsetY: number

  if (IMG_RATIO < containerRatio) {
    // Pillarboxed — image fills full height
    imgDisplayH = imgBox.h
    imgDisplayW = imgBox.h * IMG_RATIO
    imgOffsetX  = (imgBox.w - imgDisplayW) / 2
    imgOffsetY  = 0
  } else {
    // Letterboxed — image fills full width
    imgDisplayW = imgBox.w
    imgDisplayH = imgBox.w / IMG_RATIO
    imgOffsetX  = 0
    imgOffsetY  = (imgBox.h - imgDisplayH) / 2
  }

  return (
    <View style={[styles.page, { width }]}>
      {/* Hero image area */}
      <View style={styles.heroWrap} onLayout={onImgLayout}>
        <Image source={step.image} style={styles.hero} resizeMode="contain" />

        {/* Annotations — positioned relative to actual image content area */}
        {imgBox.w > 0 && step.annotations?.map((a, i) => (
          <Annotation
            key={i}
            data={a}
            imageRect={{ x: imgOffsetX, y: imgOffsetY, w: imgDisplayW, h: imgDisplayH }}
          />
        ))}
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
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    page: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, gap: Spacing.lg },
    heroWrap: {
      width: '100%', aspectRatio: 9 / 14,
      backgroundColor: t.background, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: t.hairline,
      overflow: 'hidden', position: 'relative',
      alignSelf: 'center', maxHeight: 380,
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
