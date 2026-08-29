import { StyleSheet, Text, View } from 'react-native'
import { checkPassword, PASSWORD_RULES } from '@/lib/password'
import { CocheIcon } from '@/components/ui/Icones'
import { useTheme } from '@/lib/theme'
import { Font, Spacing, type Theme } from '@/constants/ink'

/**
 * Les exigences du mot de passe, cochées à mesure de la frappe.
 *
 * Annoncées d'emblée plutôt qu'au refus : la personne voit ce qu'on attend
 * d'elle pendant qu'elle compose, au lieu de le découvrir critère par critère
 * en enchaînant les erreurs. Miroir de `web/components/PasswordRules.tsx`.
 */
export function PasswordRules({ password }: { password: string }) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const c = checkPassword(password)

  return (
    <View style={styles.list} accessibilityLabel="Exigences du mot de passe">
      {PASSWORD_RULES.map((r) => {
        const ok = c[r.key]
        return (
          <View key={r.key} style={styles.row}>
            <View style={[styles.tick, ok && styles.tickOn]}>
              {ok && <CocheIcon color={theme.onAccent} size={11} />}
            </View>
            <Text style={[styles.label, ok && styles.labelOn]}>{r.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    list: { gap: 6, marginTop: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    tick: {
      width: 16, height: 16, borderRadius: 8,
      borderWidth: 1, borderColor: t.borderStrong,
      alignItems: 'center', justifyContent: 'center',
    },
    tickOn: { backgroundColor: t.success, borderColor: t.success },
    label: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular },
    labelOn: { color: t.success, fontFamily: Font.medium },
  })
}
