import { createClient } from '@supabase/supabase-js'

/**
 * Vérifie le mot de passe actuel, sans toucher à la session en cours.
 *
 * Pourquoi c'est nécessaire : `updateUser({ password })` ne demande rien
 * d'autre que d'être connecté. Un téléphone laissé déverrouillé, ou une
 * session volée, suffisait donc à changer le mot de passe et à s'approprier le
 * compte — au moment même où l'on ajoute un second facteur contre ce risque.
 *
 * Pourquoi un client jetable plutôt que le client de l'app : `signInWithPassword`
 * remplace la session du client qui l'appelle. Sur le client principal, la
 * vérification ferait retomber la session en `aal1` et redemanderait le code de
 * double authentification en plein milieu du formulaire. Le client jetable ne
 * persiste rien et ne rafraîchit rien.
 *
 * Ce que ça laisse derrière : une session serveur orpheline, jamais
 * rafraîchie. Elle meurt d'elle-même par l'expiration pour inactivité (30 jours,
 * posée en console le 21 août 2026).
 *
 * ⚠️ **Dépend de « Single session per user » resté fermé** dans la console.
 * Cette option ne garde que la dernière connexion : la vérification
 * déconnecterait la personne de sa propre app en vérifiant son mot de passe.
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

  const verificateur = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { error } = await verificateur.auth.signInWithPassword({ email, password })
  if (!error) {
    // Portée locale : une déconnexion globale révoquerait **toutes** les
    // sessions de la personne, y compris celle de l'app qu'elle est en train
    // d'utiliser.
    await verificateur.auth.signOut({ scope: 'local' })
  }
  return !error
}
