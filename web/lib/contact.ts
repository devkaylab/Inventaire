/**
 * L'adresse à laquelle un client peut nous écrire.
 *
 * Constat de Julien, 22 août 2026 : plusieurs messages disaient « répondez à
 * ce message » alors qu'ils partent d'une adresse qui ne lit rien. Côté
 * fonctions edge, `CONTACT_EMAIL` et le `reply_to` règlent l'envoi ; côté
 * site, cette même adresse doit être **publique** (`NEXT_PUBLIC_CONTACT_EMAIL`)
 * pour s'afficher sur les pages qui invitent à écrire.
 *
 * Tant qu'elle n'est pas posée, `CONTACT_EMAIL` vaut `null` et les textes
 * doivent se passer de la promesse — jamais l'écrire à vide.
 */
export const CONTACT_EMAIL: string | null =
  (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '').trim() || null

/** « écrivez-nous à x@y » quand l'adresse existe, sinon une formule neutre. */
export function ecrivezNous(sinon = ''): string {
  return CONTACT_EMAIL ? `écrivez-nous à ${CONTACT_EMAIL}` : sinon
}
