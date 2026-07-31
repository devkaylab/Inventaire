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
import { checkInvitation } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

type Kind = 'supervisor' | 'employee'

export default function SignupScreen() {
  const { signUp } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [kind, setKind] = useState<Kind>('supervisor')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    const mail = email.trim().toLowerCase()
    setLoading(true)
    try {
      // Un employé ne peut s'inscrire que si son superviseur l'a pré-inscrit.
      if (kind === 'employee') {
        const invited = await checkInvitation(mail)
        if (!invited) {
          Alert.alert(
            'Invitation requise',
            "Aucune invitation trouvée pour cet e-mail. Demandez à votre superviseur de vous ajouter à son équipe, puis réessayez.",
          )
          return
        }
      }
      const { error } = await signUp(mail, password, fullName.trim(), kind)
      if (error) {
        Alert.alert('Inscription échouée', error)
        return
      }
      Alert.alert('Compte créé', 'Vous pouvez maintenant vous connecter.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ])
    } catch (e) {
      Alert.alert('Erreur', errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Créer un compte</Text>
            <Text style={styles.subtitle}>
              {kind === 'supervisor'
                ? 'Créez votre compte et ouvrez votre entreprise.'
                : 'Votre superviseur doit vous avoir ajouté à son équipe.'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.kindRow}>
              {([
                ['supervisor', 'Je crée mon entreprise'],
                ['employee', 'Je rejoins mon équipe'],
              ] as const).map(([k, label]) => (
                <Pressable
                  key={k}
                  style={[styles.kindButton, kind === k && styles.kindButtonActive]}
                  onPress={() => setKind(k)}
                >
                  <Text style={[styles.kindText, kind === k && styles.kindTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

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
    header: { alignItems: 'center', marginBottom: Spacing.xxxl, gap: Spacing.sm },
    title: { fontSize: 28, fontFamily: Font.extrabold, color: t.textPrimary, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, fontFamily: Font.regular, color: t.textSecondary, textAlign: 'center', lineHeight: 20 },
    form: { gap: Spacing.md },
    kindRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
    kindButton: {
      flex: 1, borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      paddingVertical: 12, paddingHorizontal: Spacing.sm, alignItems: 'center',
      backgroundColor: t.surface,
    },
    kindButtonActive: { borderColor: t.accent, backgroundColor: t.accentSoft },
    kindText: { color: t.textSecondary, fontFamily: Font.medium, fontSize: 13, textAlign: 'center' },
    kindTextActive: { color: t.accent, fontFamily: Font.bold },
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
