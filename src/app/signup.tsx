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
import { Colors } from '@/constants/colors'

export default function SignupScreen() {
  const { signUp } = useAuth()
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
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="votre@email.com"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
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
                <ActivityIndicator color="#fff" />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: 24, paddingVertical: 32 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.surface,
    color: Colors.textPrimary,
  },
  roleRow: { flexDirection: 'row', gap: 12 },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  roleButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  roleText: { color: Colors.textSecondary, fontWeight: '500' },
  roleTextActive: { color: Colors.primary, fontWeight: '700' },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: Colors.primary, fontSize: 14 },
})
