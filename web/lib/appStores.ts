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
 *   Play Console. ⚠️ **Fiche en ligne le 2 octobre 2026**, après un examen
 *   ouvert le 19 septembre à 11 h 17 — treize jours. Vérifié avant d'ouvrir le
 *   lien, comme pour l'App Store : la fiche répond en 200, le titre est
 *   « Quantinvo – Applications sur Google Play », l'éditeur est Devkaylab, le
 *   paquet y figure et le bouton d'installation est là.
 *   ⚠️ Cette valeur était **fausse** jusqu'au 15 septembre 2026
 *   (`com.devkaylab.quantinvo`, qui n'existe nulle part ailleurs dans le
 *   dépôt) : le jour de la publication, le bouton Play serait tombé sur une
 *   page introuvable. Un test compare désormais l'adresse au paquet déclaré
 *   dans `app.json` — la faute ne peut plus revenir en silence.
 */
export const PUBLIEE_IOS = true
export const PUBLIEE_ANDROID = true

/**
 * Les deux FICHES, et les deux RECHERCHES. Séparées depuis le 3 octobre 2026,
 * parce que les données structurées ont besoin de la fiche seule : un bouton
 * peut pointer vers une recherche, un balisage ne peut pas (voir
 * `boutiquesEnLigne` plus bas).
 */
const FICHE_APP_STORE = 'https://apps.apple.com/fr/app/quantinvo/id6807966626'
const FICHE_PLAY = 'https://play.google.com/store/apps/details?id=com.quantinvo.app'
const RECHERCHE_APP_STORE = 'https://apps.apple.com/fr/search?term=Quantinvo'
const RECHERCHE_PLAY = 'https://play.google.com/store/search?q=Quantinvo&c=apps'

export const APP_STORE_URL = PUBLIEE_IOS ? FICHE_APP_STORE : RECHERCHE_APP_STORE

export const PLAY_STORE_URL = PUBLIEE_ANDROID ? FICHE_PLAY : RECHERCHE_PLAY

/**
 * Les fiches de boutique réellement en ligne, pour les données structurées.
 *
 * ⚠️ **UNE BOUTIQUE FERMÉE N'A PAS DE FICHE, ELLE A UNE RECHERCHE.** Les deux
 * constantes ci-dessus retombent sur l'adresse de recherche de la plateforme,
 * et c'est juste pour un bouton — la page s'ouvre, et montrera la fiche le
 * jour venu. C'est faux dans un balisage : annoncer une page de recherche
 * comme la page officielle du produit est une fausse déclaration, et c'est
 * une machine qui la lit, sans rien vérifier.
 *
 * Cette fonction ne passe donc JAMAIS par `APP_STORE_URL` : elle rend la
 * fiche, ou rien. Les drapeaux entrent en paramètre, comme pour
 * `noteBoutiques` — la garde exerce ainsi les quatre cas, pas seulement celui
 * du jour.
 */
export function boutiquesEnLigne(ios: boolean, android: boolean): string[] {
  return [...(ios ? [FICHE_APP_STORE] : []), ...(android ? [FICHE_PLAY] : [])]
}

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
