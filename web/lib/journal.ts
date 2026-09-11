import { t } from '@/lib/i18n'
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
  superviseur_invite: (c) => t('invité %{c} comme superviseur', { c }),
  superviseur_magasins_modifies: (c) => t('modifié les magasins de %{c}', { c }),
  compteur_magasins_modifies: (c) => t('modifié les magasins de %{c}', { c }),
  magasin_renomme: (c) => t('renommé un magasin en « %{c} »', { c }),
  entreprise_renommee: (c) => t('renommé l’entreprise en « %{c} »', { c }),
  acces_retires: (c) => t('retiré tous les accès de %{c}', { c }),
  // ⚠️ Écrite par `remove_counter_from_store`, pas par une fonction `ca_*` — et
  // c'est pour ça qu'elle a manqué : la garde ne balayait que les `ca_*`. Vue
  // en clair sur le journal réel le 5 septembre 2026 (« Test Sup sans inv —
  // compteur_retire_du_magasin — Julien Compteur »). Le retrait vise UN
  // magasin, jamais tous : le libellé doit le dire.
  compteur_retire_du_magasin: (c) => t('retiré %{c} d’un magasin', { c }),
  promu_superviseur: (c) => t('promu %{c} superviseur', { c }),
  retrograde_compteur: (c) => t('passé %{c} en compteur', { c }),
  invitation_annulee: (c) => t('annulé l’invitation de %{c}', { c }),
  compte_supprime: (c) => t('supprimé le compte de %{c}', { c }),
  magasin_demande: (c) => t('demandé l’ajout du magasin « %{c} »', { c }),
  magasin_demande_annulee: (c) => t('annulé la demande du magasin « %{c} »', { c }),
  magasin_suppression_demandee: (c) => t('demandé la suppression du magasin « %{c} »', { c }),
  // Le libre-service (4 septembre 2026) : `offre_changee` est le geste du
  // client, `offre_appliquee` ce que Stripe a confirmé. Les deux existent parce
  // qu'entre les deux il y a un paiement, et qu'il peut ne jamais aboutir.
  offre_changee: (c) => t('demandé une offre plus large pour « %{c} »', { c }),
  offre_appliquee: (c) => t('élargi l’offre de « %{c} »', { c }),
  rythme_change: (c) => t('changé le rythme de paiement de « %{c} »', { c }),
  // Écrite par `vider_balise`, pas par une fonction `ca_*` : les comptages ne
  // sont journalisés nulle part ailleurs, et c'est la seule trace qu'un rayon
  // a été effacé.
  balise_videe: (c) => t('vidé la %{c}', { c }),
}

/**
 * Une ligne de journal en une phrase.
 *
 * L'auteur devient « Vous » quand c'est la personne qui lit : c'est la
 * première chose qu'elle cherche à distinguer dans un journal.
 */
export function libelleAction(ligne: LigneJournal, moi: string | null): string {
  const soi = !!ligne.actor_id && ligne.actor_id === moi
  const auteur = soi ? t('Vous') : (ligne.actor_label || t('Quelqu’un'))
  const cible = ligne.target_label || '—'
  const phrase = ACTIONS[ligne.action]
  // Une action inconnue reste lisible plutôt que muette : on montre son nom
  // technique, ce qui se remarque et se corrige.
  if (!phrase) return `${auteur} — ${ligne.action} — ${cible}`
  return soi
    ? t('%{auteur} avez %{phrase}', { auteur, phrase: phrase(cible) })
    : t('%{auteur} a %{phrase}', { auteur, phrase: phrase(cible) })
}
