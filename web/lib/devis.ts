// Les lignes d'un devis, proposées depuis la grille des offres — côté site.
//
// **Copie volontaire** de la partie « calcul » de
// `supabase/functions/_shared/devis.ts`, pour la même raison que
// `baliseSeries` et `presence` : le site et les fonctions edge ne compilent pas
// ensemble (npm d'un côté, esm.sh de l'autre). Les deux fichiers bougent
// ensemble, et `web/tests/devis.test.ts` échoue s'ils divergent — il compare
// les deux grilles ligne à ligne.
//
// ⚠️ **La grille a changé d'assiette le 2 septembre 2026.** Une ligne de devis
// se calcule désormais sur le **nombre d'appareils qui comptent en même temps**
// dans le magasin, jamais sur son volume de stock. C'est la décision du
// 30 août (hypothèse 4) enfin portée jusqu'au devis : le stock était déclaré et
// invérifiable, l'appareil se mesure.
//
// Ce que ce module fait : proposer. Le montant qui part au client est celui
// que l'administrateur valide dans la console, jamais un recalcul silencieux.

import { nomOffre, prixCents, type Rythme } from '@/lib/offres'

export type { Rythme }

export type MagasinDeclare = {
  name?: string | null
  /** Appareils comptant en même temps dans ce magasin. */
  devices?: number | null
  /**
   * Volume de stock déclaré, en pièces. ⚠️ Ne tarife plus rien : il n'est lu
   * que pour les demandes déposées AVANT le 2 septembre 2026, dont les lignes
   * doivent rester lisibles en console.
   */
  units?: number | null
  sqm?: number | null
}

export type LigneDevis = {
  libelle: string
  /** Appareils déclarés. `null` si la demande est antérieure à la bascule. */
  appareils: number | null
  /** Nom de l'offre — « Advanced ». Vide quand rien n'est déclaré. */
  offre: string
  /** Ce qui est facturé à l'échéance, au rythme du devis. */
  prixCents: number | null
  /**
   * Ce que le magasin vaut à l'année — `stores.annual_price_cents` à la
   * création. ⚠️ Il voyage DANS la ligne parce que le rythme seul ne suffit
   * pas à le retrouver : la souscription en ligne écrit un montant déjà annuel
   * sur une demande mensuelle. Voir la règle des lignes de devis, en tête de
   * la migration `20260902120001`.
   */
  annuelCents: number | null
}

/**
 * Une ligne par magasin déclaré.
 *
 * Un magasin sans appareils garde sa ligne, sans prix : il faut le voir pour en
 * parler, l'escamoter ferait un devis incomplet sans le dire. C'est aussi le
 * cas de toutes les demandes d'avant la bascule — leur volume ne tarife plus,
 * elles se devisent à la main.
 */
export function lignesProposees(
  stores: MagasinDeclare[] | null | undefined,
  storeCount = 0,
  rythme: Rythme = 'yearly',
): LigneDevis[] {
  const liste = (stores ?? []).filter(
    (m) => (m.name ?? '').trim() !== '' || m.devices != null || m.units != null || m.sqm != null,
  )
  const source: MagasinDeclare[] = liste.length > 0
    ? liste
    : Array.from({ length: Math.max(0, storeCount) }, () => ({}))

  return source.map((m, i) => {
    const appareils =
      typeof m.devices === 'number' && Number.isFinite(m.devices) && m.devices > 0 ? m.devices : null
    return {
      libelle: (m.name ?? '').trim() || `Magasin ${i + 1}`,
      appareils,
      offre: nomOffre(appareils),
      prixCents: prixCents(appareils, rythme),
      annuelCents: prixCents(appareils, 'yearly'),
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
