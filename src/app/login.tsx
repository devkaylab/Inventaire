import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { challengeAndVerify, verifiedTotpFactor } from '@/lib/mfa'
import { useTheme } from '@/lib/theme'
import { AppLogo } from '@/components/AppLogo'
import { PRIVACY_URL } from '@/constants/links'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

export default function LoginScreen() {
  const { signIn, signOut, profile, loading: authLoading, mfaRequired, recheckMfa } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Deuxième étape : le compte a un second facteur et la session en est
  // restée au mot de passe. Tant que le code n'est pas saisi, on n'entre pas.
  const [code, setCode] = useState('')

  // Navigate away as soon as the profile is available after a sign-in attempt
  useEffect(() => {
    if (mfaRequired) return
    if (!authLoading && profile) {
      router.replace(profile.role === 'supervisor' ? '/(supervisor)/' : '/(employee)/')
    }
  }, [authLoading, profile, mfaRequired])

  async function verifierCode() {
    setLoading(true)
    const factorId = await verifiedTotpFactor()
    if (!factorId) {
      setLoading(false)
      Alert.alert('Erreur', 'Aucune application d’authentification n’est associée à ce compte.')
      return
    }
    const r = await challengeAndVerify(factorId, code)
    if (!r.success) {
      setLoading(false)
      setCode('')
      Alert.alert(
        'Code refusé',
        'Code incorrect ou expiré. Vérifiez le code affiché par votre application — il change toutes les trente secondes.',
      )
      return
    }
    await recheckMfa()
    setLoading(false)
  }

  async function abandonner() {
    setCode('')
    await signOut()
  }

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

  // Deuxième étape — rien d'autre à l'écran : la personne est déjà
  // identifiée, il ne lui manque que son code.
  if (mfaRequired) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <AppLogo size={84} />
            </View>
            <Text style={styles.title}>Code de vérification</Text>
            <Text style={styles.subtitle}>
              Saisissez le code affiché par votre application d&apos;authentification.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Code à six chiffres</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              autoFocus
              placeholder="123456"
              placeholderTextColor={theme.textMuted}
            />

            <Pressable
              style={[styles.button, (loading || code.length < 6) && styles.buttonDisabled]}
              onPress={verifierCode}
              disabled={loading || code.length < 6}
            >
              {loading ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={styles.buttonText}>Vérifier</Text>
              )}
            </Pressable>

            <Pressable style={styles.link} onPress={abandonner}>
              <Text style={styles.linkText}>Revenir à la connexion</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <AppLogo size={84} />
          </View>
          <Text style={styles.title}>Quantinvo</Text>
          <Text style={styles.subtitle}>Outil d'inventaire</Text>
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
            <Text style={styles.linkText}>Comment obtenir un compte ?</Text>
          </Pressable>

          <Pressable style={styles.privacyLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.privacyLinkText}>Politique de confidentialité</Text>
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
      marginBottom: Spacing.lg,
      shadowColor: '#6C5CE7',
      shadowOpacity: 0.45,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
    },
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
    codeInput: {
      fontSize: 22,
      fontFamily: Font.semibold,
      letterSpacing: 8,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
    link: { alignItems: 'center', paddingVertical: Spacing.sm },
    linkText: { color: t.accent, fontSize: 14, fontFamily: Font.medium },
    privacyLink: { alignItems: 'center', paddingVertical: Spacing.xs },
    privacyLinkText: { color: t.textMuted, fontSize: 12, fontFamily: Font.regular, textDecorationLine: 'underline' },
  })
}
