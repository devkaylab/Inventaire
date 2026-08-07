// Accès aux inventaires côté site (superviseur). Le client Supabase du site n'est
// pas typé : on déclare ici les formes utiles et on garde la même logique que l'app.
import { supabase } from '@/lib/supabaseClient'

export type Session = {
  id: string
  inventory_number: string
  name: string
  store_name: string
  status: 'open' | 'counting' | 'closed'
  current_pass: number
  uses_zones: boolean
  created_by: string | null
  created_at: string
}

export type ZoneDashboardRow = {
  id: string
  code: string
  name: string | null
  count_status: string
  audit_status: string
  count_units: number
  count_lines: number
  audit_units: number
  audit_lines: number
}

export type SessionResultRow = {
  sku: string
  ean: string | null
  brand: string
  label: string
  unit_purchase_price: number
  theoretical_qty: number
  counted_qty: number
  status: string
  variance_units: number
  variance_value: number
}

export type ArticleAudit = {
  id: string
  session_id: string
  sku: string
  zone: string
  qty_pass1: number | null
  qty_pass2: number | null
  qty_pass3: number | null
  final_qty: number | null
  status: 'pending' | 'validated' | 'failed' | 'resolved'
}

export type ArticleLabel = { label: string; brand: string; ean: string | null; price: number }

function fail(context: string, error: unknown): never {
  console.error(`[inventory] ${context}`, error)
  throw new Error((error as { message?: string })?.message ?? 'Erreur inconnue')
}

/** Tous les inventaires visibles par le superviseur (RLS = magasins affectés). */
export async function getAccessibleSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('inventory_sessions')
    .select('id,inventory_number,name,store_name,status,current_pass,uses_zones,created_by,created_at')
    .order('created_at', { ascending: false })
  if (error) fail('getAccessibleSessions', error)
  return (data ?? []) as Session[]
}

/** Les inventaires créés par le superviseur courant (« Mes inventaires »). */
export async function getMySessions(userId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('inventory_sessions')
    .select('id,inventory_number,name,store_name,status,current_pass,uses_zones,created_by,created_at')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
  if (error) fail('getMySessions', error)
  return (data ?? []) as Session[]
}

export async function getSession(id: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('inventory_sessions')
    .select('id,inventory_number,name,store_name,status,current_pass,uses_zones,created_by,created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) fail('getSession', error)
  return (data as Session) ?? null
}

export async function getZoneDashboard(id: string): Promise<ZoneDashboardRow[]> {
  const { data, error } = await supabase.rpc('get_zone_dashboard', { p_session_id: id })
  if (error) fail('getZoneDashboard', error)
  return (data ?? []) as ZoneDashboardRow[]
}

/** Total des pièces comptées (passe 1) et auditées (passe 2), mode classique. */
export async function getCountTotals(id: string): Promise<{ counted: number; audited: number }> {
  const { data, error } = await supabase
    .from('counts')
    .select('qty,pass_number')
    .eq('session_id', id)
  if (error) fail('getCountTotals', error)
  let counted = 0
  let audited = 0
  for (const c of (data ?? []) as { qty: number; pass_number: number }[]) {
    if (c.pass_number === 2) audited += Number(c.qty)
    else if (c.pass_number === 1) counted += Number(c.qty)
  }
  return { counted, audited }
}

export async function getSessionResults(id: string): Promise<SessionResultRow[]> {
  const { data, error } = await supabase.rpc('get_session_results', { p_session_id: id })
  if (error) fail('getSessionResults', error)
  return (data ?? []) as SessionResultRow[]
}

export async function getAudits(id: string): Promise<ArticleAudit[]> {
  const { data, error } = await supabase
    .from('article_audit')
    .select('id,session_id,sku,zone,qty_pass1,qty_pass2,qty_pass3,final_qty,status')
    .eq('session_id', id)
    .order('status', { ascending: true })
    .order('sku', { ascending: true })
  if (error) fail('getAudits', error)
  return (data ?? []) as ArticleAudit[]
}

export async function getArticleLabels(id: string, skus: string[]): Promise<Record<string, ArticleLabel>> {
  if (skus.length === 0) return {}
  const { data, error } = await supabase
    .from('articles')
    .select('sku,label,brand,ean,unit_purchase_price')
    .eq('session_id', id)
    .in('sku', skus)
  if (error) fail('getArticleLabels', error)
  const map: Record<string, ArticleLabel> = {}
  for (const a of (data ?? []) as { sku: string; label: string; brand: string; ean: string | null; unit_purchase_price: number | null }[]) {
    map[a.sku] = { label: a.label, brand: a.brand, ean: a.ean, price: Number(a.unit_purchase_price ?? 0) }
  }
  return map
}

export type Member = { user_id: string; full_name: string | null; role: string | null }

export async function getSessionMembers(id: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('session_members')
    .select('user_id, profiles(full_name, role)')
    .eq('session_id', id)
  if (error) fail('getSessionMembers', error)
  // L'embed Supabase peut renvoyer `profiles` en objet ou en tableau selon l'inférence.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    return { user_id: m.user_id as string, full_name: p?.full_name ?? null, role: p?.role ?? null }
  })
}

export async function recomputeAudit(id: string): Promise<void> {
  const { error } = await supabase.rpc('recompute_session_audit', { p_session_id: id })
  if (error) fail('recomputeAudit', error)
}

export async function resolveAudit(id: string, sku: string, finalQty: number, zone = ''): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('resolve_audit', { p_session_id: id, p_sku: sku, p_final_qty: finalQty, p_zone: zone })
  if (error) fail('resolveAudit', error)
  return data as { success: boolean; error?: string }
}

export async function deleteAuditLine(id: string, sku: string, zone = ''): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('delete_audit_line', { p_session_id: id, p_sku: sku, p_zone: zone })
  if (error) fail('deleteAuditLine', error)
  return data as { success: boolean; error?: string }
}

export async function deleteSession(id: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('delete_session', { p_session_id: id })
  if (error) fail('deleteSession', error)
  return data as { success: boolean; error?: string }
}

// ── Helpers d'affichage ──────────────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte', counting: 'En cours', closed: 'Clôturée',
}

/** Regroupe des sessions par magasin (store_name), triées par nom de magasin. */
export function groupByStore(sessions: Session[]): { store: string; sessions: Session[] }[] {
  const map = new Map<string, Session[]>()
  for (const s of sessions) {
    const arr = map.get(s.store_name) ?? []
    arr.push(s)
    map.set(s.store_name, arr)
  }
  return [...map.entries()]
    .map(([store, list]) => ({ store, sessions: list }))
    .sort((a, b) => a.store.localeCompare(b.store))
}

export function fmtQty(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '')
}

export function money(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Quantité effective d'une ligne d'audit (comme l'app). */
export function effectiveQty(a: ArticleAudit): number | null {
  return a.final_qty ?? a.qty_pass3 ?? a.qty_pass2 ?? a.qty_pass1 ?? null
}
