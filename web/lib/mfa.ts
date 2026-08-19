// Double authentification par application TOTP (Google Authenticator, Aegis,
// 1Password…). Supabase fournit la mécanique — enrôlement, challenge,
// vérification — mais aucune interface : tout ce que voit l'utilisateur vit
// dans `MfaPanel` (activation depuis Mon compte) et la page de connexion
// (saisie du code).
//
// Vocabulaire Supabase : une session ouverte au mot de passe seul est de
// niveau `aal1` ; la saisie du code TOTP l'élève à `aal2`. Un compte qui
// possède un facteur vérifié a donc `nextLevel = aal2`, et tant que
// `currentLevel` n'y est pas, il manque le code.

import { supabase } from '@/lib/supabaseClient'
import { errorMessage } from '@/lib/errors'

export type EnrollData = { factorId: string; qrCode: string; secret: string }

/** Identifiant du facteur TOTP vérifié du compte, ou null s'il n'en a pas. */
export async function verifiedTotpFactor(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error || !data) return null
  return data.totp.find(f => f.status === 'verified')?.id ?? null
}

/**
 * Vrai quand la session est ouverte au mot de passe seul alors que le compte
 * a un second facteur : il manque le code, rien d'autre ne doit s'afficher.
 * En cas de doute (jeton illisible, API indisponible), répond false — ne
 * jamais enfermer dehors un compte qui n'a pas de second facteur.
 */
export async function mfaPending(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) return false
    return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
  } catch {
    return false
  }
}

/** Démarre l'enrôlement TOTP et rend le QR code à scanner. */
export async function startEnrollTotp(): Promise<EnrollData> {
  // Un essai abandonné laisse un facteur non vérifié, et le suivant échouerait
  // (nom déjà pris) : on repart propre.
  const { data: existing } = await supabase.auth.mfa.listFactors()
  for (const f of existing?.all ?? []) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Application d’authentification',
  })
  if (error || !data) throw new Error(errorMessage(error))
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** Vérifie un code TOTP ; en cas de succès, la session passe en aal2. */
export async function challengeAndVerify(
  factorId: string, code: string,
): Promise<{ success: boolean; error?: string }> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError || !challenge) return { success: false, error: errorMessage(challengeError) }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId, challengeId: challenge.id, code: code.trim(),
  })
  if (verifyError) return { success: false, error: errorMessage(verifyError) }
  return { success: true }
}

/** Retire le facteur : le mot de passe redevient seul à protéger le compte. */
export async function unenrollTotp(factorId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  return error ? { success: false, error: errorMessage(error) } : { success: true }
}
