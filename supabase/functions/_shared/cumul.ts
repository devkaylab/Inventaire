/**
 * Changer l'offre d'UN magasin dans un abonnement qui en porte PLUSIEURS
 * (16 septembre 2026).
 *
 * ⚠️ LE DÉFAUT QUE CE MODULE FERME. Une inscription à plusieurs magasins ouvre
 * UN abonnement, avec une ligne par OFFRE (quantité = nombre de magasins) et
 * UNE ligne de tranches d'appareils pour tous les magasins réunis. Le chemin
 * d'avant prenait « la première ligne qui n'est pas un supplément », forçait sa
 * quantité à 1 et remplaçait la ligne des tranches par celles du seul magasin
 * visé : monter un magasin Advanced sur « Advanced × 2 » faisait disparaître
 * l'autre magasin de la facture.
 *
 * La règle : l'abonnement est un CUMUL, et on n'y applique que l'ÉCART propre
 * au magasin — une unité de moins sur l'ancienne offre, une de plus sur la
 * nouvelle, et la différence de tranches. Le tout en un seul appel, donc une
 * seule facture de prorata.
 *
 * Module sans API Deno : les tests du site l'exécutent tel quel.
 */

export type Article = { id: string; price: string; quantity: number }

/** Un élément de `items[]` de `POST /v1/subscriptions/{id}`. */
export type Modification =
  | { id: string; quantity: number }
  | { id: string; deleted: true }
  | { price: string; quantity: number; tax_rates?: string[] }

export type Ecart = {
  /** Vide quand il n'y a rien à facturer (même offre, mêmes tranches). */
  items: Modification[]
  /** Renseigné quand l'abonnement ne ressemble pas à ce que la base décrit : on ne touche à rien. */
  refus: string | null
}

export function ecartAbonnement(
  articles: Article[],
  p: {
    ancienPrix: string
    nouveauPrix: string
    prixAppareils: string | null
    anciennesTranches: number
    nouvellesTranches: number
    taxRateId?: string | null
  },
): Ecart {
  const taxe = p.taxRateId ? { tax_rates: [p.taxRateId] } : {}
  const items: Modification[] = []
  const trouver = (prix: string | null) => (prix ? articles.find((a) => a.price === prix) : undefined)

  if (p.ancienPrix !== p.nouveauPrix) {
    const ancien = trouver(p.ancienPrix)
    // ⚠️ La ligne de l'offre actuelle DOIT exister : sinon l'abonnement ne
    // décrit pas ce que la base croit, et deviner serait facturer au hasard.
    if (!ancien || ancien.quantity < 1) {
      return { items: [], refus: 'L’abonnement ne porte pas l’offre actuelle de ce magasin.' }
    }
    items.push(ancien.quantity > 1
      ? { id: ancien.id, quantity: ancien.quantity - 1 }
      : { id: ancien.id, deleted: true })
    const nouveau = trouver(p.nouveauPrix)
    items.push(nouveau
      ? { id: nouveau.id, quantity: nouveau.quantity + 1 }
      : { price: p.nouveauPrix, quantity: 1, ...taxe })
  }

  const delta = Math.trunc(p.nouvellesTranches) - Math.trunc(p.anciennesTranches)
  if (delta !== 0) {
    if (!p.prixAppareils) {
      return { items: [], refus: 'Les appareils supplémentaires ne sont pas ouverts en ligne.' }
    }
    const sup = trouver(p.prixAppareils)
    const avant = sup?.quantity ?? 0
    const apres = avant + delta
    // ⚠️ Retirer plus de tranches que la ligne n'en porte voudrait dire que la
    // ligne ne contient pas celles de ce magasin : on ne corrige pas à l'aveugle.
    if (apres < 0) {
      return { items: [], refus: 'L’abonnement ne porte pas les tranches actuelles de ce magasin.' }
    }
    if (sup) items.push(apres === 0 ? { id: sup.id, deleted: true } : { id: sup.id, quantity: apres })
    else items.push({ price: p.prixAppareils, quantity: apres, ...taxe })
  }

  return { items, refus: null }
}

/**
 * Le rythme d'un abonnement, lu sur ses lignes. `null` s'il n'en reconnaît
 * aucune, ou s'il en reconnaît des deux rythmes (ce que Stripe refuse).
 */
export function rythmeDesArticles(
  articles: Article[],
  prix: { monthly: string[]; yearly: string[] },
): 'monthly' | 'yearly' | null {
  const m = articles.some((a) => prix.monthly.includes(a.price))
  const y = articles.some((a) => prix.yearly.includes(a.price))
  if (m === y) return null
  return m ? 'monthly' : 'yearly'
}
