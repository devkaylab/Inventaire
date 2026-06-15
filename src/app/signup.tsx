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
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

export default function SignupScreen() {
  const { signUp } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'employee' | 'supervisor'>('employee')
  const [loading, setLoading] = useState(false)

  async function handleSignup() {
    if (!fullName || !email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit comporter au moins 6 caractères.')
      return
    }
    setLoading(true)
    const { error } = await signUp(email.trim(), password, fullName.trim(), role)
    setLoading(false)
    if (error) {
      Alert.alert('Inscription échouée', error)
    } else {
      Alert.alert('Compte créé', 'Vous pouvez maintenant vous connecter.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ])
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Créer un compte</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Nom complet</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              placeholder="Jean Dupont"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="votre@email.com"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={styles.label}>Rôle</Text>
            <View style={styles.roleRow}>
              {(['employee', 'supervisor'] as const).map(r => (
                <Pressable
                  key={r}
                  style={[styles.roleButton, role === r && styles.roleButtonActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                    {r === 'employee' ? 'Employé' : 'Superviseur'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignup} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={styles.buttonText}>S'inscrire</Text>
              )}
            </Pressable>

            <Pressable style={styles.link} onPress={() => router.back()}>
              <Text style={styles.linkText}>Déjà un compte ? Se connecter</Text>
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
    header: { alignItems: 'center', marginBottom: Spacing.xxxl },
    title: { fontSize: 28, fontFamily: Font.extrabold, color: t.textPrimary, letterSpacing: -0.5 },
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
    roleRow: { flexDirection: 'row', gap: Spacing.md },
    roleButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.hairline,
      borderRadius: Radius.md,
      paddingVertical: 13,
      alignItems: 'center',
      backgroundColor: t.surface,
    },
    roleButtonActive: { borderColor: t.accent, backgroundColor: t.accentSoft },
    roleText: { color: t.textSecondary, fontFamily: Font.medium },
    roleTextActive: { color: t.accent, fontFamily: Font.bold },
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
