/**
 * Où télécharger l'application Quantinvo.
 *
 * ⚠️ **L'application n'est publiée sur aucune des deux boutiques.** Tant que
 * `PUBLIEE` vaut `false`, les boutons pointent vers la **recherche** de chaque
 * plateforme — des adresses qui fonctionnent aujourd'hui et qui montreront la
 * fiche le jour de la publication — et l'écran affiche « bientôt disponible ».
 *
 * Le jour de la mise en ligne, **tout se règle ici** : passer `PUBLIEE` à
 * `true` et remplacer les deux adresses par les fiches réelles.
 *
 * - App Store : `https://apps.apple.com/fr/app/quantinvo/id<IDENTIFIANT>`,
 *   l'identifiant numérique est donné par App Store Connect à la création de
 *   la fiche.
 * - Google Play : `https://play.google.com/store/apps/details?id=<PACKAGE>`,
 *   où `<PACKAGE>` est l'identifiant Android de l'application.
 */
export const PUBLIEE = false

export const APP_STORE_URL = PUBLIEE
  ? 'https://apps.apple.com/fr/app/quantinvo/id000000000'
  : 'https://apps.apple.com/fr/search?term=Quantinvo'

export const PLAY_STORE_URL = PUBLIEE
  ? 'https://play.google.com/store/apps/details?id=com.devkaylab.quantinvo'
  : 'https://play.google.com/store/search?q=Quantinvo&c=apps'
