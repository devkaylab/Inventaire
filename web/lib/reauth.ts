import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabasePublishableKey } from '@/lib/supabaseClient'

/**
 * Vérifie le mot de passe actuel, sans toucher à la session en cours.
 *
 * Miroir de `src/lib/reauth.ts` côté application. Le raisonnement est le même :
 * `updateUser({ password })` ne demande rien d'autre que d'être connecté, donc
 * un poste laissé ouvert suffisait à s'approprier le compte. Et la
 * vérification passe par un client jetable, parce que `signInWithPassword`
 * remplace la session du client qui l'appelle — sur le client principal, elle
 * ferait retomber la session en `aal1` et redemanderait le code de double
 * authentification au milieu du formulaire.
 *
 * ⚠️ Dépend de « Single session per user » resté fermé dans la console : cette
 * option ne garde que la dernière connexion, et la vérification déconnecterait
 * la personne de l'onglet où elle travaille.
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const verificateur = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { error } = await verificateur.auth.signInWithPassword({ email, password })
  if (!error) {
    // Portée locale : une déconnexion globale révoquerait toutes les sessions
    // de la personne, y compris celle de l'onglet en cours.
    await verificateur.auth.signOut({ scope: 'local' })
  }
  return !error
}
