import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { Font } from '@/constants/ink'

export type AnnotationData =
  | { type: 'circle'; x: number; y: number; size?: number }
  | { type: 'pulse';  x: number; y: number; size?: number }
  | { type: 'label';  x: number; y: number; text: string }

// x and y are now 0–1 fractions of the IMAGE content area (not the container)
export interface ImageRect { x: number; y: number; w: number; h: number }

interface Props {
  data: AnnotationData
  imageRect: ImageRect
}

// Attention marker — a vivid red reads clearly over screenshots in both themes
const ANNOT_COLOR = '#FF3B30'
const ANNOT_HALO  = '#FF6B6B'

// Convert image-relative fraction → absolute pixel position in the container
function toAbs(frac: number, origin: number, size: number) {
  return origin + frac * size
}

export function Annotation({ data, imageRect }: Props) {
  const absX = toAbs(data.x, imageRect.x, imageRect.w)
  const absY = toAbs(data.y, imageRect.y, imageRect.h)

  if (data.type === 'circle') {
    const size = data.size ?? 60
    return (
      <View
        pointerEvents="none"
        style={[
          styles.base,
          {
            left: absX - size / 2,
            top:  absY - size / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: ANNOT_COLOR,
            borderWidth: 3,
            shadowColor: ANNOT_COLOR,
            shadowOpacity: 0.6,
            shadowOffset: { width: 0, height: 0 },
            shadowRadius: 6,
          },
        ]}
      />
    )
  }

  if (data.type === 'pulse') {
    return <Pulse absX={absX} absY={absY} size={data.size ?? 60} />
  }

  // label
  return (
    <View
      pointerEvents="none"
      style={[styles.base, styles.labelBox, { left: absX, top: absY }]}
    >
      <Text style={styles.labelText}>{data.text}</Text>
    </View>
  )
}

// ─── Pulse: animated ring that scales out and fades ──────────────────────────
function Pulse({ absX, absY, size }: { absX: number; absY: number; size: number }) {
  const scale   = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(0.9)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale,   { toValue: 1.55, duration: 1100, useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 1,    duration: 0,    useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0,   duration: 1100, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.9, duration: 0,    useNativeDriver: true }),
        ]),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [scale, opacity])

  const left = absX - size / 2
  const top  = absY - size / 2

  return (
    <>
      {/* Static ring */}
      <View
        pointerEvents="none"
        style={[
          styles.base,
          {
            left, top,
            width: size, height: size,
            borderRadius: size / 2,
            borderColor: ANNOT_COLOR, borderWidth: 3,
          },
        ]}
      />
      {/* Pulsing ring */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.base,
          {
            left, top,
            width: size, height: size,
            borderRadius: size / 2,
            borderColor: ANNOT_HALO, borderWidth: 3,
            transform: [{ scale }], opacity,
          },
        ]}
      />
    </>
  )
}

const styles = StyleSheet.create({
  base: { position: 'absolute' },
  labelBox: {
    backgroundColor: ANNOT_COLOR,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4,
  },
  labelText: { color: '#fff', fontSize: 12, fontFamily: Font.bold },
})
