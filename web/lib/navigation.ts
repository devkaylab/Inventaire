/**
 * Les liens de la barre publique, en UN SEUL endroit.
 *
 * ⚠️ La barre les affiche en rangée sur un écran large, le menu mobile les
 * empile derrière un burger. Deux listes recopiées divergeraient au premier
 * lien ajouté — et c'est le menu mobile, celui qu'on regarde le moins, qui
 * garderait l'ancienne.
 *
 * ⚠️ « Fonctionnalités » a quitté la barre le 12 septembre 2026 (demande de
 * Julien). C'était la seule entrée qui ne menait pas à une page mais à une
 * ancre de l'accueil — donc le seul lien qui renvoyait la personne là d'où
 * elle venait. La section `#fonctionnalites` RESTE sur l'accueil : un lien
 * déjà parti par e-mail doit continuer de tomber quelque part.
 */
export const LIENS_PUBLICS = [
  { href: '/pourquoi-nous-choisir', libelle: 'Pourquoi nous choisir ?' },
  { href: '/inventaire', libelle: 'L’inventaire' },
  { href: '/tarifs', libelle: 'Tarifs' },
] as const
