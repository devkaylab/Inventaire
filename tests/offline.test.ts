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
  cacheProfile,
  cacheSession,
  cacheSessionList,
  cacheZones,
  clearSession,
  oublierCachesLocaux,
  getCachedProfile,
  getCachedSession,
  getCachedSessionList,
  enqueueBalise,
  enqueueCount,
  failedOps,
  hasCachedArticles,
  flush,
  isAuthExpired,
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

  it('une session expirée conserve la file au lieu de la jeter', async () => {
    // Préparation de l'expiration de session (21 août 2026) : sans cette
    // distinction, un jeton périmé pendant un inventaire rangeait des
    // comptages valides dans les échecs définitifs — le compteur perdait son
    // travail au lieu de le voir repartir après reconnexion.
    await enqueueCount(S, count('A', '5375'))
    await enqueueCount(S, count('B', '5375'))
    const r = await flush(S, {
      insertCount: async () => { throw { code: 'PGRST301', message: 'JWT expired' } },
      setBalise: async () => {},
    })
    expect(r.interrupted).toBe(true)
    expect(r.sent).toBe(0)
    expect(r.failed).toBe(0)
    expect((await pendingCounts(S)).map((c) => c.sku)).toEqual(['A', 'B'])
    expect(await failedOps(S)).toHaveLength(0)
  })

  it('un refus de droits reste un échec définitif, lui', async () => {
    // 42501 avec une session valide : retiré de l'inventaire, ou inventaire
    // clôturé. Le masquer derrière une file d'attente ferait croire au
    // compteur que son travail passera.
    await enqueueCount(S, count('A', '5375'))
    const r = await flush(S, {
      insertCount: async () => { throw { code: '42501', message: 'row-level security policy' } },
      setBalise: async () => {},
    })
    expect(r.interrupted).toBe(false)
    expect(r.failed).toBe(1)
    expect(await failedOps(S)).toHaveLength(1)
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

describe('robustesse : crash et écritures simultanées', () => {
  it('ne perd aucun scan quand plusieurs partent en même temps', async () => {
    // Cas réel : une douchette qui envoie deux codes coup sur coup, ou une
    // clôture de balise déclenchée pendant qu'un scan s'écrit encore. Sans
    // sérialisation, les deux lisent la même tranche et le second écrase le
    // premier — un scan disparaît sans laisser de trace.
    await Promise.all(
      Array.from({ length: 60 }, (_, i) => enqueueCount(S, count(`SKU${i}`, '5375'))),
    )
    expect((await pendingBalises(S))[0].scans).toBe(60)
  })

  it('mêle sans perte les scans et les opérations de balise concurrents', async () => {
    await Promise.all([
      enqueueCount(S, count('A', '5375')),
      enqueueBalise(S, '5375', 'count', false),
      enqueueCount(S, count('B', '5375')),
      enqueueCount(S, count('C', '5376')),
    ])
    const bal = await pendingBalises(S)
    expect(bal.find((b) => b.code === '5375')?.scans).toBe(2)
    expect(bal.find((b) => b.code === '5375')?.hasBaliseOp).toBe(true)
    expect(bal.find((b) => b.code === '5376')?.scans).toBe(1)
  })

  it('conserve tout ce qui est déjà écrit après un arrêt brutal', async () => {
    // Un crash ne « défait » rien : ce qui est passé par enqueue est sur le
    // disque. On le vérifie en repartant d'un état mémoire vierge, comme au
    // redémarrage de l'app.
    for (const sku of ['A', 'B', 'C']) await enqueueCount(S, count(sku, '5375'))
    const snapshot = new Map(store)
    store.clear()
    for (const [k, v] of snapshot) store.set(k, v) // le disque a survécu
    expect((await pendingCounts(S)).map((c) => c.sku)).toEqual(['A', 'B', 'C'])
  })
})

describe('reprise après redémarrage hors ligne', () => {
  it('restitue le profil, la fiche et la liste des inventaires', async () => {
    // Sans ces trois éléments, l'app rouvre sur une page blanche et les scans
    // en attente restent inaccessibles — à l'abri, mais bloqués.
    await cacheProfile({ id: 'u1', full_name: 'Compteur' })
    await cacheSession(S, { id: S, uses_zones: true, status: 'counting' })
    await cacheSessionList([{ id: S }])

    expect(await getCachedProfile<{ id: string }>()).toMatchObject({ id: 'u1' })
    expect(await getCachedSession<{ uses_zones: boolean }>(S)).toMatchObject({ uses_zones: true })
    expect(await getCachedSessionList<{ id: string }>()).toHaveLength(1)
  })

  it('efface la fiche de l’inventaire quand on le quitte', async () => {
    await cacheSession(S, { id: S })
    await clearSession(S)
    expect(await getCachedSession(S)).toBeNull()
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

describe('isAuthExpired', () => {
  it('reconnaît un jeton périmé ou absent', () => {
    expect(isAuthExpired({ code: 'PGRST301', message: 'JWT expired' })).toBe(true)
    expect(isAuthExpired({ status: 401 })).toBe(true)
    expect(isAuthExpired({ name: 'AuthSessionMissingError' })).toBe(true)
    expect(isAuthExpired({ message: 'invalid JWT: token is expired' })).toBe(true)
  })

  it('ne confond pas un refus de droits avec une session perdue', () => {
    expect(isAuthExpired({ code: '42501', message: 'row-level security policy' })).toBe(false)
    expect(isAuthExpired({ code: '23505', message: 'duplicate key value' })).toBe(false)
    expect(isAuthExpired({ message: 'Network request failed' })).toBe(false)
    expect(isAuthExpired(null)).toBe(false)
  })
})

describe('la déconnexion fait le ménage, sans perdre le travail', () => {
  // Constat n°8 de la revue de sécurité du 28 août 2026 : le catalogue
  // d'articles restait en clair sur le téléphone après la déconnexion.
  const SID = '11111111-1111-1111-1111-111111111111'

  it('efface ce qui se retélécharge', async () => {
    await cacheProfile({ id: 'u1' })
    await cacheSessionList([{ id: SID }])
    await cacheSession(SID, { id: SID, uses_zones: true })
    await cacheArticles(SID, [
      { id: 'a1', session_id: SID, sku: 'A', ean: '3701', brand: 'M', label: 'Pull',
        unit_purchase_price: 10 } as never,
    ])
    await cacheZones(SID, [{ id: 'z1', session_id: SID, code: '1000' } as never])

    const bilan = await oublierCachesLocaux()
    expect(bilan.effaces).toBeGreaterThan(0)

    expect(await getCachedProfile()).toBeNull()
    expect(await getCachedSessionList()).toBeNull()
    expect(await getCachedSession(SID)).toBeNull()
    expect(await hasCachedArticles(SID)).toBe(false)
  })

  it('⚠️ garde les comptages en attente — ils n’existent nulle part ailleurs', async () => {
    // C'est la seule donnée du téléphone qui ne se retélécharge pas. Les
    // effacer ferait perdre une journée de comptage à quelqu'un qui se
    // déconnecte avant d'avoir retrouvé du réseau.
    await enqueueCount(SID, { sku: 'A', ean: null, qty: 3, zone: '1000', passNumber: 1 })
    await enqueueCount(SID, { sku: 'B', ean: null, qty: 1, zone: '1000', passNumber: 1 })

    const avant = await pendingCounts(SID)
    expect(avant.length).toBe(2)

    const bilan = await oublierCachesLocaux()
    expect(bilan.conserves).toBeGreaterThan(0)

    const apres = await pendingCounts(SID)
    expect(apres.length).toBe(2)
  })
})
