import { supabase } from './supabaseClient'

/**
 * Envoyer un lien de connexion à une adresse — **l'unique chemin**.
 *
 * ⚠️ **DEUX ÉCRANS LE DEMANDENT** : « Mot de passe oublié », et l'écran
 * « Lien expiré » de `/bienvenue` (10 octobre 2026). Recopier l'envoi dans le
 * second aurait recopié aussi le repli, et la prochaine correction n'aurait
 * touché qu'une des deux copies.
 *
 * ⚠️ **L'E-MAIL PART DE QUANTINVO, PLUS DE SUPABASE** (20 septembre 2026).
 * Constat de Julien en recevant le message : « c'est un mail supabase qu'on
 * reçoit, pas de quantinvo ». Un message d'un expéditeur inconnu, sans logo,
 * avec un lien à cliquer, a exactement la forme d'un hameçonnage.
 *
 * ⚠️ **ET IL RESTE UN REPLI, PARCE QU'UN COMPTE VERROUILLÉ NE PEUT PAS
 * ATTENDRE.** Si la fonction est injoignable, on retombe sur
 * `resetPasswordForEmail` : le message est alors celui de Supabase, moins
 * bien — mais quelqu'un qui ne peut plus entrer chez lui a besoin d'un lien,
 * pas d'une charte. ⚠️ C'est un dernier recours : la fonction vient D'ABORD.
 *
 * ⚠️ **`true` NE DIT PAS QU'UN COMPTE EXISTE.** La fonction répond la même
 * chose dans tous les cas, et c'est voulu : sinon ces formulaires deviennent
 * un oracle d'énumération d'adresses. `false` veut dire « rien n'a pu
 * partir », jamais « cette adresse est inconnue ».
 */
export async function envoyerLienDeConnexion(email: string, redirectTo: string): Promise<boolean> {
  let envoye = false
  try {
    const { error } = await supabase.functions.invoke('mot-de-passe-oublie', {
      body: { email, redirectTo },
    })
    envoye = !error
  } catch {
    envoye = false
  }
  if (envoye) return true

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  return !error
}
