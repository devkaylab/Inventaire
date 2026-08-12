import { beforeEach, describe, expect, it, vi } from 'vitest'

// AsyncStorage est un module natif : on le remplace par une Map. Le contrat
// utilisé par `offline.ts` se limite à ces six méthodes.
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
  cacheZones,
  clearSession,
  enqueueBalise,
  enqueueCount,
  failedOps,
  flush,
  isNetworkError,
  migrateLegacy,
  newId,
  NO_BALISE,
  pendingBaliseCount,
  pendingBalises,
  pendingCounts,
  resolveArticleIn,
  resolveArticleOffline,
  type Article,
  type Zone,
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

function zone(code: string, name: string): Zone {
  return { id: code, session_id: S, code, name } as unknown as Zone
}

const count = (sku: string, zoneCode: string | null, qty = 1) => ({
  session_id: S,
  sku,
  pass_number: 1,
  qty,
  zone: zoneCode,
})

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

beforeEach(async () => {
  store.clear()
  await clearSession(S) // vide aussi les index en mémoire
})

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

  it('passe par l’index en mémoire une fois le cache écrit', async () => {
    await cacheArticles(S, [article(), article({ id: 'a2', sku: 'SKU2', ean: '0999', ean_norm: '999' })])
    expect((await resolveArticleOffline(S, 'SKU2'))?.sku).toBe('SKU2')
    expect((await resolveArticleOffline(S, '999'))?.sku).toBe('SKU2')
    expect(await resolveArticleOffline(S, 'INCONNU')).toBeNull()
  })
})

describe('file d’attente groupée par balise', () => {
  it('fige un identifiant et l’heure réelle du scan', async () => {
    const avant = Date.now()
    const id = await enqueueCount(S, count('SKU1', '5375'))
    const [row] = await pendingCounts(S)
    expect(row.id).toBe(id)
    expect(new Date(row.created_at as string).getTime()).toBeGreaterThanOrEqual(avant)
  })

  it('compte les balises, pas les scans, et donne leur numéro', async () => {
    await enqueueCount(S, count('A', '5375'))
    await enqueueCount(S, count('B', '5375'))
    await enqueueCount(S, count('C', '5376'))
    expect(await pendingBaliseCount(S)).toBe(2)
    const bal = await pendingBalises(S)
    expect(bal.map((b) => b.code).sort()).toEqual(['5375', '5376'])
    expect(bal.find((b) => b.code === '5375')?.scans).toBe(2)
  })

  it('donne le nom de la zone quand il est en cache', async () => {
    await cacheZones(S, [zone('5375', 'Réserve')])
    await enqueueCount(S, count('A', '5375'))
    expect((await pendingBalises(S))[0].name).toBe('Réserve')
  })

  it('regroupe les comptages sans balise dans leur propre bucket', async () => {
    await enqueueCount(S, count('A', null))
    const bal = await pendingBalises(S)
    expect(bal).toHaveLength(1)
    expect(bal[0].code).toBe(NO_BALISE)
  })

  it('additionne les quantités, corrections négatives comprises', async () => {
    await enqueueCount(S, count('A', '5375', 3))
    await enqueueCount(S, count('A', '5375', -1))
    expect((await pendingBalises(S))[0].units).toBe(2)
  })

  it('signale qu’une ouverture ou clôture de balise attend aussi', async () => {
    await enqueueBalise(S, '5375', 'count', false)
    const [b] = await pendingBalises(S)
    expect(b.hasBaliseOp).toBe(true)
    expect(b.scans).toBe(0)
  })

  it('découpe en tranches sans rien perdre', async () => {
    // 450 scans sur une même balise : au-delà de la taille de tranche, on doit
    // retrouver le compte exact. C'est ce découpage qui évite de réécrire tout
    // l'historique à chaque scan.
    for (let i = 0; i < 450; i += 1) await enqueueCount(S, count(`SKU${i}`, '5375'))
    expect((await pendingBalises(S))[0].scans).toBe(450)
    expect(await pendingCounts(S)).toHaveLength(450)
    const keys = [...store.keys()].filter((k) => k.includes(':bal:'))
    expect(keys.length).toBeGreaterThan(1) // plusieurs tranches
  })
})

describe('synchronisation', () => {
  it('envoie tout et vide la file', async () => {
    await enqueueCount(S, count('A', '5375'))
    await enqueueCount(S, count('B', '5376'))
    const deps = okDeps()
    const r = await flush(S, deps)
    expect(r.sent).toBe(2)
    expect(r.interrupted).toBe(false)
    expect(r.balisesSent.sort()).toEqual(['5375', '5376'])
    expect(await pendingBaliseCount(S)).toBe(0)
  })

  it('respecte l’ordre à l’intérieur d’une balise', async () => {
    // Ouvrir puis clôturer n'est pas la même chose que l'inverse.
    await enqueueBalise(S, '5375', 'count', true)
    await enqueueCount(S, count('A', '5375'))
    await enqueueBalise(S, '5375', 'count', false)
    const ordre: string[] = []
    await flush(S, {
      insertCount: async () => void ordre.push('count'),
      setBalise: async (_s, _c, _m, open) => void ordre.push(open ? 'ouvre' : 'cloture'),
    })
    expect(ordre).toEqual(['ouvre', 'count', 'cloture'])
  })

  it('s’arrête net sur une coupure et conserve le reste', async () => {
    await enqueueCount(S, count('A', '5375'))
    await enqueueCount(S, count('B', '5375'))
    await enqueueCount(S, count('C', '5375'))
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
    // Rien n'est perdu, et rien ne sera renvoyé deux fois.
    expect((await pendingCounts(S)).map((c) => c.sku)).toEqual(['B', 'C'])
  })

  it('ne renvoie pas ce qui est déjà passé après une coupure', async () => {
    for (const sku of ['A', 'B', 'C']) await enqueueCount(S, count(sku, '5375'))
    let n = 0
    await flush(S, {
      insertCount: async () => {
        n += 1
        if (n === 2) throw { message: 'Network request failed' }
      },
      setBalise: async () => {},
    })
    const deps = okDeps()
    await flush(S, deps)
    expect((deps.counts as { sku: string }[]).map((c) => c.sku)).toEqual(['B', 'C'])
  })

  it('traite un doublon comme déjà envoyé', async () => {
    await enqueueCount(S, count('A', '5375'))
    const r = await flush(S, {
      insertCount: async () => {
        throw { code: '23505', message: 'duplicate key value violates unique constraint' }
      },
      setBalise: async () => {},
    })
    expect(r.sent).toBe(1)
    expect(await pendingBaliseCount(S)).toBe(0)
  })

  it('met de côté un refus du serveur sans bloquer la file', async () => {
    // Sans ça, un inventaire clôturé pendant que le compteur était en réserve
    // ferait échouer éternellement la première op, et tout le reste avec.
    await enqueueCount(S, count('REFUSE', '5375'))
    await enqueueCount(S, count('OK', '5375'))
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
    expect(r.sent).toBe(1)
    expect(r.failed).toBe(1)
    expect(await pendingBaliseCount(S)).toBe(0)

    const ko = await failedOps(S)
    expect(ko).toHaveLength(1)
    expect(ko[0].reason).toMatch(/row-level security/)
  })

  it('cloisonne les inventaires', async () => {
    await enqueueCount(S, count('A', '5375'))
    await enqueueCount('autre', { ...count('B', '5375'), session_id: 'autre' })
    expect(await pendingBaliseCount(S)).toBe(1)
    expect(await pendingBaliseCount('autre')).toBe(1)
  })

  it('efface tout le local d’un inventaire sans toucher aux autres', async () => {
    await cacheArticles(S, [article()])
    await enqueueCount(S, count('A', '5375'))
    await enqueueCount('autre', { ...count('B', '5375'), session_id: 'autre' })
    await clearSession(S)
    expect(await pendingBaliseCount(S)).toBe(0)
    expect(await resolveArticleOffline(S, 'SKU1')).toBeNull()
    expect(await pendingBaliseCount('autre')).toBe(1)
  })
})

describe('reprise de l’ancienne file (v1)', () => {
  it('reverse les scans déjà en attente dans le format par balise', async () => {
    // Un téléphone qui comptait hors ligne au moment de la mise à jour ne doit
    // rien perdre : l'ancienne file est une clé par scan.
    store.set(
      'offline:v1:op:session-1:1700000000000-0001',
      JSON.stringify({
        kind: 'count',
        id: 'legacy-1',
        at: 1700000000000,
        count: { ...count('LEGACY', '5375'), id: 'legacy-1', created_at: '2026-08-12T10:00:00Z' },
      }),
    )
    expect(await migrateLegacy(S)).toBe(1)
    const bal = await pendingBalises(S)
    expect(bal).toHaveLength(1)
    expect(bal[0].code).toBe('5375')
    expect([...store.keys()].some((k) => k.startsWith('offline:v1:op:'))).toBe(false)
  })
})
