import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { ROLE_META, TUTORIAL_DATA, roleColor, type Role } from './tutorialData'

interface Props {
  isFirstTime: boolean
  onPickRole: (role: Role) => void
  onSkip: () => void
  onClose: () => void
}

export function WelcomeScreen({ isFirstTime, onPickRole, onSkip, onClose }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Guide d'utilisation</Text>
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      {isFirstTime ? (
        <Text style={styles.subtitleFirst}>
          👋 Bienvenue dans Inventaire ! Voici un rapide tour des fonctionnalités. Vous pourrez le retrouver à tout moment via le bouton ❓ en haut à droite.
        </Text>
      ) : (
        <Text style={styles.subtitle}>
          Choisissez votre rôle pour découvrir le guide adapté, étape par étape.
        </Text>
      )}

      {(['supervisor', 'employee'] as const).map((role) => {
        const meta = ROLE_META[role]
        const color = roleColor(theme, role)
        const count = TUTORIAL_DATA[role].length
        return (
          <Pressable
            key={role}
            style={({ pressed }) => [
              styles.card,
              { borderColor: color },
              pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => onPickRole(role)}
          >
            <View style={[styles.cardIconWrap, { backgroundColor: color + '22' }]}>
              <Text style={styles.cardIcon}>{meta.icon}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color }]}>{meta.name}</Text>
              <Text style={styles.cardSub}>{count} étapes — guide complet</Text>
            </View>
            <Text style={[styles.cardArrow, { color }]}>▶</Text>
          </Pressable>
        )
      })}

      {isFirstTime && (
        <Pressable style={styles.skipBtn} onPress={onSkip}>
          <Text style={styles.skipText}>Passer le guide</Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    scroll: { padding: Spacing.xl, gap: Spacing.lg, flexGrow: 1 },

    titleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: Spacing.xs,
    },
    title: { fontSize: 26, fontFamily: Font.extrabold, color: t.textPrimary, letterSpacing: -0.5 },
    closeBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong,
      alignItems: 'center', justifyContent: 'center',
    },
    closeBtnText: { color: t.textSecondary, fontSize: 16, fontFamily: Font.bold },

    subtitle: { fontSize: 14, color: t.textSecondary, lineHeight: 20, fontFamily: Font.regular },
    subtitleFirst: {
      fontSize: 14, color: t.textPrimary, lineHeight: 21,
      backgroundColor: t.accentSoft, padding: Spacing.md, borderRadius: Radius.md,
      borderLeftWidth: 3, borderLeftColor: t.accent, fontFamily: Font.regular,
    },

    card: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
      backgroundColor: t.surface,
      borderRadius: Radius.lg, padding: 18, borderWidth: 1.5, ...t.shadowCard,
    },
    cardIconWrap: {
      width: 54, height: 54, borderRadius: 27,
      alignItems: 'center', justifyContent: 'center',
    },
    cardIcon: { fontSize: 28 },
    cardBody: { flex: 1, gap: 3 },
    cardTitle: { fontSize: 17, fontFamily: Font.extrabold },
    cardSub: { fontSize: 13, color: t.textSecondary, fontFamily: Font.regular },
    cardArrow: { fontSize: 18, fontFamily: Font.bold },

    skipBtn: { alignSelf: 'center', marginTop: Spacing.md, padding: Spacing.sm },
    skipText: { fontSize: 14, color: t.textMuted, textDecorationLine: 'underline', fontFamily: Font.medium },
  })
}
