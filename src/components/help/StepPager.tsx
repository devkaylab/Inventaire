import { useCallback, useRef, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { StepPage } from './StepPage'
import { ROLE_META, TUTORIAL_DATA, roleColor, type Role } from './tutorialData'

interface Props {
  role: Role
  onComplete: () => void
  onClose: () => void
  onExitToWelcome: () => void
}

export function StepPager({ role, onComplete, onClose, onExitToWelcome }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { width } = useWindowDimensions()
  const steps = TUTORIAL_DATA[role]
  const meta = ROLE_META[role]
  const color = roleColor(theme, role)
  const total = steps.length

  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList>(null)

  const goTo = useCallback((i: number) => {
    if (i < 0 || i >= total) return
    listRef.current?.scrollToIndex({ index: i, animated: true })
    setIndex(i)
  }, [total])

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    if (i !== index) setIndex(i)
  }, [index, width])

  const isLast = index === total - 1
  const isFirst = index === 0

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onExitToWelcome} hitSlop={10} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>◀ Accueil</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color }]}>
          {meta.icon}  {meta.name} · {index + 1} / {total}
        </Text>
        <View style={[styles.headerBtn, styles.headerBtnRight]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Pager */}
      <FlatList
        ref={listRef}
        data={steps}
        keyExtractor={(_, i) => `${role}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => <StepPage step={item} roleColor={color} />}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      />

      {/* Pagination dots */}
      <View style={styles.dots}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === index && { backgroundColor: color, width: 22 },
            ]}
          />
        ))}
      </View>

      {/* Nav buttons */}
      <View style={styles.nav}>
        <Pressable
          onPress={() => goTo(index - 1)}
          disabled={isFirst}
          style={[styles.navBtn, isFirst && styles.navBtnDisabled]}
        >
          <Text style={[styles.navBtnText, isFirst && styles.navBtnTextDisabled]}>
            ◀ Précédent
          </Text>
        </Pressable>
        <Pressable
          onPress={() => isLast ? onComplete() : goTo(index + 1)}
          style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: color }]}
        >
          <Text style={styles.navBtnPrimaryText}>
            {isLast ? 'Terminer ✓' : 'Suivant ▶'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1 },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, borderBottomColor: t.hairline,
      backgroundColor: t.surface,
    },
    headerBtn: { minWidth: 80, paddingVertical: 4 },
    headerBtnRight: { alignItems: 'flex-end' },
    headerBtnText: { fontSize: 14, fontFamily: Font.semibold, color: t.textSecondary },
    headerTitle: { fontSize: 14, fontFamily: Font.bold, flex: 1, textAlign: 'center' },

    closeBtn: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: t.background, borderWidth: 1, borderColor: t.borderStrong,
      alignItems: 'center', justifyContent: 'center',
    },
    closeBtnText: { color: t.textSecondary, fontSize: 15, fontFamily: Font.bold },

    dots: {
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
      gap: 6, paddingVertical: Spacing.md,
    },
    dot: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: t.borderStrong,
    },

    nav: {
      flexDirection: 'row', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingTop: 6, paddingBottom: Spacing.lg,
      borderTopWidth: 1, borderTopColor: t.hairline,
      backgroundColor: t.surface,
    },
    navBtn: {
      flex: 1, paddingVertical: Spacing.lg, borderRadius: Radius.md,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.background, borderWidth: 1, borderColor: t.borderStrong,
    },
    navBtnDisabled: { opacity: 0.4 },
    navBtnText: { fontSize: 15, fontFamily: Font.semibold, color: t.textPrimary },
    navBtnTextDisabled: { color: t.textMuted },
    navBtnPrimary: { borderWidth: 0 },
    navBtnPrimaryText: { fontSize: 15, fontFamily: Font.extrabold, color: '#fff' },
  })
}
