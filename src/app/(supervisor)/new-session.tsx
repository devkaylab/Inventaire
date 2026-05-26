import { useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { createSession } from '@/lib/queries'
import { Colors } from '@/constants/colors'

function generateCode(): string {
  return Math.random().toString(36).toUpperCase().slice(2, 8)
}

export default function NewSessionScreen() {
  const queryClient = useQueryClient()
  const [storeName, setStoreName] = useState('')
  const [securityCode, setSecurityCode] = useState(generateCode())
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!storeName.trim()) {
      Alert.alert('Erreur', 'Le nom du magasin est requis.')
      return
    }
    if (securityCode.trim().length < 4) {
      Alert.alert('Erreur', 'Le code de sécurité doit comporter au moins 4 caractères.')
      return
    }
    setLoading(true)
    try {
      const result = await createSession(storeName.trim(), securityCode.trim())
      if (!result.success) {
        Alert.alert('Erreur', result.error ?? 'Impossible de créer la session.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      Alert.alert(
        'Session créée',
        `N° d'inventaire : ${result.inventory_number}\nCode de sécurité : ${securityCode}\n\nCommuniquez ces informations à votre équipe.`,
        [{ text: 'Voir la session', onPress: () => router.replace(`/(supervisor)/${result.session_id}`) }]
      )
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Informations de la session</Text>

          <Text style={styles.label}>Nom du magasin</Text>
          <TextInput
            style={styles.input}
            value={storeName}
            onChangeText={setStoreName}
            placeholder="Ex: Magasin Paris Centre"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>Code de sécurité</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={securityCode}
              onChangeText={v => setSecurityCode(v.toUpperCase())}
              autoCapitalize="characters"
              maxLength={10}
              placeholder="XXXXXX"
              placeholderTextColor={Colors.textMuted}
            />
            <Pressable style={styles.regenBtn} onPress={() => setSecurityCode(generateCode())}>
              <Text style={styles.regenText}>Générer</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Communiquez ce code à tous les membres de l'équipe pour qu'ils rejoignent cette session.
          </Text>

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleCreate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Créer la session</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: Colors.surface, color: Colors.textPrimary },
  codeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  regenBtn: { backgroundColor: Colors.primary + '15', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  regenText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  hint: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  button: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
