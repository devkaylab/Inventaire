import { useState } from 'react'
import {
  ActivityIndicator,
  Linking,
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
import { useAuth } from '@/lib/auth'
import { verifyCurrentPassword } from '@/lib/reauth'
import { PASSWORD_FORGOT_URL } from '@/constants/links'
import { friendlyPasswordError, passwordError, passwordSatisfies } from '@/lib/password'
import { PasswordRules } from '@/components/PasswordRules'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { signaler } from '@/lib/dialogue'
import { t } from '@/lib/i18n'
import { ClavierEvite } from '@/components/ui/ClavierEvite'

/**
 * Changer son mot de passe depuis l'app.
 *
 * **Le mot de passe actuel est exigé.** `updateUser({ password })` ne demande
 * rien d'autre que d'être connecté : un téléphone laissé déverrouillé suffisait
 * à s'approprier le compte. Qui ne s'en souvient plus passe par « mot de passe
 * oublié », qui vérifie l'identité par l'e-mail — c'est la bonne porte.
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
  const { session } = useAuth()
  const [actuel, setActuel] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const conforme = passwordSatisfies(password)
  const identiques = password.length > 0 && password === confirm
  const pretAEnvoyer = actuel.length > 0 && conforme && identiques && !busy

  async function enregistrer() {
    const probleme = passwordError(password)
    if (probleme) {
      signaler.erreur(t('Mot de passe refusé'), probleme)
      return
    }
    if (password !== confirm) {
      signaler.erreur(t('Mot de passe refusé'), t('Les deux saisies ne sont pas identiques.'))
      return
    }

    const email = session?.user.email
    if (!email) {
      signaler.erreur(t('Erreur'), t('Votre session a expiré. Reconnectez-vous.'))
      return
    }

    setBusy(true)
    try {
      if (!(await verifyCurrentPassword(email, actuel))) {
        signaler.erreur(
          t('Mot de passe actuel incorrect'),
          t('Vérifiez votre saisie. Si vous ne vous en souvenez plus, passez par « Mot de passe oublié ».'),
        )
        return
      }

      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        signaler.erreur(t('Mot de passe refusé'), t(friendlyPasswordError(error.message)))
        return
      }
      signaler.succes(
          t('Mot de passe modifié'),
          t('Votre nouveau mot de passe est actif, sur le téléphone comme sur le site.'),
        )
        router.back()
    } catch (e) {
      signaler.erreur(t('Erreur'), errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ClavierEvite>
        <ScrollView
          automaticallyAdjustKeyboardInsets contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.intro}>
              {t("Le nouveau mot de passe remplace l'ancien tout de suite, sur le téléphone comme sur le site.")}
            </Text>

            <Text style={styles.label}>{t('Mot de passe actuel')}</Text>
            <TextInput
              style={styles.input}
              value={actuel}
              onChangeText={setActuel}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              placeholder={t('Votre mot de passe d’aujourd’hui')}
              placeholderTextColor={theme.textMuted}
            />
            <Pressable style={styles.forgot} onPress={() => Linking.openURL(PASSWORD_FORGOT_URL)}>
              <Text style={styles.forgotText}>{t('Mot de passe oublié ?')}</Text>
            </Pressable>

            <Text style={styles.label}>{t('Nouveau mot de passe')}</Text>
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

            <Text style={styles.label}>{t('Confirmer')}</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder={t('Retapez le mot de passe')}
              placeholderTextColor={theme.textMuted}
            />
            {confirm.length > 0 && !identiques && (
              <Text style={styles.mismatch}>{t('Les deux saisies ne sont pas identiques.')}</Text>
            )}

            <Pressable
              style={[styles.btn, !pretAEnvoyer && styles.btnOff]}
              onPress={enregistrer}
              disabled={!pretAEnvoyer}
            >
              {busy ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text style={styles.btnText}>{t('Enregistrer')}</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.note}>
            {t('Un mot de passe qui figure dans une fuite de données connue est refusé : il est déjà à la disposition des attaquants.')}
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
    forgot: { alignSelf: 'flex-start', paddingVertical: Spacing.sm },
    forgotText: { fontSize: 13, color: t.accent, fontFamily: Font.semibold },
    btn: {
      marginTop: Spacing.xl, backgroundColor: t.accent, borderRadius: Radius.bouton,
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
