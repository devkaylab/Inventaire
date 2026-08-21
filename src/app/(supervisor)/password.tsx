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
import { supabase } from '@/lib/supabase'
import { friendlyPasswordError, passwordError, passwordSatisfies } from '@/lib/password'
import { PasswordRules } from '@/components/PasswordRules'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

/**
 * Changer son mot de passe depuis l'app.
 *
 * Il fallait jusqu'ici ouvrir le site. Les exigences sont celles de la console
 * Supabase, rejouées ici pour les énoncer en français avant l'envoi ; deux
 * règles ne peuvent se vérifier que côté serveur (mot de passe présent dans
 * une fuite connue, réutilisation de l'ancien) et reviennent en anglais —
 * `friendlyPasswordError` les traduit.
 */
export default function PasswordScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const conforme = passwordSatisfies(password)
  const identiques = password.length > 0 && password === confirm
  const pretAEnvoyer = conforme && identiques && !busy

  async function enregistrer() {
    const probleme = passwordError(password)
    if (probleme) {
      Alert.alert('Mot de passe refusé', probleme)
      return
    }
    if (password !== confirm) {
      Alert.alert('Mot de passe refusé', 'Les deux saisies ne sont pas identiques.')
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        Alert.alert('Mot de passe refusé', friendlyPasswordError(error.message))
        return
      }
      Alert.alert(
        'Mot de passe modifié',
        'Votre nouveau mot de passe est actif, sur le téléphone comme sur le site.',
        [{ text: 'Fermer', onPress: () => router.back() }],
      )
    } catch (e) {
      Alert.alert('Erreur', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.intro}>
              Le nouveau mot de passe remplace l&apos;ancien tout de suite, sur le téléphone comme
              sur le site.
            </Text>

            <Text style={styles.label}>Nouveau mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="••••••••••••"
              placeholderTextColor={theme.textMuted}
            />
            <PasswordRules password={password} />

            <Text style={styles.label}>Confirmer</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="Retapez le mot de passe"
              placeholderTextColor={theme.textMuted}
            />
            {confirm.length > 0 && !identiques && (
              <Text style={styles.mismatch}>Les deux saisies ne sont pas identiques.</Text>
            )}

            <Pressable
              style={[styles.btn, !pretAEnvoyer && styles.btnOff]}
              onPress={enregistrer}
              disabled={!pretAEnvoyer}
            >
              {busy ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={styles.btnText}>Enregistrer</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.note}>
            Un mot de passe qui figure dans une fuite de données connue est refusé : il est déjà à
            la disposition des attaquants.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
    card: {
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg,
      borderWidth: 1, borderColor: t.hairline, ...t.shadowCard,
    },
    intro: { fontSize: 13, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 18 },
    label: {
      fontSize: 12, fontFamily: Font.semibold, color: t.textSecondary,
      marginTop: Spacing.lg, marginBottom: Spacing.sm,
    },
    input: {
      backgroundColor: t.background, borderRadius: Radius.md,
      borderWidth: 1, borderColor: t.borderStrong,
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      fontSize: 15, color: t.textPrimary, fontFamily: Font.regular,
    },
    mismatch: { fontSize: 12, color: t.danger, fontFamily: Font.medium, marginTop: Spacing.sm },
    btn: {
      marginTop: Spacing.xl, backgroundColor: t.accent, borderRadius: Radius.md,
      paddingVertical: 14, alignItems: 'center', ...t.shadowButton,
    },
    btnOff: { opacity: 0.45 },
    btnText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },
    note: {
      fontSize: 12, color: t.textMuted, fontFamily: Font.regular,
      lineHeight: 17, marginLeft: 2,
    },
  })
}
