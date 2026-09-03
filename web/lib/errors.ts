// Messages d'erreur lisibles. Repris de src/lib/errors.ts (l'app mobile), sans
// les dépendances React Native, pour que les deux plateformes disent la même
// chose devant la même panne.

type SupabaseLike = { message?: string; details?: string; hint?: string; code?: string }

/**
 * ⚠️ CE QUI N'A PAS DE TEXTE NE SE SÉRIALISE PAS EN JSON.
 *
 * Constat de Julien, 3 septembre 2026, capture à l'appui : l'onglet Set up
 * affichait, dans un encadré rouge, `{"message":""}`. Ce n'était pas une
 * curiosité — c'est ce que rend `JSON.stringify` d'une erreur PostgREST sans
 * texte, et PostgREST en fabrique une (`{ message: <corps> }`) chaque fois que
 * le serveur répond en erreur AVEC UN CORPS VIDE : un délai dépassé, une
 * passerelle qui coupe. Le cas est donc exactement celui où la personne a le
 * plus besoin d'une phrase, et c'est celui où elle recevait du JSON.
 *
 * On garde le code technique quand il existe (`[57014]`) — c'est ce qui permet
 * de retrouver l'incident dans les journaux ; le reste de l'objet est déjà
 * tracé par le `console.error` de l'appelant, il n'a rien à faire à l'écran.
 */
export function errorMessage(e: unknown): string {
  if (!e) return 'Erreur inconnue'
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message

  const s = e as SupabaseLike
  if (s.message) {
    let out = s.message
    if (s.details) out += ` (${s.details})`
    if (s.hint) out += ` Conseil : ${s.hint}`
    if (s.code) out += ` [${s.code}]`
    return out
  }
  if (s.code) return `Erreur inconnue [${s.code}]`
  return 'Erreur inconnue'
}

/**
 * Traduit les échecs courants en langage de terrain. Un superviseur qui voit
 * « new row violates row-level security policy » n'a aucune piste ; il en a une
 * avec « vous n'êtes pas participant de cet inventaire ».
 */
export function friendlyError(e: unknown): string {
  const msg = errorMessage(e)
  if (/row-level security|42501|permission denied/i.test(msg)) {
    return "Action refusée. Vous n'êtes probablement pas participant de cet inventaire, ou il vient d'être clôturé."
  }
  if (/forbidden/i.test(msg)) {
    return "Accès refusé : cet inventaire ne vous est pas ouvert. Demandez au créateur de vous y inviter."
  }
  // Délai serveur dépassé. Nommé explicitement parce que ce n'est ni un refus
  // ni une panne de réseau : l'opération est partie, elle a été interrompue en
  // route. Le conseil qui suit est vrai — elle repasse au second essai.
  if (/57014|statement timeout|canceling statement/i.test(msg)) {
    return "Le serveur a mis trop de temps à répondre et a interrompu l’opération. Réessayez dans un instant."
  }
  if (/network|fetch|timeout|Failed to fetch/i.test(msg)) {
    return 'Connexion perdue. Vérifiez votre réseau puis réessayez.'
  }
  // Une erreur sans texte est le plus souvent la même chose vue de plus loin :
  // le serveur a coupé sans rien dire. On ne l'affirme pas, on dit ce qu'on
  // sait et ce qu'il y a à faire.
  if (msg === 'Erreur inconnue' || /^Erreur inconnue \[/.test(msg)) {
    return `Le serveur a interrompu l’opération sans en donner la raison. Réessayez dans un instant. (${msg})`
  }
  return msg
}
