import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

/**
 * Le jeton d'un lien d'invitation ou de réinitialisation (5 octobre 2026).
 *
 * ⚠️ **LE JETON NE SE CONSOMME QU'AU CLIC.** L'analyse des liens de Microsoft
 * 365 ouvre chaque lien d'un e-mail avant son destinataire. Quand le lien
 * menait droit à `/verify`, elle grillait le jeton à usage unique, et la
 * personne lisait « Lien expiré » (Julia, samaritaine.com, en production).
 *
 * Le lien mène désormais à la page, avec `token_hash` et `type`. La page ne
 * présente le jeton à Supabase qu'après un clic de la personne : un robot qui
 * charge la page sans cliquer ne consomme rien. Voir
 * `supabase/functions/_shared/lienDuCourriel.ts`.
 *
 * Les anciens liens (session dans le fragment `#access_token=…`) restent lus
 * par le client Supabase comme avant : ceux déjà envoyés marchent encore.
 */
export type JetonDuLien = { tokenHash: string; type: EmailOtpType }

const TYPES: EmailOtpType[] = ['invite', 'recovery', 'magiclink', 'signup', 'email']

/** Le jeton porté par l'adresse de la page, s'il y en a un. */
export function lireJetonDuLien(): JetonDuLien | null {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.search)
  const tokenHash = p.get('token_hash')
  const type = p.get('type') as EmailOtpType | null
  if (!tokenHash || !type || !TYPES.includes(type)) return null
  return { tokenHash, type }
}

/**
 * Échange le jeton contre une session. Le jeton quitte l'adresse dans tous
 * les cas : il ne sert qu'une fois, et ne doit pas rester dans l'historique.
 */
export async function ouvrirLeLien(j: JetonDuLien) {
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: j.tokenHash, type: j.type })
  window.history.replaceState(null, '', window.location.pathname)
  return error ? null : data.session
}
