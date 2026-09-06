import { IBM_Plex_Mono, Newsreader } from 'next/font/google'

/**
 * Les deux polices de « Registre » — piste des surfaces qui font foi.
 *
 * ⚠️ ELLES NE VIVENT PAS DANS `app/layout.tsx`, ET C'EST MESURÉ. Déclarées à
 * la racine, elles partaient sur **toutes** les pages : `/tarifs` téléchargeait
 * 136,6 ko de polices au lieu de 60,1 — 76,5 ko pour deux caractères qu'une
 * page vitrine n'affiche jamais. `next/font` n'émet la feuille `@font-face`
 * que dans les morceaux qui importent ce module ; en le faisant importer par
 * la seule coquille de l'espace connecté, la vitrine retrouve son poids.
 *
 * ⚠️ Elles restent AUTO-HÉBERGÉES comme les deux autres : aucune requête ne
 * part chez Google au chargement. La politique de confidentialité s'appuie
 * dessus — jamais de `<link href="fonts.googleapis.com">`.
 *
 * - **Newsreader** (56,8 ko) porte les titres du rapport, des écarts et du
 *   rapport de magasin. Serif de LECTURE, pas de décoration : elle dit
 *   « pièce » là où une grotesque dit « écran ». Variable, donc un seul
 *   fichier pour toutes les graisses.
 * - **IBM Plex Mono** (19,6 ko, deux graisses) porte TOUS LES NOMBRES de ces
 *   écrans. C'est le seul changement de Registre qui ne soit pas esthétique :
 *   en chasse fixe les colonnes s'alignent au chiffre près, et l'écart le plus
 *   gros se repère sans lire les nombres.
 */
export const policeRegistre = Newsreader({
  subsets: ['latin'], variable: '--police-registre', display: 'swap',
})
export const policeNombre = IBM_Plex_Mono({
  subsets: ['latin'], weight: ['400', '500'], variable: '--police-nombre', display: 'swap',
})
