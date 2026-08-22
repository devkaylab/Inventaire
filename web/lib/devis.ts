// Les lignes d'un devis, proposées depuis la grille — côté site.
//
// **Copie volontaire** de la partie « calcul » de
// `supabase/functions/_shared/devis.ts`, pour la même raison que
// `baliseSeries` et `presence` : le site et les fonctions edge ne compilent pas
// ensemble (npm d'un côté, esm.sh de l'autre). Les deux fichiers bougent
// ensemble, et `web/tests/devis.test.ts` échoue s'ils divergent — il compare
// les deux grilles ligne à ligne.
//
// Ce que ce module fait : proposer. Le montant qui part au client est celui
// que l'administrateur valide dans la console, jamais un recalcul silencieux.

import { TRANCHES, trancheDe } from '@/lib/tarifs'

export type MagasinDeclare = {
  name?: string | null
  units?: number | null
  sqm?: number | null
}

export type LigneDevis = {
  libelle: string
  unites: number | null
  tranche: string
  prixCents: number | null
}

/**
 * Une ligne par magasin déclaré.
 *
 * Un magasin sans volume garde sa ligne, sans prix : il faut le voir pour en
 * parler. Et si le formulaire n'a rien détaillé (demandes d'avant le
 * 21 août 2026), on retombe sur le nombre de magasins annoncé.
 */
export function lignesProposees(
  stores: MagasinDeclare[] | null | undefined,
  storeCount = 0,
): LigneDevis[] {
  const liste = (stores ?? []).filter(
    (m) => (m.name ?? '').trim() !== '' || m.units != null || m.sqm != null,
  )
  const source: MagasinDeclare[] = liste.length > 0
    ? liste
    : Array.from({ length: Math.max(0, storeCount) }, () => ({}))

  return source.map((m, i) => {
    const unites = typeof m.units === 'number' && Number.isFinite(m.units) ? m.units : null
    const t = trancheDe(unites)
    return {
      libelle: (m.name ?? '').trim() || `Magasin ${i + 1}`,
      unites,
      tranche: t?.profil ?? '',
      prixCents: t?.prixEuros == null ? null : t.prixEuros * 100,
    }
  })
}

/** Somme des lignes chiffrées. Les lignes sur devis ne comptent pas pour zéro. */
export function totalProposeCents(lignes: readonly LigneDevis[]): { cents: number; surDevis: number } {
  let cents = 0
  let surDevis = 0
  for (const l of lignes) {
    if (l.prixCents === null) surDevis += 1
    else cents += l.prixCents
  }
  return { cents, surDevis }
}

/**
 * Référence proposée : `DEV-<année>-<4 chiffres>` dérivés de l'identifiant de
 * la demande. Stable — rouvrir le panneau propose la même — et sans compteur à
 * tenir en base. Elle reste modifiable : c'est une proposition, pas une
 * numérotation comptable.
 */
export function referenceProposee(annee: number, graine: string): string {
  let h = 0
  for (const c of graine) h = (h * 31 + c.charCodeAt(0)) % 10_000
  return `DEV-${annee}-${String(h).padStart(4, '0')}`
}

/** La grille, telle que la voit ce module — sert au test de concordance. */
export const GRILLE_CENTIMES = TRANCHES.map((t) => ({
  max: t.max,
  profil: t.profil,
  prixCents: t.prixEuros == null ? null : t.prixEuros * 100,
}))
