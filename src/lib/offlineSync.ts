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
 * Règle unique : on tente le serveur, et on ne bascule en local que sur une
 * **panne réseau**. Un refus du serveur (balise inconnue, inventaire clôturé,
 * droits insuffisants) doit rester un refus visible immédiatement — le masquer
 * derrière une mise en attente ferait croire au compteur que son travail est
 * enregistré alors qu'il sera rejeté à la synchronisation.
 */

// ─── Préparation : à faire pendant qu'il y a du réseau ───────────────────────

/**
 * Télécharge et met en cache ce dont le comptage aura besoin sans réseau.
 *
 * Appelé à l'ouverture d'un inventaire. Si ça échoue, on ne bloque pas : le
 * comptage en ligne fonctionne toujours, seul le hors ligne sera dégradé — et
 * `hasOfflineCache` permet à l'écran de le dire honnêtement.
 */
export async function primeOfflineCache(sessionId: string): Promise<boolean> {
  try {
    const [articles, zones] = await Promise.all([
      q.getSessionArticles(sessionId),
      q.getZones(sessionId).catch(() => []),
    ])
    await off.cacheArticles(sessionId, articles)
    await off.cacheZones(sessionId, zones)
    return true
  } catch (e) {
    console.warn('[offlineSync] mise en cache impossible', e)
    return false
  }
}

export async function hasOfflineCache(sessionId: string): Promise<boolean> {
  return off.hasCachedArticles(sessionId)
}

// ─── Opérations de comptage ──────────────────────────────────────────────────

/** Résout un code-barres : serveur si possible, cache local sinon. */
export async function resolveArticle(sessionId: string, value: string): Promise<Article | null> {
  try {
    return await q.resolveArticle(sessionId, value)
  } catch (e) {
    if (!off.isNetworkError(e)) throw e
    return off.resolveArticleOffline(sessionId, value)
  }
}

/** Enregistre un comptage : insertion directe, ou mise en attente si le réseau est tombé. */
export async function insertCount(count: TablesInsert<'counts'>): Promise<{ queued: boolean }> {
  try {
    await q.insertCount(count)
    return { queued: false }
  } catch (e) {
    if (!off.isNetworkError(e)) throw e
    const { id: _id, created_at: _createdAt, ...rest } = count
    await off.enqueueCount(count.session_id, rest)
    return { queued: true }
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
  try {
    return await q.setBalise(sessionId, code, mode, open, allowCreate)
  } catch (e) {
    if (!off.isNetworkError(e)) throw e
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
}

// ─── Synchronisation ─────────────────────────────────────────────────────────

export type SyncOutcome = off.FlushResult & { pending: number }

/**
 * Renvoie la file. Sans réseau, s'arrête à la première coupure et conserve
 * l'ordre — appeler cette fonction trop souvent est donc sans danger.
 */
export async function syncNow(sessionId: string): Promise<SyncOutcome> {
  const result = await off.flush(sessionId, {
    insertCount: (c) => q.insertCount(c),
    setBalise: (s, c, m, o, a) => q.setBalise(s, c, m, o, a),
  })
  return { ...result, pending: await off.pendingCount(sessionId) }
}

export const pendingCount = off.pendingCount
export const pendingCounts = off.pendingCounts
export const failedOps = off.failedOps
export const clearFailedOps = off.clearFailedOps
export const clearOfflineSession = off.clearSession
