// Le journal de l'entreprise, mis en français.
//
// `company_audit_log` enregistre des actions techniques (`acces_retires`,
// `magasin_demande`…). Les afficher telles quelles reviendrait à demander à
// l'administrateur de deviner. Ce module traduit une ligne en une phrase — et
// c'est aussi ce qui rend l'ajout d'une action visible : une action non
// traduite s'affiche en clair, et un test le voit.

export type LigneJournal = {
  id: number
  created_at: string
  actor_id: string | null
  actor_label: string
  action: string
  target_label: string
  details: Record<string, unknown>
}

/**
 * Les actions écrites par les fonctions `ca_*`, et ce qu'elles racontent.
 *
 * Chaque libellé est un **participe sans auxiliaire** — « invité Marc », pas
 * « a invité Marc ». C'est ce qui permet d'écrire « Julien a invité » et
 * « Vous avez invité » sans deux tables de libellés, et ce qui empêche le
 * « Vous a invité » que produisait la première version.
 */
export const ACTIONS: Record<string, (cible: string) => string> = {
  superviseur_invite: (c) => `invité ${c} comme superviseur`,
  superviseur_magasins_modifies: (c) => `modifié les magasins de ${c}`,
  compteur_magasins_modifies: (c) => `modifié les magasins de ${c}`,
  magasin_renomme: (c) => `renommé un magasin en « ${c} »`,
  entreprise_renommee: (c) => `renommé l’entreprise en « ${c} »`,
  acces_retires: (c) => `retiré tous les accès de ${c}`,
  promu_superviseur: (c) => `promu ${c} superviseur`,
  retrograde_compteur: (c) => `passé ${c} en compteur`,
  invitation_annulee: (c) => `annulé l’invitation de ${c}`,
  compte_supprime: (c) => `supprimé le compte de ${c}`,
  magasin_demande: (c) => `demandé l’ajout du magasin « ${c} »`,
  magasin_demande_annulee: (c) => `annulé la demande du magasin « ${c} »`,
  magasin_suppression_demandee: (c) => `demandé la suppression du magasin « ${c} »`,
  // Le libre-service (4 septembre 2026) : `offre_changee` est le geste du
  // client, `offre_appliquee` ce que Stripe a confirmé. Les deux existent parce
  // qu'entre les deux il y a un paiement, et qu'il peut ne jamais aboutir.
  offre_changee: (c) => `demandé un forfait plus large pour « ${c} »`,
  offre_appliquee: (c) => `élargi le forfait de « ${c} »`,
  // Écrite par `vider_balise`, pas par une fonction `ca_*` : les comptages ne
  // sont journalisés nulle part ailleurs, et c'est la seule trace qu'un rayon
  // a été effacé.
  balise_videe: (c) => `vidé la ${c}`,
}

/**
 * Une ligne de journal en une phrase.
 *
 * L'auteur devient « Vous » quand c'est la personne qui lit : c'est la
 * première chose qu'elle cherche à distinguer dans un journal.
 */
export function libelleAction(ligne: LigneJournal, moi: string | null): string {
  const soi = !!ligne.actor_id && ligne.actor_id === moi
  const auteur = soi ? 'Vous' : (ligne.actor_label || 'Quelqu’un')
  const cible = ligne.target_label || '—'
  const phrase = ACTIONS[ligne.action]
  // Une action inconnue reste lisible plutôt que muette : on montre son nom
  // technique, ce qui se remarque et se corrige.
  if (!phrase) return `${auteur} — ${ligne.action} — ${cible}`
  return `${auteur} ${soi ? 'avez' : 'a'} ${phrase(cible)}`
}
