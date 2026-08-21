/**
 * Grille tarifaire — définition unique côté web.
 *
 * La licence est annuelle, par magasin, et déterminée par la tranche de volume
 * de stock du magasin. Le volume s'entend en **unités** — le nombre de pièces
 * physiques, jamais le nombre de références : un magasin de 200 000 unités peut
 * n'avoir que 25 000 références, soit trois tranches d'écart.
 *
 * Les montants sont ceux de la grille regonflée de la fiscalité (21 août 2026) :
 * ils laissent 1 200 / 2 400 / 3 900 / 6 000 / 8 400 € nets une fois l'impôt sur
 * les sociétés et la flat tax payés. Voir `docs/entreprise/hypotheses-tarifaires.md`.
 *
 * **Cette table fait foi avec l'annexe 2 des CGV**
 * (`docs/entreprise/cgv-quantinvo-brouillon.md`), et un test compare les deux :
 * changer un montant ici sans changer le contrat fait échouer la suite.
 */

export interface Tranche {
  /** Borne haute, en unités. `null` pour la dernière tranche, non bornée. */
  readonly max: number | null
  /** Profil de magasin — le mot qui parle au prospect. */
  readonly profil: string
  /** Bornes en toutes lettres, telles qu'affichées. */
  readonly bornes: string
  /** Licence annuelle HT, en euros. `null` quand le prix se fait au cas par cas. */
  readonly prixEuros: number | null
}

export const TRANCHES: readonly Tranche[] = [
  { max: 10_000, profil: 'Boutique', bornes: 'jusqu’à 10 000', prixEuros: 2_100 },
  { max: 50_000, profil: 'Magasin', bornes: '10 001 à 50 000', prixEuros: 4_200 },
  { max: 200_000, profil: 'Grande surface', bornes: '50 001 à 200 000', prixEuros: 6_600 },
  { max: 500_000, profil: 'Grand magasin', bornes: '200 001 à 500 000', prixEuros: 10_200 },
  { max: 1_000_000, profil: 'Très grand magasin', bornes: '500 001 à 1 000 000', prixEuros: 14_400 },
  { max: null, profil: 'Hypermarché', bornes: 'plus d’un million', prixEuros: null },
] as const

/**
 * Tranche applicable à un volume de stock, ou `null` si le volume n'est pas
 * exploitable (vide, négatif, non numérique). Un stock de 0 n'a pas de tranche :
 * c'est une saisie incomplète, pas une boutique vide.
 */
export function trancheDe(unites: number | null | undefined): Tranche | null {
  if (unites == null || !Number.isFinite(unites) || unites <= 0) return null
  return TRANCHES.find((t) => t.max === null || unites <= t.max) ?? null
}

/** Libellé complet d'une tranche : « Grand magasin — 200 001 à 500 000 ». */
export function libelleTranche(t: Tranche): string {
  return `${t.profil} — ${t.bornes}`
}

/**
 * Somme des licences d'une liste de volumes.
 *
 * Les magasins au-delà d'un million sont comptés à part : leur prix se fait au
 * cas par cas, et les noyer dans un total donnerait un chiffre faux. Les
 * volumes non renseignés sont ignorés, pas comptés à zéro.
 */
export function totalAnnuel(volumes: readonly (number | null | undefined)[]): {
  euros: number
  surDevis: number
  chiffres: number
} {
  let euros = 0
  let surDevis = 0
  let chiffres = 0
  for (const v of volumes) {
    const t = trancheDe(v)
    if (!t) continue
    chiffres += 1
    if (t.prixEuros === null) surDevis += 1
    else euros += t.prixEuros
  }
  return { euros, surDevis, chiffres }
}

/**
 * Densité de stock, en unités par mètre carré.
 *
 * Sert à recouper une déclaration : le stock ne se vérifie pas dans le Service
 * — l'import du stock théorique est facultatif et rattaché à un inventaire, pas
 * au magasin (voir l'article 6.4 des CGV) — alors que la surface d'un point de
 * vente se contrôle de l'extérieur.
 *
 * Renvoie `null` si l'un des deux chiffres manque.
 */
export function densite(unites: number | null | undefined, m2: number | null | undefined): number | null {
  if (unites == null || m2 == null) return null
  if (!Number.isFinite(unites) || !Number.isFinite(m2)) return null
  if (unites <= 0 || m2 <= 0) return null
  return unites / m2
}

/*
 * Le jugement « cette densité tient-elle debout ? » ne vit pas ici mais dans
 * `web/lib/secteurs.ts` : il dépend du secteur d'activité, et une fourchette
 * unique ne servait à rien — assez large pour couvrir un magasin de meubles et
 * une pharmacie, elle laissait passer trois tranches tarifaires d'écart.
 */
