/**
 * La vitrine en deux langues (11 septembre 2026).
 *
 * ⚠️ LA LANGUE D'UNE PAGE DE LA VITRINE EST DANS SON ADRESSE, pas dans un
 * cookie : `/tarifs` est en français, `/en/tarifs` en anglais, et Google
 * indexe les deux. C'est ce qui distingue la vitrine de l'espace connecté, où
 * la langue est un choix d'appareil (cookie `qlang`).
 *
 * Ce module ne dépend de rien : il sert au serveur (rendu des pages), au client
 * (bouton de langue, redirection) et aux tests.
 */

export const PREFIXE_EN = '/en'

/** Les pages françaises qui ont leur jumelle sous `/en`. */
export const CHEMINS_VITRINE = [
  '/', '/tarifs', '/inventaire', '/pourquoi-nous-choisir',
  '/inscription', '/souscrire', '/superviseur', '/open', '/suppression-compte',
] as const

export type CheminVitrine = (typeof CHEMINS_VITRINE)[number]

function sansAncre(chemin: string): string {
  return chemin.split(/[?#]/)[0]
}

export function estCheminVitrine(chemin: string): boolean {
  return (CHEMINS_VITRINE as readonly string[]).includes(sansAncre(chemin))
}

/** `/en/tarifs` → `/tarifs` ; `/en` → `/` ; une adresse française reste telle quelle. */
export function cheminFrancais(chemin: string): string {
  if (chemin === PREFIXE_EN) return '/'
  if (chemin.startsWith(PREFIXE_EN + '/')) return chemin.slice(PREFIXE_EN.length)
  return chemin
}

/**
 * La langue que l'ADRESSE impose : 'en' sous `/en`, 'fr' sur une page
 * française de la vitrine, et `null` partout ailleurs — là, c'est le cookie
 * qui décide (connexion, espace connecté, devis).
 */
export function langueDuChemin(chemin: string | null | undefined): 'fr' | 'en' | null {
  if (!chemin) return null
  const c = sansAncre(chemin)
  if (c === PREFIXE_EN || c.startsWith(PREFIXE_EN + '/')) return 'en'
  return estCheminVitrine(c) ? 'fr' : null
}

/**
 * Un lien écrit en français, rendu dans la langue de la page. Seules les
 * adresses de la vitrine changent : `/login`, `/entreprise`, un `mailto:` ou
 * une adresse externe restent ce qu'elles sont.
 */
export function lienVitrine(langue: 'fr' | 'en', href: string): string {
  if (langue === 'fr' || !href.startsWith('/')) return href
  const base = sansAncre(href)
  if (!estCheminVitrine(base)) return href
  const reste = href.slice(base.length)
  return (base === '/' ? PREFIXE_EN : PREFIXE_EN + base) + reste
}

/** La même page dans l'autre langue — ce que fait le bouton FR/EN sur la vitrine. */
export function cheminDansLangue(chemin: string, langue: 'fr' | 'en'): string {
  const fr = cheminFrancais(sansAncre(chemin))
  return lienVitrine(langue, fr)
}
