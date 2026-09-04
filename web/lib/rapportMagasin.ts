// Le rapport consolidé d'un magasin.
//
// Un grand magasin ouvre un inventaire par étage, par réserve, par corner :
// jusqu'ici personne ne pouvait dire ce que le magasin, entier, avait donné.
// Ce module sert les quatre fonctions qui répondent à cette question —
// `rapport_magasin_*`, migration du 4 septembre 2026.
//
// ⚠️ CE QUI EST ADDITIONNÉ EST CE QUI EST COCHÉ, jamais une plage de dates.
// Les dates ne servent qu'à préparer la sélection ; le serveur, lui, ne
// retient que les inventaires CLÔTURÉS du magasin visé. Un inventaire encore
// en cours passé dans la liste est simplement ignoré — il ferait bouger le
// rapport d'heure en heure.

import { supabase } from '@/lib/supabaseClient'
import { errorMessage } from '@/lib/errors'

function fail(context: string, error: unknown): never {
  console.error(`[rapportMagasin] ${context}`, error)
  throw new Error(errorMessage(error))
}

export type StatutInventaire = 'open' | 'counting' | 'closed'

export type InventaireDuMagasin = {
  session_id: string
  nom: string
  numero: string
  statut: StatutInventaire
  cloture_le: string | null
  cree_le: string
  references_attendues: number
  dans_periode: boolean
}

export type EnteteMagasin = {
  id: string
  nom: string
  entreprise: string
  entreprise_id: string
}

/**
 * Le magasin et ses inventaires récents (100 au plus).
 *
 * Elle rend aussi l'identité du magasin, et ce n'est pas de la commodité :
 * l'administrateur Quantinvo n'a pas de `company_id`, donc `ca_store_detail`
 * lui est fermée. Sans ce bloc, l'écran n'aurait pas de titre pour lui.
 */
export async function getInventairesDuMagasin(
  storeId: string, du: string | null, au: string | null,
): Promise<{ magasin: EnteteMagasin; inventaires: InventaireDuMagasin[] }> {
  const { data, error } = await supabase.rpc('rapport_magasin_inventaires', {
    p_store_id: storeId, p_du: du, p_au: au,
  })
  if (error) fail('getInventairesDuMagasin', error)
  const d = data as { magasin: EnteteMagasin; inventaires: InventaireDuMagasin[] }
  return {
    magasin: d.magasin,
    inventaires: (d.inventaires ?? []).map(i => ({
      ...i,
      references_attendues: Number(i.references_attendues ?? 0),
    })),
  }
}

export type RapportMagasinResume = {
  inventaires: number
  lignes: number
  doublons: number
  theorique: number
  compte: number
  ecart_unites: number
  ecart_valeur: number
  non_arbitres: number
}

/**
 * Les totaux du périmètre choisi.
 *
 * ⚠️ Ils portent sur TOUT le périmètre, jamais sur la page ni sur la
 * recherche : un total qui suivrait la page ne voudrait rien dire. Même règle
 * que le rapport d'un inventaire.
 */
export async function getRapportMagasinResume(
  storeId: string, sessions: string[],
): Promise<RapportMagasinResume> {
  const { data, error } = await supabase.rpc('rapport_magasin_resume', {
    p_store_id: storeId, p_sessions: sessions,
  })
  if (error) fail('getRapportMagasinResume', error)
  const r = (data ?? [])[0]
  return {
    inventaires: Number(r?.inventaires ?? 0),
    lignes: Number(r?.lignes ?? 0),
    doublons: Number(r?.doublons ?? 0),
    theorique: Number(r?.theorique ?? 0),
    compte: Number(r?.compte ?? 0),
    ecart_unites: Number(r?.ecart_unites ?? 0),
    ecart_valeur: Number(r?.ecart_valeur ?? 0),
    non_arbitres: Number(r?.non_arbitres ?? 0),
  }
}

export type TriRapportMagasin =
  | 'sku' | 'theoretical_qty' | 'counted_qty'
  | 'variance_units' | 'variance_value' | 'inventaires'

export type LigneRapportMagasin = {
  sku: string
  ean: string | null
  brand: string
  label: string
  theoretical_qty: number
  counted_qty: number
  variance_units: number
  variance_value: number
  /** Dans combien des inventaires retenus cette référence apparaît. */
  inventaires: number
}

export async function getRapportMagasinPage(
  storeId: string,
  sessions: string[],
  opts: {
    recherche?: string
    tri?: TriRapportMagasin
    sens?: 'asc' | 'desc'
    offset?: number
    limite?: number
    multiSeulement?: boolean
  } = {},
): Promise<{ rows: LigneRapportMagasin[]; total: number }> {
  const { data, error } = await supabase.rpc('rapport_magasin_page', {
    p_store_id: storeId,
    p_sessions: sessions,
    p_recherche: opts.recherche?.trim() || null,
    p_tri: opts.tri ?? 'variance_value',
    p_sens: opts.sens ?? 'desc',
    p_offset: opts.offset ?? 0,
    p_limite: opts.limite ?? 50,
    p_multi_seulement: opts.multiSeulement ?? false,
  })
  if (error) fail('getRapportMagasinPage', error)
  const rows = (data ?? []) as (LigneRapportMagasin & { total: number })[]
  return { rows: rows as LigneRapportMagasin[], total: Number(rows[0]?.total ?? 0) }
}

/** Une ligne par (inventaire, référence) — la feuille qui dit d'où vient l'écart. */
export type LigneDetailMagasin = {
  inventaire: string
  numero: string
  sku: string
  ean: string | null
  brand: string
  label: string
  theoretical_qty: number
  counted_qty: number
  variance_units: number
  variance_value: number
}

export async function getDetailMagasinPage(
  storeId: string, sessions: string[], offset: number, limite: number,
): Promise<{ rows: LigneDetailMagasin[]; total: number }> {
  const { data, error } = await supabase.rpc('rapport_magasin_detail', {
    p_store_id: storeId, p_sessions: sessions, p_offset: offset, p_limite: limite,
  })
  if (error) fail('getDetailMagasinPage', error)
  const rows = (data ?? []) as (LigneDetailMagasin & { total: number })[]
  return { rows: rows as LigneDetailMagasin[], total: Number(rows[0]?.total ?? 0) }
}

const TAILLE_EXPORT = 5000

/**
 * Parcourt toutes les pages — POUR L'EXPORT SEULEMENT.
 *
 * ⚠️ Le fichier remis au client doit être COMPLET. La différence avec « tout
 * demander d'un coup », c'est qu'on le demande par tranches : le serveur n'a
 * jamais à rendre 400 000 lignes dans les huit secondes qui lui sont
 * accordées. Recopié de `getAllRapportRows` plutôt que partagé — les deux
 * familles de fonctions n'ont ni les mêmes paramètres ni les mêmes colonnes,
 * et une abstraction de plus ne rendrait aucune des deux plus claire.
 */
async function toutesLesPages<T>(
  page: (offset: number) => Promise<{ rows: T[]; total: number }>,
  onAvance?: (fait: number, total: number) => void,
): Promise<T[]> {
  const tout: T[] = []
  let offset = 0
  let total = 0
  for (;;) {
    const r = await page(offset)
    total = r.total
    tout.push(...r.rows)
    onAvance?.(tout.length, total)
    if (r.rows.length < TAILLE_EXPORT || tout.length >= total) break
    offset += TAILLE_EXPORT
  }
  return tout
}

export function getToutesLesLignesMagasin(
  storeId: string, sessions: string[], onAvance?: (fait: number, total: number) => void,
): Promise<LigneRapportMagasin[]> {
  return toutesLesPages(
    (offset) => getRapportMagasinPage(storeId, sessions, {
      tri: 'sku', sens: 'asc', offset, limite: TAILLE_EXPORT,
    }),
    onAvance,
  )
}

export function getToutLeDetailMagasin(
  storeId: string, sessions: string[], onAvance?: (fait: number, total: number) => void,
): Promise<LigneDetailMagasin[]> {
  return toutesLesPages(
    (offset) => getDetailMagasinPage(storeId, sessions, offset, TAILLE_EXPORT),
    onAvance,
  )
}
