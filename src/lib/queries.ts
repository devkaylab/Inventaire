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

/**
 * Totaux de pièces d'un inventaire — additionnés **sur le serveur**.
 *
 * Remplace un `select` sur `counts` qui rapatriait toutes les lignes de
 * l'inventaire sur le téléphone pour n'en tirer que deux nombres. Sur un vrai
 * inventaire cela fait des milliers de lignes par ouverture d'écran, et le
 * total dépendait du plafond de lignes que l'API peut imposer — il aurait
 * baissé sans rien dire. Même correctif que le site (voir la note « Tenue en
 * charge » d'AGENTS.md) : **ne jamais y remettre un `select` sur `counts`**.
 */
export async function getSessionCountTotals(sessionId: string) {
  const { data, error } = await supabase.rpc('get_session_count_totals', { p_session_id: sessionId })
  if (error) throwSupabase('getSessionCountTotals', error)
  const row = (Array.isArray(data) ? data[0] : data) as
    { counted?: number; audited?: number; counted_skus?: number; audited_skus?: number } | null
  return {
    counted: Number(row?.counted ?? 0),
    audited: Number(row?.audited ?? 0),
    countedSkus: Number(row?.counted_skus ?? 0),
    auditedSkus: Number(row?.audited_skus ?? 0),
  }
}

/**
 * Ce que **cette personne** a compté, additionné sur le serveur.
 *
 * `getMyCounts` ne filtre pas sur l'utilisateur : c'est la policy
 * `counts_select_own` qui limite un compteur à ses lignes. Un superviseur, lui,
 * verrait toute l'équipe — et l'écran présente ce nombre comme son travail à
 * lui. La fonction, elle, ne compte que `auth.uid()` quel que soit le rôle.
 */
export async function getMyCountTotals(sessionId: string) {
  const { data, error } = await supabase.rpc('get_my_count_totals', { p_session_id: sessionId })
  if (error) throwSupabase('getMyCountTotals', error)
  const row = (Array.isArray(data) ? data[0] : data) as { counted?: number; audited?: number } | null
  return { counted: Number(row?.counted ?? 0), audited: Number(row?.audited ?? 0) }
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

export async function createSession(name: string, storeId: string, securityCode: string, usesZones: boolean) {
  const { data, error } = await supabase.rpc('create_session', {
    p_name: name,
    p_store_id: storeId,
    p_security_code: securityCode,
    p_uses_zones: usesZones,
  })
  if (error) throwSupabase('createSession', error)
  return data as { success: boolean; session_id?: string; inventory_number?: string; name?: string; store_name?: string; security_code?: string; error?: string }
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

export type Profile = Tables<'profiles'>
export type Company = Tables<'companies'>

/** L'entreprise du superviseur courant. RLS (companies_member_select) ne
 *  renvoie que sa propre entreprise → une seule ligne au plus.
 *  Colonnes explicites : le code entreprise (join_code) est confidentiel (admin only)
 *  et n'est pas lisible avec la clé publique. */
export async function getMyCompany(): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, created_at')
    .limit(1)
    .maybeSingle()
  if (error) throwSupabase('getMyCompany', error)
  return (data as unknown as Company) ?? null
}

export type Store = Tables<'stores'>

/** Les magasins de l'entreprise courante. RLS ne renvoie que ceux du membre ;
 *  le code magasin (join_code) est confidentiel (admin only) et exclu. */
export async function getStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, company_id, name, created_at')
    .order('name', { ascending: true })
  if (error) throwSupabase('getStores', error)
  return (data ?? []) as unknown as Store[]
}

/**
 * ⚠️ Hors service côté client depuis la migration 20260813000005.
 *
 * L'auto-affectation par saisie du code magasin allait à l'envers du parcours
 * retenu : le code accompagne désormais la *demande* d'accès déposée sur le
 * site, et c'est la validation Quantinvo qui affecte au magasin. `join_store`
 * a donc été révoquée au rôle `authenticated` — l'appeler remonte un 42501.
 *
 * Conservée pour le back-office (`service_role`).
 */
export async function joinStore(code: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('join_store', { p_code: code.trim() })
  if (error) throwSupabase('joinStore', error)
  return data as {
    success: boolean
    store_id?: string
    store_name?: string
    company_id?: string
    company_name?: string
    error?: string
  }
}

/** Les magasins auxquels le superviseur courant est affecté (RPC get_my_stores).
 *  Repli sur getStores() si la migration « magasin assigné » n'est pas encore
 *  appliquée (fonction absente) — la création reste bloquée côté serveur. */
export async function getMyAssignedStores(): Promise<Store[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_my_stores')
  if (error) return getStores()
  return (data ?? []) as Store[]
}

export type DeletionRequest = Tables<'account_deletion_requests'>

/** Demande de suppression de compte en attente pour l'utilisateur courant (ou null). */
export async function getMyDeletionRequest(): Promise<DeletionRequest | null> {
  const { data, error } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()
  if (error) throwSupabase('getMyDeletionRequest', error)
  return data
}

/** L'utilisateur courant demande la suppression de son compte. La demande est
 *  transmise à l'administrateur, qui la traite. */
export async function requestAccountDeletion() {
  const { data, error } = await supabase.rpc('request_account_deletion')
  if (error) throwSupabase('requestAccountDeletion', error)
  return data as { success: boolean; already?: boolean; error?: string }
}

/** Pré-inscrit un membre : le superviseur ajoute son e-mail à l'équipe.
 *  L'employé pourra ensuite créer son compte lui-même. RLS restreint
 *  l'insertion à l'entreprise du superviseur. */
export async function createInvitation(input: { fullName: string; email: string; companyId: string }) {
  const { error } = await supabase.from('team_invitations').insert({
    company_id: input.companyId,
    email: input.email.trim().toLowerCase(),
    full_name: input.fullName.trim(),
    created_by: (await supabase.auth.getUser()).data.user!.id,
  })
  if (error) throwSupabase('createInvitation', error)
}

/** Ajoute un membre (compteur) à l'équipe : pré-inscrit l'e-mail et lui envoie
 *  un e-mail pour finaliser son compte. Passe par l'edge function invite-teammate. */
/**
 * Pré-inscrit un compteur dans l'équipe.
 *
 * `storeIds` vide signifie « tous les magasins du superviseur » : c'est le
 * comportement historique, conservé pour un superviseur mono-magasin, où le
 * choix n'aurait aucun sens. Le serveur revérifie que les magasins choisis
 * sont bien les siens.
 */
export async function inviteTeammate(input: {
  firstName: string
  lastName: string
  email: string
  storeIds?: string[]
}) {
  const { data, error } = await supabase.functions.invoke('invite-teammate', {
    body: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      storeIds: input.storeIds ?? [],
    },
  })
  if (error) throwSupabase('inviteTeammate', error)
  const res = data as {
    success: boolean
    emailSent?: boolean
    alreadyInvited?: boolean
    emailError?: string
    error?: string
    code?: string
  }
  if (!res.success) {
    // Le code voyage avec l'erreur : sans lui, l'écran ne peut que titrer
    // « Erreur » et recopier le texte. Certaines réponses ne sont pas des
    // fautes de saisie — un compte qui appartient à une autre entreprise, par
    // exemple — et se présentent autrement.
    const err = new Error(res.error ?? "Échec de l'ajout") as Error & { code?: string }
    err.code = res.code
    throw err
  }
  return res
}

/** Annule une invitation en attente. */
/**
 * Annule une invitation qu'on a soi-même émise.
 *
 * Passe par `cancel_my_invitation`, comme la page « Mon équipe » du site : la
 * fonction porte la garde côté serveur. Un DELETE nu sur la table dépendait
 * d'une policy dont rien ne garantit qu'elle couvre ce cas.
 */
/**
 * Retire un compteur d'**un** magasin, pas de tous.
 *
 * Une même personne peut compter dans plusieurs magasins, supervisés par des
 * personnes différentes : la retirer partout d'un seul geste ferait disparaître
 * quelqu'un de l'équipe d'un collègue. La RPC vérifie côté serveur que le
 * magasin est bien le sien, et refuse qu'on se retire soi-même.
 */
export async function removeCounterFromStore(userId: string, storeId: string) {
  const { data, error } = await supabase.rpc('remove_counter_from_store', {
    p_user: userId,
    p_store_id: storeId,
  })
  if (error) throwSupabase('removeCounterFromStore', error)
  const result = data as { success?: boolean; error?: string } | null
  if (result && result.success === false) {
    throwSupabase('removeCounterFromStore', new Error(result.error ?? 'Retrait impossible.'))
  }
}

export async function cancelMyInvitation(id: string) {
  const { data, error } = await supabase.rpc('cancel_my_invitation', { p_id: id })
  if (error) throwSupabase('cancelMyInvitation', error)
  const r = data as { success?: boolean; error?: string } | null
  if (r && r.success === false) throw new Error(r.error ?? "Annulation impossible.")
}

/**
 * ⚠️ Plus appelée : l'inscription depuis l'app a disparu.
 *
 * Elle servait de garde côté client avant `signUp` — le compteur devait
 * prouver qu'il avait été pré-inscrit. Depuis le passage au lien magique, son
 * compte auth est créé par `invite-teammate` et il ne s'inscrit plus : il
 * vérifie ses informations et choisit son mot de passe sur `/bienvenue`.
 *
 * La RPC reste en base, sans danger (elle ne renvoie qu'un booléen).
 */
export async function checkInvitation(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_invitation', { p_email: email.trim().toLowerCase() })
  if (error) throwSupabase('checkInvitation', error)
  return data === true
}

export type SessionInvitation = Tables<'session_invitations'>
export type SessionRole = 'supervisor' | 'counter'

/** Enregistre (ou met à jour) un jeton de notification push pour l'utilisateur courant. */
export async function registerPushToken(token: string, platform: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: user.id, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' })
  if (error) console.error('[queries] registerPushToken', error)
}

/** Invite une personne (par nom + e-mail) à un inventaire précis, avec un rôle.
 *  Passe par l'edge function invite-to-session (ajout membre ou invitation en
 *  attente + e-mail + push). */
export async function inviteToSession(input: {
  sessionId: string
  fullName: string
  email: string
  role: SessionRole
}) {
  const { data, error } = await supabase.functions.invoke('invite-to-session', {
    body: {
      sessionId: input.sessionId,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
    },
  })
  if (error) throwSupabase('inviteToSession', error)
  const result = data as { success: boolean; outcome?: 'added' | 'invited'; emailSent?: boolean; pushSent?: boolean; error?: string }
  if (!result.success) throwSupabase('inviteToSession', new Error(result.error ?? "Échec de l'invitation"))
  return result
}

/** Invitations en attente pour un inventaire (personnes pas encore inscrites). */
export async function getSessionInvitations(sessionId: string): Promise<SessionInvitation[]> {
  const { data, error } = await supabase
    .from('session_invitations')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
  if (error) throwSupabase('getSessionInvitations', error)
  return data ?? []
}

/** Annule une invitation en attente sur un inventaire. */
export async function deleteSessionInvitation(id: string) {
  const { error } = await supabase.from('session_invitations').delete().eq('id', id)
  if (error) throwSupabase('deleteSessionInvitation', error)
}

/** Retire un membre déjà présent d'un inventaire (réservé au superviseur ;
 *  impossible de retirer le créateur). Les comptages/audits sont conservés. */
export async function removeSessionMember(sessionId: string, userId: string) {
  const { data, error } = await supabase.rpc('remove_session_member', {
    p_session_id: sessionId,
    p_user_id: userId,
  })
  if (error) throwSupabase('removeSessionMember', error)
  const res = data as { success: boolean; error?: string }
  if (!res.success) throwSupabase('removeSessionMember', new Error(res.error ?? 'Échec du retrait'))
}

/** L'utilisateur courant quitte un inventaire (sans supprimer ses comptages/audits). */
export async function leaveSession(sessionId: string) {
  const { data, error } = await supabase.rpc('leave_session', { p_session_id: sessionId })
  if (error) throwSupabase('leaveSession', error)
  const res = data as { success: boolean; error?: string }
  if (!res.success) throwSupabase('leaveSession', new Error(res.error ?? 'Échec'))
}

export type DirectoryEntry = { user_id: string; full_name: string; email: string; role: string }

/** Annuaire des membres de l'entreprise (nom + e-mail) pour la recherche à l'invitation. */
export async function getCompanyDirectory(): Promise<DirectoryEntry[]> {
  const { data, error } = await supabase.rpc('get_company_directory')
  if (error) throwSupabase('getCompanyDirectory', error)
  return (data ?? []) as DirectoryEntry[]
}

/** Annuaire d'un magasin : superviseurs affectés + compteurs de l'équipe du magasin.
 *  Sert à l'invitation à un inventaire (membres existants, même magasin). */
export async function getStoreDirectory(storeId: string): Promise<DirectoryEntry[]> {
  const { data, error } = await supabase.rpc('get_store_directory', { p_store_id: storeId })
  if (error) throwSupabase('getStoreDirectory', error)
  return (data ?? []) as DirectoryEntry[]
}

export async function joinSession(inventoryNumber: string, securityCode: string) {
  const { data, error } = await supabase.rpc('join_session', {
    p_inventory_number: inventoryNumber,
    p_security_code: securityCode,
  })
  if (error) throwSupabase('joinSession', error)
  return data as { success: boolean; session_id?: string; store_name?: string; status?: string; current_pass?: number; error?: string }
}

/**
 * ⚠️ Hors service côté client depuis la migration 20260813000002.
 *
 * `advance_pass` et `revert_pass` viennent du modèle « la passe est un état
 * global de la session ». Ce modèle n'existe plus : chaque participant choisit
 * son mode (Comptage→1, Audit→2) et `current_pass` n'est plus lu nulle part.
 * Aucun écran n'appelle ces deux fonctions.
 *
 * L'exécution a été retirée au rôle `authenticated` : elles sont SECURITY
 * DEFINER et forçaient `status = 'counting'`, ce qui permettait à un simple
 * compteur de rouvrir un inventaire clôturé — contournant la RLS qui réserve
 * cet UPDATE aux superviseurs participants.
 *
 * Les appeler remonte donc désormais un 42501. Si les passes globales
 * reviennent, il faudra rendre le GRANT **et** ajouter la garde
 * `status <> 'closed'` dans les deux fonctions.
 */
export async function advancePass(sessionId: string) {
  const { data, error } = await supabase.rpc('advance_pass', { p_session_id: sessionId })
  if (error) throwSupabase('advancePass', error)
  return data as { success: boolean; current_pass?: number; error?: string }
}

// Voir l'avertissement sur advancePass : hors service côté client (42501).
// Reculait d'une passe (ex. Audit -> Compte) ; deleteCounts effaçait les
// comptages de la passe quittée.
export async function revertPass(sessionId: string, deleteCounts: boolean) {
  const { data, error } = await supabase.rpc('revert_pass', {
    p_session_id: sessionId,
    p_delete_counts: deleteCounts,
  })
  if (error) throwSupabase('revertPass', error)
  return data as { success: boolean; current_pass?: number; error?: string }
}

/**
 * Clôture réelle : l'inventaire passe en lecture seule, **les données restent**.
 *
 * Auparavant « Clôturer » appelait `delete_session` et effaçait tout : le
 * statut `closed` n'était donc jamais atteint, et il fallait exporter le rapport
 * avant de clôturer sous peine de tout perdre. Depuis la migration
 * 20260812000003, les policies d'insertion de `counts` refusent les scans sur un
 * inventaire clôturé — un compteur resté sur son téléphone ne peut plus fausser
 * un rapport déjà exporté.
 */
export async function closeSession(sessionId: string) {
  const { error } = await supabase
    .from('inventory_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throwSupabase('closeSession', error)
}

/** Réouvre un inventaire clôturé : le comptage peut reprendre. */
export async function reopenSession(sessionId: string) {
  const { error } = await supabase
    .from('inventory_sessions')
    .update({ status: 'counting', closed_at: null })
    .eq('id', sessionId)
  if (error) throwSupabase('reopenSession', error)
}

/**
 * Suppression définitive de l'inventaire et de toutes ses données.
 *
 * Passe par une fonction SECURITY DEFINER côté serveur, qui contourne RLS :
 * c'est ce qui garantit que toutes les lignes (comptages, stock théorique,
 * audits, membres, référentiel, session) partent réellement.
 */
export async function deleteSessionPermanently(sessionId: string) {
  const { data, error } = await supabase.rpc('delete_session', { p_session_id: sessionId })
  if (error) throwSupabase('deleteSessionPermanently', error)
  const result = data as unknown as { success: boolean; error?: string }
  if (!result.success) throwSupabase('deleteSessionPermanently', new Error(result.error ?? 'Échec de la suppression'))
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

export async function resolveAudit(sessionId: string, sku: string, finalQty: number, zone = '') {
  const { data, error } = await supabase.rpc('resolve_audit', {
    p_session_id: sessionId,
    p_sku: sku,
    p_final_qty: finalQty,
    p_zone: zone,
  })
  if (error) throwSupabase('resolveAudit', error)
  return data as { success: boolean; error?: string }
}

export async function deleteAuditLine(sessionId: string, sku: string, zone = '') {
  const { data, error } = await supabase.rpc('delete_audit_line', {
    p_session_id: sessionId,
    p_sku: sku,
    p_zone: zone,
  })
  if (error) throwSupabase('deleteAuditLine', error)
  return data as { success: boolean; error?: string }
}

export async function getSessionResults(sessionId: string): Promise<SessionResultRow[]> {
  const { data, error } = await supabase.rpc('get_session_results', { p_session_id: sessionId })
  if (error) throwSupabase('getSessionResults', error)
  return (data ?? []) as SessionResultRow[]
}

/** Détail par (article, balise) — non sommé entre zones — pour l'onglet « Détail par zone ».
 *  Compté par / Audité par = identités des scanneurs (passe 1 / passe 2). */
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

export async function getSessionDetail(sessionId: string): Promise<SessionDetailRow[]> {
  const { data, error } = await supabase.rpc('get_session_detail', { p_session_id: sessionId })
  if (error) throwSupabase('getSessionDetail', error)
  return (data ?? []) as SessionDetailRow[]
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
  zone?: string | null,
): Promise<ScanEntrySeed[]> {
  // En mode zones, on reconstruit la liste de la BALISE (tous compteurs confondus)
  // pour permettre la correction ; sinon la liste du compteur (mode classique).
  let q = supabase
    .from('counts')
    .select('sku, qty, created_at')
    .eq('session_id', sessionId)
    .eq('pass_number', passNumber)
  q = zone != null ? q.eq('zone', zone) : q.eq('counted_by', countedBy)
  const { data, error } = await q
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

/**
 * Tout le référentiel d'un inventaire, pour la mise en cache hors ligne.
 *
 * Pagination obligatoire : PostgREST plafonne une réponse à 1000 lignes, et un
 * inventaire de magasin en compte couramment plusieurs milliers. Sans les
 * `range`, le cache se remplirait silencieusement à moitié — et le compteur
 * verrait « article inconnu » en réserve sur tout ce qui dépasse.
 */
export async function getSessionArticles(sessionId: string): Promise<Article[]> {
  const PAGE = 1000
  const out: Article[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('session_id', sessionId)
      .order('sku', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throwSupabase('getSessionArticles', error)
    const page = data ?? []
    out.push(...page)
    if (page.length < PAGE) return out
  }
}

export async function getArticleLabels(sessionId: string, skus: string[]) {
  if (skus.length === 0) return {}
  const { data, error } = await supabase
    .from('articles')
    .select('sku, label, brand, ean, unit_purchase_price')
    .eq('session_id', sessionId)
    .in('sku', skus)
  if (error) throwSupabase('getArticleLabels', error)
  const map: Record<string, { label: string; brand: string; ean: string | null; price: number }> = {}
  for (const a of data ?? []) map[a.sku] = { label: a.label, brand: a.brand, ean: a.ean, price: Number(a.unit_purchase_price ?? 0) }
  return map
}

// ── Zones & balises ────────────────────────────────────────────────────────

export type Zone = Tables<'zones'>
export type BaliseMode = 'count' | 'audit'

/** Une balise du dashboard : statut compte/audit + volumes comptés/audités. */
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

/** Toutes les balises d'une session (RLS : superviseur de la compagnie ou membre). */
export async function getZones(sessionId: string): Promise<Zone[]> {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .eq('session_id', sessionId)
    .order('code', { ascending: true })
  if (error) throwSupabase('getZones', error)
  return data ?? []
}

/** Définit une plage de balises rattachées à une zone nommée (ex. « réserve Beauté » 12341→12349). */
export async function defineZoneRange(sessionId: string, name: string, start: number, end: number) {
  const { data, error } = await supabase.rpc('define_zone', {
    p_session_id: sessionId,
    p_name: name,
    p_code_start: start,
    p_code_end: end,
  })
  if (error) throwSupabase('defineZoneRange', error)
  return data as { success: boolean; created?: number; name?: string; error?: string }
}

/** Supprime toutes les balises d'une zone nommée. */
export async function deleteZone(sessionId: string, name: string) {
  const { data, error } = await supabase.rpc('delete_zone', {
    p_session_id: sessionId,
    p_name: name,
  })
  if (error) throwSupabase('deleteZone', error)
  return data as { success: boolean; deleted?: number; error?: string }
}

/** Scan d'une balise : ouvre (open=true) ou clôture (open=false) pour le mode donné.
 *  allowCreate : crée la balise si elle est inconnue lors de l'ouverture. */
export async function setBalise(
  sessionId: string, code: string, mode: BaliseMode, open: boolean, allowCreate = false
) {
  const { data, error } = await supabase.rpc('set_balise', {
    p_session_id: sessionId,
    p_code: code,
    p_mode: mode,
    p_open: open,
    p_allow_create: allowCreate,
  })
  if (error) throwSupabase('setBalise', error)
  return data as {
    success: boolean
    code?: string
    name?: string | null
    mode?: BaliseMode
    status?: 'open' | 'done'
    error?: string
  }
}

/** Avancement par balise (compte & audit) pour le dashboard superviseur. */
export async function getZoneDashboard(sessionId: string): Promise<ZoneDashboardRow[]> {
  const { data, error } = await supabase.rpc('get_zone_dashboard', { p_session_id: sessionId })
  if (error) throwSupabase('getZoneDashboard', error)
  return (data ?? []) as ZoneDashboardRow[]
}


// ─── Mon compte ──────────────────────────────────────────────────────────────
// Ce que la personne peut faire sur elle-même. Le trigger
// `profiles_pin_privileged` fige `role`, `company_id` et `is_admin` : seuls le
// prénom et le nom sont modifiables ici, et c'est voulu.

/**
 * Corrige son nom. Un seul champ, découpé comme sur le site (premier mot =
 * prénom, le reste = nom) : les deux moitiés doivent rester d'accord, sinon
 * l'équipe et les invitations affichent un nom et le profil un autre.
 */
export async function updateMyName(userId: string, fullName: string) {
  const propre = fullName.trim().replace(/\s+/g, ' ')
  const morceaux = propre.split(' ')
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: propre,
      first_name: morceaux[0],
      last_name: morceaux.length > 1 ? morceaux.slice(1).join(' ') : '',
    })
    .eq('id', userId)
  if (error) throwSupabase('updateMyName', error)
}

/**
 * Droit d'accès et de portabilité (articles 15 et 20 du RGPD).
 *
 * La base assemble l'export ; l'app n'en fait qu'un fichier. Aucun code
 * d'accès n'y figure et le détail des comptages n'y est que résumé —
 * l'employeur en est responsable de traitement, l'export le dit lui-même.
 */
export async function exportMyData(): Promise<unknown> {
  const { data, error } = await supabase.rpc('export_my_data')
  if (error) throwSupabase('exportMyData', error)
  return data
}

// ─── Mon équipe ──────────────────────────────────────────────────────────────

export type TeamCounter = {
  id: string
  full_name: string | null
  email: string | null
  is_active: boolean
  sessions_counted: number
  last_count_at: string | null
}
export type TeamStore = { id: string; name: string; counters: TeamCounter[] }

/**
 * Invitation telle que la rend `my_team_by_store` — et non la ligne de table :
 * la RPC ne renvoie ni `full_name`, ni `role`, ni `store_ids`. S'appuyer sur
 * le type de la table ferait afficher un nom toujours vide.
 */
export type TeamInvite = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
}
export type TeamByStore = { stores: TeamStore[]; invitations: TeamInvite[] }

/**
 * L'équipe du superviseur, rangée par magasin — la même RPC que la page
 * « Mon équipe » du site. Deux écrans qui montrent la même chose doivent la
 * demander de la même façon, sinon ils finissent par ne plus dire pareil.
 */
export async function getMyTeamByStore(): Promise<TeamByStore> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('my_team_by_store')
  if (error) throwSupabase('getMyTeamByStore', error)
  const r = (data ?? {}) as Partial<TeamByStore>
  return { stores: r.stores ?? [], invitations: r.invitations ?? [] }
}
