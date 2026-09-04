/**
 * Usage constaté — le jugement.
 *
 * `admin_usage_overview` rend des faits ; ce module décide ce qu'ils veulent
 * dire. Même partage que `lib/pipeline.ts` et `lib/entreprise.ts` : une règle
 * qui bougera plus souvent que la requête, et qui se teste sans base ni
 * navigateur.
 *
 * ── ⚠️ La règle d'asymétrie, qui porte tout le reste ────────────────────────
 *
 * Le plancher est le plus gros inventaire UNIQUE des douze derniers mois. Il ne
 * mesure pas le stock d'un magasin — il en donne un minorant, et seulement dans
 * un sens :
 *
 *   · AU-DESSUS de la borne de la tranche facturée → c'est un fait. On ne
 *     compte pas ce qu'on n'a pas.
 *   · EN DESSOUS → cela ne dit RIEN. Un inventaire tournant ne couvre qu'un
 *     rayon, une marque, une réserve.
 *
 * D'où le vocabulaire, qui n'est pas négociable : le verdict neutre se lit
 * **« Rien à signaler »**, jamais « Cohérent » ni « Conforme ». Ces deux mots
 * affirmeraient une vérification qui n'a pas eu lieu, et feraient renouveler un
 * contrat sur une impression fausse. Un test de garde les interdit.
 */

import { TRANCHES, trancheDe, type Tranche } from '@/lib/tarifs'
import { nb } from '@/lib/format'

export type MagasinUsage = {
  id: string
  name: string
  /** Volume déclaré à la vente. Nul = magasin créé sans volume. */
  units: number | null
  sqm: number | null
  annual_price_cents: number | null
  inventaires: number
  /** Plus gros inventaire unique sur 12 mois, en pièces. Nul = rien de compté. */
  plancher: number | null
  /** Compteurs distincts identifiés. Voir `compteursLisibles`. */
  compteurs: number
  /** Lignes de comptage, tous inventaires confondus. */
  lignes: number
  dernier: string | null
}

export type UsageEntreprise = {
  stores: MagasinUsage[]
  inventaires: number
  compteurs_distincts: number
}

export type EtatUsage =
  | 'au-dela'
  | 'rien-a-signaler'
  | 'pas-mesurable'
  | 'volume-inconnu'

export type Lecture = {
  etat: EtatUsage
  /** Tranche facturée, déduite du volume déclaré. */
  payee: Tranche | null
  /** Tranche que le plancher observé impose. Seulement si `au-dela`. */
  due: Tranche | null
  /** Part de la borne haute atteinte, 1 = pile la borne. Nul si incalculable. */
  part: number | null
  /** Écart annuel en euros, positif. Nul hors `au-dela`. */
  ecartEuros: number | null
}

/** Le mot qui s'affiche. Volontairement prudent — voir l'en-tête. */
export const LIBELLES: Record<EtatUsage, string> = {
  'au-dela': 'Au-delà de la tranche',
  'rien-a-signaler': 'Rien à signaler',
  'pas-mesurable': 'Pas encore mesurable',
  'volume-inconnu': 'Volume non renseigné',
}

/**
 * Ce que dit un magasin.
 *
 * L'ordre des refus compte : sans volume déclaré il n'y a pas de terme de
 * comparaison, et c'est un manque à combler (bouton « renseigner »), pas une
 * absence de mesure.
 */
export function lireUsage(m: MagasinUsage): Lecture {
  const vide: Lecture = { etat: 'volume-inconnu', payee: null, due: null, part: null, ecartEuros: null }

  const payee = trancheDe(m.units)
  if (!payee) return vide

  if (m.plancher == null || m.plancher <= 0) {
    return { etat: 'pas-mesurable', payee, due: null, part: null, ecartEuros: null }
  }

  // La dernière tranche n'a pas de borne haute : rien ne peut la dépasser.
  if (payee.max === null) {
    return { etat: 'rien-a-signaler', payee, due: null, part: null, ecartEuros: null }
  }

  const part = m.plancher / payee.max
  if (m.plancher <= payee.max) {
    return { etat: 'rien-a-signaler', payee, due: null, part, ecartEuros: null }
  }

  const due = trancheDe(m.plancher)
  // Un écart ne se chiffre que si les deux tranches ont un prix : au-delà d'un
  // million, c'est sur devis, et annoncer un montant serait inventer.
  const ecartEuros =
    due && due.prixEuros !== null && payee.prixEuros !== null
      ? Math.max(0, due.prixEuros - payee.prixEuros)
      : null

  return { etat: 'au-dela', payee, due, part, ecartEuros }
}

/**
 * Combien de compteurs afficher, et faut-il l'afficher.
 *
 * ⚠️ `counts.counted_by` passe à NULL quand un compte est supprimé (migration
 * 20260818000001, l'effacement qui n'efface pas les chiffres). Un magasin peut
 * donc avoir des centaines de lignes et zéro compteur identifié. Afficher « 0 »
 * ferait croire que personne n'a compté.
 */
export function compteursLisibles(m: MagasinUsage): number | null {
  if (m.compteurs > 0) return m.compteurs
  return m.lignes > 0 ? null : 0
}

/** Les magasins qui appellent un geste, le plus gros écart d'abord. */
export function aRevoir(stores: MagasinUsage[]): MagasinUsage[] {
  return stores
    .filter((m) => lireUsage(m).etat === 'au-dela')
    .sort((a, b) => (lireUsage(b).ecartEuros ?? 0) - (lireUsage(a).ecartEuros ?? 0))
}

/** Revenu annuel qu'un passage de tranche rapporterait, tous magasins confondus. */
export function ecartTotalEuros(stores: MagasinUsage[]): number {
  return aRevoir(stores).reduce((t, m) => t + (lireUsage(m).ecartEuros ?? 0), 0)
}

/** Licences facturées, en euros. Ignore les magasins sans prix posé. */
export function licencesEuros(stores: MagasinUsage[]): number {
  return stores.reduce((t, m) => t + (m.annual_price_cents ?? 0), 0) / 100
}

/**
 * Phrase du constat, ou null quand il n'y a rien à dire.
 *
 * Elle nomme les magasins plutôt que d'annoncer un nombre : « deux magasins »
 * oblige à ouvrir le tableau pour savoir lesquels.
 */
export function phraseConstat(stores: MagasinUsage[]): string | null {
  const liste = aRevoir(stores)
  if (liste.length === 0) return null
  const noms = liste.slice(0, 3).map((m) => m.name)
  const reste = liste.length - noms.length
  const sujet = reste > 0 ? `${noms.join(', ')} et ${reste} autre${reste > 1 ? 's' : ''}` : joindre(noms)
  const total = ecartTotalEuros(stores)
  const verbe = liste.length > 1 ? 'ont compté' : 'a compté'
  const fin = total > 0 ? ` — ${nb(total)} € par an au renouvellement.` : '.'
  return `${sujet} ${verbe} au-delà de la tranche facturée${fin}`
}

function joindre(noms: string[]): string {
  if (noms.length <= 1) return noms[0] ?? ''
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
}

/** Borne haute de la tranche, pour l'afficher à côté du plancher. */
export function borneDe(units: number | null): number | null {
  const t = trancheDe(units)
  return t?.max ?? null
}

/** Toutes les tranches chiffrées, pour un sélecteur. Le hors-borne n'en est pas une. */
export const TRANCHES_CHIFFREES = TRANCHES.filter((t) => t.prixEuros !== null)
