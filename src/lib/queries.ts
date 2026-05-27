import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/types/database.types'

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
  if (error) throw error
  return data
}

export async function getSession(sessionId: string) {
  const { data, error } = await supabase
    .from('inventory_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  if (error) throw error
  return data
}

export async function getSessionMembers(sessionId: string) {
  const { data, error } = await supabase
    .from('session_members')
    .select('*, profiles(*)')
    .eq('session_id', sessionId)
  if (error) throw error
  return data
}

export async function getMyCounts(sessionId: string, passNumber: number) {
  const { data, error } = await supabase
    .from('counts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('pass_number', passNumber)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getSessionCounts(sessionId: string) {
  const { data, error } = await supabase
    .from('counts')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function resolveArticle(value: string): Promise<Article | null> {
  const trimmed = value.trim()
  const { data } = await supabase
    .from('articles')
    .select('*')
    .or(`sku.eq.${trimmed},ean.eq.${trimmed}`)
    .limit(1)
    .maybeSingle()
  return data
}

export async function insertCount(count: TablesInsert<'counts'>) {
  const { data, error } = await supabase.from('counts').insert(count).select().single()
  if (error) throw error
  return data
}

export async function upsertArticles(articles: TablesInsert<'articles'>[]) {
  const { error } = await supabase
    .from('articles')
    .upsert(articles, { onConflict: 'sku' })
  if (error) throw error
}

export async function upsertTheoreticalStock(
  sessionId: string,
  rows: { sku: string; theoretical_qty: number }[]
) {
  const payload = rows.map(r => ({ session_id: sessionId, sku: r.sku, theoretical_qty: r.theoretical_qty }))
  const { error } = await supabase
    .from('theoretical_stock')
    .upsert(payload, { onConflict: 'session_id,sku' })
  if (error) throw error
}

export async function createSession(storeName: string, securityCode: string) {
  const { data, error } = await supabase.rpc('create_session', {
    p_store_name: storeName,
    p_security_code: securityCode,
  })
  if (error) throw error
  return data as { success: boolean; session_id?: string; inventory_number?: string; store_name?: string; error?: string }
}

export async function joinSession(inventoryNumber: string, securityCode: string) {
  const { data, error } = await supabase.rpc('join_session', {
    p_inventory_number: inventoryNumber,
    p_security_code: securityCode,
  })
  if (error) throw error
  return data as { success: boolean; session_id?: string; store_name?: string; status?: string; current_pass?: number; error?: string }
}

export async function advancePass(sessionId: string) {
  const { data, error } = await supabase.rpc('advance_pass', { p_session_id: sessionId })
  if (error) throw error
  return data as { success: boolean; current_pass?: number; error?: string }
}

export async function closeSession(sessionId: string) {
  const { error } = await supabase
    .from('inventory_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}

export async function getTheoreticalStock(sessionId: string) {
  const { data, error } = await supabase
    .from('theoretical_stock')
    .select('*')
    .eq('session_id', sessionId)
  if (error) throw error
  return data
}

export async function recomputeAudit(sessionId: string) {
  const { data, error } = await supabase.rpc('recompute_session_audit', { p_session_id: sessionId })
  if (error) throw error
  return data as { success: boolean; failed?: number; pending?: number; total?: number }
}

export async function getAudits(sessionId: string) {
  const { data, error } = await supabase
    .from('article_audit')
    .select('*')
    .eq('session_id', sessionId)
    .order('status', { ascending: true })
    .order('sku', { ascending: true })
  if (error) throw error
  return data
}

export async function resolveAudit(sessionId: string, sku: string, finalQty: number) {
  const { data, error } = await supabase.rpc('resolve_audit', {
    p_session_id: sessionId,
    p_sku: sku,
    p_final_qty: finalQty,
  })
  if (error) throw error
  return data as { success: boolean; error?: string }
}

export async function getSessionResults(sessionId: string): Promise<SessionResultRow[]> {
  const { data, error } = await supabase.rpc('get_session_results', { p_session_id: sessionId })
  if (error) throw error
  return (data ?? []) as SessionResultRow[]
}

export async function getArticleLabels(skus: string[]) {
  if (skus.length === 0) return {}
  const { data, error } = await supabase
    .from('articles')
    .select('sku, label, brand, ean')
    .in('sku', skus)
  if (error) throw error
  const map: Record<string, { label: string; brand: string; ean: string | null }> = {}
  for (const a of data ?? []) map[a.sku] = { label: a.label, brand: a.brand, ean: a.ean }
  return map
}
