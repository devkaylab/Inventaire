/**
 * Où télécharger l'application Quantinvo.
 *
 * ⚠️ **L'application n'est publiée sur aucune des deux boutiques.** Tant que
 * `PUBLIEE` vaut `false`, les boutons pointent vers la **recherche** de chaque
 * plateforme — des adresses qui fonctionnent aujourd'hui et qui montreront la
 * fiche le jour de la publication — et l'écran affiche « bientôt disponible ».
 *
 * Le jour de la mise en ligne, **une seule ligne change ici** : `PUBLIEE` passe
 * à `true`. Les deux adresses de fiche sont désormais les vraies, relevées le
 * 15 septembre 2026 dans les consoles :
 *
 * - **App Store** — identifiant `6807966626`, lu dans App Store Connect
 *   (App Information → Apple ID). La fiche est en « Prepare for Submission »,
 *   build 5 attaché : l'adresse ne répondra qu'une fois la version approuvée.
 * - **Google Play** — paquet `com.quantinvo.app`, celui de `app.json` et de la
 *   Play Console.
 *   ⚠️ Cette valeur était **fausse** jusqu'au 15 septembre 2026
 *   (`com.devkaylab.quantinvo`, qui n'existe nulle part ailleurs dans le
 *   dépôt) : le jour de la publication, le bouton Play serait tombé sur une
 *   page introuvable. Un test compare désormais l'adresse au paquet déclaré
 *   dans `app.json` — la faute ne peut plus revenir en silence.
 */
export const PUBLIEE = false

export const APP_STORE_URL = PUBLIEE
  ? 'https://apps.apple.com/fr/app/quantinvo/id6807966626'
  : 'https://apps.apple.com/fr/search?term=Quantinvo'

export const PLAY_STORE_URL = PUBLIEE
  ? 'https://play.google.com/store/apps/details?id=com.quantinvo.app'
  : 'https://play.google.com/store/search?q=Quantinvo&c=apps'
