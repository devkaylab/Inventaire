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
import { Colors } from '@/constants/colors'

export default function EmployeeHomeScreen() {
  const { signOut, profile } = useAuth()
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
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.welcome}>Bonjour, {profile?.full_name}</Text>
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
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>Code de sécurité</Text>
          <TextInput
            style={styles.input}
            value={securityCode}
            onChangeText={v => setSecurityCode(v.toUpperCase())}
            autoCapitalize="characters"
            placeholder="XXXXXX"
            placeholderTextColor={Colors.textMuted}
          />

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleJoin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Rejoindre</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  welcome: { fontSize: 14, color: Colors.textSecondary },
  signOut: { fontSize: 14, color: Colors.danger },
  body: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  cardDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: Colors.background, color: Colors.textPrimary },
  button: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
