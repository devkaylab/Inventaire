import { supabase } from '@/lib/supabase'
import * as q from '@/lib/queries'
import type { Article, BaliseMode } from '@/lib/queries'
import type { TablesInsert } from '@/types/database.types'
import * as off from '@/lib/offline'
import { pingSession } from '@/lib/presence'

/**
 * Bascule serveur ↔ local, transparente pour les écrans.
 *
 * Ces fonctions reprennent **exactement** les signatures de `@/lib/queries`
 * qu'elles remplacent : le scanner change ses imports, pas son code. C'est
 * délibéré — `scanner.tsx` fait plus de mille lignes et porte déjà des erreurs
 * de lint préexistantes ; le réécrire pour ajouter le hors ligne aurait mélangé
 * deux sujets et rendu toute régression difficile à situer.
 *
 * Règle de bascule : on ne passe en local que sur une **panne réseau**. Un refus
 * du serveur (balise inconnue, inventaire clôturé, droits insuffisants) doit
 * rester un refus visible immédiatement — le masquer derrière une mise en
 * attente ferait croire au compteur que son travail est enregistré alors qu'il
 * sera rejeté à la synchronisation.
 */

// ─── État réseau ─────────────────────────────────────────────────────────────

/**
 * Une fois hors ligne, on **cesse d'essayer** à chaque scan.
 *
 * C'est le correctif de la lenteur signalée sur le terrain : sans cet état,
 * chaque code présenté devant la caméra relançait une requête vouée à expirer,
 * et le compteur attendait le délai réseau *avant* de voir son article. En
 * réserve, ça rendait le scan inutilisable.
 *
 * La reprise ne se joue pas ici : c'est la synchronisation périodique (toutes
 * les 20 s, et au retour au premier plan) qui sert de sonde. Quand elle passe,
 * le mode en ligne revient. Un scan peut donc partir en file jusqu'à 20 s après
 * le retour du réseau — c'est sans conséquence, il sera envoyé juste après, et
 * ça garde le scan instantané.
 */
let offline = false

export function isOffline(): boolean {
  return offline
}

/** Notifie les écrans du passage en ligne / hors ligne (bandeau global). */
type Listener = (offline: boolean) => void
const listeners = new Set<Listener>()

export function subscribeNetwork(fn: Listener): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

function setOffline(next: boolean) {
  if (offline === next) return
  offline = next
  for (const fn of listeners) fn(next)
}

function noteNetworkError(e: unknown): boolean {
  if (!off.isNetworkError(e)) return false
  setOffline(true)
  return true
}

// ─── Préparation : à faire pendant qu'il y a du réseau ───────────────────────

/**
 * Télécharge et met en cache ce dont le comptage aura besoin sans réseau, puis
 * chauffe l'index en mémoire.
 *
 * Si ça échoue, on ne bloque pas : le comptage en ligne fonctionne toujours,
 * seul le hors ligne sera dégradé — et `hasOfflineCache` permet à l'écran de le
 * dire honnêtement.
 */
export async function primeOfflineCache(sessionId: string): Promise<boolean> {
  try {
    const [articles, zones, session] = await Promise.all([
      q.getSessionArticles(sessionId),
      q.getZones(sessionId).catch(() => []),
      q.getSession(sessionId).catch(() => null),
    ])
    // ⚠️ Le référentiel du serveur ne connaît pas encore les articles créés en
    // réserve : ils sont dans la file, pas en base. `cacheArticles` réécrit le
    // cache **en entier** — les rajouter ici est ce qui évite qu'un code saisi à
    // la main redevienne « inconnu » à la première barre de réseau, alors que
    // son comptage attend toujours d'être envoyé.
    //
    // Une seule écriture, pas une par article : le cache se réécrit à chaque
    // appel, et boucler dessus coûterait le carré du nombre d'articles.
    const enAttente = await off.pendingArticles(sessionId)
    const connus = new Set(articles.map((a) => a.sku))
    await off.cacheArticles(sessionId, [
      ...articles,
      ...enAttente.filter((a) => !connus.has(a.sku)),
    ])
    await off.cacheZones(sessionId, zones)
    // La fiche d'inventaire est ce qui permet de **rouvrir** l'écran de comptage
    // après un redémarrage sans réseau. Sans elle, les scans en attente seraient
    // à l'abri sur le disque mais inaccessibles.
    if (session) await off.cacheSession(sessionId, session)
    setOffline(false)
    return true
  } catch (e) {
    noteNetworkError(e)
    console.warn('[offlineSync] mise en cache impossible', e)
    // Même sans réseau, l'index local (s'il existe déjà) doit être prêt.
    await off.warmArticleIndex(sessionId)
    return false
  }
}

/**
 * Fiche d'un inventaire : serveur si possible, cache local sinon.
 *
 * C'est la fonction que les écrans doivent appeler à la place de
 * `queries.getSession`, sans quoi un redémarrage hors ligne laisse une page
 * blanche là où le compteur attend son scanner.
 */
export async function getSession(sessionId: string): Promise<q.Session | null> {
  const cached = () => off.getCachedSession<q.Session>(sessionId)
  if (offline) return cached()
  try {
    const s = await q.getSession(sessionId)
    if (s) await off.cacheSession(sessionId, s)
    return s
  } catch (e) {
    if (!noteNetworkError(e)) throw e
    return cached()
  }
}

/**
 * Ce que le serveur a enregistré pour cette personne — dernière valeur connue
 * hors ligne (4 septembre 2026).
 *
 * ⚠️ C'EST CE QUI LAISSAIT L'ÉCRAN DE PROGRESSION BLANC EN RÉSERVE. Constat de
 * Julien. Cette requête était la seule de l'écran à ne pas passer par ici :
 * sans réseau elle échouait, React Query la rejouait deux fois, et **tout
 * l'écran restait derrière son chargement** — y compris le bouton « Compter
 * des articles », qui est la seule chose dont un compteur ait besoin à ce
 * moment-là. Sur un wifi de magasin qui répond sans router, chaque tentative
 * attend le délai réseau : l'écran pouvait rester vide une minute.
 *
 * ⚠️ Elle rend `null` quand rien n'est en cache, jamais un zéro. « 0 pièce
 * comptée » à quelqu'un qui vient d'en compter cent serait faux, et c'est
 * précisément le genre de chiffre qu'on croit.
 */
export async function getMyCountTotals(
  sessionId: string,
): Promise<{ counted: number; audited: number } | null> {
  const cached = () => off.getCachedCountTotals<{ counted: number; audited: number }>(sessionId)
  if (offline) return cached()
  try {
    const t = await q.getMyCountTotals(sessionId)
    await off.cacheCountTotals(sessionId, t)
    return t
  } catch (e) {
    if (!noteNetworkError(e)) throw e
    return cached()
  }
}

/** Inventaires du compteur : serveur si possible, dernière liste connue sinon. */
export async function getSessions(): Promise<q.Session[]> {
  if (offline) return (await off.getCachedSessionList<q.Session>()) ?? []
  try {
    const list = await q.getSessions()
    await off.cacheSessionList(list)
    return list
  } catch (e) {
    if (!noteNetworkError(e)) throw e
    return (await off.getCachedSessionList<q.Session>()) ?? []
  }
}

export async function hasOfflineCache(sessionId: string): Promise<boolean> {
  return off.hasCachedArticles(sessionId)
}

// ─── Opérations de comptage ──────────────────────────────────────────────────

/**
 * Résout un code-barres : cache local si on se sait hors ligne, serveur sinon.
 *
 * ⚠️ **Le cache sert de repli même EN LIGNE**, quand le serveur ne connaît pas
 * le code. C'est la fenêtre qui sépare un article créé en réserve de sa
 * remontée : la file l'a, la base pas encore. Sans ce repli, la première barre
 * de réseau rouvrait « Article inconnu » sur un code qu'on venait de saisir —
 * et une seconde saisie fabriquait un doublon dans la file. Trouvé par
 * `tests/offlineSync.test.ts`, pas à l'écran.
 *
 * Le repli ne peut pas ressusciter un article retiré du référentiel : chaque
 * `primeOfflineCache` réécrit le cache à partir du serveur, et n'y ajoute que
 * ce qui attend encore dans la file.
 */
export async function resolveArticle(sessionId: string, value: string): Promise<Article | null> {
  if (offline) return off.resolveArticleOffline(sessionId, value)
  try {
    return (await q.resolveArticle(sessionId, value)) ?? off.resolveArticleOffline(sessionId, value)
  } catch (e) {
    if (!noteNetworkError(e)) throw e
    return off.resolveArticleOffline(sessionId, value)
  }
}

/**
 * La liste des scans d'une balise : serveur **plus** ce qui attend en file.
 *
 * ⚠️ **Deux défauts hors ligne, et le second corrompt des données.** L'écran
 * appelait `queries.getMyScanEntries` en direct :
 *
 *  1. sans réseau, la liste d'une balise ouverte restait vide — or c'est elle
 *     que les boutons « + / − » corrigent. Le compteur ne pouvait plus
 *     reprendre une erreur de la journée ;
 *  2. pire, l'échec **ne vidait rien** : passer de la balise A à la balise B
 *     laissait les scans de A affichés sous B. Un « − » posé là écrivait une
 *     correction négative dans B pour un article compté en A.
 *
 * La file est ajoutée dans les deux cas, pas seulement hors ligne : au retour
 * du réseau, une partie des scans est déjà partie et l'autre attend encore.
 * N'afficher que le serveur ferait clignoter la liste entre les deux.
 */
export async function getScanEntries(
  sessionId: string,
  passNumber: number,
  countedBy: string,
  zone?: string | null,
): Promise<q.ScanEntrySeed[]> {
  let entries: q.ScanEntrySeed[] = []
  if (!offline) {
    try {
      entries = await q.getMyScanEntries(sessionId, passNumber, countedBy, zone)
    } catch (e) {
      // Un refus du serveur (inventaire clôturé, droits) ne doit pas non plus
      // afficher la liste de la balise précédente : on repart de la file.
      if (!noteNetworkError(e)) console.warn('[offlineSync] liste des scans', e)
    }
  }

  const attente = (await off.pendingCounts(sessionId)).filter(
    (c) =>
      Number(c.pass_number) === passNumber &&
      // Mode zones : la balise. Mode classique : ses propres lignes.
      (zone != null ? (c.zone ?? null) === zone : c.counted_by === countedBy),
  )
  if (attente.length === 0) return entries

  const agg = new Map<string, q.ScanEntrySeed>()
  for (const e of entries) agg.set(e.article.sku, { ...e })
  for (const c of attente) {
    const at = c.created_at ? new Date(c.created_at).getTime() : Date.now()
    const cur = agg.get(c.sku)
    if (cur) {
      cur.qty += Number(c.qty ?? 0)
      if (at > cur.timestamp) cur.timestamp = at
      continue
    }
    // Le libellé vient du cache local — c'est là que vivent aussi les articles
    // créés en réserve, qui n'existent encore nulle part ailleurs.
    const article =
      (await off.resolveArticleOffline(sessionId, c.sku)) ??
      (off.articleFromInsert({ session_id: sessionId, sku: c.sku, label: '' }) as Article)
    agg.set(c.sku, { article, qty: Number(c.qty ?? 0), timestamp: at })
  }
  // Une référence entièrement corrigée (net nul ou négatif) quitte la liste,
  // comme côté serveur.
  return [...agg.values()].filter((e) => e.qty > 0).sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Crée un article absent du référentiel (« Article inconnu »).
 *
 * ⚠️ **C'est la fonction qui manquait au hors ligne.** L'écran de scan
 * appelait `queries.insertArticle` en direct : sans réseau, la saisie
 * échouait avec « fetch failed », le compteur restait devant une étiquette
 * bien réelle sans moyen d'avancer, et le seul chemin qui lui restait était
 * de ne pas compter l'article. Signalé par Julien le 1er septembre 2026, sur
 * les deux plateformes.
 *
 * L'article est ajouté au cache local **dans les deux cas** : en ligne pour
 * que la descente en réserve qui suit le connaisse déjà, hors ligne parce que
 * c'est alors le seul endroit où il existe. Sans cela, rescanner le code
 * qu'on vient de saisir rouvrirait « Article inconnu » — et créerait un
 * doublon dans la file.
 *
 * @param bucket  code de la balise ouverte, pour que l'article parte avec les
 *                comptages du même endroit (voir `enqueueArticle`).
 */
export async function insertArticle(
  article: TablesInsert<'articles'>,
  bucket: string | null = null,
): Promise<Article> {
  // L'identifiant est tiré ICI, pas laissé au serveur : la copie mise en cache
  // et la ligne qui arrivera en base portent alors le même `id`, et un renvoi
  // en double retombe sur la clé primaire — que la file traite comme « déjà
  // passé ». L'unicité (session_id, sku) protégerait de toute façon, mais deux
  // identités pour un même article sont une confusion qu'on peut s'épargner.
  const payload: TablesInsert<'articles'> = { ...article, id: article.id ?? off.newId() }
  const local = off.articleFromInsert(payload)
  const enqueue = async (): Promise<Article> => {
    await off.enqueueArticle(payload.session_id, bucket ?? off.NO_BALISE, payload)
    await off.addCachedArticle(payload.session_id, local)
    return local
  }
  if (offline) return enqueue()
  try {
    const created = await q.insertArticle(payload)
    await off.addCachedArticle(payload.session_id, created)
    return created
  } catch (e) {
    if (!noteNetworkError(e)) throw e
    return enqueue()
  }
}

/** Enregistre un comptage : insertion directe, ou mise en attente si le réseau est tombé. */
export async function insertCount(count: TablesInsert<'counts'>): Promise<{ queued: boolean }> {
  const enqueue = async () => {
    const { id: _id, created_at: _createdAt, ...rest } = count
    await off.enqueueCount(count.session_id, rest)
    return { queued: true }
  }
  if (offline) return enqueue()
  try {
    await q.insertCount(count)
    return { queued: false }
  } catch (e) {
    if (!noteNetworkError(e)) throw e
    return enqueue()
  }
}

export type SetBaliseResult = Awaited<ReturnType<typeof q.setBalise>> & { queued?: boolean }

/**
 * Ouvre ou clôture une balise.
 *
 * Hors ligne, l'app ne peut pas vérifier que la balise appartient bien à
 * l'inventaire : cette validation vit dans `set_balise`, côté serveur. On
 * accepte donc de façon optimiste, et le refus éventuel remontera à la
 * synchronisation, dans les opérations mises de côté. C'est le seul compromis
 * possible, et il va dans le bon sens : mieux vaut un comptage à rattacher
 * qu'un compteur bloqué au fond d'une réserve.
 */
export async function setBalise(
  sessionId: string,
  code: string,
  mode: BaliseMode,
  open: boolean,
  allowCreate = false,
): Promise<SetBaliseResult> {
  const enqueue = async (): Promise<SetBaliseResult> => {
    await off.enqueueBalise(sessionId, code, mode, open, allowCreate)
    return {
      success: true,
      code,
      name: await off.zoneNameFor(sessionId, code),
      mode,
      status: open ? 'open' : 'done',
      queued: true,
    }
  }
  if (offline) return enqueue()
  try {
    return await q.setBalise(sessionId, code, mode, open, allowCreate)
  } catch (e) {
    if (!noteNetworkError(e)) throw e
    return enqueue()
  }
}

// ─── Synchronisation ─────────────────────────────────────────────────────────

export type SyncOutcome = off.FlushResult & { balises: off.PendingBalise[] }

/**
 * Renvoie la file, et sert de sonde réseau : c'est son résultat qui fait
 * repasser l'app en ligne. Appeler cette fonction souvent est sans danger — sans
 * réseau elle s'arrête à la première opération et conserve tout le reste.
 */
export async function syncNow(sessionId: string): Promise<SyncOutcome> {
  // Sans session d'authentification, ne rien tenter.
  //
  // Un jeton absent ne vaut pas « erreur d'authentification » côté serveur : la
  // requête part en tant qu'anonyme et PostgREST répond « permission denied »,
  // que la file range dans les échecs **définitifs**. Une session expirée
  // pendant un inventaire enverrait donc des comptages valides à la poubelle.
  // On garde tout en attente jusqu'à la reconnexion.
  const { data: { session: auth } } = await supabase.auth.getSession()
  if (!auth) {
    return {
      sent: 0,
      failed: 0,
      interrupted: true,
      balisesSent: [],
      balises: await off.pendingBalises(sessionId),
    }
  }

  const result = await off.flush(sessionId, {
    insertCount: (c) => q.insertCount(c),
    insertArticle: (a) => q.insertArticle(a),
    setBalise: (s, c, m, o, a) => q.setBalise(s, c, m, o, a),
  })
  setOffline(result.interrupted)
  // Une file qui remonte doit prévenir le tableau de bord, au même titre qu'un
  // scan en direct. Sans cette ligne, un retour de réserve versait des
  // centaines de comptages que le superviseur ne verrait qu'au prochain
  // rafraîchissement de repli — le site espace justement les siens quand rien
  // ne lui est signalé. Un seul signal pour toute la file : `pingSession`
  // regroupe, et le site n'a besoin de savoir que « il y a du nouveau ».
  if (result.sent > 0) pingSession(sessionId, 'count')
  return { ...result, balises: await off.pendingBalises(sessionId) }
}

/**
 * Sonde légère quand il n'y a rien à envoyer : sans elle, un téléphone dont la
 * file est vide resterait marqué hors ligne indéfiniment, et le bandeau
 * mentirait.
 */
export async function probeNetwork(sessionId: string): Promise<boolean> {
  try {
    await q.getSession(sessionId)
    setOffline(false)
    return true
  } catch (e) {
    if (!off.isNetworkError(e)) {
      // Le serveur répond, il refuse : c'est en ligne.
      setOffline(false)
      return true
    }
    setOffline(true)
    return false
  }
}

export const pendingBalises = off.pendingBalises
export const pendingBaliseCount = off.pendingBaliseCount
export const pendingCounts = off.pendingCounts
export const pendingArticles = off.pendingArticles
export const failedOps = off.failedOps
export const clearFailedOps = off.clearFailedOps
export const clearOfflineSession = off.clearSession
export const NO_BALISE = off.NO_BALISE
export type PendingBalise = off.PendingBalise
