import type { ViewStyle } from 'react-native'

/**
 * La largeur au-delà de laquelle le contenu cesse de s'étirer.
 *
 * ⚠️ **C'est la réponse à l'iPad, et elle ne change rien sur un téléphone.**
 * Le plus large des iPhone fait 440 points de large : la borne n'est jamais
 * atteinte, aucun écran de téléphone ne bouge. Sur un iPad 13" (1032 points),
 * en revanche, la mise en page du téléphone s'étalait sur toute la largeur —
 * champs de connexion d'un bord à l'autre, cartes de 1000 points, et un grand
 * vide au milieu. C'est exactement ce que la règle 2.4.1 d'Apple refuse : une
 * application iPhone agrandie plutôt qu'une application qui exploite l'écran.
 *
 * 720 plutôt que 600 : les tableaux du rapport et la liste des scans ont
 * besoin de largeur, et une colonne trop étroite sur 1032 points redonnerait
 * l'impression d'une fenêtre de téléphone posée au milieu.
 */
export const COLONNE_MAX = 720

/**
 * À poser en `contentStyle` des piles de navigation, jamais sur l'en-tête.
 *
 * ⚠️ **L'en-tête reste pleine largeur, et c'est délibéré** : un bandeau
 * rétréci au milieu de l'écran ferait « application de téléphone dans une
 * fenêtre », le défaut qu'on corrige. Ce qui se centre, c'est le contenu.
 */
export const contenuColonne: ViewStyle = {
  width: '100%',
  maxWidth: COLONNE_MAX,
  alignSelf: 'center',
}
