import AsyncStorage from '@react-native-async-storage/async-storage'

import type { Tables, TablesInsert } from '@/types/database.types'

/**
 * Comptage hors ligne — stockage local et file d'attente d'envoi.
 *
 * Scénario visé : l'équipe rejoint l'inventaire là où ça capte, puis descend en
 * réserve ou en chambre froide sans signal. L'app doit alors continuer à
 * scanner, ouvrir et clôturer des balises, puis tout renvoyer au retour.
 *
 * Aucune dépendance native nouvelle : `AsyncStorage` est déjà embarqué (session
 * Supabase, thème). S'en tenir là évite un `pod install`, qui écrase à chaque
 * fois le correctif du chemin contenant un espace.
 *
 * ── Pourquoi le stockage est groupé par balise ──────────────────────────────
 *
 * La v1 écrivait une clé par scan. Sur iOS, `AsyncStorage` **inline toute valeur
 * de moins de 1024 octets dans un manifeste unique**, et réécrit ce manifeste en
 * entier dès qu'il change (`RNCAsyncStorage.mm`, `RCTInlineValueThreshold`).
 * Chaque scan réécrivait donc l'intégralité des scans en attente : le millième
 * scan coûtait mille fois le premier. C'est ce qui rendait l'identification d'un
 * code de plus en plus lente à mesure que la réserve avançait.
 *
 * Ici, les opérations sont groupées **par balise, en tranches**. Une tranche
 * dépasse vite 1024 octets, donc elle part dans son propre fichier et sort du
 * manifeste : le coût d'un scan ne dépend plus que de la tranche courante,
 * jamais du total accumulé.
 *
 * Ce découpage tombe juste par ailleurs : l'ordre d'envoi ne compte **qu'à
 * l'intérieur d'une balise** (ouvrir avant de clôturer). Deux balises
 * différentes sont indépendantes, leurs opérations peuvent partir dans n'importe
 * quel ordre relatif.
 *
 * ── Pourquoi le renvoi est sûr ──────────────────────────────────────────────
 *
 * 1. `counts.id` est un `uuid` avec `gen_random_uuid()` par défaut — mais rien
 *    n'oblige le client à laisser le serveur le choisir. En le générant ici, un
 *    renvoi en double retombe sur la clé primaire (erreur 23505) au lieu de
 *    créer une seconde ligne. Le rejeu est donc idempotent.
 * 2. `counts` est un journal **append-only** : aucune policy `UPDATE`, les
 *    corrections sont des lignes de quantité négative. Un envoi tardif ne peut
 *    écraser aucune donnée saisie entre-temps par quelqu'un d'autre.
 *
 * `created_at` a un défaut `now()` côté serveur : on envoie l'heure réelle du
 * scan, faute de quoi une journée de comptage hors ligne s'horodaterait à la
 * seconde de la synchronisation.
 */

const V = 'offline:v2'
const V1_OP_PREFIX = 'offline:v1:op:' // file de la v1, encore à drainer (voir migrateLegacy)

const articlesKey = (sessionId: string) => `${V}:articles:${sessionId}`
const zonesKey = (sessionId: string) => `${V}:zones:${sessionId}`
const balisePrefix = (sessionId: string) => `${V}:bal:${sessionId}:`
const failedPrefix = (sessionId: string) => `${V}:failed:${sessionId}:`

/** Bucket des comptages sans balise (inventaire classique, hors mode zones). */
export const NO_BALISE = '__sans_balise__'

/**
 * Taille d'une tranche. Assez grande pour que la tranche dépasse le seuil des
 * 1024 octets dès ses premières entrées (et sorte donc du manifeste), assez
 * petite pour qu'un scan ne réécrive jamais plus de quelques dizaines de Ko.
 */
const CHUNK = 200

export type Article = Tables<'articles'>
export type Zone = Tables<'zones'>
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

/** Ce qu'une balise a en attente — c'est l'unité que le compteur comprend. */
export type PendingBalise = {
  /** Code de la balise, ou `NO_BALISE` hors mode zones. */
  code: string
  /** Nom de la zone si connu du cache local (« Réserve »). */
  name: string | null
  /** Nombre d'articles comptés en attente sur cette balise. */
  scans: number
  /** Somme des quantités en attente (les corrections sont négatives). */
  units: number
  /** `true` si une ouverture ou une clôture de balise attend aussi. */
  hasBaliseOp: boolean
  /** Horodatage du scan le plus ancien encore en attente. */
  since: number
}

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

/**
 * Session d'authentification expirée ou absente.
 *
 * À traiter comme une panne réseau — l'opération est valide, c'est le droit
 * d'écrire qui manque momentanément. Sans cette distinction, l'expiration de
 * session rangerait des comptages parfaitement bons dans les échecs
 * définitifs, et le compteur perdrait son travail au lieu de le voir repartir
 * après reconnexion.
 *
 * Attention : un `42501` n'est **pas** listé ici. Refus de droits avec une
 * session valide (retiré de l'inventaire, inventaire clôturé), c'est un refus
 * définitif, qui doit rester visible.
 */
export function isAuthExpired(e: unknown): boolean {
  const err = e as { code?: string; status?: number; name?: string; message?: string } | null
  if (!err) return false
  if (err.code === 'PGRST301' || err.status === 401) return true
  if (err.name === 'AuthApiError' || err.name === 'AuthSessionMissingError') return true
  return /jwt (expired|is expired|invalid)|invalid jwt|token is expired|session (missing|expired)/i.test(
    err.message ?? '',
  )
}

/** Conflit de clé primaire : la ligne est déjà passée, l'op est donc terminée. */
function isDuplicate(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null
  if (!err) return false
  return err.code === '23505' || /duplicate key|already exists/i.test(err.message ?? '')
}

// ─── Référentiel et balises en cache ─────────────────────────────────────────

/**
 * Index en mémoire du référentiel.
 *
 * Sans lui, chaque scan relisait et re-parsait le référentiel entier depuis le
 * disque — plusieurs milliers d'articles à chaque code présenté devant la
 * caméra. L'index est construit une fois, puis chaque résolution est une lecture
 * de table de hachage.
 */
type ArticleIndex = { sessionId: string; byCode: Map<string, Article>; size: number }
let articleIndex: ArticleIndex | null = null

function buildIndex(sessionId: string, articles: Article[]): ArticleIndex {
  const byCode = new Map<string, Article>()
  for (const a of articles) {
    if (a.sku) byCode.set(a.sku, a)
    if (a.ean) byCode.set(a.ean, a)
    // Excel mange les zéros de tête des cellules EAN numériques : l'EAN stocké
    // et le code scanné peuvent différer d'un ou plusieurs zéros. `ean_norm` est
    // la colonne générée sans zéros de tête ; on indexe les deux formes.
    const norm = (a as Article & { ean_norm?: string | null }).ean_norm
    if (norm) byCode.set(norm, a)
  }
  return { sessionId, byCode, size: articles.length }
}

export async function cacheArticles(sessionId: string, articles: Article[]): Promise<void> {
  await AsyncStorage.setItem(articlesKey(sessionId), JSON.stringify(articles))
  articleIndex = buildIndex(sessionId, articles)
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

/** Charge l'index en mémoire s'il ne l'est pas déjà. À appeler à l'entrée du scan. */
export async function warmArticleIndex(sessionId: string): Promise<number> {
  if (articleIndex?.sessionId === sessionId) return articleIndex.size
  articleIndex = buildIndex(sessionId, await getCachedArticles(sessionId))
  return articleIndex.size
}

export async function hasCachedArticles(sessionId: string): Promise<boolean> {
  return (await warmArticleIndex(sessionId)) > 0
}

/** Résolution pure, testable, sur une liste d'articles. */
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

/** Résolution hors ligne : lecture d'index, sans accès disque une fois chauffé. */
export async function resolveArticleOffline(
  sessionId: string,
  value: string,
): Promise<Article | null> {
  const trimmed = value.trim()
  if (!trimmed) return null
  await warmArticleIndex(sessionId)
  const idx = articleIndex
  if (!idx || idx.sessionId !== sessionId) return null
  return idx.byCode.get(trimmed) ?? idx.byCode.get(trimmed.replace(/^0+/, '')) ?? null
}

/**
 * Les balises servent à retrouver le **nom** de la zone hors ligne (« Réserve »,
 * « Surface de vente »). Sans ça, le compteur ne verrait qu'un numéro et
 * perdrait le repère qui lui dit qu'il est au bon endroit.
 */
export async function cacheZones(sessionId: string, zones: Zone[]): Promise<void> {
  await AsyncStorage.setItem(zonesKey(sessionId), JSON.stringify(zones))
  zoneNames = null
}

export async function getCachedZones(sessionId: string): Promise<Zone[]> {
  const raw = await AsyncStorage.getItem(zonesKey(sessionId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Zone[]) : []
  } catch {
    return []
  }
}

let zoneNames: { sessionId: string; byCode: Map<string, string | null> } | null = null

async function zoneNameMap(sessionId: string): Promise<Map<string, string | null>> {
  if (zoneNames?.sessionId === sessionId) return zoneNames.byCode
  const byCode = new Map<string, string | null>()
  for (const z of await getCachedZones(sessionId)) byCode.set(z.code, z.name)
  zoneNames = { sessionId, byCode }
  return byCode
}

export async function zoneNameFor(sessionId: string, code: string): Promise<string | null> {
  return (await zoneNameMap(sessionId)).get(code) ?? null
}

// ─── Reprise après redémarrage ───────────────────────────────────────────────

/**
 * Ce qu'il faut pour **rouvrir** un inventaire sans réseau.
 *
 * Les scans en attente survivent à un crash — ils sont sur le disque. Mais sans
 * ce cache-ci, l'app ne pouvait pas les reprendre : au redémarrage elle allait
 * chercher le profil, la liste des inventaires et la fiche de session sur le
 * serveur, et sans réseau l'écran de comptage restait blanc. Le travail était à
 * l'abri, et inaccessible — le pire des deux mondes en pleine réserve.
 *
 * Ces trois éléments sont donc écrits au passage, quand le réseau est là, et
 * servis en repli quand il ne l'est plus.
 */
const profileKey = `${V}:profile`
const sessionKey = (sessionId: string) => `${V}:session:${sessionId}`
const sessionListKey = `${V}:sessions`

async function putJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value))
}

async function getJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Profil du compteur — son identifiant alimente `counted_by` à chaque scan. */
export const cacheProfile = (p: unknown) => putJson(profileKey, p)
export const getCachedProfile = <T,>() => getJson<T>(profileKey)

/** Fiche d'un inventaire : mode zones, statut, numéro, magasin. */
export const cacheSession = (sessionId: string, s: unknown) => putJson(sessionKey(sessionId), s)
export const getCachedSession = <T,>(sessionId: string) => getJson<T>(sessionKey(sessionId))

/** Liste des inventaires du compteur, pour retrouver le sien au redémarrage. */
export const cacheSessionList = (list: unknown) => putJson(sessionListKey, list)
export const getCachedSessionList = <T,>() => getJson<T[]>(sessionListKey)

/**
 * Oublie les caches locaux à la déconnexion.
 *
 * ⚠️ POURQUOI. Le catalogue d'articles d'un inventaire — références, libellés,
 * prix d'achat — vit en clair dans `AsyncStorage`, et y restait après la
 * déconnexion : le bac à sable de l'application le protège des autres
 * applications, pas d'un téléphone déverrouillé ni d'une sauvegarde non
 * chiffrée. Constat n°8 de la revue de sécurité du 28 août 2026.
 *
 * ⚠️ ET SURTOUT, CE QU'ELLE NE TOUCHE PAS : **la file des comptages en attente
 * et les échecs**. Ce sont les seules données du téléphone qui n'existent nulle
 * part ailleurs — les effacer ferait perdre une journée de comptage à quelqu'un
 * qui se déconnecte avant d'avoir retrouvé du réseau. Tout le reste (articles,
 * zones, fiches d'inventaire, liste, profil) se retélécharge à la reconnexion :
 * c'est ce qui rend ce ménage sans risque.
 *
 * La file de la v1 (`offline:v1:op:`) est épargnée pour la même raison : elle
 * attend encore d'être drainée par `migrateLegacy`.
 *
 * Rend ce qu'elle a fait, pour le journal de développement — et pour qu'un
 * appelant puisse un jour prévenir « il vous reste N comptages à envoyer ».
 */
export async function oublierCachesLocaux(): Promise<{ effaces: number; conserves: number }> {
  const toutes = await AsyncStorage.getAllKeys()
  const precieuse = (k: string) =>
    k.startsWith(V1_OP_PREFIX) || k.includes(`${V}:bal:`) || k.includes(`${V}:failed:`)

  const aEffacer = toutes.filter((k) => k.startsWith(`${V}:`) && !precieuse(k))
  const conserves = toutes.filter(precieuse).length

  if (aEffacer.length) await AsyncStorage.multiRemove(aEffacer)

  // ⚠️ ET L'INDEX EN MÉMOIRE, qui n'est pas dans `AsyncStorage` : `articleIndex`
  // garde le catalogue entier de la dernière session ouverte, pour résoudre un
  // code sans lire le disque. Vider le stockage sans le vider laisserait tout
  // le référentiel en RAM pour la durée du processus — le premier jet de ce
  // ménage l'oubliait, et c'est le test qui l'a montré.
  articleIndex = null

  return { effaces: aEffacer.length, conserves }
}

// ─── File d'attente, groupée par balise ──────────────────────────────────────

const chunkKey = (sessionId: string, code: string, i: number) =>
  `${balisePrefix(sessionId)}${encodeURIComponent(code)}:${String(i).padStart(6, '0')}`

function parseChunkKey(sessionId: string, key: string): { code: string; index: number } | null {
  const rest = key.slice(balisePrefix(sessionId).length)
  const sep = rest.lastIndexOf(':')
  if (sep < 0) return null
  return { code: decodeURIComponent(rest.slice(0, sep)), index: Number(rest.slice(sep + 1)) }
}

async function chunkKeysFor(sessionId: string, code?: string): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys()
  const prefix = code === undefined ? balisePrefix(sessionId) : `${balisePrefix(sessionId)}${encodeURIComponent(code)}:`
  return all.filter((k) => k.startsWith(prefix)).sort()
}

async function readChunk(key: string): Promise<PendingOp[]> {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingOp[]) : []
  } catch {
    return []
  }
}

/**
 * Sérialise les écritures de la file.
 *
 * `append` lit une tranche, y ajoute une opération, puis réécrit. Si deux
 * enregistrements se chevauchent — une clôture de balise déclenchée pendant
 * qu'un scan est encore en cours d'écriture, une douchette qui envoie deux
 * codes coup sur coup — les deux lisent la même tranche et le second écrase le
 * premier. Un scan disparaît, sans la moindre trace. Cette file garantit qu'une
 * écriture ne commence qu'une fois la précédente terminée.
 */
let writeChain: Promise<unknown> = Promise.resolve()

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = writeChain.then(task, task)
  // La chaîne ne doit jamais rester en échec, sinon toute écriture ultérieure
  // serait rejetée d'office ; l'erreur est propagée à l'appelant, pas à la file.
  writeChain = next.catch(() => undefined)
  return next
}

/** Ajoute une opération à la dernière tranche de sa balise, ou en ouvre une nouvelle. */
async function append(sessionId: string, code: string, op: PendingOp): Promise<void> {
  return serialize(async () => {
    const keys = await chunkKeysFor(sessionId, code)
    const lastKey = keys[keys.length - 1]
    if (lastKey) {
      const ops = await readChunk(lastKey)
      if (ops.length < CHUNK) {
        ops.push(op)
        await AsyncStorage.setItem(lastKey, JSON.stringify(ops))
        return
      }
    }
    const nextIndex = lastKey ? (parseChunkKey(sessionId, lastKey)?.index ?? 0) + 1 : 0
    await AsyncStorage.setItem(chunkKey(sessionId, code, nextIndex), JSON.stringify([op]))
  })
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
  await append(sessionId, count.zone || NO_BALISE, {
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
  await append(sessionId, code, {
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

/**
 * Les balises qui ont encore quelque chose à envoyer, avec leur numéro.
 *
 * C'est l'unité qui parle au terrain : « la balise 5375 n'est pas remontée » est
 * actionnable, « 412 scans en attente » ne l'est pas.
 */
export async function pendingBalises(sessionId: string): Promise<PendingBalise[]> {
  const keys = await chunkKeysFor(sessionId)
  if (keys.length === 0) return []
  const rows = await AsyncStorage.multiGet(keys)
  const byCode = new Map<string, PendingBalise>()

  for (const [key, raw] of rows) {
    if (!raw) continue
    const parsedKey = parseChunkKey(sessionId, key)
    if (!parsedKey) continue
    let ops: PendingOp[]
    try {
      ops = JSON.parse(raw) as PendingOp[]
    } catch {
      continue
    }
    const cur =
      byCode.get(parsedKey.code) ??
      ({ code: parsedKey.code, name: null, scans: 0, units: 0, hasBaliseOp: false, since: Infinity } as PendingBalise)
    for (const op of ops) {
      if (op.kind === 'count') {
        cur.scans += 1
        cur.units += Number(op.count.qty ?? 0)
      } else {
        cur.hasBaliseOp = true
      }
      if (op.at < cur.since) cur.since = op.at
    }
    byCode.set(parsedKey.code, cur)
  }

  const names = await zoneNameMap(sessionId)
  const out = [...byCode.values()].filter((b) => b.scans > 0 || b.hasBaliseOp)
  for (const b of out) b.name = names.get(b.code) ?? null
  // Les plus anciennes d'abord : ce sont celles dont l'absence inquiète le plus.
  out.sort((a, b) => a.since - b.since)
  return out
}

/** Nombre de balises ayant encore quelque chose à envoyer. */
export async function pendingBaliseCount(sessionId: string): Promise<number> {
  return (await pendingBalises(sessionId)).length
}

/** Les comptages en attente, pour compléter la liste affichée à l'écran. */
export async function pendingCounts(sessionId: string): Promise<TablesInsert<'counts'>[]> {
  const keys = await chunkKeysFor(sessionId)
  const rows = await AsyncStorage.multiGet(keys)
  const out: TablesInsert<'counts'>[] = []
  for (const [, raw] of rows) {
    if (!raw) continue
    try {
      for (const op of JSON.parse(raw) as PendingOp[]) {
        if (op.kind === 'count') out.push(op.count)
      }
    } catch {
      // Tranche illisible : ignorée ici, la synchro s'en occupera.
    }
  }
  return out
}

export async function failedOps(sessionId: string): Promise<FailedOp[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(failedPrefix(sessionId)))
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
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(failedPrefix(sessionId)))
  if (keys.length) await AsyncStorage.multiRemove(keys)
}

export type FlushResult = {
  /** Opérations effectivement passées. */
  sent: number
  /** Balises entièrement remontées pendant cette synchro. */
  balisesSent: string[]
  /** `true` si la file a été interrompue par une coupure réseau. */
  interrupted: boolean
  /** Ops refusées définitivement par le serveur, écartées de la file. */
  failed: number
}

/**
 * Reprend la file de la v1 (une clé par scan) et la reverse dans le format par
 * balise. Sans ça, les scans déjà en attente sur un téléphone au moment de la
 * mise à jour seraient perdus en silence.
 */
export async function migrateLegacy(sessionId: string): Promise<number> {
  const prefix = `${V1_OP_PREFIX}${sessionId}:`
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix)).sort()
  if (keys.length === 0) return 0
  const rows = await AsyncStorage.multiGet(keys)
  let moved = 0
  for (const [, raw] of rows) {
    if (!raw) continue
    try {
      const op = JSON.parse(raw) as PendingOp
      const code = op.kind === 'count' ? op.count.zone || NO_BALISE : op.code
      await append(sessionId, code, op)
      moved += 1
    } catch {
      // Entrée illisible : rien à en tirer.
    }
  }
  await AsyncStorage.multiRemove(keys)
  return moved
}

/**
 * Vide la file, balise par balise.
 *
 * L'ordre est respecté **à l'intérieur d'une balise** (ouvrir avant de
 * clôturer) ; entre balises il est sans importance, elles sont indépendantes.
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
  await migrateLegacy(sessionId)

  const keys = await chunkKeysFor(sessionId)
  let sent = 0
  let failed = 0
  const balisesSent = new Set<string>()
  const balisesTouched = new Set<string>()

  for (const key of keys) {
    const parsedKey = parseChunkKey(sessionId, key)
    if (parsedKey) balisesTouched.add(parsedKey.code)
    const ops = await readChunk(key)
    // Ce qu'il reste après passage : on réécrit la tranche pour ne jamais
    // renvoyer ce qui est déjà passé, même si la synchro est coupée juste après.
    const remaining: PendingOp[] = []
    let interrupted = false

    for (let i = 0; i < ops.length; i += 1) {
      const op = ops[i]
      if (interrupted) {
        remaining.push(op)
        continue
      }
      try {
        if (op.kind === 'count') await deps.insertCount(op.count)
        else await deps.setBalise(op.sessionId, op.code, op.mode, op.open, op.allowCreate)
        sent += 1
      } catch (e) {
        if (isDuplicate(e)) {
          sent += 1
          continue
        }
        if (isNetworkError(e) || isAuthExpired(e)) {
          interrupted = true
          remaining.push(op)
          continue
        }
        const reason = (e as { message?: string })?.message ?? 'Refus du serveur'
        await AsyncStorage.setItem(
          `${failedPrefix(sessionId)}${op.id}`,
          JSON.stringify({ op, reason, failedAt: Date.now() } satisfies FailedOp),
        )
        failed += 1
      }
    }

    if (remaining.length === 0) await AsyncStorage.removeItem(key)
    else await AsyncStorage.setItem(key, JSON.stringify(remaining))

    if (interrupted) {
      return { sent, balisesSent: [...balisesSent], interrupted: true, failed }
    }
  }

  // Une balise est « remontée » quand plus aucune de ses tranches ne subsiste.
  const left = new Set(
    (await chunkKeysFor(sessionId))
      .map((k) => parseChunkKey(sessionId, k)?.code)
      .filter((c): c is string => !!c),
  )
  for (const code of balisesTouched) if (!left.has(code)) balisesSent.add(code)

  return { sent, balisesSent: [...balisesSent], interrupted: false, failed }
}

/** Efface tout le local d'un inventaire (quitté, clôturé, supprimé). */
export async function clearSession(sessionId: string): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (k) =>
      k === articlesKey(sessionId) ||
      k === zonesKey(sessionId) ||
      k === sessionKey(sessionId) ||
      k.startsWith(balisePrefix(sessionId)) ||
      k.startsWith(failedPrefix(sessionId)) ||
      k.startsWith(`${V1_OP_PREFIX}${sessionId}:`),
  )
  if (keys.length) await AsyncStorage.multiRemove(keys)
  if (articleIndex?.sessionId === sessionId) articleIndex = null
  if (zoneNames?.sessionId === sessionId) zoneNames = null
}
