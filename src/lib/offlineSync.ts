import * as q from '@/lib/queries'
import type { Article, BaliseMode } from '@/lib/queries'
import type { TablesInsert } from '@/types/database.types'
import * as off from '@/lib/offline'

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
    await off.cacheArticles(sessionId, articles)
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

/** Résout un code-barres : cache local si on se sait hors ligne, serveur sinon. */
export async function resolveArticle(sessionId: string, value: string): Promise<Article | null> {
  if (offline) return off.resolveArticleOffline(sessionId, value)
  try {
    return await q.resolveArticle(sessionId, value)
  } catch (e) {
    if (!noteNetworkError(e)) throw e
    return off.resolveArticleOffline(sessionId, value)
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
  const result = await off.flush(sessionId, {
    insertCount: (c) => q.insertCount(c),
    setBalise: (s, c, m, o, a) => q.setBalise(s, c, m, o, a),
  })
  setOffline(result.interrupted)
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
export const failedOps = off.failedOps
export const clearFailedOps = off.clearFailedOps
export const clearOfflineSession = off.clearSession
export const NO_BALISE = off.NO_BALISE
export type PendingBalise = off.PendingBalise
