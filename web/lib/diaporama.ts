/**
 * Le diaporama de l'accueil : la règle d'avance, sortie du composant.
 *
 * ⚠️ ELLE VIT ICI PARCE QU'ELLE NE SE VÉRIFIE PAS AUTREMENT. Le composant
 * dépend d'un `IntersectionObserver`, et celui-ci est SUSPENDU dans un onglet
 * masqué — c'est-à-dire dans tout volet de contrôle automatisé : mesuré, il ne
 * se déclenche pas une seule fois, pas même pour annoncer « hors écran ». Une
 * règle qui ne tient qu'à des booléens et à des nombres se teste sans
 * navigateur ; le composant ne fait plus que la brancher.
 */

/**
 * Entre deux points qui se révèlent, et avant le premier.
 * ⚠️ Resserrés le 12 septembre 2026 à la demande de Julien : à une seconde
 * l'un, les quatre points d'une diapositive mettaient 3,2 s à s'installer, et
 * la moitié du temps de lecture passait à attendre le dernier.
 */
export const PAS_MS = 600
export const PREMIER_MS = 150

/**
 * ⚠️ ELLE DOIT LAISSER LES POINTS ARRIVER, PUIS SE LIRE. Sur une diapositive à
 * quatre points, le dernier apparaît à 3,2 s : en dessous, on changerait de
 * diapositive avant de l'avoir montré. Le reste est le temps de lecture.
 */
export const AUTO_MS = 8000

/** Quand le dernier point d'une diapositive a fini d'apparaître. */
export function apparitionFinie(nbPoints: number): number {
  return PREMIER_MS + Math.max(0, nbPoints - 1) * PAS_MS
}

export type EtatAvance = {
  /** Un geste du lecteur : il a choisi, on ne reprend plus la main. */
  arrete: boolean
  /** À l'écran, dans un onglet au premier plan. */
  actif: boolean
  /** Survolé, ou parcouru au clavier. */
  enPause: boolean
  /** « Moins d'animation » demandé au système. */
  mouvementReduit: boolean
}

/**
 * Les quatre garde-fous d'une section qui tourne toute seule. Chacun répond à
 * un défaut précis : reprendre la main sur quelqu'un qui vient de choisir,
 * défiler pendant qu'on lit ailleurs sur la page, changer sous les doigts de
 * qui la parcourt, et ignorer une préférence d'accessibilité.
 */
export function avanceAutorisee(e: EtatAvance): boolean {
  return !e.arrete && e.actif && !e.enPause && !e.mouvementReduit
}

/** La suivante, en boucle. Un diaporama vide ne bouge pas. */
export function suivante(courante: number, total: number): number {
  return total > 0 ? (courante + 1) % total : 0
}
