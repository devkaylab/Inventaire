import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { joinStore } from '@/lib/queries'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

export default function CompanySetupScreen() {
  const { refreshProfile, signOut } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    if (!code.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le code du magasin.')
      return
    }
    setLoading(true)
    try {
      const res = await joinStore(code.trim())
      if (!res.success) {
        Alert.alert('Erreur', res.error ?? 'Code introuvable.')
        return
      }
      await refreshProfile()
      router.replace('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Rejoindre votre magasin</Text>
            <Text style={styles.subtitle}>
              Saisissez le code du magasin qui vous a été communiqué par votre administrateur.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Code du magasin</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={t => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABC123"
              placeholderTextColor={theme.textMuted}
            />

            <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleJoin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={styles.buttonText}>Rejoindre</Text>
              )}
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
