import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

export default function LoginScreen() {
  const { signIn, profile, loading: authLoading } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Navigate away as soon as the profile is available after a sign-in attempt
  useEffect(() => {
    if (!authLoading && profile) {
      router.replace(profile.role === 'supervisor' ? '/(supervisor)/' : '/(employee)/')
    }
  }, [authLoading, profile])

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.')
      return
    }
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    if (error) {
      setLoading(false)
      Alert.alert('Connexion échouée', error)
    }
    // On success: keep the spinner visible — useEffect above will navigate
    // once the auth state (session + profile) is fully resolved.
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>I</Text>
          </View>
          <Text style={styles.title}>Inventaire</Text>
          <Text style={styles.subtitle}>Application de comptage</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="votre@email.com"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
          />

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={styles.buttonText}>Se connecter</Text>
            )}
          </Pressable>

          <Pressable style={styles.link} onPress={() => router.push('/signup')}>
            <Text style={styles.linkText}>Pas encore de compte ? S'inscrire</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xxl },
    header: { alignItems: 'center', marginBottom: 40 },
    logoMark: {
      width: 60, height: 60, borderRadius: Radius.lg, backgroundColor: t.accent,
      alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
      ...t.shadowButton,
    },
    logoMarkText: { color: t.onAccent, fontSize: 30, fontFamily: Font.extrabold },
    title: { fontSize: 30, fontFamily: Font.extrabold, color: t.textPrimary, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: t.textSecondary, marginTop: Spacing.xs, fontFamily: Font.regular },
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
