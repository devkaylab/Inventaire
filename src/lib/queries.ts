import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/types/database.types'
import { errorMessage } from '@/lib/errors'

function throwSupabase(context: string, error: unknown): never {
  console.error(`[queries] ${context}`, error)
  throw new Error(errorMessage(error))
}

export type Session = Tables<'inventory_sessions'>
export type Article = Tables<'articles'>
export type Count = Tables<'counts'>
export type ArticleAudit = Tables<'article_audit'>

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

export async function getSessions() {
  const { data, error } = await supabase
    .from('inventory_sessions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throwSupabase('getSessions', error)
  return data
}

export async function getSession(sessionId: string) {
  const { data, error } = await supabase
    .from('inventory_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  if (error) throwSupabase('getSession', error)
  return data
}

export async function getSessionMembers(sessionId: string) {
  const { data, error } = await supabase
    .from('session_members')
    .select('*, profiles(*)')
    .eq('session_id', sessionId)
  if (error) throwSupabase('getSessionMembers', error)
  return data
}

export async function getMyCounts(sessionId: string, passNumber: number) {
  const { data, error } = await supabase
    .from('counts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('pass_number', passNumber)
    .order('created_at', { ascending: false })
  if (error) throwSupabase('getMyCounts', error)
  return data
}

export async function getSessionCounts(sessionId: string) {
  const { data, error } = await supabase
    .from('counts')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
  if (error) throwSupabase('getSessionCounts', error)
  return data
}

export async function resolveArticle(sessionId: string, value: string): Promise<Article | null> {
  const trimmed = value.trim()
  // Match leading-zero variants: Excel drops leading zeros from numeric EAN cells,
  // so the stored EAN can differ from the scanned barcode by leading zeros.
  // ean_norm (generated column) holds the EAN without leading zeros; compare it to
  // the scanned code stripped the same way. Covers both directions.
  const norm = trimmed.replace(/^0+/, '')
  const filters = [`sku.eq.${trimmed}`, `ean.eq.${trimmed}`]
  if (norm) filters.push(`ean_norm.eq.${norm}`)
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('session_id', sessionId)
    .or(filters.join(','))
    .limit(1)
    .maybeSingle()
  if (error) throwSupabase('resolveArticle', error)
  return data
}

export async function insertArticle(article: TablesInsert<'articles'>): Promise<Article> {
  const { data, error } = await supabase.from('articles').insert(article).select().single()
  if (error) throwSupabase('insertArticle', error)
  return data
}

export async function insertCount(count: TablesInsert<'counts'>) {
  const { data, error } = await supabase.from('counts').insert(count).select().single()
  if (error) throwSupabase('insertCount', error)
  return data
}

export async function createSession(storeName: string, securityCode: string) {
  const { data, error } = await supabase.rpc('create_session', {
    p_store_name: storeName,
    p_security_code: securityCode,
  })
  if (error) throwSupabase('createSession', error)
  return data as { success: boolean; session_id?: string; inventory_number?: string; store_name?: string; security_code?: string; error?: string }
}

export async function createCompany(name: string) {
  const { data, error } = await supabase.rpc('create_company', { p_name: name })
  if (error) throwSupabase('createCompany', error)
  return data as { success: boolean; company_id?: string; name?: string; join_code?: string; error?: string }
}

export async function joinCompany(code: string) {
  const { data, error } = await supabase.rpc('join_company', { p_code: code })
  if (error) throwSupabase('joinCompany', error)
  return data as { success: boolean; company_id?: string; name?: string; error?: string }
}

export async function joinSession(inventoryNumber: string, securityCode: string) {
  const { data, error } = await supabase.rpc('join_session', {
    p_inventory_number: inventoryNumber,
    p_security_code: securityCode,
  })
  if (error) throwSupabase('joinSession', error)
  return data as { success: boolean; session_id?: string; store_name?: string; status?: string; current_pass?: number; error?: string }
}

export async function advancePass(sessionId: string) {
  const { data, error } = await supabase.rpc('advance_pass', { p_session_id: sessionId })
  if (error) throwSupabase('advancePass', error)
  return data as { success: boolean; current_pass?: number; error?: string }
}

// Step the session back one pass (e.g. Audit -> Compte) so the team can resume
// counting. Allowed for the supervisor-owner and for any session member.
// deleteCounts wipes everything counted in the pass being left.
export async function revertPass(sessionId: string, deleteCounts: boolean) {
  const { data, error } = await supabase.rpc('revert_pass', {
    p_session_id: sessionId,
    p_delete_counts: deleteCounts,
  })
  if (error) throwSupabase('revertPass', error)
  return data as { success: boolean; current_pass?: number; error?: string }
}

export async function closeSession(sessionId: string) {
  // Deletion is handled server-side via a SECURITY DEFINER function that
  // bypasses RLS — guarantees all rows (counts, stock, audit, members, session)
  // are actually removed regardless of client-side policies.
  const { data, error } = await supabase.rpc('delete_session', { p_session_id: sessionId })
  if (error) throwSupabase('closeSession', error)
  const result = data as unknown as { success: boolean; error?: string }
  if (!result.success) throwSupabase('closeSession', new Error(result.error ?? 'Échec de la suppression'))
}

export async function getTheoreticalStock(sessionId: string) {
  const { data, error } = await supabase
    .from('theoretical_stock')
    .select('*')
    .eq('session_id', sessionId)
  if (error) throwSupabase('getTheoreticalStock', error)
  return data
}

export async function recomputeAudit(sessionId: string) {
  const { data, error } = await supabase.rpc('recompute_session_audit', { p_session_id: sessionId })
  if (error) throwSupabase('recomputeAudit', error)
  return data as { success: boolean; failed?: number; pending?: number; total?: number }
}

export async function getAudits(sessionId: string) {
  const { data, error } = await supabase
    .from('article_audit')
    .select('*')
    .eq('session_id', sessionId)
    .order('status', { ascending: true })
    .order('sku', { ascending: true })
  if (error) throwSupabase('getAudits', error)
  return data
}

export async function resolveAudit(sessionId: string, sku: string, finalQty: number) {
  const { data, error } = await supabase.rpc('resolve_audit', {
    p_session_id: sessionId,
    p_sku: sku,
    p_final_qty: finalQty,
  })
  if (error) throwSupabase('resolveAudit', error)
  return data as { success: boolean; error?: string }
}

export async function deleteAuditLine(sessionId: string, sku: string) {
  const { data, error } = await supabase.rpc('delete_audit_line', {
    p_session_id: sessionId,
    p_sku: sku,
  })
  if (error) throwSupabase('deleteAuditLine', error)
  return data as { success: boolean; error?: string }
}

export async function getSessionResults(sessionId: string): Promise<SessionResultRow[]> {
  const { data, error } = await supabase.rpc('get_session_results', { p_session_id: sessionId })
  if (error) throwSupabase('getSessionResults', error)
  return (data ?? []) as SessionResultRow[]
}

export type ScanEntrySeed = { article: Article; qty: number; timestamp: number }

// Rebuild a counter's scan list from persisted counts so it survives navigation
// (and app restarts) until the inventory is closed. Aggregates net qty per SKU
// for the given session + pass + counter, drops SKUs that net to zero, and
// joins the article details needed to render each row.
export async function getMyScanEntries(
  sessionId: string,
  passNumber: number,
  countedBy: string,
): Promise<ScanEntrySeed[]> {
  const { data, error } = await supabase
    .from('counts')
    .select('sku, qty, created_at')
    .eq('session_id', sessionId)
    .eq('pass_number', passNumber)
    .eq('counted_by', countedBy)
  if (error) throwSupabase('getMyScanEntries', error)

  const agg = new Map<string, { qty: number; ts: number }>()
  for (const row of data ?? []) {
    const cur = agg.get(row.sku) ?? { qty: 0, ts: 0 }
    cur.qty += Number(row.qty)
    const t = new Date(row.created_at as string).getTime()
    if (t > cur.ts) cur.ts = t
    agg.set(row.sku, cur)
  }

  const skus = [...agg.entries()].filter(([, v]) => v.qty > 0).map(([sku]) => sku)
  if (skus.length === 0) return []

  // Fetch article details in chunks — a counter may have scanned thousands of
  // distinct SKUs, and a single huge `.in(...)` can blow the URL length limit.
  const bySku = new Map<string, Article>()
  const CHUNK = 300
  for (let i = 0; i < skus.length; i += CHUNK) {
    const slice = skus.slice(i, i + CHUNK)
    const { data: articles, error: aErr } = await supabase
      .from('articles')
      .select('*')
      .eq('session_id', sessionId)
      .in('sku', slice)
    if (aErr) throwSupabase('getMyScanEntries.articles', aErr)
    for (const a of articles ?? []) bySku.set(a.sku, a)
  }

  const entries: ScanEntrySeed[] = []
  for (const sku of skus) {
    const article = bySku.get(sku)
    if (!article) continue // article no longer exists (e.g. catalog re-import)
    entries.push({ article, qty: agg.get(sku)!.qty, timestamp: agg.get(sku)!.ts })
  }
  entries.sort((a, b) => b.timestamp - a.timestamp)
  return entries
}

export async function getArticleLabels(sessionId: string, skus: string[]) {
  if (skus.length === 0) return {}
  const { data, error } = await supabase
    .from('articles')
    .select('sku, label, brand, ean')
    .eq('session_id', sessionId)
    .in('sku', skus)
  if (error) throwSupabase('getArticleLabels', error)
  const map: Record<string, { label: string; brand: string; ean: string | null }> = {}
  for (const a of data ?? []) map[a.sku] = { label: a.label, brand: a.brand, ean: a.ean }
  return map
}

