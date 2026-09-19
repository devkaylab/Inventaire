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
// ⚠️ L'ORDRE D'UNE DÉCOUVERTE (Julien, maquette validée le 19 septembre
// 2026) : le sujet, puis l'outil, puis pourquoi nous, puis le prix — l'ordre
// du deck commercial. Le pied de page (SiteChrome) suit le même.
export const LIENS_PUBLICS = [
  { href: '/inventaire', libelle: 'L’inventaire' },
  { href: '/decouvrir', libelle: 'Notre outil' },
  { href: '/pourquoi-nous-choisir', libelle: 'Pourquoi nous choisir ?' },
  { href: '/tarifs', libelle: 'Tarifs' },
] as const
