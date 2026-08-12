import AsyncStorage from '@react-native-async-storage/async-storage'

import type { Tables, TablesInsert } from '@/types/database.types'

/**
 * Comptage hors ligne — stockage local et file d'attente d'envoi.
 *
 * Scénario visé : l'équipe rejoint l'inventaire là où ça capte, puis descend en
 * réserve ou en chambre froide sans signal. L'app doit alors continuer à
 * scanner, ouvrir et clôturer des balises, puis tout renvoyer au retour.
 *
 * Ce module ne dépend d'aucun composant natif nouveau. `AsyncStorage` est déjà
 * embarqué (session Supabase, thème, tutoriel) : s'en tenir là évite un
 * `pod install`, qui écrase à chaque fois le correctif du chemin contenant un
 * espace. Voir aussi `docs/` et la mémoire projet.
 *
 * Deux propriétés du schéma rendent le renvoi sûr, et c'est ce qui permet cette
 * approche simple :
 *
 * 1. `counts.id` est un `uuid` avec `gen_random_uuid()` par défaut — mais rien
 *    n'oblige le client à laisser le serveur le choisir. En le générant ici, un
 *    renvoi en double retombe sur la clé primaire (erreur 23505) au lieu de
 *    créer une seconde ligne. Le rejeu est donc idempotent sans aucun travail
 *    côté serveur.
 * 2. `counts` est un journal **append-only** : aucune policy `UPDATE`, les
 *    corrections sont des lignes de quantité négative. Un envoi tardif ne peut
 *    donc écraser aucune donnée saisie entre-temps par quelqu'un d'autre.
 *
 * `created_at` a un défaut `now()` côté serveur : on envoie l'heure réelle du
 * scan, faute de quoi une journée de comptage hors ligne s'horodaterait à la
 * seconde de la synchronisation.
 */

const V = 'offline:v1'
const articlesKey = (sessionId: string) => `${V}:articles:${sessionId}`
const opPrefix = (sessionId: string) => `${V}:op:${sessionId}:`
const failedPrefix = (sessionId: string) => `${V}:failed:${sessionId}:`

export type Article = Tables<'articles'>
export type BaliseMode = 'count' | 'audit'

export type PendingOp =
  | { kind: 'count'; id: string; at: number; count: TablesInsert<'counts'> }
  | {
      kind: 'balise'
      id: string
      at: number
      sessionId: string
      code: string
      mode: BaliseMode
      open: boolean
      allowCreate: boolean
    }

/** Op rejetée définitivement par le serveur, conservée pour ne rien perdre en silence. */
export type FailedOp = { op: PendingOp; reason: string; failedAt: number }

// ─── Identifiants ────────────────────────────────────────────────────────────

/**
 * UUID v4. `crypto.randomUUID` n'existe pas dans le moteur JS de React Native,
 * et tirer une dépendance de plus pour ça n'en vaut pas le coût : une collision
 * se manifesterait de toute façon comme un conflit de clé primaire, que la
 * synchronisation traite déjà comme « déjà envoyé ».
 */
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Deux scans peuvent tomber dans la même milliseconde : un compteur suffit à les
// départager, et la clé reste triable lexicographiquement dans l'ordre de saisie.
let seq = 0
function nextOpKey(sessionId: string): string {
  seq = (seq + 1) % 10000
  return `${opPrefix(sessionId)}${Date.now()}-${String(seq).padStart(4, '0')}`
}

// ─── Détection de la panne réseau ────────────────────────────────────────────

/**
 * Distingue « le serveur est injoignable » de « le serveur a refusé ».
 *
 * On ne teste pas la présence de Wi-Fi : ce qui compte est de joindre Supabase,
 * pas d'avoir une barre de signal. Un hotspot capté mais sans route vers
 * Internet est hors ligne pour nous, et un module de connectivité dirait le
 * contraire.
 */
export function isNetworkError(e: unknown): boolean {
  const err = e as { name?: string; message?: string; status?: number } | null
  if (!err) return false
  if (err.name === 'AuthRetryableFetchError' || err.name === 'TypeError') return true
  return /network request failed|failed to fetch|fetch|timeout|timed out|offline/i.test(
    err.message ?? '',
  )
}

/** Conflit de clé primaire : la ligne est déjà passée, l'op est donc terminée. */
function isDuplicate(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null
  if (!err) return false
  return err.code === '23505' || /duplicate key|already exists/i.test(err.message ?? '')
}

// ─── Référentiel articles en cache ───────────────────────────────────────────

/** À appeler quand le réseau est là : sans ça, plus aucun code-barres ne se résout hors ligne. */
export async function cacheArticles(sessionId: string, articles: Article[]): Promise<void> {
  await AsyncStorage.setItem(articlesKey(sessionId), JSON.stringify(articles))
}

export async function getCachedArticles(sessionId: string): Promise<Article[]> {
  const raw = await AsyncStorage.getItem(articlesKey(sessionId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Article[]) : []
  } catch {
    return []
  }
}

export async function hasCachedArticles(sessionId: string): Promise<boolean> {
  return (await getCachedArticles(sessionId)).length > 0
}

/**
 * Résolution d'un code-barres sur le cache local.
 *
 * Reprend exactement la règle de `resolveArticle` côté serveur, y compris les
 * zéros de tête : Excel les mange dans les cellules EAN numériques, donc l'EAN
 * stocké peut différer du code scanné. La colonne générée `ean_norm` contient
 * l'EAN sans zéros de tête ; on compare des deux côtés.
 */
export function resolveArticleIn(articles: Article[], value: string): Article | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const norm = trimmed.replace(/^0+/, '')
  for (const a of articles) {
    if (a.sku === trimmed) return a
    if (a.ean === trimmed) return a
    const aNorm = (a as Article & { ean_norm?: string | null }).ean_norm
    if (norm && aNorm && aNorm === norm) return a
  }
  return null
}

export async function resolveArticleOffline(
  sessionId: string,
  value: string,
): Promise<Article | null> {
  return resolveArticleIn(await getCachedArticles(sessionId), value)
}

// ─── File d'attente ──────────────────────────────────────────────────────────

async function pushOp(sessionId: string, op: PendingOp): Promise<void> {
  await AsyncStorage.setItem(nextOpKey(sessionId), JSON.stringify(op))
}

/**
 * Met un comptage en attente. L'identifiant et l'horodatage sont figés ici,
 * pas à l'envoi — c'est ce qui rend le rejeu idempotent et l'heure fidèle.
 */
export async function enqueueCount(
  sessionId: string,
  count: Omit<TablesInsert<'counts'>, 'id' | 'created_at'>,
): Promise<string> {
  const id = newId()
  const at = Date.now()
  await pushOp(sessionId, {
    kind: 'count',
    id,
    at,
    count: { ...count, id, created_at: new Date(at).toISOString() },
  })
  return id
}

export async function enqueueBalise(
  sessionId: string,
  code: string,
  mode: BaliseMode,
  open: boolean,
  allowCreate = false,
): Promise<void> {
  await pushOp(sessionId, {
    kind: 'balise',
    id: newId(),
    at: Date.now(),
    sessionId,
    code,
    mode,
    open,
    allowCreate,
  })
}

async function opKeys(sessionId: string): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys()
  return keys.filter((k) => k.startsWith(opPrefix(sessionId))).sort()
}

/** Nombre d'opérations encore à envoyer — ce que l'écran affiche au compteur. */
export async function pendingCount(sessionId: string): Promise<number> {
  return (await opKeys(sessionId)).length
}

/** Les comptages en attente, pour compléter la liste affichée à l'écran. */
export async function pendingCounts(sessionId: string): Promise<TablesInsert<'counts'>[]> {
  const keys = await opKeys(sessionId)
  const rows = await AsyncStorage.multiGet(keys)
  const out: TablesInsert<'counts'>[] = []
  for (const [, raw] of rows) {
    if (!raw) continue
    try {
      const op = JSON.parse(raw) as PendingOp
      if (op.kind === 'count') out.push(op.count)
    } catch {
      // Entrée illisible : ignorée ici, la synchro s'en occupera.
    }
  }
  return out
}

export async function failedOps(sessionId: string): Promise<FailedOp[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
    k.startsWith(failedPrefix(sessionId)),
  )
  const rows = await AsyncStorage.multiGet(keys)
  const out: FailedOp[] = []
  for (const [, raw] of rows) {
    if (!raw) continue
    try {
      out.push(JSON.parse(raw) as FailedOp)
    } catch {
      // idem
    }
  }
  return out
}

export async function clearFailedOps(sessionId: string): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
    k.startsWith(failedPrefix(sessionId)),
  )
  if (keys.length) await AsyncStorage.multiRemove(keys)
}

export type FlushResult = {
  sent: number
  /** `true` si la file a été interrompue par une coupure réseau (le reste est conservé). */
  interrupted: boolean
  /** Ops refusées définitivement par le serveur, écartées de la file. */
  failed: number
}

/**
 * Vide la file, **dans l'ordre de saisie**.
 *
 * L'ordre compte pour les balises : ouvrir puis clôturer n'est pas la même chose
 * que l'inverse. Les envois sont donc séquentiels, pas parallèles.
 *
 * Trois issues par opération :
 * - succès, ou doublon (déjà passée lors d'une synchro interrompue) → retirée ;
 * - panne réseau → on s'arrête net et on garde tout le reste, l'ordre est
 *   préservé pour la prochaine tentative ;
 * - refus du serveur → mise de côté dans `failed:` puis on continue. Sans ça,
 *   une seule opération irrecevable bloquerait la file indéfiniment. Le cas
 *   concret : l'inventaire a été clôturé pendant que le compteur était en
 *   réserve, et depuis la migration 20260812000003 les policies refusent alors
 *   toute insertion dans `counts`.
 */
export async function flush(
  sessionId: string,
  deps: {
    insertCount: (count: TablesInsert<'counts'>) => Promise<unknown>
    setBalise: (
      sessionId: string,
      code: string,
      mode: BaliseMode,
      open: boolean,
      allowCreate: boolean,
    ) => Promise<unknown>
  },
): Promise<FlushResult> {
  const keys = await opKeys(sessionId)
  let sent = 0
  let failed = 0

  for (const key of keys) {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) continue

    let op: PendingOp
    try {
      op = JSON.parse(raw) as PendingOp
    } catch {
      await AsyncStorage.removeItem(key) // entrée corrompue : rien à en tirer
      continue
    }

    try {
      if (op.kind === 'count') await deps.insertCount(op.count)
      else await deps.setBalise(op.sessionId, op.code, op.mode, op.open, op.allowCreate)
      await AsyncStorage.removeItem(key)
      sent += 1
    } catch (e) {
      if (isDuplicate(e)) {
        await AsyncStorage.removeItem(key)
        sent += 1
        continue
      }
      if (isNetworkError(e)) return { sent, interrupted: true, failed }
      const reason = (e as { message?: string })?.message ?? 'Refus du serveur'
      await AsyncStorage.setItem(
        `${failedPrefix(sessionId)}${op.id}`,
        JSON.stringify({ op, reason, failedAt: Date.now() } satisfies FailedOp),
      )
      await AsyncStorage.removeItem(key)
      failed += 1
    }
  }

  return { sent, interrupted: false, failed }
}

/** Efface tout le local d'un inventaire (quitté, clôturé, supprimé). */
export async function clearSession(sessionId: string): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (k) =>
      k === articlesKey(sessionId) ||
      k.startsWith(opPrefix(sessionId)) ||
      k.startsWith(failedPrefix(sessionId)),
  )
  if (keys.length) await AsyncStorage.multiRemove(keys)
}
