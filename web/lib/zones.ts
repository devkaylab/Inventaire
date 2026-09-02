// Zones et balises.
//
// Vocabulaire (souvent confondu, donc explicite ici) :
//  · une BALISE est une étiquette QR numérotée, physique, collée dans le
//    magasin. En base c'est une ligne de `zones`, identifiée par son `code`.
//    Les étiquettes sont imprimées par série depuis l'app (aucun stock tenu en
//    base) et se réutilisent d'un inventaire à l'autre.
//  · une ZONE (ou emplacement) n'a pas de table : c'est simplement l'ensemble
//    des balises partageant le même `zones.name`. « Réserve » = balises 1 à 10.
//
// Chaque balise a deux cycles de vie indépendants : le comptage
// (`count_status`) et l'audit (`audit_status`), chacun pending → open → done.

import { supabase } from '@/lib/supabaseClient'
import { errorMessage } from '@/lib/errors'

export type ZoneDashboardRow = {
  id: string
  code: string
  name: string | null
  count_status: 'pending' | 'open' | 'done'
  audit_status: 'pending' | 'open' | 'done'
  count_units: number
  count_lines: number
  audit_units: number
  audit_lines: number
  /**
   * Ce que QUELQU'UN D'AUTRE a compté sur la balise — jamais qui.
   *
   * ⚠️ C'est ce qui permet à l'écran de scan de prévenir quand un collègue est
   * déjà passé, et de se TAIRE quand on rouvre sa propre balise. Une colonne
   * « propriétaire » sur `zones` aurait répondu à une autre question, et serait
   * devenue fausse dès que deux personnes se relaient sur un rayon.
   */
  count_units_autres: number
  count_lines_autres: number
  audit_units_autres: number
  audit_lines_autres: number
}

export type BaliseMode = 'count' | 'audit'

/**
 * Une ligne du détail d'une balise : ce qui a été compté, et ce que l'audit en
 * a dit.
 *
 * ⚠️ `audit_status` est celui de la BALISE, pas de la ligne — il est le même
 * sur toutes les lignes, et c'est lui qui décide si l'écart peut se calculer.
 * Tant que l'audit tourne, une quantité auditée à zéro ne distingue pas
 * « l'auditeur n'a rien trouvé » de « l'auditeur n'est pas encore passé » :
 * même règle que `computeDiscrepancies`, qui refuse de conclure dans ce cas.
 */
export type BaliseLigne = {
  sku: string
  ean: string | null
  brand: string
  label: string
  counted_qty: number
  audited_qty: number
  /** Quantité retenue par un arbitrage, s'il y en a eu un. */
  final_qty: number | null
  audit_status: 'pending' | 'open' | 'done'
}

/** Le maximum imposé par le serveur dans define_zone. */
export const MAX_RANGE = 2000

function fail(context: string, error: unknown): never {
  console.error(`[zones] ${context}`, error)
  throw new Error(errorMessage(error))
}

export async function getZoneDashboard(sessionId: string): Promise<ZoneDashboardRow[]> {
  const { data, error } = await supabase.rpc('get_zone_dashboard', { p_session_id: sessionId })
  if (error) fail('getZoneDashboard', error)
  return (data ?? []) as ZoneDashboardRow[]
}

export async function defineZoneRange(
  sessionId: string, name: string, start: number, end: number,
): Promise<{ success: boolean; created?: number; name?: string; error?: string }> {
  const { data, error } = await supabase.rpc('define_zone', {
    p_session_id: sessionId, p_name: name, p_code_start: start, p_code_end: end,
  })
  if (error) fail('defineZoneRange', error)
  return data as { success: boolean; created?: number; error?: string }
}

export async function deleteZone(
  sessionId: string, name: string,
): Promise<{ success: boolean; deleted?: number; error?: string }> {
  const { data, error } = await supabase.rpc('delete_zone', { p_session_id: sessionId, p_name: name })
  if (error) fail('deleteZone', error)
  return data as { success: boolean; deleted?: number; error?: string }
}

/**
 * Ouvre ou clôture un cycle (comptage ou audit) d'une balise.
 * Utile au superviseur quand un compteur a quitté l'application en laissant une
 * balise ouverte : rien côté serveur ne la referme, elle resterait « en cours »
 * indéfiniment et compterait comme non faite.
 */
export async function setBalise(
  sessionId: string, code: string, mode: BaliseMode, open: boolean,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('set_balise', {
    p_session_id: sessionId, p_code: code, p_mode: mode, p_open: open, p_allow_create: false,
  })
  if (error) fail('setBalise', error)
  return data as { success: boolean; error?: string }
}

/**
 * Clôture l'audit d'une balise, en reprenant le comptage si personne n'a
 * audité.
 *
 * ⚠️ **Ne pas remplacer par `setBalise(..., 'audit', false)`.** Ce dernier ne
 * bascule que le statut : l'audit devenant « terminé », l'écart devient
 * calculable, et toutes les références de la balise sortaient à **moins la
 * totalité du comptage** — une démarque intégrale fabriquée par le seul fait de
 * ranger un audit que personne n'a fait (constat de Julien, 2 septembre 2026).
 *
 * La reprise n'a lieu que si la balise n'a **aucune** ligne d'audit. Une balise
 * auditée à moitié garde ses écarts : là, quelqu'un est passé, et ne pas avoir
 * retrouvé un article est justement ce que l'inventaire révèle.
 */
export async function cloturerAuditBalise(
  sessionId: string, code: string,
): Promise<{ success: boolean; reprises?: number; error?: string }> {
  const { data, error } = await supabase.rpc('cloturer_audit_balise', {
    p_session_id: sessionId, p_code: code,
  })
  if (error) fail('cloturerAuditBalise', error)
  return data as { success: boolean; reprises?: number; error?: string }
}

/**
 * Ce qui a été compté sur UNE balise.
 *
 * ⚠️ Passe par `get_balise_detail`, jamais par `getSessionDetail` filtré au
 * navigateur : cette dernière rend le détail de l'inventaire entier, et le
 * rapatrier pour n'en montrer qu'un rayon est le motif retiré en août 2026
 * pour la tenue en charge.
 */
export async function getBaliseDetail(sessionId: string, code: string): Promise<BaliseLigne[]> {
  const { data, error } = await supabase.rpc('get_balise_detail', {
    p_session_id: sessionId, p_code: code,
  })
  if (error) fail('getBaliseDetail', error)
  return (data ?? []) as BaliseLigne[]
}

/**
 * Efface tout ce qui a été compté et audité sur une balise, et la remet à
 * faire.
 *
 * Pour une balise comptée dans le mauvais rayon, ou un comptage à reprendre de
 * zéro : sans ce geste il fallait corriger article par article. Irréversible —
 * l'écran exige de recopier le numéro de la balise, et l'action est écrite au
 * journal de l'entreprise.
 */
export async function viderBalise(
  sessionId: string, code: string,
): Promise<{ success: boolean; lignes?: number; pieces?: number; error?: string }> {
  const { data, error } = await supabase.rpc('vider_balise', {
    p_session_id: sessionId, p_code: code,
  })
  if (error) fail('viderBalise', error)
  return data as { success: boolean; lignes?: number; pieces?: number; error?: string }
}

/**
 * L'écart d'une ligne, ou `null` quand il ne se calcule pas encore.
 *
 * ⚠️ Deux cas rendent `null`, et ce n'est pas la même prudence : l'audit de la
 * balise n'est pas clôturé (on ne sait pas si l'auditeur est passé), ou la
 * ligne a été arbitrée (la quantité retenue remplace la comparaison). Une
 * soustraction affichée dans le premier cas accuserait quelqu'un à tort.
 */
export function ecartLigne(l: BaliseLigne): number | null {
  if (l.audit_status !== 'done') return null
  if (l.final_qty != null) return null
  return Number(l.audited_qty) - Number(l.counted_qty)
}

// ── Agrégations pures (testées unitairement) ─────────────────────────────────

export type ZoneGroup = {
  name: string
  total: number
  counted: number
  audited: number
  codes: string[]
  /** true si le nom est le libellé de repli des balises sans emplacement. */
  unnamed: boolean
}

export const UNNAMED = '(Sans emplacement)'

/** Regroupe les balises par emplacement, comme l'écran « Zones » du mobile. */
export function groupByName(rows: ZoneDashboardRow[]): ZoneGroup[] {
  const map = new Map<string, ZoneGroup>()
  for (const r of rows) {
    const name = r.name ?? UNNAMED
    const g = map.get(name) ?? { name, total: 0, counted: 0, audited: 0, codes: [], unnamed: name === UNNAMED }
    g.total += 1
    if (r.count_status === 'done') g.counted += 1
    if (r.audit_status === 'done') g.audited += 1
    g.codes.push(r.code)
    map.set(name, g)
  }
  return [...map.values()]
    .map(g => ({ ...g, codes: sortCodes(g.codes) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/** Tri naturel : 2 avant 10, et les codes non numériques en fin, par ordre alpha. */
export function sortCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const na = Number(a), nb = Number(b)
    const aNum = Number.isFinite(na), bNum = Number.isFinite(nb)
    if (aNum && bNum) return na - nb
    if (aNum) return -1
    if (bNum) return 1
    return a.localeCompare(b)
  })
}

/** « 1 → 10 » pour une plage contiguë, « 1 → 10 (+2) » si des trous existent. */
export function codeRange(codes: string[]): string {
  if (codes.length === 0) return '—'
  const sorted = sortCodes(codes)
  if (sorted.length === 1) return sorted[0]
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const nf = Number(first), nl = Number(last)
  const contiguous = Number.isFinite(nf) && Number.isFinite(nl) && nl - nf + 1 === sorted.length
  return contiguous ? `${first} → ${last}` : `${first} → ${last} (${sorted.length})`
}

/** Validation de plage, alignée sur les règles du serveur (define_zone). */
export function validateRange(name: string, start: string, end: string): string | null {
  if (!name.trim()) return "Indiquez le nom de l'emplacement (ex. « Réserve »)."
  const s = Number(start), e = Number(end)
  if (!Number.isInteger(s) || !Number.isInteger(e) || start.trim() === '' || end.trim() === '') {
    return 'Indiquez la première et la dernière balise de la plage.'
  }
  if (s < 0) return 'Une balise ne peut pas être négative.'
  if (s > e) return 'La première balise doit être inférieure ou égale à la dernière.'
  if (e - s + 1 > MAX_RANGE) return `Plage trop grande : ${MAX_RANGE} balises au maximum par affectation.`
  return null
}
