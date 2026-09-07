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
// ⚠️ **L'assiette a changé le 2 septembre 2026.** Une ligne se calcule sur le
// nombre d'appareils qui comptent en même temps dans le magasin, plus sur son
// volume de stock — la décision du 30 août (hypothèse 4) portée jusqu'au devis.
// La grille ci-dessous est la **copie en centimes** de `web/lib/offres.ts` ;
// `web/tests/devis.test.ts` échoue si les deux divergent.
//
// Charte « Papier » : fond blanc, encre pour le texte, indigo pour les titres et
// le total, filet de scan cyan sous l'en-tête. Un devis s'imprime et se signe.
// ============================================================================

/**
 * ⚠️ Jumelle de `MENTION_TVA` dans `web/lib/offres.ts`. Doublon volontaire :
 * le site et les fonctions edge ne compilent pas ensemble. Un test compare
 * les deux.
 */
export const MENTION_TVA = 'TVA non applicable, article 293 B du CGI'

/**
 * La palette du devis — piste « Registre », 6 septembre 2026.
 *
 * ⚠️ ELLE REMPLACE LE DERNIER INDIGO DU PRODUIT. Le PDF portait encore, à
 * l'octet près, l'identité d'avant : bandeau #0B0F19, filet cyan #38C9FF,
 * titre #4636B0, bouton #6366F1 — le même indigo que le halo du logo, retiré
 * le matin même. C'était le document que le client signe.
 *
 * ⚠️ ET IL N'Y A PAS DE FOND. Registre a un papier crème (#FBFAF7) ; on ne le
 * peint PAS sur la page. Un devis s'imprime : un aplat crème sur 210 × 297 mm
 * coûte de l'encre au client pour un fond que son papier porte déjà. Le
 * papier du document, c'est le papier.
 */
export const COULEURS_DEVIS = {
  encre: '#1b1a17',
  /**
   * ⚠️ IL N'Y A PAS DE TROISIÈME GRIS SUR UN DOCUMENT. La palette en portait un
   * (#8b877c) : sur du papier blanc il donne 3,2:1, sous le seuil AA — et il
   * portait la date de validité, le SIREN et les en-têtes de colonnes,
   * c'est-à-dire des choses qu'on LIT. C'est la même règle qu'à l'écran, où
   * `--text-3` est banni de Registre : dans un document la hiérarchie vient de
   * la taille et de la casse, jamais de la pâleur.
   */
  encre2: '#56534c',
  /** Le seul accent du produit qui vive hors du thème — voir la décision 2. */
  marine: '#1d3e63',
  /** Le signal : ce qui appelle une lecture attentive, jamais une décoration. */
  ocre: '#8a5a10',
  filet: '#e2ded3',
  filetFort: '#c6c1b3',
} as const

/** Un magasin déclaré au formulaire d'inscription. */
export type MagasinDeclare = {
  name?: string | null
  /** Appareils comptant en même temps dans ce magasin — l'assiette. */
  devices?: number | null
  /** Volume de stock. ⚠️ Ne tarife plus rien ; lu pour les demandes anciennes. */
  units?: number | null
  sqm?: number | null
}

/** Les deux rythmes, écrits comme la base et Stripe les nomment. */
export type Rythme = 'monthly' | 'yearly'

/** Une ligne du devis, telle qu'elle s'affiche et se facture. */
export type LigneDevis = {
  /** Nom du magasin, ou « Magasin 2 » à défaut. */
  libelle: string
  /** Appareils déclarés. `null` si la demande est antérieure à la bascule. */
  appareils: number | null
  /** Nom de l'offre — « Advanced ». Vide si rien n'est déclaré. */
  offre: string
  /** Licence HT, en centimes, au rythme du devis. `null` = sur devis. */
  prixCents: number | null
  /** Ce que le magasin vaut à l'année — voir la migration `20260902120001`. */
  annuelCents: number | null
}

export type Devis = {
  reference: string
  entreprise: string
  /**
   * Objet du devis, quand il ne se déduit pas des lignes — « Ajout du magasin
   * Lyon Part-Dieu ». Une inscription n'en a pas besoin : ses lignes sont les
   * magasins eux-mêmes.
   */
  objet?: string
  contact: string
  siren?: string | null
  lignes: LigneDevis[]
  /** Total facturé, en centimes — celui saisi en console, qui fait foi. */
  totalCents: number
  /** Le rythme du devis. Décide des libellés du tableau et du total. */
  rythme?: Rythme
  emisLe: Date
  expireLe: Date
}

/** Grille des offres, en centimes. Doit rester alignée sur `web/lib/offres.ts`. */
export const OFFRES_CENTIMES: readonly {
  cle: string; nom: string; max: number; moisCents: number; anCents: number
}[] = [
  { cle: 'essential', nom: 'Essential', max: 2, moisCents: 8_900, anCents: 95_000 },
  { cle: 'advanced', nom: 'Advanced', max: 20, moisCents: 31_000, anCents: 330_000 },
  { cle: 'enterprise', nom: 'Enterprise', max: 100, moisCents: 89_000, anCents: 945_000 },
]

/** Au-delà de cent appareils, par tranche de dix entamée. */
export const SUPPLEMENT_CENTIMES = { par: 10, moisCents: 6_400, anCents: 69_000 } as const

/** Le plafond au-delà duquel le palier Enterprise se prolonge. */
export const APPAREILS_MAX = 100

const exploitable = (n: number | null | undefined): n is number =>
  n != null && Number.isFinite(n) && n > 0

/**
 * Le prix d'un magasin, en centimes, hors taxes.
 *
 * Rend `null` pour un nombre d'appareils inexploitable : zéro appareil n'est
 * pas un magasin gratuit, c'est une saisie incomplète — et c'est le cas de
 * toutes les demandes déposées avant la bascule du 2 septembre 2026.
 */
export function prixCents(appareils: number | null | undefined, rythme: Rythme = 'yearly'): number | null {
  if (!exploitable(appareils)) return null
  const annuel = rythme === 'yearly'
  const socle = OFFRES_CENTIMES[OFFRES_CENTIMES.length - 1]
  const o = OFFRES_CENTIMES.find((x) => appareils <= x.max)
  if (o) return annuel ? o.anCents : o.moisCents
  const tranches = Math.ceil((appareils - APPAREILS_MAX) / SUPPLEMENT_CENTIMES.par)
  const base = annuel ? socle.anCents : socle.moisCents
  const pas = annuel ? SUPPLEMENT_CENTIMES.anCents : SUPPLEMENT_CENTIMES.moisCents
  return base + tranches * pas
}

/** Le nom de l'offre qui couvre ce nombre d'appareils. Vide si inexploitable. */
export function nomOffre(appareils: number | null | undefined): string {
  if (!exploitable(appareils)) return ''
  return (OFFRES_CENTIMES.find((x) => appareils <= x.max)
    ?? OFFRES_CENTIMES[OFFRES_CENTIMES.length - 1]).nom
}

/**
 * Lignes proposées pour une demande.
 *
 * Un magasin sans appareils déclarés garde sa ligne, sans prix : il faut le
 * voir pour en parler, l'escamoter ferait un devis incomplet sans le dire.
 */
export function lignesProposees(
  stores: MagasinDeclare[] | null | undefined,
  storeCount = 0,
  rythme: Rythme = 'yearly',
): LigneDevis[] {
  const liste = (stores ?? []).filter(
    (m) => (m.name ?? '').trim() !== '' || m.devices != null || m.units != null || m.sqm != null,
  )
  const source = liste.length > 0
    ? liste
    : Array.from({ length: Math.max(0, storeCount) }, () => ({} as MagasinDeclare))

  return source.map((m, i) => {
    const appareils = exploitable(m.devices) ? m.devices : null
    return {
      libelle: (m.name ?? '').trim() || `Magasin ${i + 1}`,
      appareils,
      offre: nomOffre(appareils),
      prixCents: prixCents(appareils, rythme),
      annuelCents: prixCents(appareils, 'yearly'),
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
  /**
   * `police: 'serif'` demande Times plutôt qu'Helvetica.
   *
   * ⚠️ ET C'EST TIMES, PAS NEWSREADER. Un PDF n'a droit sans embarquement
   * qu'aux quatorze polices que tout lecteur possède ; embarquer la serif du
   * site voudrait dire glisser un fichier de police dans la fonction edge,
   * pour un document que personne ne comparera côte à côte avec l'écran.
   */
  | { type: 'texte'; x: number; y: number; texte: string; taille: number; gras?: boolean; police?: 'serif'; couleur?: string; alignement?: 'gauche' | 'droite' }
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

  // ⚠️ L'EN-TÊTE EST UN FILET, PLUS UN BANDEAU. Un aplat d'encre de 26 mm en
  // haut d'une A4 est une bannière de site posée sur un document — et il
  // s'imprime. La marque en serif à gauche, la nature de la pièce à droite,
  // un trait d'encre dessous : c'est l'en-tête d'un acte.
  e.push({ type: 'texte', x: marge, y: 20, texte: 'Quantinvo', taille: 17, police: 'serif', couleur: C.encre })
  e.push({
    type: 'texte', x: droite, y: 20, alignement: 'droite',
    texte: 'DEVIS', taille: 9, gras: true, couleur: C.encre2,
  })
  e.push({ type: 'trait', x1: marge, y1: 24, x2: droite, y2: 24, epaisseur: 0.6, couleur: C.encre })

  // La référence EST le titre : c'est par elle qu'on retrouve la pièce.
  let y = 42
  e.push({ type: 'texte', x: marge, y, texte: devis.reference, taille: 22, police: 'serif', couleur: C.marine })
  e.push({ type: 'texte', x: droite, y: y - 4, texte: `Émis le ${jour(devis.emisLe)}`, taille: 9, couleur: C.encre2, alignement: 'droite' })
  e.push({ type: 'texte', x: droite, y: y + 1, texte: `Valable jusqu'au ${jour(devis.expireLe)}`, taille: 9, couleur: C.encre2, alignement: 'droite' })

  // Destinataire
  y = 56
  e.push({ type: 'texte', x: marge, y, texte: 'Établi pour', taille: 8, couleur: C.encre2 })
  y += 6
  e.push({ type: 'texte', x: marge, y, texte: devis.entreprise, taille: 12, gras: true, couleur: C.encre })
  y += 5.5
  e.push({ type: 'texte', x: marge, y, texte: devis.contact, taille: 9.5, couleur: C.encre2 })
  if (devis.siren) {
    y += 5
    e.push({ type: 'texte', x: marge, y, texte: `SIREN ${devis.siren}`, taille: 9, couleur: C.encre2 })
  }

  if (devis.objet) {
    y += 7
    e.push({ type: 'texte', x: marge, y, texte: devis.objet, taille: 9.5, gras: true, couleur: C.marine })
  }

  // Tableau. Les deux colonnes du milieu disent l'assiette : le nombre
  // d'appareils, et l'offre qu'il désigne. Le stock n'y figure plus — il ne
  // tarife plus rien depuis le 2 septembre 2026.
  const mensuel = devis.rythme === 'monthly'
  y = 88
  e.push({ type: 'texte', x: marge, y, texte: 'Magasin', taille: 8, gras: true, couleur: C.encre2 })
  e.push({ type: 'texte', x: marge + 82, y, texte: 'Appareils', taille: 8, gras: true, couleur: C.encre2 })
  e.push({ type: 'texte', x: marge + 118, y, texte: 'Offre', taille: 8, gras: true, couleur: C.encre2 })
  e.push({
    type: 'texte', x: droite, y, taille: 8, gras: true, couleur: C.encre2, alignement: 'droite',
    texte: mensuel ? 'Abonnement mensuel HT' : 'Licence annuelle HT',
  })
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
      texte: l.appareils === null ? '—' : `${nombre(l.appareils)} appareil${l.appareils > 1 ? 's' : ''}`,
    })
    e.push({ type: 'texte', x: marge + 118, y, texte: l.offre || '—', taille: 9.5, couleur: C.encre2 })
    e.push({
      type: 'texte', x: droite, y, alignement: 'droite', taille: 10, gras: true, couleur: C.encre,
      texte: l.prixCents === null ? 'sur devis' : euros(l.prixCents),
    })
    e.push({ type: 'trait', x1: marge, y1: y + 2.5, x2: droite, y2: y + 2.5, epaisseur: 0.2, couleur: C.filet })
  }

  if (reste > 0) {
    y += 8
    e.push({
      type: 'texte', x: marge, y, taille: 9.5, couleur: C.encre2,
      texte: `et ${nombre(reste)} autres magasins, détaillés en annexe`,
    })
  }

  // Total
  // Le total se pose sous un trait d'encre, sans aplat : c'est la ligne
  // d'arrêté d'un relevé, pas un encadré à remarquer.
  y += 12
  e.push({ type: 'trait', x1: marge, y1: y - 4, x2: droite, y2: y - 4, epaisseur: 0.6, couleur: C.encre })
  e.push({
    type: 'texte', x: marge, y: y + 3, taille: 10.5, gras: true, couleur: C.encre,
    texte: mensuel ? 'Total mensuel hors taxes' : 'Total annuel hors taxes',
  })
  e.push({
    type: 'texte', x: droite, y: y + 4, alignement: 'droite', taille: 15, police: 'serif',
    couleur: C.encre, texte: euros(devis.totalCents),
  })

  // Conditions
  y += 22
  // ⚠️ La première ligne dit ce que l'offre borne, et ce qu'elle ne borne pas.
  // « Comptages, compteurs et inventaires illimités » était vrai de la grille
  // au volume ; il ne l'est plus — c'est le nombre d'appareils qui comptent en
  // même temps qui est facturé.
  for (const ligne of [
    mensuel
      ? 'Abonnement mensuel par magasin, pour le nombre d’appareils indiqué. Inventaires illimités.'
      : 'Licence annuelle par magasin, pour le nombre d’appareils indiqué. Inventaires illimités.',
    'Un appareil est un téléphone ou une tablette qui compte en même temps que les autres.',
    // ⚠️ LA MENTION EST RÉGLEMENTAIRE, PAS DESCRIPTIVE (4 septembre 2026).
    // L'éditeur est en franchise en base : l'article 293 B du CGI impose ces
    // mots-là sur un devis comme sur une facture. La phrase d'avant — « TVA
    // non applicable sur ce document, le montant hors taxes fait foi » —
    // annonçait l'inverse de la réalité : que la facture, elle, l'ajouterait.
    // Le jour où la franchise est dépassée, cette ligne redevient
    // « Prix hors taxes, TVA au taux en vigueur » — voir `TVA_APPLICABLE`
    // dans `web/lib/offres.ts`, qui commande tout le reste.
    MENTION_TVA,
    "L'acceptation de ce devis vaut bon pour accord. La facture suit, et les accès sont",
    'ouverts dès son règlement.',
  ]) {
    e.push({
      type: 'texte', x: marge, y, texte: ligne, taille: 8.5,
      // ⚠️ L'ocre ne sert qu'à ce qui appelle une lecture attentive. Sur ce
      // document il n'y a qu'une phrase dans ce cas : la mention légale.
      couleur: ligne === MENTION_TVA ? C.ocre : C.encre2,
    })
    y += 5
  }

  // Pied
  const yPied = PAGE.hauteur - 20
  e.push({ type: 'trait', x1: marge, y1: yPied - 6, x2: droite, y2: yPied - 6, epaisseur: 0.4, couleur: C.filetFort })
  e.push({ type: 'texte', x: marge, y: yPied, texte: 'Quantinvo', taille: 9, gras: true, couleur: C.encre })
  e.push({
    type: 'texte', x: droite, y: yPied, alignement: 'droite', taille: 8.5, couleur: C.encre2,
    texte: 'Devis établi par Quantinvo · www.quantinvo.com',
  })

  return e
}
