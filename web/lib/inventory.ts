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
 * Totaux de l'inventaire : quatre nombres, calculés **par le serveur**.
 *
 * `counts` est un journal append-only où les corrections sont des lignes de
 * quantité négative : on somme `qty`, on ne compte jamais les lignes. Les
 * références sont comptées en distinct — un SKU scanné vingt fois reste une
 * référence.
 *
 * ⚠️ Ne jamais revenir à un `select` sur `counts` ici. La version d'origine
 * téléchargeait toutes les lignes de comptage de l'inventaire pour les
 * additionner dans le navigateur, et cette fonction est rejouée **toutes les
 * huit secondes** par chaque tableau de bord ouvert (`refreshLive`). À cent
 * compteurs sur un magasin, cela fait des centaines de milliers de lignes
 * transférées par sondage : c'est ce qui empêchait le produit de tenir un gros
 * inventaire, bien avant que Postgres ne peine à écrire les scans.
 * Voir la migration 20260821240001. Un test garde ce choix.
 */
export async function getCountTotals(id: string): Promise<{
  counted: number; audited: number; countedSkus: number; auditedSkus: number
}> {
  const { data, error } = await supabase.rpc('get_session_count_totals', { p_session_id: id })
  if (error) fail('getCountTotals', error)

  // La fonction renvoie une table d'une seule ligne : PostgREST la rend sous
  // forme de tableau. Un inventaire sans aucun scan renvoie bien une ligne de
  // zéros — mais on se protège du tableau vide plutôt que de le supposer.
  const row = (Array.isArray(data) ? data[0] : data) as {
    counted: number | string | null
    audited: number | string | null
    counted_skus: number | string | null
    audited_skus: number | string | null
  } | undefined

  return {
    counted: Number(row?.counted ?? 0),
    audited: Number(row?.audited ?? 0),
    countedSkus: Number(row?.counted_skus ?? 0),
    auditedSkus: Number(row?.audited_skus ?? 0),
  }
}

/** Ce qui est chargé pour cet inventaire : référentiel et stock théorique. */
export type ImportState = {
  /** Lignes du référentiel articles. */
  articles: number
  /** Lignes de stock théorique (SKU portant une quantité attendue). */
  stock: number
  /** Somme des quantités attendues — 0 si aucun stock théorique importé. */
  theoreticalQty: number
}

/**
 * ⚠️ UN SEUL APPEL, ET IL COMPTE EN BASE — ne jamais y remettre de `count:
 * 'exact'` sur `articles` ou `theoretical_stock`.
 *
 * Ces deux comptages étaient des requêtes HEAD à PostgREST. La policy
 * `articles_supervisor` porte `is_session_participant(session_id)`, qui prend
 * la colonne de la LIGNE : Postgres l'évalue une fois par ligne. Sur
 * l'inventaire « HV » (29 382 articles) le comptage demandait 11,7 s, donc
 * dépassait le délai serveur — et comme cette fonction est jouée à CHAQUE
 * ouverture du tableau de bord, l'onglet Set up tombait en erreur avant même
 * qu'on importe quoi que ce soit (3 septembre 2026).
 *
 * `etat_import` contrôle le droit UNE fois puis compte hors RLS : 24 ms pour
 * les trois chiffres. C'est le motif de `get_session_count_totals`, pour la
 * même raison.
 */
export async function getImportState(id: string): Promise<ImportState> {
  const { data, error } = await supabase.rpc('etat_import', { p_session_id: id })
  if (error) fail('getImportState', error)
  const row = Array.isArray(data) ? data[0] : data
  return {
    articles: Number(row?.articles ?? 0),
    stock: Number(row?.stock ?? 0),
    theoreticalQty: Number(row?.theorique ?? 0),
  }
}

/**
 * Démarre le comptage : l'inventaire passe de « Ouverte » à « En cours ».
 *
 * Purement déclaratif — rien n'empêche techniquement de scanner avant. Le
 * statut sert de repère partagé : l'équipe sait que la préparation est finie
 * et que les fichiers ne bougeront plus.
 */
export async function startSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_sessions')
    .update({ status: 'counting' })
    .eq('id', id)
  if (error) fail('startSession', error)
}

// ── Résultats et audit ───────────────────────────────────────────────────────

/**
 * Le rapport se lit PAR PAGES (3 septembre 2026).
 *
 * ⚠️ `get_session_results` et `get_session_detail` rendaient toutes les lignes
 * d'un coup — 400 000 sur un gros inventaire, des dizaines de mégaoctets, et
 * un navigateur qui calculait ensuite totaux, recherche et tri sur place.
 * Mesuré à 6,3 s côté serveur, et l'écran ne s'ouvrait plus du tout au-delà.
 *
 * Ne pas revenir à un appel qui rend tout : ce qui change ici n'est pas la
 * vitesse d'affichage, c'est le fait que l'écran s'ouvre.
 */

/** Le tri accepté par le serveur. Toute autre valeur y est ignorée. */
export type RapportTri =
  | 'sku' | 'label' | 'status'
  | 'theoretical_qty' | 'counted_qty' | 'variance_units' | 'variance_value'

export type RapportResume = {
  lignes: number
  theorique: number
  compte: number
  ecart_unites: number
  ecart_valeur: number
  non_arbitres: number
}

/**
 * Les totaux affichés en tuiles.
 *
 * ⚠️ Ils portent sur l'inventaire ENTIER, pas sur la page ni sur la recherche.
 * C'est ce que l'écran montrait déjà quand il chargeait tout ; un total qui
 * suivrait la page ne voudrait rien dire.
 */
export async function getRapportResume(id: string): Promise<RapportResume> {
  const { data, error } = await supabase.rpc('rapport_resume', { p_session_id: id })
  if (error) fail('getRapportResume', error)
  const r = (data ?? [])[0]
  return {
    lignes: Number(r?.lignes ?? 0),
    theorique: Number(r?.theorique ?? 0),
    compte: Number(r?.compte ?? 0),
    ecart_unites: Number(r?.ecart_unites ?? 0),
    ecart_valeur: Number(r?.ecart_valeur ?? 0),
    non_arbitres: Number(r?.non_arbitres ?? 0),
  }
}

/** Une page du rapport, plus le nombre de lignes que la recherche retient. */
export async function getRapportPage(id: string, opts: {
  recherche?: string
  tri?: RapportTri
  sens?: 'asc' | 'desc'
  offset?: number
  limite?: number
}): Promise<{ rows: SessionResultRow[]; total: number }> {
  const { data, error } = await supabase.rpc('rapport_page', {
    p_session_id: id,
    p_recherche: opts.recherche?.trim() || null,
    p_tri: opts.tri ?? 'variance_value',
    p_sens: opts.sens ?? 'desc',
    p_offset: opts.offset ?? 0,
    p_limite: opts.limite ?? 50,
  })
  if (error) fail('getRapportPage', error)
  const rows = (data ?? []) as (SessionResultRow & { total: number })[]
  return { rows: rows as SessionResultRow[], total: Number(rows[0]?.total ?? 0) }
}

/**
 * Parcourt toutes les pages et rend l'ensemble — POUR L'EXPORT SEULEMENT.
 *
 * ⚠️ Le fichier remis au client doit être COMPLET : c'est le seul endroit du
 * site où l'on veut encore tout. La différence avec avant est qu'on le
 * demande par tranches, au lieu d'exiger 400 000 lignes en une réponse que le
 * serveur ne peut pas rendre dans le temps qui lui est accordé.
 *
 * `onAvance` sert à dire où on en est : à cette taille, l'attente se compte en
 * dizaines de secondes, et un bouton qui tourne sans rien dire inquiète.
 */
async function toutesLesPages<T>(
  page: (offset: number) => Promise<{ rows: T[]; total: number }>,
  taille: number,
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
    // On s'arrête sur une page incomplète : c'est la dernière. Le garde-fou
    // sur `total` évite une boucle sans fin si le serveur changeait d'avis.
    if (r.rows.length < taille || tout.length >= total) break
    offset += taille
  }
  return tout
}

const TAILLE_EXPORT = 5000

export async function getAllRapportRows(
  id: string, onAvance?: (fait: number, total: number) => void,
): Promise<SessionResultRow[]> {
  return toutesLesPages(
    (offset) => getRapportPage(id, { tri: 'sku', sens: 'asc', offset, limite: TAILLE_EXPORT }),
    TAILLE_EXPORT, onAvance,
  )
}

export async function getSessionDetail(
  id: string, onAvance?: (fait: number, total: number) => void,
): Promise<SessionDetailRow[]> {
  return toutesLesPages(async (offset) => {
    const { data, error } = await supabase.rpc('rapport_detail_page', {
      p_session_id: id, p_offset: offset, p_limite: TAILLE_EXPORT,
    })
    if (error) fail('getSessionDetail', error)
    const rows = (data ?? []) as (SessionDetailRow & { total: number })[]
    return { rows: rows as SessionDetailRow[], total: Number(rows[0]?.total ?? 0) }
  }, TAILLE_EXPORT, onAvance)
}

/**
 * Les écarts d'audit d'un inventaire, LIBELLÉS COMPRIS, en un seul appel.
 *
 * ⚠️ Remplace deux lectures directes qui ne tenaient pas la taille, et il faut
 * les deux raisons pour comprendre pourquoi cette fonction existe :
 *
 * 1. `article_audit` porte une policy dont le garde s'évalue **une fois par
 *    ligne** (0,44 ms mesurés) : lire toute la table d'un inventaire de
 *    30 000 références dépassait les 8 s du délai serveur.
 * 2. Les libellés se chargeaient par tranches de 200 SKU — la longueur d'URL
 *    admise ne permet pas mieux — soit **150 requêtes en série** sur un gros
 *    catalogue.
 *
 * `lister_ecarts` est `SECURITY DEFINER` : le droit se contrôle une fois, la
 * jointure se fait en base. Mesuré à 190 ms sur 29 389 références.
 *
 * Ne pas revenir à un `.from('article_audit')` ni à un `.in('sku', …)` découpé.
 */
export async function getEcarts(id: string): Promise<{
  audits: ArticleAudit[]
  labels: Record<string, ArticleLabel>
}> {
  const { data, error } = await supabase.rpc('lister_ecarts', { p_session_id: id })
  if (error) fail('getEcarts', error)

  const rows = (data ?? []) as (ArticleAudit & {
    label: string | null
    brand: string | null
    ean: string | null
    unit_purchase_price: number | null
  })[]

  const audits: ArticleAudit[] = []
  const labels: Record<string, ArticleLabel> = {}
  for (const r of rows) {
    audits.push({
      id: r.id, session_id: r.session_id, sku: r.sku, zone: r.zone,
      qty_pass1: r.qty_pass1, qty_pass2: r.qty_pass2, qty_pass3: r.qty_pass3,
      final_qty: r.final_qty, status: r.status,
      resolved_by: r.resolved_by, updated_at: r.updated_at,
    })
    // La jointure est externe : un article supprimé du référentiel depuis le
    // comptage garde sa ligne d'écart, sans libellé.
    if (r.label !== null) {
      labels[r.sku] = {
        label: r.label, brand: r.brand ?? '', ean: r.ean,
        price: Number(r.unit_purchase_price ?? 0),
      }
    }
  }
  return { audits, labels }
}

/**
 * Recalcule les écarts d'un inventaire.
 *
 * ⚠️ `force` n'est PAS une commodité : sans comptage nouveau, la fonction sait
 * qu'elle n'a rien à refaire et rend ses totaux en quelques millisecondes — ce
 * qui est ce qui rend un inventaire de 400 000 références utilisable. Mais
 * l'annulation d'un arbitrage écrit DIRECTEMENT dans `article_audit` sans
 * toucher aux comptages : le raccourci ne verrait rien bouger, et la ligne
 * resterait « à traiter » au lieu de retrouver son vrai statut. C'est le seul
 * appelant qui doit forcer.
 */
export async function recomputeAudit(id: string, force = false): Promise<void> {
  const { error } = await supabase.rpc('recompute_session_audit', {
    p_session_id: id, p_force: force,
  })
  if (error) fail('recomputeAudit', error)
}

export async function resolveAudit(id: string, sku: string, finalQty: number, zone = ''): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('resolve_audit', {
    p_session_id: id, p_sku: sku, p_final_qty: finalQty, p_zone: zone,
  })
  if (error) fail('resolveAudit', error)
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

/**
 * Libellés des statuts d'une ligne du rapport — identiques à l'export mobile.
 *
 * `uncounted` n'est pas un statut d'audit : c'est un article **attendu au
 * stock théorique et jamais scanné**. Il n'a donc aucune ligne d'audit, et ne
 * peut pas porter l'un des quatre autres statuts. Il n'entre pas non plus dans
 * le décompte « articles présentant encore un écart », qui ne vise que les
 * écarts d'audit.
 */
export const AUDIT_STATUS_LABELS: Record<string, string> = {
  validated: 'Validé', resolved: 'Arbitré', failed: 'Écart de comptage', pending: 'En attente',
  uncounted: 'Non compté',
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

// ── Ajouter quelqu'un à un inventaire ────────────────────────────────────────

export type DirectoryEntry = { user_id: string; full_name: string; email: string; role: string }
export type SessionRole = 'counter' | 'supervisor'

/**
 * L'équipe du magasin : les personnes qui ont déjà un compte et qu'on peut
 * ajouter à un inventaire de ce magasin.
 *
 * Ajouter quelqu'un à un inventaire n'est pas créer un compte. Créer un compte
 * se fait depuis « Mon équipe » ; ici on choisit parmi ceux qui existent.
 */
export async function getStoreDirectory(storeId: string): Promise<DirectoryEntry[]> {
  const { data, error } = await supabase.rpc('get_store_directory', { p_store_id: storeId })
  if (error) fail('getStoreDirectory', error)
  return (data ?? []) as DirectoryEntry[]
}

/**
 * Ajoute une personne à l'inventaire — ou l'invite si elle n'a pas de compte.
 *
 * Même edge function que l'application mobile (`invite-to-session`), qui refuse
 * les adresses sans compte. Le site appelait jusqu'ici `invite-teammate`, qui
 * crée un compte pour l'entreprise **sans rattacher personne à l'inventaire** :
 * on remplissait le formulaire et l'équipe de l'inventaire ne bougeait pas.
 */
export async function inviteToSession(input: {
  sessionId: string
  fullName: string
  email: string
  role: SessionRole
}): Promise<{ success: boolean; outcome?: 'added' | 'invited'; error?: string }> {
  const { data, error } = await supabase.functions.invoke('invite-to-session', {
    body: {
      sessionId: input.sessionId,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
    },
  })
  if (error) fail('inviteToSession', error)
  return data as { success: boolean; outcome?: 'added' | 'invited'; error?: string }
}
