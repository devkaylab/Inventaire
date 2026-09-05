/**
 * Les liens de la barre publique, en UN SEUL endroit.
 *
 * ⚠️ La barre les affiche en rangée sur un écran large, le menu mobile les
 * empile derrière un burger. Deux listes recopiées divergeraient au premier
 * lien ajouté — et c'est le menu mobile, celui qu'on regarde le moins, qui
 * garderait l'ancienne.
 */
export const LIENS_PUBLICS = [
  { href: '/pourquoi-nous-choisir', libelle: 'Pourquoi nous choisir ?' },
  { href: '/inventaire', libelle: 'L’inventaire' },
  { href: '/#fonctionnalites', libelle: 'Fonctionnalités' },
  { href: '/tarifs', libelle: 'Tarifs' },
] as const
