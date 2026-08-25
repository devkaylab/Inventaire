import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import {
  challengeAndVerify,
  formatSecret,
  startEnrollTotp,
  unenrollTotp,
  verifiedTotpFactor,
  type EnrollData,
} from '@/lib/mfa'
import { QrCode } from '@/components/QrCode'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { demander, signaler } from '@/lib/dialogue'

/**
 * Double authentification — activation depuis le téléphone.
 *
 * Le site fait scanner un QR code. Ici, l'application d'authentification est
 * installée sur l'appareil même qui l'affiche : on ne peut pas le scanner. Le
 * chemin principal devient donc l'ouverture directe de l'application par le
 * lien `otpauth://`, ou la clé recopiée à la main. Le QR reste en dessous,
 * pour s'enrôler depuis un autre appareil.
 *
 * Il n'y a pas de codes de secours : un téléphone perdu se dépanne en base
 * (`delete from auth.mfa_factors where user_id = …`), en service_role. L'écran
 * le dit avant l'activation plutôt qu'après la perte.
 */
export default function MfaScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)

  const [factorId, setFactorId] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [enroll, setEnroll] = useState<EnrollData | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  // Lecture initiale : pas de setState synchrone dans l'effet, seulement au
  // retour de la promesse.
  useEffect(() => {
    let vivant = true
    verifiedTotpFactor()
      .then((id) => { if (vivant) { setFactorId(id); setChargement(false) } })
      .catch(() => { if (vivant) setChargement(false) })
    return () => { vivant = false }
  }, [])

  /** Relecture après activation ou retrait — appelée depuis un geste, pas d'un effet. */
  const relire = useCallback(async () => {
    setFactorId(await verifiedTotpFactor())
  }, [])

  async function commencer() {
    setBusy(true)
    try {
      setEnroll(await startEnrollTotp())
    } catch (e) {
      signaler.erreur('Activation impossible', errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Ouvre l'application d'authentification sur le lien `otpauth://`.
   *
   * Sans `canOpenURL` volontairement : sur iOS il répond faux pour tout
   * schéma non déclaré dans l'Info.plist, même quand une application sait
   * parfaitement l'ouvrir. On tente donc l'ouverture et on rattrape l'échec —
   * la clé recopiable juste en dessous reste le chemin de secours.
   */
  async function ouvrirApplication(uri: string) {
    try {
      await Linking.openURL(uri)
    } catch {
      signaler.erreur(
        'Aucune application d’authentification',
        'Installez-en une (Google Authenticator, Aegis, 1Password…), puis recopiez-y la clé affichée en dessous.',
      )
    }
  }

  async function verifier() {
    if (!enroll) return
    setBusy(true)
    try {
      const r = await challengeAndVerify(enroll.factorId, code)
      if (!r.success) {
        signaler.erreur(
          'Code refusé',
          'Code incorrect ou expiré. Vérifiez le code affiché par votre application — il change toutes les trente secondes.',
        )
        return
      }
      setEnroll(null)
      setCode('')
      await relire()
      signaler.succes(
          'Double authentification activée',
          'Votre code vous sera demandé à chaque connexion, sur le téléphone comme sur le site.',
        )
        router.back()
    } finally {
      setBusy(false)
    }
  }

  function confirmerRetrait() {
    if (!factorId) return
    void demander({
      titre: 'Désactiver la double authentification ?',
      texte: 'Votre mot de passe redeviendra seul à protéger votre compte.',
      action: 'Désactiver',
      ton: 'danger',
    }).then(async (ok) => {
      if (!ok) return
      const r = await unenrollTotp(factorId)
      if (!r.success) {
        signaler.erreur('Désactivation impossible', r.error ?? undefined)
        return
      }
      await relire()
    })
  }

  if (chargement) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.xxxl }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {factorId ? (
            <View style={styles.card}>
              <View style={styles.onBadge}>
                <View style={styles.onDot} />
                <Text style={styles.onText}>Activée</Text>
              </View>
              <Text style={styles.title}>Votre compte demande un code</Text>
              <Text style={styles.text}>
                À chaque connexion, après votre mot de passe, votre application
                d&apos;authentification affiche un code à six chiffres à saisir.
              </Text>
              <Pressable style={styles.dangerBtn} onPress={confirmerRetrait}>
                <Text style={styles.dangerBtnText}>Désactiver</Text>
              </Pressable>
            </View>
          ) : !enroll ? (
            <>
              <View style={styles.card}>
                <Text style={styles.title}>Ajouter une application d&apos;authentification</Text>
                <Text style={styles.text}>
                  Google Authenticator, Aegis, 1Password… À chaque connexion, elle affichera un
                  code à six chiffres qui change toutes les trente secondes. Sans ce code, un mot
                  de passe volé ne suffit plus à entrer.
                </Text>
                <Pressable style={[styles.btn, busy && styles.btnOff]} onPress={commencer} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color={theme.onAccent} />
                  ) : (
                    <Text style={styles.btnText}>Commencer</Text>
                  )}
                </Pressable>
              </View>
              <View style={styles.warnCard}>
                <Text style={styles.warnText}>
                  Il n&apos;y a pas de codes de secours. Si vous perdez le téléphone qui porte
                  votre application d&apos;authentification, seul l&apos;administrateur Quantinvo
                  pourra vous rendre l&apos;accès.
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.card}>
              <Text style={styles.title}>Inscrivez Quantinvo dans votre application</Text>

              <Pressable style={styles.softBtn} onPress={() => ouvrirApplication(enroll.uri)}>
                <Text style={styles.softBtnText}>Ouvrir mon application d&apos;authentification</Text>
              </Pressable>

              <View style={styles.sep}>
                <View style={styles.sepLine} />
                <Text style={styles.sepText}>ou</Text>
                <View style={styles.sepLine} />
              </View>

              <Text style={styles.fieldLabel}>Clé à recopier</Text>
              <View style={styles.secretBox}>
                <Text style={[styles.secret, tabular]} selectable>
                  {formatSecret(enroll.secret)}
                </Text>
              </View>
              <Text style={styles.hint}>Appuyez longuement sur la clé pour la copier.</Text>

              <View style={styles.qrBlock}>
                <QrCode value={enroll.uri} size={168} />
                <Text style={styles.qrCap}>
                  À scanner depuis un autre appareil, si vous préférez
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Code affiché par l&apos;application</Text>
              <TextInput
                style={[styles.input, tabular]}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                placeholder="123456"
                placeholderTextColor={theme.textMuted}
              />

              <Pressable
                style={[styles.btn, (busy || code.length < 6) && styles.btnOff]}
                onPress={verifier}
                disabled={busy || code.length < 6}
              >
                {busy ? (
                  <ActivityIndicator color={theme.onAccent} />
                ) : (
                  <Text style={styles.btnText}>Vérifier et activer</Text>
                )}
              </Pressable>
            </View>
          )}
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
    title: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary },
    text: {
      fontSize: 13, color: t.textSecondary, fontFamily: Font.regular,
      lineHeight: 19, marginTop: Spacing.sm,
    },

    onBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      backgroundColor: t.successSoft, borderRadius: Radius.pill,
      paddingHorizontal: 10, paddingVertical: 4, marginBottom: Spacing.md,
    },
    onDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.success },
    onText: { fontSize: 11, fontFamily: Font.semibold, color: t.success },

    btn: {
      marginTop: Spacing.lg, backgroundColor: t.accent, borderRadius: Radius.md,
      paddingVertical: 14, alignItems: 'center', ...t.shadowButton,
    },
    btnOff: { opacity: 0.45 },
    btnText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },

    softBtn: {
      marginTop: Spacing.lg, backgroundColor: t.accentSoft, borderRadius: Radius.md,
      paddingVertical: 14, alignItems: 'center',
    },
    softBtnText: { color: t.accent, fontSize: 14, fontFamily: Font.semibold },

    dangerBtn: {
      marginTop: Spacing.lg, backgroundColor: t.dangerSoft, borderRadius: Radius.md,
      paddingVertical: 14, alignItems: 'center',
    },
    dangerBtnText: { color: t.danger, fontSize: 14, fontFamily: Font.bold },

    sep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginVertical: Spacing.lg },
    sepLine: { flex: 1, height: 1, backgroundColor: t.hairline },
    sepText: { fontSize: 11, color: t.textMuted, fontFamily: Font.regular },

    fieldLabel: {
      fontSize: 12, fontFamily: Font.semibold, color: t.textSecondary,
      marginTop: Spacing.lg, marginBottom: Spacing.sm,
    },
    secretBox: {
      backgroundColor: t.background, borderRadius: Radius.md,
      borderWidth: 1, borderColor: t.hairline, padding: Spacing.md,
    },
    secret: { fontSize: 15, color: t.textPrimary, fontFamily: Font.semibold, letterSpacing: 1.5 },
    hint: { fontSize: 11, color: t.textMuted, fontFamily: Font.regular, marginTop: Spacing.xs },

    qrBlock: { marginTop: Spacing.xl, alignItems: 'center' },
    qrCap: {
      fontSize: 11, color: t.textMuted, fontFamily: Font.regular,
      marginTop: Spacing.sm, textAlign: 'center',
    },

    input: {
      backgroundColor: t.background, borderRadius: Radius.md,
      borderWidth: 1, borderColor: t.borderStrong,
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      fontSize: 18, color: t.textPrimary, fontFamily: Font.semibold, letterSpacing: 6,
    },

    warnCard: {
      backgroundColor: t.warningSoft, borderRadius: Radius.md, padding: Spacing.lg,
    },
    warnText: { fontSize: 12, color: t.warning, fontFamily: Font.medium, lineHeight: 18 },
  })
}
