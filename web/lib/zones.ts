// Zones et balises.
//
// Vocabulaire (souvent confondu, donc explicite ici) :
//  · une BALISE est une étiquette QR numérotée, physique, collée dans le
//    magasin. En base c'est une ligne de `zones`, identifiée par son `code`.
//    Le stock d'étiquettes appartient à l'entreprise (companies.balise_count)
//    et se réutilise d'un inventaire à l'autre.
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
}

export type BaliseMode = 'count' | 'audit'

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
