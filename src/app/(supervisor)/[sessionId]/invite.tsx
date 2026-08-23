/**
 * Ajouter des compteurs à un inventaire.
 *
 * Dernière étape du tunnel de préparation (créer → zones → fichiers → ici),
 * et écran autonome depuis la fiche d'un inventaire.
 *
 * ⚠️ **Deux gestes distincts, que l'écran enchaîne sans les confondre :**
 *
 * - `invite-teammate` crée un **compte pour l'entreprise** — c'est « créer son
 *   équipe ». La personne reçoit un e-mail pour choisir son mot de passe.
 * - `invite-to-session` ajoute à **cet inventaire** quelqu'un qui a déjà un
 *   compte. Être dans l'équipe du magasin ne donne aucun accès à l'inventaire
 *   (`is_session_participant` exige une ligne dans `session_members`).
 *
 * Ce qui rend l'enchaînement possible : `handle_new_user` se déclenche à
 * l'insertion dans `auth.users`, c'est-à-dire **à l'invitation**. Le profil et
 * le rattachement au magasin (`store_team`) existent donc avant que la personne
 * ait choisi son mot de passe — elle apparaît dans l'annuaire du magasin
 * aussitôt créée, et rejoint l'inventaire dans la foulée. Vérifié en base le
 * 23 août 2026.
 */
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import {
  getSession,
  getSessionInvitations,
  getSessionMembers,
  getStoreDirectory,
  inviteTeammate,
  inviteToSession,
  type DirectoryEntry,
  type SessionRole,
} from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'

export default function InviteToSessionScreen() {
  const { sessionId, from } = useLocalSearchParams<{ sessionId: string; from?: string }>()
  // Dernière étape du tunnel : le retour est masqué comme sur les deux écrans
  // précédents, et la sortie se fait par « Commencer l'inventaire ».
  const fromNew = from === 'new'
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

  // Création d'équipe, quand il n'y a encore personne à chercher.
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)

  // Personnes déjà dans l'inventaire (à exclure des suggestions).
  const excludedIds = new Set<string>()
  if (profile?.id) excludedIds.add(profile.id)
  for (const m of members ?? []) excludedIds.add((m as { user_id: string }).user_id)
  const excludedEmails = new Set((invitations ?? []).map(i => i.email.toLowerCase()))

  const disponibles = (directory ?? []).filter(
    d => !excludedIds.has(d.user_id) && !excludedEmails.has((d.email ?? '').toLowerCase()),
  )

  /**
   * « Pas encore d'équipe » se juge sur l'annuaire **entier**, pas sur les
   * suggestions d'une recherche : quelqu'un dont tous les collègues sont déjà
   * dans l'inventaire n'a pas à se voir proposer d'en créer un de plus.
   * L'annuaire contient toujours au moins le superviseur lui-même — d'où le
   * filtre sur les compteurs.
   */
  const equipeVide = directory !== undefined
    && (directory ?? []).filter(d => d.user_id !== profile?.id && d.role !== 'supervisor').length === 0

  const q = query.trim().toLowerCase()
  const suggestions = (!q || selected)
    ? []
    : disponibles
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
      return Alert.alert('Personne à choisir', 'Choisissez une personne dans la liste des suggestions.')
    }
    const fullName = selected.full_name || ''
    const mail = selected.email

    setLoading(true)
    try {
      const res = await inviteToSession({ sessionId, fullName, email: mail, role })
      const added = res.outcome === 'added'
      const who = fullName || mail
      const roleLabel = role === 'supervisor' ? 'co-superviseur' : 'compteur'
      await rafraichir()
      // ⚠️ Dans le tunnel, on reste : on ajoute souvent plusieurs personnes à
      // la suite. Hors tunnel, l'écran a été ouvert pour un ajout et se ferme.
      Alert.alert(
        added ? 'Personne ajoutée' : 'Invitation envoyée',
        added
          ? `${who} a été ajouté à l'inventaire en tant que ${roleLabel}.`
          : `${who} recevra un e-mail l'invitant à créer son compte avec l'adresse ${mail}. Elle rejoindra l'inventaire dès son inscription.`,
        [{ text: fromNew ? 'Continuer' : 'Terminé', onPress: () => { if (!fromNew) router.back() } }],
      )
      clearSelection()
    } catch (e) {
      Alert.alert('Erreur', errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  /**
   * Créer le compte d'un compteur, puis l'ajouter à l'inventaire.
   *
   * ⚠️ Le compteur est rattaché au **magasin de cet inventaire**, pas à tous
   * ceux du superviseur : on le crée depuis un inventaire précis, c'est là
   * qu'il va compter. Passer une liste vide le rattacherait à tous les magasins
   * du créateur (branche `else` de `handle_new_user`).
   *
   * ⚠️ Si le compte est créé mais l'ajout échoue, on le dit : le compte existe
   * bel et bien, et le refaire donnerait « déjà invité ». La personne se
   * retrouve alors par la recherche, juste au-dessus.
   */
  async function handleCreate() {
    const first = firstName.trim()
    const last = lastName.trim()
    const mail = email.trim().toLowerCase()
    if (!first) return Alert.alert('Prénom manquant', 'Saisissez le prénom du compteur.')
    if (!last) return Alert.alert('Nom manquant', 'Saisissez le nom du compteur.')
    if (!mail || !mail.includes('@')) return Alert.alert('Adresse à revoir', 'Saisissez une adresse e-mail valide.')

    const who = `${first} ${last}`
    setCreating(true)
    try {
      await inviteTeammate({
        firstName: first,
        lastName: last,
        email: mail,
        storeIds: storeId ? [storeId] : [],
      })
      await queryClient.invalidateQueries({ queryKey: ['team-invitations'] })

      try {
        await inviteToSession({ sessionId, fullName: who, email: mail, role: 'counter' })
      } catch (e) {
        await rafraichir()
        setFirstName(''); setLastName(''); setEmail('')
        return Alert.alert(
          'Compte créé, ajout à faire',
          `Le compte de ${who} est créé, mais son ajout à l'inventaire a échoué : ${errorMessage(e)}\n\nRetrouvez-le par la recherche ci-dessus.`,
        )
      }

      await rafraichir()
      setFirstName(''); setLastName(''); setEmail('')
      Alert.alert(
        'Compteur ajouté',
        `${who} reçoit un e-mail à l'adresse ${mail} pour choisir son mot de passe, et fait déjà partie de cet inventaire.`,
      )
    } catch (e: unknown) {
      const code = (e as { code?: string }).code
      if (code === 'other_company') {
        // Ce n'est pas une faute de saisie : on dit la marche à suivre, et on
        // ne nomme jamais l'autre entreprise.
        Alert.alert('Cette personne n’est pas de votre entreprise', errorMessage(e))
      } else {
        Alert.alert('Erreur', errorMessage(e))
      }
    } finally {
      setCreating(false)
    }
  }

  async function rafraichir() {
    await queryClient.invalidateQueries({ queryKey: ['session-members', sessionId] })
    await queryClient.invalidateQueries({ queryKey: ['session-invitations', sessionId] })
    if (storeId) await queryClient.invalidateQueries({ queryKey: ['store-directory', storeId] })
  }

  async function partager() {
    try {
      await Share.share({
        message: `Inventaire : ${session?.inventory_number}\nCode inventaire : ${session?.security_code ?? '—'}\nMagasin : ${session?.store_name}`,
      })
    } catch { /* geste annulé */ }
  }

  const canSend = !!selected
  const noMatch = q.length > 0 && !selected && suggestions.length === 0
  const busy = loading || creating

  // Personnes déjà sur l'inventaire, hors soi-même : ce qu'on vient de faire.
  const dejaAjoutes = (members ?? []).filter(m => (m as { user_id: string }).user_id !== profile?.id).length
    + (invitations ?? []).length

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {fromNew && (
        <Stack.Screen
          options={{
            title: 'Ajouter des compteurs',
            headerBackVisible: false,
            headerLeft: () => null,
            gestureEnabled: false,
          }}
        />
      )}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            {equipeVide
              ? "Qui comptera sur cet inventaire ? Créez le compte de votre premier compteur, ou partagez-lui les identifiants s'il a déjà l'application."
              : `Qui comptera sur cet inventaire ? Cherchez dans l'équipe${session?.store_name ? ` de ${session.store_name}` : ' du magasin'}, ou partagez les identifiants.`}
          </Text>

          {dejaAjoutes > 0 && (
            <Text style={styles.compte}>
              {dejaAjoutes} personne{dejaAjoutes > 1 ? 's' : ''} sur cet inventaire, en plus de vous.
            </Text>
          )}

          {!equipeVide && (
            <>
              <Text style={styles.label}>Rechercher dans l’équipe</Text>
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
                  {"Personne de ce nom dans l'équipe de ce magasin. Un compteur qui n'a pas encore de compte se crée plus bas."}
                </Text>
              )}

              <Text style={styles.label}>Rôle sur cet inventaire</Text>
              <View style={styles.roleRow}>
                <RolePill styles={styles} active={role === 'counter'} title="Compteur" desc="Scanne et compte les articles" onPress={() => setRole('counter')} />
                <RolePill styles={styles} active={role === 'supervisor'} title="Co-superviseur" desc="Mêmes droits que vous" onPress={() => setRole('supervisor')} />
              </View>

              <Pressable style={[styles.button, (!canSend || busy) && styles.buttonDisabled]} onPress={handleSubmit} disabled={!canSend || busy}>
                {loading ? (
                  <ActivityIndicator color={theme.onAccent} />
                ) : (
                  <Text style={styles.buttonText}>{"Ajouter à l'inventaire"}</Text>
                )}
              </Pressable>
            </>
          )}

          {/* ── Créer son équipe ───────────────────────────────────────────
              Le message d'avant renvoyait vers « Ajouter un membre » depuis le
              profil, sans lien : un cul-de-sac. On crée ici. */}
          <View style={styles.creerCard}>
            {equipeVide ? (
              <>
                <Text style={styles.creerTitre}>Vous n’avez pas encore d’équipe</Text>
                <Text style={styles.creerTexte}>
                  Créez le compte de votre premier compteur : il recevra un e-mail pour choisir
                  son mot de passe, et rejoindra cet inventaire aussitôt.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.creerTitre}>Ajouter un nouveau compteur</Text>
                <Text style={styles.creerTexte}>
                  Cette personne n’a pas encore de compte ? Créez-le ici : elle rejoindra cet
                  inventaire aussitôt.
                </Text>
              </>
            )}
            <View style={styles.duo}>
              <TextInput
                style={[styles.input, styles.inputDuo]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Prénom"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, styles.inputDuo]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Nom"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="words"
              />
            </View>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Adresse e-mail"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <Pressable style={[styles.button, busy && styles.buttonDisabled]} onPress={handleCreate} disabled={busy}>
              {creating ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={styles.buttonText}>{"Créer et ajouter à l'inventaire"}</Text>
              )}
            </Pressable>
          </View>

          {/* ── L'autre voie pour rejoindre ────────────────────────────────
              Numéro + code (`join_session`) : elle sert à qui a déjà
              l'application, et c'est le moment où l'on veut la transmettre —
              c'est ce que le pop-up de création affichait autrefois. */}
          <View style={styles.codeCard}>
            <Text style={styles.creerTitre}>Ou partagez les identifiants</Text>
            <Text style={styles.creerTexte}>
              Une personne qui a déjà l’application rejoint l’inventaire avec son numéro et
              son code.
            </Text>
            <View style={styles.codeRow}>
              <View style={styles.codeChip}><Text style={styles.codeChipText}>{session?.inventory_number ?? '—'}</Text></View>
              <View style={[styles.codeChip, styles.codeChipFort]}><Text style={[styles.codeChipText, styles.codeChipTextFort]}>{session?.security_code ?? '—'}</Text></View>
            </View>
            <Pressable style={styles.partagerBtn} onPress={partager}>
              <Text style={styles.partagerBtnText}>Partager les identifiants</Text>
            </Pressable>
          </View>

          {fromNew && (
            <View style={styles.finBloc}>
              <Pressable style={styles.startBtn} onPress={() => router.replace(`/(supervisor)/${sessionId}`)}>
                <Text style={styles.startBtnText}>{"Commencer l'inventaire"}</Text>
              </Pressable>
              {/* Demande de Julien : le dire sur la page, plutôt que de le
                  laisser deviner. L'étape propose, elle ne barre pas la route. */}
              <Text style={styles.finNote}>
                Vous pouvez commencer sans personne : on compte parfois seul, et des compteurs
                s’ajoutent à tout moment depuis la fiche de l’inventaire.
              </Text>
            </View>
          )}
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
    intro: { fontSize: 14, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 20, marginBottom: Spacing.xs },
    compte: { fontSize: 13, color: t.success, fontFamily: Font.semibold, marginBottom: Spacing.xs },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary, marginTop: Spacing.sm },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    input: {
      flex: 1, borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg, paddingVertical: 13, fontSize: 16,
      backgroundColor: t.surface, color: t.textPrimary, fontFamily: Font.regular,
    },
    inputDuo: { flex: 1 },
    duo: { flexDirection: 'row', gap: Spacing.sm },
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

    creerCard: {
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg,
      borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, marginTop: Spacing.lg,
      ...t.shadowCard,
    },
    codeCard: {
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg,
      borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, marginTop: Spacing.md,
      ...t.shadowCard,
    },
    creerTitre: { fontSize: 15, fontFamily: Font.bold, color: t.textPrimary, letterSpacing: -0.2 },
    creerTexte: { fontSize: 13, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 19 },
    codeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
    codeChip: {
      flex: 1, borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md,
      paddingVertical: 10, paddingHorizontal: Spacing.md, alignItems: 'center',
    },
    codeChipFort: { borderColor: t.accent, backgroundColor: t.accentSoft },
    codeChipText: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary },
    codeChipTextFort: { color: t.accent, fontFamily: Font.bold, letterSpacing: 1 },
    partagerBtn: {
      backgroundColor: t.accentSoft, borderRadius: Radius.md, paddingVertical: 13,
      alignItems: 'center', marginTop: 2,
    },
    partagerBtnText: { color: t.accent, fontSize: 15, fontFamily: Font.bold },

    button: {
      backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg,
      alignItems: 'center', marginTop: Spacing.sm, ...t.shadowButton,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },

    finBloc: { gap: Spacing.sm, marginTop: Spacing.xl },
    // Le vert du bout du tunnel, comme sur Zones et Import : le bouton qui fait
    // avancer ne se confond pas avec les actions de l'écran.
    startBtn: {
      backgroundColor: t.success, borderRadius: Radius.lg, paddingVertical: Spacing.lg,
      alignItems: 'center', ...t.shadowButton,
    },
    startBtnText: { color: '#fff', fontFamily: Font.bold, fontSize: 16 },
    finNote: { fontSize: 12.5, color: t.textMuted, fontFamily: Font.regular, lineHeight: 18, textAlign: 'center' },
  })
}
