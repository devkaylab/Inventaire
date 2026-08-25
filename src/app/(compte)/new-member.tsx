import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Redirect, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyAssignedStores, getMyCompany, inviteTeammate } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { avertir, signaler } from '@/lib/dialogue'

export default function NewMemberScreen() {
  const { profile } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const queryClient = useQueryClient()
  const { data: company } = useQuery({ queryKey: ['my-company'], queryFn: getMyCompany })
  const { data: stores } = useQuery({ queryKey: ['my-stores'], queryFn: getMyAssignedStores })
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  // Vide = tous les magasins. Le choix n'apparaît qu'à partir de deux magasins.
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const multiStore = (stores?.length ?? 0) > 1

  function toggleStore(id: string) {
    setSelectedStores(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]))
  }

  async function handleSubmit() {
    const first = firstName.trim()
    const last = lastName.trim()
    const mail = email.trim().toLowerCase()
    if (!first) return signaler.erreur('Erreur', 'Saisissez le prénom du compteur.')
    if (!last) return signaler.erreur('Erreur', 'Saisissez le nom du compteur.')
    if (!mail || !mail.includes('@')) return signaler.erreur('Erreur', "Saisissez une adresse e-mail valide.")
    if (!company) return signaler.erreur('Erreur', 'Entreprise introuvable.')
    if (multiStore && selectedStores.length === 0) {
      return signaler.erreur('Erreur', 'Choisissez au moins un magasin auquel rattacher ce compteur.')
    }

    const name = `${first} ${last}`
    setLoading(true)
    try {
      const res = await inviteTeammate({
        firstName: first,
        lastName: last,
        email: mail,
        storeIds: multiStore ? selectedStores : [],
      })
      // ⚠️ **La clé de « Mon équipe », pas une autre.** C'était
      // `['team-invitations']` — la clé d'une requête supprimée le 21 août
      // 2026 avec l'ancien écran de profil. Rien n'était donc rechargé :
      // l'écran d'où l'on vient affichait toujours « Personne dans votre
      // équipe », et le superviseur recommençait (constat de Julien,
      // 23 août 2026). Le cache tient 30 s, un retour ne suffit pas.
      await queryClient.invalidateQueries({ queryKey: ['my-team'] })
      signaler.succes(
          'Compteur ajouté',
          res.emailSent
            ? `${name} reçoit un e-mail à l'adresse ${mail}. Le lien lui permettra de choisir son mot de passe.`
            : res.alreadyInvited
              ? `${name} avait déjà été invité : le lien reçu précédemment reste valable.`
              : `${name} a été ajouté, mais l'e-mail n'a pas pu partir (${res.emailError ?? 'raison inconnue'}). Relancez l'ajout pour réessayer.`,
        )
        router.back()
    } catch (e) {
      const msg = errorMessage(e)
      const code = (e as { code?: string } | null)?.code
      // Un compte qui appartient à une autre entreprise n'est pas une faute de
      // saisie : rien à corriger dans le formulaire. On le dit comme un fait,
      // avec la marche à suivre, et non sous un titre « Erreur ».
      if (code === 'other_company') {
        void avertir({
          titre: 'Cette personne n’est pas de votre entreprise',
          texte: msg,
        })
      } else {
        signaler.erreur(
          'Erreur',
          /duplicate|unique/i.test(msg)
            ? 'Cette adresse e-mail est déjà invitée ou déjà utilisée.'
            : msg,
        )
      }
    } finally {
      setLoading(false)
    }
  }

  // Même garde que Mon équipe, d'où il s'ouvre : le groupe `(supervisor)` la
  // portait avant que cet écran ne rejoigne la pile de « Mon compte ».
  if (profile?.role !== 'supervisor') return <Redirect href="/(compte)/account" />

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Pré-inscrivez un compteur de votre équipe. Il recevra un e-mail, vérifiera son prénom et
            son nom, et choisira son propre mot de passe. Son rattachement au magasin est automatique
            — le code magasin ne lui est jamais communiqué.
          </Text>

          <Text style={styles.label}>Prénom</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Ex: Marie"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Ex: Dupont"
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
            {"Le compteur recevra à cette adresse un lien personnel : il y vérifiera son prénom et son nom, puis choisira son mot de passe."}
          </Text>

          {multiStore && (
            <>
              <Text style={styles.label}>Magasins accessibles</Text>
              <Text style={styles.hint}>
                Vous supervisez plusieurs magasins : choisissez celui ou ceux où ce compteur pourra
                intervenir.
              </Text>
              <View style={styles.storeList}>
                {(stores ?? []).map(s => {
                  const on = selectedStores.includes(s.id)
                  return (
                    <Pressable
                      key={s.id}
                      style={[styles.storeChip, on && styles.storeChipOn]}
                      onPress={() => toggleStore(s.id)}
                    >
                      <Text style={[styles.storeChipText, on && styles.storeChipTextOn]}>{s.name}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </>
          )}

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
    storeList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
    storeChip: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.sm,
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: t.surface,
    },
    storeChipOn: { borderColor: t.accent, backgroundColor: t.accent },
    storeChipText: { fontSize: 14, fontFamily: Font.semibold, color: t.textSecondary },
    storeChipTextOn: { color: t.onAccent },
    button: {
      backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg,
      alignItems: 'center', marginTop: Spacing.lg, ...t.shadowButton,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
  })
}
