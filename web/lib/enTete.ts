/**
 * La règle qui décide si la barre s'efface — séparée de l'écran pour être
 * vérifiable.
 *
 * ⚠️ ELLE VIT ICI PARCE QUE LE VOLET NAVIGATEUR NE PEUT PAS LA TESTER.
 * Le composant écoute le défilement et regroupe ses lectures dans un
 * `requestAnimationFrame` — or un onglet masqué n'en produit aucun : mesuré le
 * 5 septembre 2026, `rafTourne: false`. Quatrième variante de ce piège sur ce
 * dépôt (les animations gelées, les apparitions `.reveal`, `getAnimations()`
 * vide). Une décision qui ne tient qu'à des nombres se teste sans navigateur ;
 * ce qui reste à voir de ses yeux, c'est le fondu.
 */

/** Sous cette largeur seulement — c'est le seuil où le burger apparaît. */
export const MOBILE_MAX = 780
/** On ne retire rien tant qu'on n'a pas quitté le haut de la page. */
export const DEPART = 90
/** En deçà, c'est un tremblement de doigt, pas une intention. */
export const PAS = 6

export type EtatDefilement = {
  /** Position courante. */
  y: number
  /** Position à la dernière décision. */
  precedent: number
  largeur: number
  menuOuvert: boolean
  /** Ce que la barre fait en ce moment. */
  retiree: boolean
}

/**
 * Rend l'état voulu de la barre.
 *
 * Trois cas où elle RESTE, et chacun a sa raison :
 * - **écran large** : la place ne manque pas, et une barre qui va et vient
 *   sous la souris agace plus qu'elle ne sert ;
 * - **menu ouvert** : on retirerait la croix sous le doigt ;
 * - **haut de page** : rien à gagner, et le rebond élastique d'iOS ferait
 *   clignoter la barre à chaque arrivée.
 */
export function barreRetiree(e: EtatDefilement): boolean {
  if (e.largeur > MOBILE_MAX || e.menuOuvert || e.y <= DEPART) return false
  const delta = e.y - e.precedent
  // Un mouvement plus petit que le pas ne décide de rien : on garde l'état.
  if (Math.abs(delta) < PAS) return e.retiree
  return delta > 0
}

/**
 * Faut-il retenir cette position comme référence ?
 *
 * ⚠️ On ne la retient QUE lorsqu'on a tranché. Sinon, une suite de
 * micro-défilements sous le pas ferait avancer la référence pixel par pixel et
 * le seuil ne serait jamais franchi — la barre ne bougerait plus jamais.
 */
export function retenirPosition(e: EtatDefilement): boolean {
  if (e.largeur > MOBILE_MAX || e.menuOuvert || e.y <= DEPART) return true
  return Math.abs(e.y - e.precedent) >= PAS
}
