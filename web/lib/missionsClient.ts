/**
 * Ce que le client lit d'un état de mission, et comment les dates se disent.
 *
 * ⚠️ **LE CLIENT NE VOIT PAS LA MACHINE D'ÉTAT.** Elle a seize positions ;
 * `en_constitution`, `equipe_complete` et `prete` sont NOS problèmes, pas les
 * siens (point 16 du plan : « constituer l'équipe est notre problème »). Il en
 * voit cinq, et « Nous constituons votre équipe » couvre les trois du milieu.
 */

const LIBELLES: Record<string, string> = {
  prix_calcule: 'À confirmer',
  paiement_autorise: 'Paiement en cours',
  confirmee: 'Confirmé',
  en_constitution: 'Confirmé',
  equipe_complete: 'Confirmé',
  prete: 'Confirmé',
  en_cours: 'En cours',
  controle_qualite: 'Contrôle des écarts',
  terminee: 'Terminé',
  paiement_prestataires: 'Terminé',
  payee: 'Terminé',
  annulee: 'Annulé',
  remboursee: 'Remboursé',
  litige: 'En litige',
  echouee: 'Annulé par Quantinvo',
}

export function etatClient(etat: string): string {
  return LIBELLES[etat] ?? etat
}

/** Ce que Quantinvo est en train de faire, dit au client. */
export function ceQuOnFait(etat: string): string | null {
  switch (etat) {
    case 'confirmee':
    case 'en_constitution':
      return 'Nous constituons votre équipe. Vous recevrez un message dès qu’elle est complète — vous n’avez rien à valider.'
    case 'equipe_complete':
    case 'prete':
      return 'Votre équipe est au complet. Nous vous rappelons la veille ce qu’il faut préparer sur place.'
    case 'en_cours':
      return 'L’inventaire est en cours. Vous pouvez suivre l’avancement en direct.'
    case 'controle_qualite':
      return 'Le comptage est fini. Le responsable contrôle les écarts avant la clôture.'
    default:
      return null
  }
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function enDateLongue(iso: string): string {
  const d = new Date(iso)
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`
}

export function enDateCourte(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MOIS[d.getMonth()]}`
}

export function enHeure(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
