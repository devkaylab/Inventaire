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
import { useAuth } from '@/lib/auth'
import {
  getSession,
  getSessionInvitations,
  getSessionMembers,
  getStoreDirectory,
  inviteToSession,
  type DirectoryEntry,
  type SessionRole,
} from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

export default function InviteToSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { profile } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const queryClient = useQueryClient()

  const { data: session } = useQuery({ queryKey: ['session', sessionId], queryFn: () => getSession(sessionId) })
  const storeId = session?.store_id
  const { data: directory } = useQuery({
    queryKey: ['store-directory', storeId],
    queryFn: () => getStoreDirectory(storeId as string),
    enabled: !!storeId,
  })
  const { data: members } = useQuery({ queryKey: ['session-members', sessionId], queryFn: () => getSessionMembers(sessionId) })
  const { data: invitations } = useQuery({ queryKey: ['session-invitations', sessionId], queryFn: () => getSessionInvitations(sessionId) })

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<DirectoryEntry | null>(null)
  const [role, setRole] = useState<SessionRole>('counter')
  const [loading, setLoading] = useState(false)

  // Personnes déjà dans l'inventaire (à exclure des suggestions).
  const excludedIds = new Set<string>()
  if (profile?.id) excludedIds.add(profile.id)
  for (const m of members ?? []) excludedIds.add((m as { user_id: string }).user_id)
  const excludedEmails = new Set((invitations ?? []).map(i => i.email.toLowerCase()))

  const q = query.trim().toLowerCase()
  const suggestions = (!q || selected)
    ? []
    : (directory ?? [])
        .filter(d => !excludedIds.has(d.user_id) && !excludedEmails.has((d.email ?? '').toLowerCase()))
        .filter(d => (d.full_name ?? '').toLowerCase().includes(q) || (d.email ?? '').toLowerCase().includes(q))
        .slice(0, 8)

  function pick(entry: DirectoryEntry) {
    setSelected(entry)
    setQuery(entry.full_name || entry.email)
  }

  function clearSelection() {
    setSelected(null)
    setQuery('')
  }

  async function handleSubmit() {
    if (!selected) {
      return Alert.alert('Erreur', 'Choisissez une personne dans la liste des suggestions.')
    }
    const fullName = selected.full_name || ''
    const email = selected.email

    setLoading(true)
    try {
      const res = await inviteToSession({ sessionId, fullName, email, role })
      const added = res.outcome === 'added'
      const who = fullName || email
      const roleLabel = role === 'supervisor' ? 'co-superviseur' : 'compteur'
      Alert.alert(
        added ? 'Personne ajoutée' : 'Invitation envoyée',
        added
          ? `${who} a été ajouté à l'inventaire en tant que ${roleLabel}.`
          : `${who} recevra un e-mail l'invitant à créer son compte avec l'adresse ${email}. Elle rejoindra l'inventaire dès son inscription.`,
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

  const canSend = !!selected
  const noMatch = q.length > 0 && !selected && suggestions.length === 0

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            {'Recherchez une personne de l’équipe du magasin par nom ou e-mail'}
            {session ? ` pour l'inventaire « ${session.name || session.store_name} »` : ''}
            {". Seules les personnes ayant déjà un compte apparaissent. Pour ajouter un nouveau compteur, utilisez « Ajouter un membre » depuis votre profil."}
          </Text>

          <Text style={styles.label}>Recherche</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={(v) => { setQuery(v); if (selected) setSelected(null) }}
              placeholder="Nom ou adresse e-mail"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            {selected && (
              <Pressable style={styles.clearBtn} onPress={clearSelection}>
                <Text style={styles.clearBtnText}>Effacer</Text>
              </Pressable>
            )}
          </View>

          {selected && (
            <View style={styles.selectedCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(selected.full_name || selected.email).charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selName}>{selected.full_name || selected.email}</Text>
                <Text style={styles.selMeta}>{selected.email}</Text>
              </View>
            </View>
          )}

          {suggestions.map(s => (
            <Pressable key={s.user_id} style={styles.suggRow} onPress={() => pick(s)}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(s.full_name || s.email).charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.suggName}>{s.full_name || s.email}</Text>
                <Text style={styles.suggMeta}>{s.email}{s.role === 'supervisor' ? ' · superviseur' : ''}</Text>
              </View>
            </Pressable>
          ))}

          {noMatch && (
            <Text style={styles.noMatch}>
              {"Aucune personne trouvée dans l'équipe de ce magasin. Un nouveau compteur doit d'abord être ajouté via « Ajouter un membre »."}
            </Text>
          )}

          <Text style={styles.label}>Rôle sur cet inventaire</Text>
          <View style={styles.roleRow}>
            <RolePill styles={styles} active={role === 'counter'} title="Compteur" desc="Scanne et compte les articles" onPress={() => setRole('counter')} />
            <RolePill styles={styles} active={role === 'supervisor'} title="Co-superviseur" desc="Mêmes droits que vous" onPress={() => setRole('supervisor')} />
          </View>

          <Pressable style={[styles.button, (!canSend || loading) && styles.buttonDisabled]} onPress={handleSubmit} disabled={!canSend || loading}>
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
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    input: {
      flex: 1, borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg, paddingVertical: 13, fontSize: 16,
      backgroundColor: t.surface, color: t.textPrimary, fontFamily: Font.regular,
    },
    clearBtn: { paddingHorizontal: Spacing.md, paddingVertical: 10 },
    clearBtnText: { color: t.accent, fontSize: 14, fontFamily: Font.semibold },
    selectedCard: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: t.accentSoft, borderRadius: Radius.md, padding: Spacing.md,
      borderWidth: 1, borderColor: t.accent,
    },
    selName: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary },
    selMeta: { fontSize: 12, fontFamily: Font.regular, color: t.textSecondary, marginTop: 1 },
    suggRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: t.surface, borderRadius: Radius.md, padding: Spacing.md,
      borderWidth: 1, borderColor: t.hairline,
    },
    suggName: { fontSize: 14, fontFamily: Font.semibold, color: t.textPrimary },
    suggMeta: { fontSize: 12, fontFamily: Font.regular, color: t.textMuted, marginTop: 1 },
    avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 15, fontFamily: Font.bold, color: t.accent },
    noMatch: { fontSize: 13, color: t.textMuted, fontFamily: Font.regular, lineHeight: 18, paddingVertical: Spacing.sm },
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
