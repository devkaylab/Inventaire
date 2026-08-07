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
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyCompany, inviteTeammate } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

export default function NewMemberScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const queryClient = useQueryClient()
  const { data: company } = useQuery({ queryKey: ['my-company'], queryFn: getMyCompany })
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    const name = fullName.trim()
    const mail = email.trim().toLowerCase()
    if (!name) return Alert.alert('Erreur', 'Saisissez le nom du membre.')
    if (!mail || !mail.includes('@')) return Alert.alert('Erreur', "Saisissez une adresse e-mail valide.")
    if (!company) return Alert.alert('Erreur', 'Entreprise introuvable.')

    setLoading(true)
    try {
      const res = await inviteTeammate({ fullName: name, email: mail })
      await queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
      Alert.alert(
        'Membre ajouté',
        res.emailSent
          ? `Un e-mail a été envoyé à ${mail} pour finaliser son compte.`
          : `${name} a été ajouté. Demandez-lui d'ouvrir l'app, de choisir « Je rejoins mon équipe » et de s'inscrire avec l'adresse ${mail}.\n\n(L'e-mail automatique n'a pas encore pu être envoyé — configuration Resend/domaine à finaliser.)`,
        [{ text: 'Terminé', onPress: () => router.back() }],
      )
    } catch (e) {
      const msg = errorMessage(e)
      Alert.alert(
        'Erreur',
        /duplicate|unique/i.test(msg)
          ? 'Cette adresse e-mail est déjà invitée ou déjà utilisée.'
          : msg,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Pré-inscrivez un membre de votre équipe. Il pourra ensuite créer son compte lui-même avec
            cette adresse e-mail et choisir son propre mot de passe.
          </Text>

          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ex: Marie Dupont"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={styles.label}>Adresse e-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="marie.dupont@exemple.fr"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <Text style={styles.hint}>
            {"L'employé recevra un e-mail à cette adresse et devra l'utiliser exactement pour s'inscrire."}
          </Text>

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={styles.buttonText}>{"Ajouter à l'équipe"}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.xl, gap: Spacing.sm },
    intro: { fontSize: 14, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 20, marginBottom: Spacing.md },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary, marginTop: Spacing.sm },
    input: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg, paddingVertical: 13, fontSize: 16,
      backgroundColor: t.surface, color: t.textPrimary, fontFamily: Font.regular,
    },
    hint: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular, marginTop: 4, lineHeight: 17 },
    button: {
      backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg,
      alignItems: 'center', marginTop: Spacing.lg, ...t.shadowButton,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
  })
}
