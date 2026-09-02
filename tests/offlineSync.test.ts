import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * La bascule serveur ↔ local, exercée sur le VRAI module.
 *
 * `tests/offline.test.ts` couvre la file et le cache ; ici on éprouve
 * `offlineSync.ts` lui-même — celui qui décide, à chaque geste, entre le
 * serveur et le disque. C'est la pièce qui manquait le 1er septembre 2026 :
 * « Article inconnu » ne passait pas par elle du tout.
 */

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

// Une session d'authentification valable : sans elle, `syncNow` garde tout en
// file (garde de l'expiration de session), et rien ne partirait.
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) } },
}))
vi.mock('@/lib/presence', () => ({ pingSession: () => {} }))

/** Le serveur, simulé : `panne` coupe tout, comme une descente en réserve. */
const serveur = {
  panne: false,
  articles: [] as Record<string, unknown>[],
  counts: [] as Record<string, unknown>[],
  reset() { this.panne = false; this.articles = []; this.counts = [] },
}
const coupure = () => { throw { name: 'TypeError', message: 'Network request failed' } }

vi.mock('@/lib/queries', () => ({
  resolveArticle: async (_s: string, v: string) => {
    if (serveur.panne) coupure()
    return serveur.articles.find((a) => a.sku === v || a.ean === v) ?? null
  },
  insertArticle: async (a: Record<string, unknown>) => {
    if (serveur.panne) coupure()
    serveur.articles.push(a)
    return { ...a, ean_norm: null, updated_at: '2026-09-02T00:00:00Z' }
  },
  insertCount: async (c: Record<string, unknown>) => {
    if (serveur.panne) coupure()
    serveur.counts.push(c)
    return c
  },
  getMyScanEntries: async () => { if (serveur.panne) coupure(); return [] },
  getSessionArticles: async () => { if (serveur.panne) coupure(); return serveur.articles },
  getZones: async () => { if (serveur.panne) coupure(); return [] },
  getSession: async () => { if (serveur.panne) coupure(); return { id: 'S', uses_zones: true } },
  getSessions: async () => { if (serveur.panne) coupure(); return [] },
  setBalise: async () => { if (serveur.panne) coupure(); return { success: true } },
}))

import {
  getScanEntries,
  insertArticle,
  insertCount,
  isOffline,
  primeOfflineCache,
  resolveArticle,
  syncNow,
} from '@/lib/offlineSync'

const S = 'S'
const CODE = '3760999999999'

beforeEach(async () => {
  store.clear()
  serveur.reset()
  // On repart en ligne : l'état hors ligne est un module, il survit aux tests.
  await primeOfflineCache(S)
})

describe('« Article inconnu » pendant une coupure', () => {
  it('ne lève plus « fetch failed » : il part en file et se retrouve au scan suivant', async () => {
    serveur.panne = true
    // La coupure se constate au premier code présenté, comme sur le terrain.
    expect(await resolveArticle(S, CODE)).toBeNull()
    expect(isOffline()).toBe(true)

    const cree = await insertArticle(
      { session_id: S, sku: CODE, ean: CODE, brand: '', label: 'INCONNU', unit_purchase_price: 0 },
      '1000',
    )
    expect(cree.label).toBe('INCONNU')
    expect(serveur.articles).toHaveLength(0) // rien n'est parti, et rien n'a échoué

    // Rescanner le même code ne rouvre pas « Article inconnu ».
    expect((await resolveArticle(S, CODE))?.sku).toBe(CODE)

    await insertCount({ session_id: S, sku: CODE, pass_number: 1, qty: 1, counted_by: 'u1', zone: '1000' })

    // Retour du réseau : l'article d'abord, son comptage ensuite.
    serveur.panne = false
    const r = await syncNow(S)
    expect(r.interrupted).toBe(false)
    expect(r.failed).toBe(0)
    expect(serveur.articles.map((a) => a.sku)).toEqual([CODE])
    expect(serveur.counts.map((c) => c.sku)).toEqual([CODE])
    // `ean_norm` est généré côté serveur : il ne doit jamais être écrit.
    expect(serveur.articles[0]).not.toHaveProperty('ean_norm')
    expect(await syncNow(S)).toMatchObject({ sent: 0 })
  })

  it('survit à primeOfflineCache, qui réécrit le référentiel entier', async () => {
    serveur.panne = true
    await resolveArticle(S, CODE)
    await insertArticle(
      { session_id: S, sku: CODE, ean: CODE, brand: '', label: 'INCONNU', unit_purchase_price: 0 },
      '1000',
    )
    // Une barre de réseau, et l'écran de scan se rouvre : le catalogue du
    // serveur ne connaît pas encore cet article.
    serveur.panne = false
    await primeOfflineCache(S)
    expect((await resolveArticle(S, CODE))?.label).toBe('INCONNU')
  })
})

describe('la liste d’une balise pendant une coupure', () => {
  it('rend les scans mis en attente, avec leur libellé', async () => {
    serveur.panne = true
    await resolveArticle(S, CODE)
    await insertArticle(
      { session_id: S, sku: CODE, ean: CODE, brand: '', label: 'INCONNU', unit_purchase_price: 0 },
      '1000',
    )
    await insertCount({ session_id: S, sku: CODE, pass_number: 1, qty: 1, counted_by: 'u1', zone: '1000' })
    await insertCount({ session_id: S, sku: CODE, pass_number: 1, qty: 1, counted_by: 'u1', zone: '1000' })

    const liste = await getScanEntries(S, 1, 'u1', '1000')
    expect(liste).toHaveLength(1)
    expect(liste[0].qty).toBe(2)               // deux scans, une ligne
    expect(liste[0].article.label).toBe('INCONNU')
  })

  it('ne mélange jamais deux balises', async () => {
    serveur.panne = true
    await resolveArticle(S, CODE)
    await insertCount({ session_id: S, sku: 'A', pass_number: 1, qty: 1, counted_by: 'u1', zone: '1000' })
    await insertCount({ session_id: S, sku: 'B', pass_number: 1, qty: 1, counted_by: 'u1', zone: '1001' })
    expect((await getScanEntries(S, 1, 'u1', '1000')).map((e) => e.article.sku)).toEqual(['A'])
    expect((await getScanEntries(S, 1, 'u1', '1001')).map((e) => e.article.sku)).toEqual(['B'])
  })

  it('retire une référence entièrement corrigée', async () => {
    serveur.panne = true
    await resolveArticle(S, CODE)
    await insertCount({ session_id: S, sku: 'A', pass_number: 1, qty: 2, counted_by: 'u1', zone: '1000' })
    await insertCount({ session_id: S, sku: 'A', pass_number: 1, qty: -2, counted_by: 'u1', zone: '1000' })
    expect(await getScanEntries(S, 1, 'u1', '1000')).toEqual([])
  })

  it('ne retient pas la passe d’à côté', async () => {
    serveur.panne = true
    await resolveArticle(S, CODE)
    await insertCount({ session_id: S, sku: 'A', pass_number: 2, qty: 1, counted_by: 'u1', zone: '1000' })
    expect(await getScanEntries(S, 1, 'u1', '1000')).toEqual([])
  })
})
