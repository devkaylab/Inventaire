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
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSession, inviteToSession, type SessionRole } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

export default function InviteToSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const queryClient = useQueryClient()
  const { data: session } = useQuery({ queryKey: ['session', sessionId], queryFn: () => getSession(sessionId) })
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<SessionRole>('counter')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    const name = fullName.trim()
    const mail = email.trim().toLowerCase()
    if (!name) return Alert.alert('Erreur', 'Saisissez le nom de la personne.')
    if (!mail || !mail.includes('@')) return Alert.alert('Erreur', 'Saisissez une adresse e-mail valide.')

    setLoading(true)
    try {
      const res = await inviteToSession({ sessionId, fullName: name, email: mail, role })
      const added = res.outcome === 'added'
      const roleLabel = role === 'supervisor' ? 'co-superviseur' : 'compteur'
      Alert.alert(
        added ? 'Personne ajoutée' : 'Invitation envoyée',
        added
          ? `${name} a été ajouté à l'inventaire en tant que ${roleLabel}.`
          : `${name} recevra un e-mail l'invitant à créer son compte avec l'adresse ${mail}. Elle rejoindra l'inventaire dès son inscription.`,
        [{ text: 'Terminé', onPress: () => router.back() }],
      )
      await queryClient.invalidateQueries({ queryKey: ['session-members', sessionId] })
      await queryClient.invalidateQueries({ queryKey: ['session-invitations', sessionId] })
    } catch (e) {
      Alert.alert('Erreur', errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            {"Invitez une personne à participer à l'inventaire"}
            {session ? ` « ${session.name || session.store_name} »` : ''}
            {". Si elle a déjà un compte, elle est ajoutée immédiatement ; sinon, elle reçoit un e-mail pour créer le sien."}
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
          />

          <Text style={styles.label}>Rôle sur cet inventaire</Text>
          <View style={styles.roleRow}>
            <RolePill
              styles={styles}
              active={role === 'counter'}
              title="Compteur"
              desc="Scanne et compte les articles"
              onPress={() => setRole('counter')}
            />
            <RolePill
              styles={styles}
              active={role === 'supervisor'}
              title="Co-superviseur"
              desc="Mêmes droits que vous"
              onPress={() => setRole('supervisor')}
            />
          </View>

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={styles.buttonText}>{"Envoyer l'invitation"}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function RolePill({
  active, title, desc, onPress, styles,
}: {
  active: boolean
  title: string
  desc: string
  onPress: () => void
  styles: ReturnType<typeof makeStyles>
}) {
  return (
    <Pressable style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={[styles.pillTitle, active && styles.pillTitleActive]}>{title}</Text>
      <Text style={[styles.pillDesc, active && styles.pillDescActive]}>{desc}</Text>
    </Pressable>
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
    roleRow: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
    pill: {
      flex: 1, borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      padding: Spacing.md, backgroundColor: t.surface, gap: 3,
    },
    pillActive: { borderColor: t.accent, backgroundColor: t.accentSoft },
    pillTitle: { fontSize: 14, fontFamily: Font.bold, color: t.textPrimary },
    pillTitleActive: { color: t.accent },
    pillDesc: { fontSize: 12, fontFamily: Font.regular, color: t.textMuted, lineHeight: 16 },
    pillDescActive: { color: t.accent },
    button: {
      backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg,
      alignItems: 'center', marginTop: Spacing.lg, ...t.shadowButton,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
  })
}
