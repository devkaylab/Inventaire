import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { SUPERVISOR_REQUEST_URL } from '@/constants/links'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

/**
 * Écran de repli : un superviseur connecté sans entreprise rattachée.
 *
 * Il saisissait ici son code magasin pour s'auto-affecter (`join_store`). Ce
 * n'est plus le parcours : le code magasin accompagne désormais la *demande*
 * déposée sur le site, et c'est la validation Quantinvo qui affecte au
 * magasin. `join_store` a d'ailleurs été révoquée au rôle `authenticated`.
 *
 * Le cas ne devrait donc plus se produire ; l'écran reste pour ne pas laisser
 * un compte dans une impasse muette, et renvoie vers le bon parcours.
 */
export default function CompanySetupScreen() {
  const { signOut } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Accès en attente</Text>
            <Text style={styles.subtitle}>
              Votre compte n&apos;est rattaché à aucun magasin. L&apos;accès superviseur est accordé
              par Quantinvo à partir d&apos;une demande accompagnée du code magasin remis par
              l&apos;administrateur de votre entreprise.
            </Text>
          </View>

          <View style={styles.form}>
            <Pressable style={styles.button} onPress={() => Linking.openURL(SUPERVISOR_REQUEST_URL)}>
              <Text style={styles.buttonText}>Déposer ma demande</Text>
            </Pressable>

            <Pressable style={styles.link} onPress={() => signOut()}>
              <Text style={styles.linkText}>Se déconnecter</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.xxxl },
    header: { marginBottom: Spacing.xxl },
    title: { fontSize: 28, fontFamily: Font.extrabold, color: t.textPrimary, letterSpacing: -0.5, textAlign: 'center' },
    subtitle: {
      fontSize: 14,
      fontFamily: Font.regular,
      color: t.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.md,
      lineHeight: 20,
    },
    form: { gap: Spacing.md },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary },
    input: {
      borderWidth: 1,
      borderColor: t.hairline,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 13,
      fontSize: 16,
      fontFamily: Font.regular,
      backgroundColor: t.surface,
      color: t.textPrimary,
    },
    codeInput: { letterSpacing: 4, fontFamily: Font.bold, textAlign: 'center' },
    button: {
      backgroundColor: t.accent,
      borderRadius: Radius.md,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.sm,
      ...t.shadowButton,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
    link: { alignItems: 'center', paddingVertical: Spacing.sm },
    linkText: { color: t.accent, fontSize: 14, fontFamily: Font.medium },
  })
}
