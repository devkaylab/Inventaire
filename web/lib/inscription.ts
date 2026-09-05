/**
 * Le parcours d'inscription : ses réponses, et ce qu'elles décident.
 *
 * Maquette : https://claude.ai/code/artifact/27d8f3e6-5e7a-4de7-a1eb-6da9d39cce3a
 *
 * ⚠️ RIEN ICI NE FIXE UN PRIX. Le montant qui part chez Stripe vient de
 * `prix_offre`, en base, appelée par `finaliser_inscription` — la fonction est
 * appelée avec le jeton du prospect, lui laisser porter un montant le
 * laisserait s'inscrire à un centime. Ce module sert à AFFICHER.
 */
import { APPAREILS_MAX, PLAFOND_LIBRE_SERVICE } from '@/lib/offres'

/** Une réponse toute faite : on choisit, on ne saisit pas. */
export type Choix = { valeur: string; libelle: string }

/**
 * ⚠️ AUCUNE TRANCHE NE CHEVAUCHE UNE FRONTIÈRE D'OFFRE. Les paliers sont 2, 20
 * et 100 : une tranche « 15 à 25 » rendrait l'offre indécidable, à cheval sur
 * Advanced et Enterprise. Chaque tranche porte donc son plafond, et c'est lui
 * qui tarife.
 */
export const APPAREILS_TRANCHES: (Choix & { plafond: number | null })[] = [
  { valeur: '2', libelle: '1 à 2 appareils', plafond: 2 },
  { valeur: '10', libelle: '3 à 10 appareils', plafond: 10 },
  { valeur: '20', libelle: '11 à 20 appareils', plafond: 20 },
  { valeur: '50', libelle: '21 à 50 appareils', plafond: 50 },
  { valeur: '100', libelle: '51 à 100 appareils', plafond: 100 },
  // ⚠️ Au-delà de cent, le prix se compte par DIX : une tranche ne suffit plus
  // à le calculer. C'est le seul chiffre exact de tout le parcours, et il ne
  // se demande qu'au magasin qui en a besoin (tranché par Julien, 5 sept. 2026).
  { valeur: 'exact', libelle: `Plus de ${APPAREILS_MAX} appareils`, plafond: null },
]

export const FREQUENCES: Choix[] = [
  { valeur: 'mensuel', libelle: 'Chaque mois' },
  { valeur: 'trimestre', libelle: 'Chaque trimestre' },
  { valeur: 'semestre', libelle: 'Deux fois par an' },
  { valeur: 'annuel', libelle: 'Une fois par an' },
  { valeur: 'jamais', libelle: 'Sans rythme fixe' },
]

export const VOLUMES: Choix[] = [
  { valeur: '1000', libelle: 'Moins de 1 000 références' },
  { valeur: '10000', libelle: '1 000 à 10 000' },
  { valeur: '50000', libelle: '10 000 à 50 000' },
  { valeur: '150000', libelle: '50 000 à 150 000' },
  { valeur: '150000+', libelle: 'Plus de 150 000' },
]

/** Un magasin, tel que l'écran le tient. */
export type MagasinSaisi = { nom: string; tranche: string; exact: string }

export const magasinVide = (): MagasinSaisi => ({ nom: '', tranche: '', exact: '' })

/**
 * Le nombre d'appareils que la saisie désigne, ou `null` tant qu'elle est
 * incomplète. Une tranche vaut son plafond ; « plus de 100 » vaut le chiffre
 * exact, parce que le prix s'y compte par dix.
 */
export function appareilsDe(m: MagasinSaisi): number | null {
  if (m.tranche === 'exact') {
    const n = Number(m.exact.replace(/\s/g, ''))
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }
  const t = APPAREILS_TRANCHES.find((x) => x.valeur === m.tranche)
  return t?.plafond ?? null
}

/** Ce qui empêche encore d'aller plus loin, ou `null`. */
export function refusMagasin(m: MagasinSaisi): string | null {
  if (m.nom.trim() === '') return 'Donnez un nom à ce magasin.'
  if (m.tranche === '') return 'Indiquez combien d’appareils y comptent en même temps.'
  const n = appareilsDe(m)
  if (n == null) return 'Indiquez le nombre exact d’appareils.'
  // ⚠️ La borne haute se dit AVANT le clic : le serveur la refuse aussi
  // (`hors_grille`), mais découvrir après avoir payé qu'il n'y avait rien à
  // acheter fait douter du bouton.
  if (n > PLAFOND_LIBRE_SERVICE) {
    return `Au-delà de ${PLAFOND_LIBRE_SERVICE} appareils, l’offre d’un magasin ne se prolonge plus : déclarez-les séparément.`
  }
  return null
}
