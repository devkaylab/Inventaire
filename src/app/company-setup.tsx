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
import { createCompany, joinCompany } from '@/lib/queries'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

type Mode = 'create' | 'join'

export default function CompanySetupScreen() {
  const { refreshProfile, signOut } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [mode, setMode] = useState<Mode>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (mode === 'create' && !name.trim()) {
      Alert.alert('Erreur', "Veuillez saisir le nom de l'entreprise.")
      return
    }
    if (mode === 'join' && !code.trim()) {
      Alert.alert('Erreur', "Veuillez saisir le code de l'entreprise.")
      return
    }
    setLoading(true)
    try {
      if (mode === 'create') {
        const res = await createCompany(name.trim())
        if (!res.success) {
          Alert.alert('Erreur', res.error ?? "Création impossible.")
          return
        }
        await refreshProfile()
        Alert.alert(
          'Entreprise créée',
          `Partagez ce code avec vos collègues superviseurs pour qu'ils rejoignent « ${res.name} » :\n\n${res.join_code}`,
          [{ text: 'Continuer', onPress: () => router.replace('/') }],
        )
      } else {
        const res = await joinCompany(code.trim())
        if (!res.success) {
          Alert.alert('Erreur', res.error ?? 'Code introuvable.')
          return
        }
        await refreshProfile()
        router.replace('/')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Votre entreprise</Text>
            <Text style={styles.subtitle}>
              Vos inventaires sont privés à votre entreprise. Créez-en une, ou rejoignez celle de vos
              collègues avec leur code.
            </Text>
          </View>

          <View style={styles.modeRow}>
            {(['create', 'join'] as const).map(m => (
              <Pressable
                key={m}
                style={[styles.modeButton, mode === m && styles.modeButtonActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                  {m === 'create' ? 'Créer' : 'Rejoindre'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.form}>
            {mode === 'create' ? (
              <>
                <Text style={styles.label}>Nom de l'entreprise</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  placeholder="Ma société"
                  placeholderTextColor={theme.textMuted}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Code de l'entreprise</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={code}
                  onChangeText={t => setCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="ABC123"
                  placeholderTextColor={theme.textMuted}
                />
              </>
            )}

            <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={styles.buttonText}>{mode === 'create' ? "Créer l'entreprise" : 'Rejoindre'}</Text>
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
    modeRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
    modeButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.hairline,
      borderRadius: Radius.md,
      paddingVertical: 13,
      alignItems: 'center',
      backgroundColor: t.surface,
    },
    modeButtonActive: { borderColor: t.accent, backgroundColor: t.accentSoft },
    modeText: { color: t.textSecondary, fontFamily: Font.medium },
    modeTextActive: { color: t.accent, fontFamily: Font.bold },
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
