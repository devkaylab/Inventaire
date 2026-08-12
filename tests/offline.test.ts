import { beforeEach, describe, expect, it, vi } from 'vitest'

// AsyncStorage est un module natif : on le remplace par une Map. Le contrat
// utilisé par `offline.ts` se limite à ces cinq méthodes.
const store = new Map<string, string>()
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
    getAllKeys: async () => [...store.keys()],
    multiGet: async (ks: string[]) => ks.map((k) => [k, store.get(k) ?? null]),
    multiRemove: async (ks: string[]) => ks.forEach((k) => store.delete(k)),
  },
}))

import {
  cacheArticles,
  clearSession,
  enqueueBalise,
  enqueueCount,
  failedOps,
  flush,
  isNetworkError,
  newId,
  pendingCount,
  pendingCounts,
  resolveArticleIn,
  resolveArticleOffline,
  type Article,
} from '@/lib/offline'

const S = 'session-1'

function article(over: Partial<Article> = {}): Article {
  return {
    id: 'a1',
    session_id: S,
    sku: 'SKU1',
    ean: '3760123456789',
    ean_norm: '3760123456789',
    brand: 'Marque',
    label: 'Article',
    unit_purchase_price: 1,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  } as unknown as Article
}

function okDeps() {
  const counts: unknown[] = []
  const balises: unknown[] = []
  return {
    counts,
    balises,
    insertCount: async (c: unknown) => void counts.push(c),
    setBalise: async (
      sessionId: string,
      code: string,
      mode: string,
      open: boolean,
      allowCreate: boolean,
    ) => void balises.push({ sessionId, code, mode, open, allowCreate }),
  }
}

beforeEach(() => store.clear())

describe('newId', () => {
  it('produit un uuid v4 bien formé', () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('ne se répète pas', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId()))
    expect(ids.size).toBe(2000)
  })
})

describe('isNetworkError', () => {
  it('reconnaît une coupure réseau', () => {
    expect(isNetworkError({ message: 'Network request failed' })).toBe(true)
    expect(isNetworkError({ name: 'TypeError', message: 'Failed to fetch' })).toBe(true)
    expect(isNetworkError({ name: 'AuthRetryableFetchError' })).toBe(true)
  })

  it('ne confond pas un refus du serveur avec une coupure', () => {
    // Le cas qui compte : un inventaire clôturé refuse l'insertion. Le traiter
    // comme une panne réseau ferait boucler la synchro indéfiniment.
    expect(isNetworkError({ code: '42501', message: 'row-level security policy' })).toBe(false)
    expect(isNetworkError({ code: '23505', message: 'duplicate key value' })).toBe(false)
    expect(isNetworkError(null)).toBe(false)
  })
})

describe('résolution d’un code-barres hors ligne', () => {
  it('trouve par SKU et par EAN', () => {
    const list = [article()]
    expect(resolveArticleIn(list, 'SKU1')?.sku).toBe('SKU1')
    expect(resolveArticleIn(list, '3760123456789')?.sku).toBe('SKU1')
  })

  it('ignore les zéros de tête, dans les deux sens', () => {
    // Excel mange les zéros de tête des cellules EAN numériques : l'EAN stocké
    // et le code scanné diffèrent alors d'un ou plusieurs zéros.
    const stocke = [article({ ean: '0123456', ean_norm: '123456' } as Partial<Article>)]
    expect(resolveArticleIn(stocke, '123456')?.sku).toBe('SKU1')
    expect(resolveArticleIn(stocke, '000123456')?.sku).toBe('SKU1')
  })

  it('ne trouve rien pour un code inconnu ou vide', () => {
    expect(resolveArticleIn([article()], '000000')).toBeNull()
    expect(resolveArticleIn([article()], '   ')).toBeNull()
  })

  it('lit le cache écrit pendant que le réseau était là', async () => {
    await cacheArticles(S, [article()])
    expect((await resolveArticleOffline(S, 'SKU1'))?.sku).toBe('SKU1')
  })
})

describe('file d’attente', () => {
  it('fige un identifiant et l’heure réelle du scan', async () => {
    const avant = Date.now()
    const id = await enqueueCount(S, { session_id: S, sku: 'SKU1', pass_number: 1, qty: 1 })
    const [row] = await pendingCounts(S)
    expect(row.id).toBe(id)
    expect(new Date(row.created_at as string).getTime()).toBeGreaterThanOrEqual(avant)
  })

  it('compte ce qui reste à envoyer', async () => {
    await enqueueCount(S, { session_id: S, sku: 'A', pass_number: 1, qty: 1 })
    await enqueueBalise(S, '5375', 'count', true)
    expect(await pendingCount(S)).toBe(2)
  })

  it('envoie tout et vide la file', async () => {
    await enqueueCount(S, { session_id: S, sku: 'A', pass_number: 1, qty: 1 })
    await enqueueCount(S, { session_id: S, sku: 'B', pass_number: 1, qty: 2 })
    const deps = okDeps()
    const r = await flush(S, deps)
    expect(r).toEqual({ sent: 2, interrupted: false, failed: 0 })
    expect(await pendingCount(S)).toBe(0)
    expect(deps.counts).toHaveLength(2)
  })

  it('respecte l’ordre de saisie', async () => {
    // Ouvrir puis clôturer n'est pas la même chose que l'inverse.
    await enqueueBalise(S, '5375', 'count', true)
    await enqueueCount(S, { session_id: S, sku: 'A', pass_number: 1, qty: 1 })
    await enqueueBalise(S, '5375', 'count', false)
    const ordre: string[] = []
    await flush(S, {
      insertCount: async () => void ordre.push('count'),
      setBalise: async (_s, _c, _m, open) => void ordre.push(open ? 'ouvre' : 'cloture'),
    })
    expect(ordre).toEqual(['ouvre', 'count', 'cloture'])
  })

  it('s’arrête net sur une coupure et conserve le reste', async () => {
    await enqueueCount(S, { session_id: S, sku: 'A', pass_number: 1, qty: 1 })
    await enqueueCount(S, { session_id: S, sku: 'B', pass_number: 1, qty: 1 })
    await enqueueCount(S, { session_id: S, sku: 'C', pass_number: 1, qty: 1 })
    let n = 0
    const r = await flush(S, {
      insertCount: async () => {
        n += 1
        if (n === 2) throw { message: 'Network request failed' }
      },
      setBalise: async () => {},
    })
    expect(r.interrupted).toBe(true)
    expect(r.sent).toBe(1)
    // Les deux restantes sont gardées : rien n'est perdu, l'ordre est intact.
    expect(await pendingCount(S)).toBe(2)
    expect((await pendingCounts(S)).map((c) => c.sku)).toEqual(['B', 'C'])
  })

  it('traite un doublon comme déjà envoyé', async () => {
    // Cas réel : la synchro a été coupée après l'insertion mais avant l'accusé.
    await enqueueCount(S, { session_id: S, sku: 'A', pass_number: 1, qty: 1 })
    const r = await flush(S, {
      insertCount: async () => {
        throw { code: '23505', message: 'duplicate key value violates unique constraint' }
      },
      setBalise: async () => {},
    })
    expect(r).toEqual({ sent: 1, interrupted: false, failed: 0 })
    expect(await pendingCount(S)).toBe(0)
  })

  it('met de côté un refus du serveur sans bloquer la file', async () => {
    // Sans ça, un inventaire clôturé pendant que le compteur était en réserve
    // ferait échouer éternellement la première op, et tout le reste avec.
    await enqueueCount(S, { session_id: S, sku: 'REFUSE', pass_number: 1, qty: 1 })
    await enqueueCount(S, { session_id: S, sku: 'OK', pass_number: 1, qty: 1 })
    const deps = okDeps()
    const r = await flush(S, {
      insertCount: async (c) => {
        if ((c as { sku: string }).sku === 'REFUSE') {
          throw { code: '42501', message: 'new row violates row-level security policy' }
        }
        await deps.insertCount(c)
      },
      setBalise: deps.setBalise,
    })
    expect(r).toEqual({ sent: 1, interrupted: false, failed: 1 })
    expect(await pendingCount(S)).toBe(0)

    // Rien n'est perdu en silence : l'op refusée reste consultable, avec sa raison.
    const ko = await failedOps(S)
    expect(ko).toHaveLength(1)
    expect(ko[0].reason).toMatch(/row-level security/)
  })

  it('cloisonne les inventaires', async () => {
    await enqueueCount(S, { session_id: S, sku: 'A', pass_number: 1, qty: 1 })
    await enqueueCount('autre', { session_id: 'autre', sku: 'B', pass_number: 1, qty: 1 })
    expect(await pendingCount(S)).toBe(1)
    expect(await pendingCount('autre')).toBe(1)
  })

  it('efface tout le local d’un inventaire sans toucher aux autres', async () => {
    await cacheArticles(S, [article()])
    await enqueueCount(S, { session_id: S, sku: 'A', pass_number: 1, qty: 1 })
    await enqueueCount('autre', { session_id: 'autre', sku: 'B', pass_number: 1, qty: 1 })
    await clearSession(S)
    expect(await pendingCount(S)).toBe(0)
    expect(await resolveArticleOffline(S, 'SKU1')).toBeNull()
    expect(await pendingCount('autre')).toBe(1)
  })
})
