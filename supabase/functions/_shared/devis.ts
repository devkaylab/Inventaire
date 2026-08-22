// ============================================================================
// Le devis : ses lignes, ses totaux, et sa mise en page — sans rien dessiner.
// ----------------------------------------------------------------------------
// Ce module ne connaît ni PDF ni HTML : il transforme une demande d'inscription
// en **lignes de devis**, puis ces lignes en **éléments de page** (du texte, des
// traits, des rectangles, à des coordonnées en millimètres). Le rendu proprement
// dit est dans `devisPdf.ts`, qui est le seul à dépendre de pdf-lib.
//
// Pourquoi cette séparation : elle rend la mise en page **testable** par les
// tests du site (vitest ne sait pas résoudre les imports esm.sh de Deno), et
// elle évite d'avoir deux dessins du même document qui divergeraient — le piège
// déjà connu des planches de balises.
//
// Le module est volontairement **sans API Deno**, comme `email.ts`.
//
// Charte « Papier » : fond blanc, encre pour le texte, indigo pour les titres et
// le total, filet de scan cyan sous l'en-tête. Un devis s'imprime et se signe.
// ============================================================================

export const COULEURS_DEVIS = {
  encre: '#0b0f19',
  encre2: '#2a3140',
  indigoProfond: '#4636b0',
  indigo: '#6366f1',
  ardoise: '#5b6475',
  brume: '#f4f5f9',
  filet: '#e3e6ee',
  cyan: '#38c9ff',
  blanc: '#ffffff',
} as const

/** Un magasin déclaré au formulaire d'inscription. */
export type MagasinDeclare = {
  name?: string | null
  units?: number | null
  sqm?: number | null
}

/** Une ligne du devis, telle qu'elle s'affiche et se facture. */
export type LigneDevis = {
  /** Nom du magasin, ou « Magasin 2 » à défaut. */
  libelle: string
  /** Volume déclaré, en unités. `null` si non renseigné. */
  unites: number | null
  /** Profil tarifaire — « Grande surface ». Vide si hors grille. */
  tranche: string
  /** Licence annuelle HT, en centimes. `null` = sur devis. */
  prixCents: number | null
}

export type Devis = {
  reference: string
  entreprise: string
  contact: string
  siren?: string | null
  lignes: LigneDevis[]
  /** Total facturé, en centimes — celui saisi en console, qui fait foi. */
  totalCents: number
  emisLe: Date
  expireLe: Date
}

/** Grille des tranches, en centimes. Doit rester alignée sur `web/lib/tarifs.ts`. */
const TRANCHES: readonly { max: number | null; profil: string; prixCents: number | null }[] = [
  { max: 10_000, profil: 'Boutique', prixCents: 210_000 },
  { max: 50_000, profil: 'Magasin', prixCents: 420_000 },
  { max: 200_000, profil: 'Grande surface', prixCents: 660_000 },
  { max: 500_000, profil: 'Grand magasin', prixCents: 1_020_000 },
  { max: 1_000_000, profil: 'Très grand magasin', prixCents: 1_440_000 },
  { max: null, profil: 'Hypermarché', prixCents: null },
]

/** Tranche applicable à un volume, ou `null` si le volume n'est pas exploitable. */
export function trancheDeUnites(unites: number | null | undefined) {
  if (unites == null || !Number.isFinite(unites) || unites <= 0) return null
  return TRANCHES.find((t) => t.max === null || unites <= t.max) ?? null
}

/**
 * Lignes proposées pour une demande.
 *
 * Un magasin sans volume déclaré garde sa ligne, sans prix : il faut le voir
 * pour en parler, l'escamoter ferait un devis incomplet sans le dire.
 */
export function lignesProposees(stores: MagasinDeclare[] | null | undefined, storeCount = 0): LigneDevis[] {
  const liste = (stores ?? []).filter(
    (m) => (m.name ?? '').trim() !== '' || m.units != null || m.sqm != null,
  )
  const source = liste.length > 0
    ? liste
    : Array.from({ length: Math.max(0, storeCount) }, () => ({} as MagasinDeclare))

  return source.map((m, i) => {
    const unites = typeof m.units === 'number' && Number.isFinite(m.units) ? m.units : null
    const t = trancheDeUnites(unites)
    return {
      libelle: (m.name ?? '').trim() || `Magasin ${i + 1}`,
      unites,
      tranche: t?.profil ?? '',
      prixCents: t?.prixCents ?? null,
    }
  })
}

/** Somme des lignes chiffrées. Les lignes sur devis ne sont pas comptées à zéro. */
export function totalProposeCents(lignes: readonly LigneDevis[]): { cents: number; surDevis: number } {
  let cents = 0
  let surDevis = 0
  for (const l of lignes) {
    if (l.prixCents === null) surDevis += 1
    else cents += l.prixCents
  }
  return { cents, surDevis }
}

export const euros = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export const nombre = (n: number) => n.toLocaleString('fr-FR')

export const jour = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`

/** Référence proposée : DEV-<année>-<4 chiffres tirés de l'identifiant>. */
export function referenceProposee(annee: number, graine: string): string {
  let h = 0
  for (const c of graine) h = (h * 31 + c.charCodeAt(0)) % 10_000
  return `DEV-${annee}-${String(h).padStart(4, '0')}`
}

// ── Mise en page ───────────────────────────────────────────────────────────
// Coordonnées en millimètres, origine en haut à gauche (le rendu retourne l'axe
// vertical pour PDF). Page A4.

export type Element =
  | { type: 'texte'; x: number; y: number; texte: string; taille: number; gras?: boolean; couleur?: string; alignement?: 'gauche' | 'droite' }
  | { type: 'trait'; x1: number; y1: number; x2: number; y2: number; epaisseur: number; couleur: string }
  | { type: 'bloc'; x: number; y: number; largeur: number; hauteur: number; couleur: string }

export const PAGE = { largeur: 210, hauteur: 297, marge: 18 } as const

/**
 * Le devis, en éléments de page.
 *
 * Une seule page : au-delà d'une quinzaine de magasins, les lignes sont
 * regroupées en fin de tableau plutôt que de déborder — un devis de trois pages
 * ne se lit pas mieux, et la ligne de total doit rester sous les yeux.
 */
export function elementsDevis(devis: Devis): Element[] {
  const e: Element[] = []
  const { marge, largeur } = PAGE
  const droite = largeur - marge
  const C = COULEURS_DEVIS

  // En-tête encre, filet de scan cyan : la marque avant le document.
  e.push({ type: 'bloc', x: 0, y: 0, largeur, hauteur: 26, couleur: C.encre })
  e.push({ type: 'bloc', x: 0, y: 26, largeur, hauteur: 0.8, couleur: C.cyan })
  e.push({ type: 'texte', x: marge, y: 15, texte: 'Quantinvo', taille: 16, gras: true, couleur: C.blanc })
  e.push({
    type: 'texte', x: droite, y: 14.5, alignement: 'droite',
    texte: "L'outil d'inventaire pour le commerce", taille: 8, couleur: '#9aa4c0',
  })

  let y = 42
  e.push({ type: 'texte', x: marge, y, texte: 'DEVIS', taille: 18, gras: true, couleur: C.indigoProfond })
  e.push({ type: 'texte', x: droite, y, texte: devis.reference, taille: 11, gras: true, couleur: C.encre, alignement: 'droite' })
  y += 7
  e.push({ type: 'texte', x: droite, y, texte: `Émis le ${jour(devis.emisLe)}`, taille: 9, couleur: C.ardoise, alignement: 'droite' })
  y += 5
  e.push({ type: 'texte', x: droite, y, texte: `Valable jusqu'au ${jour(devis.expireLe)}`, taille: 9, couleur: C.ardoise, alignement: 'droite' })

  // Destinataire
  y = 56
  e.push({ type: 'texte', x: marge, y, texte: 'Établi pour', taille: 8, couleur: C.ardoise })
  y += 6
  e.push({ type: 'texte', x: marge, y, texte: devis.entreprise, taille: 12, gras: true, couleur: C.encre })
  y += 5.5
  e.push({ type: 'texte', x: marge, y, texte: devis.contact, taille: 9.5, couleur: C.encre2 })
  if (devis.siren) {
    y += 5
    e.push({ type: 'texte', x: marge, y, texte: `SIREN ${devis.siren}`, taille: 9, couleur: C.ardoise })
  }

  // Tableau
  y = 88
  e.push({ type: 'texte', x: marge, y, texte: 'Magasin', taille: 8, gras: true, couleur: C.ardoise })
  e.push({ type: 'texte', x: marge + 82, y, texte: 'Stock déclaré', taille: 8, gras: true, couleur: C.ardoise })
  e.push({ type: 'texte', x: marge + 118, y, texte: 'Profil', taille: 8, gras: true, couleur: C.ardoise })
  e.push({ type: 'texte', x: droite, y, texte: 'Licence annuelle HT', taille: 8, gras: true, couleur: C.ardoise, alignement: 'droite' })
  y += 2.5
  e.push({ type: 'trait', x1: marge, y1: y, x2: droite, y2: y, epaisseur: 0.4, couleur: C.filet })

  const MAX_LIGNES = 15
  const visibles = devis.lignes.slice(0, MAX_LIGNES)
  const reste = devis.lignes.length - visibles.length

  for (const l of visibles) {
    y += 8
    e.push({ type: 'texte', x: marge, y, texte: l.libelle, taille: 10, couleur: C.encre })
    e.push({
      type: 'texte', x: marge + 82, y, taille: 9.5, couleur: C.encre2,
      texte: l.unites === null ? '—' : `${nombre(l.unites)} pièces`,
    })
    e.push({ type: 'texte', x: marge + 118, y, texte: l.tranche || '—', taille: 9.5, couleur: C.encre2 })
    e.push({
      type: 'texte', x: droite, y, alignement: 'droite', taille: 10, gras: true, couleur: C.encre,
      texte: l.prixCents === null ? 'sur devis' : euros(l.prixCents),
    })
    e.push({ type: 'trait', x1: marge, y1: y + 2.5, x2: droite, y2: y + 2.5, epaisseur: 0.2, couleur: C.filet })
  }

  if (reste > 0) {
    y += 8
    e.push({
      type: 'texte', x: marge, y, taille: 9.5, couleur: C.ardoise,
      texte: `et ${nombre(reste)} autres magasins, détaillés en annexe`,
    })
  }

  // Total
  y += 14
  e.push({ type: 'bloc', x: marge, y: y - 7, largeur: droite - marge, hauteur: 16, couleur: C.brume })
  e.push({ type: 'texte', x: marge + 5, y: y + 2, texte: 'Total annuel hors taxes', taille: 10.5, gras: true, couleur: C.encre })
  e.push({
    type: 'texte', x: droite - 5, y: y + 3, alignement: 'droite', taille: 15, gras: true,
    couleur: C.indigoProfond, texte: euros(devis.totalCents),
  })

  // Conditions
  y += 22
  for (const ligne of [
    'Licence annuelle par magasin. Comptages, compteurs et inventaires illimités.',
    'TVA non applicable sur ce document — le montant hors taxes fait foi.',
    "L'acceptation de ce devis vaut bon pour accord. La facture suit, et les accès sont",
    'ouverts dès son règlement.',
  ]) {
    e.push({ type: 'texte', x: marge, y, texte: ligne, taille: 8.5, couleur: C.ardoise })
    y += 5
  }

  // Pied
  const yPied = PAGE.hauteur - 20
  e.push({ type: 'trait', x1: marge, y1: yPied - 6, x2: droite, y2: yPied - 6, epaisseur: 0.4, couleur: C.filet })
  e.push({ type: 'texte', x: marge, y: yPied, texte: 'Quantinvo', taille: 9, gras: true, couleur: C.encre })
  e.push({
    type: 'texte', x: droite, y: yPied, alignement: 'droite', taille: 8.5, couleur: C.ardoise,
    texte: 'Devis établi par Quantinvo · quantinvo.vercel.app',
  })

  return e
}
