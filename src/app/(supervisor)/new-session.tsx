import { useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { createSession } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

function generateCode(): string {
  return Math.random().toString(36).toUpperCase().slice(2, 8)
}

export default function NewSessionScreen() {
  const queryClient = useQueryClient()
  const theme = useTheme()
  const styles = makeStyles(theme)
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
        '✅ Session créée',
        `N° d'inventaire : ${result.inventory_number}\nCode de sécurité : ${result.security_code ?? securityCode}\n\nImportez maintenant le catalogue articles et le stock théorique pour préparer le comptage.`,
        [
          {
            text: 'Importer les fichiers',
            onPress: () => router.replace(`/(supervisor)/${result.session_id}/import`),
          },
          {
            text: 'Plus tard',
            style: 'cancel',
            onPress: () => router.replace(`/(supervisor)/${result.session_id}`),
          },
        ]
      )
    } catch (e: unknown) {
      console.error('[new-session] createSession', e)
      Alert.alert('Erreur', errorMessage(e))
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
            placeholderTextColor={theme.textMuted}
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
              placeholderTextColor={theme.textMuted}
            />
            <Pressable style={styles.regenBtn} onPress={() => setSecurityCode(generateCode())}>
              <Text style={styles.regenText}>Générer</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Communiquez ce code à tous les membres de l'équipe pour qu'ils rejoignent cette session.
          </Text>

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleCreate} disabled={loading}>
            {loading ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.buttonText}>Créer la session</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.md },
    sectionTitle: { fontSize: 18, fontFamily: Font.bold, color: t.textPrimary, marginBottom: Spacing.xs, letterSpacing: -0.3 },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary },
    input: { borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 13, fontSize: 16, backgroundColor: t.surface, color: t.textPrimary, fontFamily: Font.regular },
    codeRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    regenBtn: { backgroundColor: t.accentSoft, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 13 },
    regenText: { color: t.accent, fontFamily: Font.semibold, fontSize: 14 },
    hint: { fontSize: 13, color: t.textSecondary, lineHeight: 18, fontFamily: Font.regular },
    button: { backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.lg, ...t.shadowButton },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
  })
}
