/**
 * Où télécharger l'application Quantinvo.
 *
 * ⚠️ **UN DRAPEAU PAR BOUTIQUE, ET C'EST LA LEÇON DU 27 SEPTEMBRE 2026.** Il
 * n'y en avait qu'un, `PUBLIEE`, pour les deux : le jour où l'App Store a
 * ouvert, le passer à `true` aurait aussi pointé le bouton Play vers une fiche
 * qui n'existe pas encore. Une publication ne tombe pas le même jour des deux
 * côtés — Apple a approuvé le 27 septembre, Google examinait encore.
 *
 * Il n'existe donc plus de `PUBLIEE` tout court : lire « l'application est
 * publiée » sans savoir de laquelle on parle était précisément le piège.
 *
 * Tant qu'une boutique n'a pas ouvert, son bouton pointe vers la **recherche**
 * de la plateforme — une adresse qui fonctionne aujourd'hui et qui montrera la
 * fiche le jour venu — et l'écran le dit.
 *
 * - **App Store** — identifiant `6807966626`, lu dans App Store Connect
 *   (App Information → Apple ID). ⚠️ **Fiche en ligne depuis le 27 septembre
 *   2026, 16 h 41 UTC** : version 1.0, gratuite, iOS 16.4 minimum. Vérifié
 *   sur l'API d'Apple avant d'ouvrir le lien, pas seulement annoncé.
 * - **Google Play** — paquet `com.quantinvo.app`, celui d'`app.json` et de la
 *   Play Console. Toujours en examen : envoi du 19 septembre 2026, 11 h 17.
 *   ⚠️ Cette valeur était **fausse** jusqu'au 15 septembre 2026
 *   (`com.devkaylab.quantinvo`, qui n'existe nulle part ailleurs dans le
 *   dépôt) : le jour de la publication, le bouton Play serait tombé sur une
 *   page introuvable. Un test compare désormais l'adresse au paquet déclaré
 *   dans `app.json` — la faute ne peut plus revenir en silence.
 */
export const PUBLIEE_IOS = true
export const PUBLIEE_ANDROID = false

export const APP_STORE_URL = PUBLIEE_IOS
  ? 'https://apps.apple.com/fr/app/quantinvo/id6807966626'
  : 'https://apps.apple.com/fr/search?term=Quantinvo'

export const PLAY_STORE_URL = PUBLIEE_ANDROID
  ? 'https://play.google.com/store/apps/details?id=com.quantinvo.app'
  : 'https://play.google.com/store/search?q=Quantinvo&c=apps'

/**
 * Ce qui n'est pas encore en ligne, d'après les deux drapeaux.
 *
 * ⚠️ **PRENDRE LES DEUX EN PARAMÈTRE N'EST PAS UNE COQUETTERIE.** Écrite en
 * dur sur les constantes, la règle n'aurait qu'un seul cas éprouvable — celui
 * du jour. Ici, la garde les exerce toutes les quatre, donc la phrase sera
 * juste le jour où Google Play ouvrira à son tour, sans que personne n'y
 * repense.
 */
export function noteBoutiques(
  ios: boolean,
  android: boolean
): 'deux' | 'play' | 'apple' | null {
  if (ios && android) return null
  if (!ios && !android) return 'deux'
  return ios ? 'play' : 'apple'
}
