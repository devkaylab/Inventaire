/**
 * Le prix d'un inventaire à la demande — la copie d'affichage.
 *
 * ⚠️ **AUCUN PRIX N'EST DÉCIDÉ ICI.** Ce module sert à MONTRER un montant
 * pendant que le visiteur répond aux trois questions, avant qu'il ait un
 * compte. Le montant qui engage vient de `prix_mission` / `devis_mission`, en
 * base — même règle que `prixCents` et `prix_offre` pour l'abonnement :
 * « laisser le client porter un montant, c'est le laisser réserver à un
 * centime » (`docs/notes/074`).
 *
 * ⚠️ **C'EST DONC UN DOUBLON VOLONTAIRE**, le sixième du projet, et il suit la
 * même discipline que les cinq autres : une garde compare cette copie à celle
 * qui fait foi (`web/tests/prix-on-demand.test.ts`, qui lit les réglages dans
 * la migration). Les deux bougent ensemble ou la garde tombe.
 *
 * ⚠️ **ET IL EXISTE POUR NE PAS OUVRIR UNE CINQUIÈME FONCTION À `anon`.** Il y
 * en a quatre, c'est mesuré à chaque revue de sécurité, et en ajouter une est
 * une décision. La maquette promet « trois questions et votre prix s'affiche,
 * vous ne créerez un compte qu'au moment de réserver » : cette copie tient la
 * promesse sans rien ouvrir.
 *
 * Conception : docs/entreprise/on-demand/02-le-prix.md
 */

/** Les réglages de la version en vigueur. Copie de `reglages_prix`. */
export const REGLAGES = {
  version: 1,
  tauxInventoristeCents: 2000,
  tauxResponsableCents: 2800,
  productivite: 800,
  dureeCibleMinutes: 270,
  fraisFixesCents: 4600,
  responsableDesN: 3,
  arrondiMinutes: 30,
  margeCible: 0.25,
  margeMinimum: 0.22,
} as const

/** Les départements où une équipe peut être constituée. Copie de `zones_desservies`. */
export const DEPARTEMENTS_DESSERVIS = [
  '59', '69', '75', '77', '78', '91', '92', '93', '94', '95',
] as const

/** Ce qu'on annonce au visiteur, en toutes lettres (maquette Etape1-Visiteur). */
export const OU_NOUS_ALLONS = 'Paris et en Île-de-France, à Lyon et à Lille'

export type Secteur = 'textile' | 'chaussures' | 'cosmetique' | 'sport' | 'electronique' | 'autre'

export const SECTEURS: { cle: Secteur; nom: string }[] = [
  { cle: 'textile', nom: 'Textile' },
  { cle: 'chaussures', nom: 'Chaussures' },
  { cle: 'cosmetique', nom: 'Cosmétique' },
  { cle: 'sport', nom: 'Sport' },
  { cle: 'electronique', nom: 'Électronique' },
  { cle: 'autre', nom: 'Autre' },
]

export type Tranche = { cle: string; nom: string; min: number; max: number }

/**
 * ⚠️ **ON RETIENT LE HAUT DE LA TRANCHE, JAMAIS LE MILIEU.** Un prix ferme se
 * calcule sur le cas le plus lourd que le client a lui-même annoncé — c'est ce
 * qui permet de ne pas revenir vers lui le soir de l'inventaire.
 */
export const TRANCHES_ARTICLES: Tranche[] = [
  { cle: 'a', nom: 'Moins de 2 000 articles', min: 0, max: 2_000 },
  { cle: 'b', nom: '2 000 à 5 000 articles', min: 2_000, max: 5_000 },
  { cle: 'c', nom: '5 000 à 10 000 articles', min: 5_000, max: 10_000 },
  { cle: 'd', nom: '10 000 à 20 000 articles', min: 10_000, max: 20_000 },
  { cle: 'e', nom: '20 000 à 30 000 articles', min: 20_000, max: 30_000 },
  { cle: 'f', nom: '30 000 à 50 000 articles', min: 30_000, max: 50_000 },
  { cle: 'g', nom: '50 000 à 100 000 articles', min: 50_000, max: 100_000 },
]

export const TRANCHES_REFERENCES: Tranche[] = [
  { cle: 'a', nom: 'Moins de 500 références', min: 0, max: 500 },
  { cle: 'b', nom: '500 à 1 000 références', min: 500, max: 1_000 },
  { cle: 'c', nom: '1 000 à 3 000 références', min: 1_000, max: 3_000 },
  { cle: 'd', nom: '3 000 à 5 000 références', min: 3_000, max: 5_000 },
  { cle: 'e', nom: '5 000 à 10 000 références', min: 5_000, max: 10_000 },
  { cle: 'f', nom: 'Plus de 10 000 références', min: 10_000, max: 40_000 },
]

/**
 * Les inventaires se déroulent à n'importe quelle heure — avant l'ouverture,
 * en pleine journée, après la fermeture. C'est une correction de Julien sur la
 * maquette : ne proposer que le soir écarte la moitié des magasins.
 */
export const MOMENTS = [
  { cle: 'avant_ouverture', nom: 'Avant l’ouverture', heures: ['05:00', '06:00', '07:00'] },
  { cle: 'journee', nom: 'En journée', heures: ['10:00', '13:00', '15:00'] },
  { cle: 'apres_fermeture', nom: 'Après la fermeture', heures: ['20:00', '21:00', '22:00'] },
] as const

export type MomentCle = (typeof MOMENTS)[number]['cle']

export type Chaine = {
  articlesRetenus: number
  heuresPersonne: number
  inventoristes: number
  responsable: boolean
  dureeMinutes: number
  equipeCents: number
  coutCents: number
  prixCents: number
  margeCents: number
  marge: number
  remunerationInventoristeCents: number
  remunerationResponsableCents: number
}

/** La chaîne de `prix_mission`, pas à pas. Tout en centimes. */
export function chaine(articlesRetenus: number, coefficient = 1): Chaine {
  const r = REGLAGES
  const heuresPersonne = articlesRetenus / r.productivite
  const inventoristes = Math.ceil(heuresPersonne / (r.dureeCibleMinutes / 60))
  const dureeMinutes =
    Math.ceil((heuresPersonne / inventoristes) * 60 / r.arrondiMinutes) * r.arrondiMinutes
  const responsable = inventoristes >= r.responsableDesN
  const heuresFacturees = dureeMinutes / 60
  const equipeCents = Math.round(
    (inventoristes * r.tauxInventoristeCents
      + (responsable ? r.tauxResponsableCents : 0)) * heuresFacturees,
  )
  const coutCents = equipeCents + r.fraisFixesCents
  const prixCents = Math.round((coutCents / (1 - r.margeCible)) * coefficient / 100) * 100
  return {
    articlesRetenus, heuresPersonne, inventoristes, responsable, dureeMinutes,
    equipeCents, coutCents, prixCents,
    margeCents: prixCents - coutCents,
    marge: prixCents === 0 ? 0 : (prixCents - coutCents) / prixCents,
    remunerationInventoristeCents: Math.round(r.tauxInventoristeCents * heuresFacturees),
    remunerationResponsableCents:
      responsable ? Math.round(r.tauxResponsableCents * heuresFacturees) : 0,
  }
}

export type Refus = 'hors_zone' | 'trop_tot' | 'marge_insuffisante' | 'incomplet'

export type Reponses = {
  codePostal: string
  secteur: Secteur | ''
  trancheArticles: string
  debut: Date | null
}

export type Devis =
  | { ok: true; chaine: Chaine; arrivee: Date; finPrevue: Date; annulationGratuiteJusquAu: Date }
  | { ok: false; refus: Refus }

/** Le délai de constitution d'une équipe. Copie de `devis_mission`. */
export const DELAI_HEURES = 48

export function departementDe(codePostal: string): string {
  return codePostal.replace(/\D/g, '').slice(0, 2)
}

export function estDesservi(codePostal: string): boolean {
  return (DEPARTEMENTS_DESSERVIS as readonly string[]).includes(departementDe(codePostal))
}

/** Le devis affiché pendant le parcours. La base refait le même calcul. */
export function devis(r: Reponses, maintenant = new Date()): Devis {
  const tranche = TRANCHES_ARTICLES.find((t) => t.cle === r.trancheArticles)
  if (!r.codePostal || !r.secteur || !tranche || !r.debut) return { ok: false, refus: 'incomplet' }
  if (!estDesservi(r.codePostal)) return { ok: false, refus: 'hors_zone' }
  if (r.debut.getTime() < maintenant.getTime() + DELAI_HEURES * 3600_000) {
    return { ok: false, refus: 'trop_tot' }
  }
  const c = chaine(tranche.max)
  if (c.marge < REGLAGES.margeMinimum) return { ok: false, refus: 'marge_insuffisante' }
  return {
    ok: true,
    chaine: c,
    arrivee: new Date(r.debut.getTime() - 15 * 60_000),
    finPrevue: new Date(r.debut.getTime() + c.dureeMinutes * 60_000),
    annulationGratuiteJusquAu: new Date(r.debut.getTime() - 3 * 24 * 3600_000),
  }
}

/** « 4 h 30 », « 3 h », « 45 min ». */
export function duree(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}
