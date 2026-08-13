// Accès aux inventaires côté site (superviseur).
//
// Le client Supabase du site n'est pas typé : on déclare ici les formes utiles.
// La sémantique métier est volontairement identique à celle de l'app mobile
// (src/lib/queries.ts) — les deux implémentations sont séparées parce que les
// deux paquets npm le sont (React 18 / React 19, Next / Expo), mais un même
// inventaire doit s'y lire à l'identique.
import { supabase } from '@/lib/supabaseClient'
import { errorMessage } from '@/lib/errors'

export type SessionStatus = 'open' | 'counting' | 'closed'

export type Session = {
  id: string
  inventory_number: string
  name: string
  store_name: string
  store_id: string | null
  status: SessionStatus
  current_pass: number
  uses_zones: boolean
  created_by: string | null
  created_at: string
  closed_at: string | null
  security_code: string | null
}

const SESSION_COLS =
  'id,inventory_number,name,store_name,store_id,status,current_pass,uses_zones,created_by,created_at,closed_at,security_code'

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

/** Une ligne par (article, balise) — la source du « Détail par zone » de l'export. */
export type SessionDetailRow = {
  sku: string
  ean: string | null
  brand: string | null
  label: string | null
  zone: string | null
  zone_name: string | null
  counted_qty: number
  counted_by: string | null
  audited: boolean
  audited_qty: number
  audited_by: string | null
}

export type AuditStatus = 'pending' | 'validated' | 'failed' | 'resolved'

export type ArticleAudit = {
  id: string
  session_id: string
  sku: string
  zone: string
  qty_pass1: number | null
  qty_pass2: number | null
  qty_pass3: number | null
  final_qty: number | null
  status: AuditStatus
  resolved_by: string | null
  updated_at: string
}

export type ArticleLabel = { label: string; brand: string; ean: string | null; price: number }

export type Member = {
  user_id: string
  full_name: string | null
  role: string | null
  session_role: string | null
  joined_at: string | null
}

export type SessionInvitation = {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
}

// `join_code` n'est lisible que par le superviseur affecté (et l'admin), via
// la fonction SECURITY DEFINER `get_my_stores` — la colonne reste révoquée en
// SELECT direct pour `anon` / `authenticated`.
export type Store = { id: string; name: string; join_code?: string | null }

function fail(context: string, error: unknown): never {
  console.error(`[inventory] ${context}`, error)
  throw new Error(errorMessage(error))
}

// ── Inventaires ──────────────────────────────────────────────────────────────

/** Tous les inventaires visibles (RLS : créés par moi, ou où je suis membre). */
export async function getAccessibleSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('inventory_sessions')
    .select(SESSION_COLS)
    .order('created_at', { ascending: false })
  if (error) fail('getAccessibleSessions', error)
  return (data ?? []) as Session[]
}

export async function getMySessions(userId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('inventory_sessions')
    .select(SESSION_COLS)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
  if (error) fail('getMySessions', error)
  return (data ?? []) as Session[]
}

export async function getSession(id: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('inventory_sessions')
    .select(SESSION_COLS)
    .eq('id', id)
    .maybeSingle()
  if (error) fail('getSession', error)
  return (data as Session) ?? null
}

/** Les magasins où j'ai le droit de créer un inventaire. */
export async function getMyStores(): Promise<Store[]> {
  const { data, error } = await supabase.rpc('get_my_stores')
  if (error) fail('getMyStores', error)
  return (data ?? []) as Store[]
}

export async function createSession(
  name: string, storeId: string, securityCode: string, usesZones: boolean,
): Promise<{ success: boolean; session_id?: string; inventory_number?: string; security_code?: string; error?: string }> {
  const { data, error } = await supabase.rpc('create_session', {
    p_name: name, p_store_id: storeId, p_security_code: securityCode, p_uses_zones: usesZones,
  })
  if (error) fail('createSession', error)
  return data as { success: boolean; session_id?: string; error?: string }
}

/**
 * Clôture réelle : le statut passe à `closed`, **les données sont conservées**.
 * Le tableau de bord bascule en lecture seule et le rapport reste
 * téléchargeable. Depuis la migration 20260812000003, les policies d'insertion
 * de `counts` refusent aussi les scans sur un inventaire clôturé — un compteur
 * resté sur son téléphone ne peut plus fausser un rapport déjà exporté.
 *
 * À ne pas confondre avec `deleteSession`, qui efface tout.
 */
export async function closeSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) fail('closeSession', error)
}

/** Réouvre un inventaire clôturé (le comptage peut reprendre). */
export async function reopenSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_sessions')
    .update({ status: 'counting', closed_at: null })
    .eq('id', id)
  if (error) fail('reopenSession', error)
}

/** Suppression définitive : comptages, stock théorique, audits, membres, balises. */
export async function deleteSession(id: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('delete_session', { p_session_id: id })
  if (error) fail('deleteSession', error)
  return data as { success: boolean; error?: string }
}

// ── Progression ──────────────────────────────────────────────────────────────

/**
 * Totaux du mode classique (sans balise).
 * `counts` est un journal append-only où les corrections sont des lignes de
 * quantité négative : on somme `qty`, on ne compte jamais les lignes.
 */
export async function getCountTotals(id: string): Promise<{
  counted: number; audited: number; countedSkus: number; auditedSkus: number
}> {
  const { data, error } = await supabase
    .from('counts')
    .select('qty,pass_number,sku')
    .eq('session_id', id)
  if (error) fail('getCountTotals', error)

  let counted = 0
  let audited = 0
  const countedSkus = new Set<string>()
  const auditedSkus = new Set<string>()
  for (const c of (data ?? []) as { qty: number; pass_number: number; sku: string }[]) {
    if (c.pass_number === 2) { audited += Number(c.qty); auditedSkus.add(c.sku) }
    else if (c.pass_number === 1) { counted += Number(c.qty); countedSkus.add(c.sku) }
  }
  return { counted, audited, countedSkus: countedSkus.size, auditedSkus: auditedSkus.size }
}

/** Ce qui est chargé pour cet inventaire : référentiel et stock théorique. */
export async function getImportState(id: string): Promise<{ articles: number; stock: number }> {
  const [a, s] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('session_id', id),
    supabase.from('theoretical_stock').select('*', { count: 'exact', head: true }).eq('session_id', id),
  ])
  if (a.error) fail('getImportState/articles', a.error)
  if (s.error) fail('getImportState/stock', s.error)
  return { articles: a.count ?? 0, stock: s.count ?? 0 }
}

// ── Résultats et audit ───────────────────────────────────────────────────────

export async function getSessionResults(id: string): Promise<SessionResultRow[]> {
  const { data, error } = await supabase.rpc('get_session_results', { p_session_id: id })
  if (error) fail('getSessionResults', error)
  return (data ?? []) as SessionResultRow[]
}

export async function getSessionDetail(id: string): Promise<SessionDetailRow[]> {
  const { data, error } = await supabase.rpc('get_session_detail', { p_session_id: id })
  if (error) fail('getSessionDetail', error)
  return (data ?? []) as SessionDetailRow[]
}

export async function getAudits(id: string): Promise<ArticleAudit[]> {
  const { data, error } = await supabase
    .from('article_audit')
    .select('id,session_id,sku,zone,qty_pass1,qty_pass2,qty_pass3,final_qty,status,resolved_by,updated_at')
    .eq('session_id', id)
    .order('sku', { ascending: true })
  if (error) fail('getAudits', error)
  return (data ?? []) as ArticleAudit[]
}

const SKU_CHUNK = 200

export async function getArticleLabels(id: string, skus: string[]): Promise<Record<string, ArticleLabel>> {
  const map: Record<string, ArticleLabel> = {}
  if (skus.length === 0) return map

  // Un `.in()` non borné finit par dépasser la longueur d'URL admise dès qu'un
  // inventaire dépasse quelques centaines de références : on découpe.
  for (let i = 0; i < skus.length; i += SKU_CHUNK) {
    const chunk = skus.slice(i, i + SKU_CHUNK)
    const { data, error } = await supabase
      .from('articles')
      .select('sku,label,brand,ean,unit_purchase_price')
      .eq('session_id', id)
      .in('sku', chunk)
    if (error) fail('getArticleLabels', error)
    for (const a of (data ?? []) as { sku: string; label: string; brand: string; ean: string | null; unit_purchase_price: number | null }[]) {
      map[a.sku] = { label: a.label, brand: a.brand, ean: a.ean, price: Number(a.unit_purchase_price ?? 0) }
    }
  }
  return map
}

export async function recomputeAudit(id: string): Promise<void> {
  const { error } = await supabase.rpc('recompute_session_audit', { p_session_id: id })
  if (error) fail('recomputeAudit', error)
}

export async function resolveAudit(id: string, sku: string, finalQty: number, zone = ''): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('resolve_audit', {
    p_session_id: id, p_sku: sku, p_final_qty: finalQty, p_zone: zone,
  })
  if (error) fail('resolveAudit', error)
  return data as { success: boolean; error?: string }
}

export async function deleteAuditLine(id: string, sku: string, zone = ''): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('delete_audit_line', {
    p_session_id: id, p_sku: sku, p_zone: zone,
  })
  if (error) fail('deleteAuditLine', error)
  return data as { success: boolean; error?: string }
}

// ── Équipe ───────────────────────────────────────────────────────────────────

export async function getSessionMembers(id: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('session_members')
    .select('user_id, role, joined_at, profiles(full_name, role)')
    .eq('session_id', id)
  if (error) fail('getSessionMembers', error)

  // Selon l'inférence, l'embed Supabase renvoie `profiles` en objet ou en
  // tableau : on décrit les deux formes plutôt que de couper court à `any`.
  type EmbeddedProfile = { full_name: string | null; role: string | null }
  type MemberRow = {
    user_id: string
    role: string | null
    joined_at: string | null
    profiles: EmbeddedProfile | EmbeddedProfile[] | null
  }

  return ((data ?? []) as unknown as MemberRow[]).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    return {
      user_id: m.user_id,
      full_name: p?.full_name ?? null,
      role: p?.role ?? null,
      session_role: m.role ?? null,
      joined_at: m.joined_at ?? null,
    }
  })
}

export async function getSessionInvitations(id: string): Promise<SessionInvitation[]> {
  const { data, error } = await supabase
    .from('session_invitations')
    .select('id,email,full_name,role,created_at')
    .eq('session_id', id)
    .order('created_at', { ascending: false })
  if (error) fail('getSessionInvitations', error)
  return (data ?? []) as SessionInvitation[]
}

export async function deleteSessionInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.from('session_invitations').delete().eq('id', invitationId)
  if (error) fail('deleteSessionInvitation', error)
}

export async function removeSessionMember(sessionId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('remove_session_member', {
    p_session_id: sessionId, p_user_id: userId,
  })
  if (error) fail('removeSessionMember', error)
  return data as { success: boolean; error?: string }
}

// ── Aides d'affichage ────────────────────────────────────────────────────────

export { fmtQty, fmtSigned, money, parseDecimal, relativeTime, plural } from '@/lib/format'

export const STATUS_LABELS: Record<string, string> = {
  open: 'Ouverte', counting: 'En cours', closed: 'Clôturée',
}

/** Libellés des statuts d'une ligne d'audit — identiques à l'export mobile. */
export const AUDIT_STATUS_LABELS: Record<string, string> = {
  validated: 'Validé', resolved: 'Arbitré', failed: 'Écart de comptage', pending: 'En attente',
}

/** Regroupe des inventaires par magasin, triés par nom de magasin. */
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

/** Quantité retenue d'une ligne d'audit — même précédence que get_session_results. */
export function effectiveQty(a: ArticleAudit): number | null {
  return a.final_qty ?? a.qty_pass2 ?? a.qty_pass1 ?? null
}
