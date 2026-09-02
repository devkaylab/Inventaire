import { useState } from 'react'
import {
  ActivityIndicator,
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
import { useAuth } from '@/lib/auth'
import { updateMyName } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { signaler } from '@/lib/dialogue'
import { ClavierEvite } from '@/components/ui/ClavierEvite'

/**
 * Modifier son nom.
 *
 * C'est la seule information qu'on corrige soi-même : l'adresse identifie le
 * compte, et le rôle comme l'entreprise sont figés par le serveur (trigger
 * `profiles_pin_privileged`). Un seul champ, découpé comme sur le site.
 */
export default function NameScreen() {
  const { profile, session, refreshProfile } = useAuth()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [nom, setNom] = useState(profile?.full_name ?? '')
  const [busy, setBusy] = useState(false)

  const propre = nom.trim().replace(/\s+/g, ' ')
  const modifie = propre.length > 0 && propre !== (profile?.full_name ?? '')

  async function enregistrer() {
    if (!session?.user.id || !modifie) return
    setBusy(true)
    try {
      await updateMyName(session.user.id, propre)
      await refreshProfile()
      router.back()
    } catch (e) {
      signaler.erreur('Modification impossible', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ClavierEvite style={{ flex: 1 }}>
        <ScrollView
          automaticallyAdjustKeyboardInsets contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>Prénom et nom</Text>
            <TextInput
              style={styles.input}
              value={nom}
              onChangeText={setNom}
              autoCapitalize="words"
              autoComplete="name"
              placeholder="Marie Lambert"
              placeholderTextColor={theme.textMuted}
            />
            <Text style={styles.hint}>
              C&apos;est le nom que voient votre équipe et les personnes que vous invitez.
            </Text>

            <Pressable
              style={[styles.btn, (!modifie || busy) && styles.btnOff]}
              onPress={enregistrer}
              disabled={!modifie || busy}
            >
              {busy ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={styles.btnText}>Enregistrer</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.note}>
            Votre adresse e-mail identifie votre compte et ne peut pas être changée ici. Votre
            rôle et votre entreprise sont fixés par votre administrateur.
          </Text>
        </ScrollView>
      </ClavierEvite>
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
    label: { fontSize: 12, fontFamily: Font.semibold, color: t.textSecondary, marginBottom: Spacing.sm },
    input: {
      backgroundColor: t.background, borderRadius: Radius.md,
      borderWidth: 1, borderColor: t.borderStrong,
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      fontSize: 15, color: t.textPrimary, fontFamily: Font.regular,
    },
    hint: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular, marginTop: Spacing.sm, lineHeight: 17 },
    btn: {
      marginTop: Spacing.lg, backgroundColor: t.accent, borderRadius: Radius.md,
      paddingVertical: 14, alignItems: 'center', ...t.shadowButton,
    },
    btnOff: { opacity: 0.45 },
    btnText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },
    note: { fontSize: 12, color: t.textMuted, fontFamily: Font.regular, lineHeight: 17, marginLeft: 2 },
  })
}
