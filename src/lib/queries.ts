import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/types/database.types'

export type Session = Tables<'inventory_sessions'>
export type Article = Tables<'articles'>
export type Count = Tables<'counts'>

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
