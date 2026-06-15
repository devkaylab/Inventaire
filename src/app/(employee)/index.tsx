import { useState } from 'react'
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
import { joinSession } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'

export default function EmployeeHomeScreen() {
  const { signOut, profile } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [inventoryNumber, setInventoryNumber] = useState('')
  const [securityCode, setSecurityCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    if (!inventoryNumber.trim() || !securityCode.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le numéro d\'inventaire et le code de sécurité.')
      return
    }
    setLoading(true)
    try {
      const result = await joinSession(inventoryNumber.trim(), securityCode.trim())
      if (!result.success) {
        Alert.alert('Erreur', result.error ?? 'Impossible de rejoindre la session.')
        return
      }
      router.push(`/(employee)/${result.session_id}`)
    } catch (e: unknown) {
      console.error('[employee] joinSession', e)
      Alert.alert('Erreur', errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.welcome}>Bonjour, <Text style={styles.welcomeName}>{profile?.full_name}</Text></Text>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Déconnexion</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rejoindre une session</Text>
          <Text style={styles.cardDesc}>
            Demandez le numéro d'inventaire et le code de sécurité à votre superviseur.
          </Text>

          <Text style={styles.label}>N° d'inventaire</Text>
          <TextInput
            style={styles.input}
            value={inventoryNumber}
            onChangeText={v => setInventoryNumber(v.toUpperCase())}
            autoCapitalize="characters"
            placeholder="INV-20260526-XXXX"
            placeholderTextColor={theme.textMuted}
          />

          <Text style={styles.label}>Code de sécurité</Text>
          <TextInput
            style={styles.input}
            value={securityCode}
            onChangeText={v => setSecurityCode(v.toUpperCase())}
            autoCapitalize="characters"
            placeholder="XXXXXX"
            placeholderTextColor={theme.textMuted}
          />

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleJoin} disabled={loading}>
            {loading ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.buttonText}>Rejoindre</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: t.surface, borderBottomWidth: 1, borderBottomColor: t.hairline },
    welcome: { fontSize: 14, color: t.textSecondary, fontFamily: Font.regular },
    welcomeName: { color: t.textPrimary, fontFamily: Font.semibold },
    signOut: { fontSize: 14, color: t.danger, fontFamily: Font.medium },
    body: { flex: 1, justifyContent: 'center', padding: Spacing.xxl },
    card: { backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.xl, borderWidth: 1, borderColor: t.hairline, gap: Spacing.md, ...t.shadowCard },
    cardTitle: { fontSize: 18, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.3 },
    cardDesc: { fontSize: 14, color: t.textSecondary, lineHeight: 20, fontFamily: Font.regular },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary },
    input: { borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 13, fontSize: 16, backgroundColor: t.background, color: t.textPrimary, fontFamily: Font.regular, ...tabular },
    button: { backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.xs, ...t.shadowButton },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
  })
}
