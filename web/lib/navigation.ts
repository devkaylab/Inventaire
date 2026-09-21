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
  // ⚠️ EN DEUXIÈME POSITION, ET PAS EN QUEUE DE BARRE (20 septembre 2026).
  // Constat de Julien : « depuis le site quantinvo, je n'ai aucun bouton qui
  // mène vers on demand ». On-Demand n'est pas une étape de la découverte :
  // c'est la SECONDE FAÇON de faire la chose dont parle « L'inventaire ». Sa
  // place est juste après le sujet, avant l'outil — qui ne couvre qu'une des
  // deux façons. La page compare les deux offres au même rang.
  //
  // ⚠️ **ET IL S'APPELLE « ON-DEMAND », MÊME EN FRANÇAIS** (Julien, 21
  // septembre 2026). Sa consigne disait « même en français » : c'était le
  // signe que le nom devait RESTER On-demand sur la vitrine française, pas
  // devenir « À la demande » — traduire un nom de produit n'est pas le
  // traduire, c'est en créer un second.
  //
  // ⚠️ Le libellé passe par `t()` : comme il est identique dans les deux
  // langues, il n'a pas d'entrée anglaise, et c'est voulu.
  { href: '/on-demand', libelle: 'On-demand' },
  { href: '/decouvrir', libelle: 'Notre outil' },
  { href: '/pourquoi-nous-choisir', libelle: 'Pourquoi nous choisir ?' },
  { href: '/tarifs', libelle: 'Tarifs' },
] as const
