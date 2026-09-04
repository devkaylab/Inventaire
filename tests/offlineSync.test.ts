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
  totaux: { counted: 0, audited: 0 },
  /** Le référentiel du serveur : une ligne par SKU, avec sa date. */
  catalogue: [] as { sku: string; date: string }[],
  /** Combien de lignes le dernier téléchargement a demandées, et combien d'appels. */
  demandes: [] as (string | null)[],
  reset() {
    this.panne = false; this.articles = []; this.counts = []
    this.totaux = { counted: 0, audited: 0 }
    this.catalogue = []; this.demandes = []
  },
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
  catalogueRepere: async () => {
    if (serveur.panne) coupure()
    const dates = serveur.catalogue.map((a) => a.date).sort()
    return { repere: dates.length ? dates[dates.length - 1] : null, total: serveur.catalogue.length }
  },
  getCatalogue: async (_s: string, depuis?: string | null) => {
    if (serveur.panne) coupure()
    serveur.demandes.push(depuis ?? null)
    return serveur.catalogue
      .filter((a) => !depuis || a.date > depuis)
      .map((a) => ({
        id: '', session_id: 'S', sku: a.sku, ean: null, ean_norm: null,
        label: a.sku, brand: '', unit_purchase_price: 0, updated_at: '',
      }))
  },
  getZones: async () => { if (serveur.panne) coupure(); return [] },
  getSession: async () => { if (serveur.panne) coupure(); return { id: 'S', uses_zones: true } },
  getSessions: async () => { if (serveur.panne) coupure(); return [] },
  getMyCountTotals: async () => { if (serveur.panne) coupure(); return serveur.totaux },
  setBalise: async () => { if (serveur.panne) coupure(); return { success: true } },
}))

import { getCachedArticles } from '@/lib/offline'
import {
  getMyCountTotals,
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

/**
 * L'écran de progression du compteur, hors ligne (4 septembre 2026).
 *
 * Constat de Julien : « lorsque nous sommes hors ligne la page progression
 * sur téléphone reste blanche ». Le total du serveur était la SEULE requête
 * de cet écran à ne pas passer par la bascule : sans réseau elle échouait,
 * React Query la rejouait, et tout l'écran restait derrière son chargement —
 * y compris le bouton « Compter des articles », la seule chose dont on ait
 * besoin en réserve.
 */
describe('les totaux du compteur survivent à la coupure', () => {
  it('rend la dernière valeur connue quand le réseau tombe', async () => {
    serveur.totaux = { counted: 142, audited: 30 }
    expect(await getMyCountTotals(S)).toEqual({ counted: 142, audited: 30 })

    serveur.panne = true
    expect(await getMyCountTotals(S)).toEqual({ counted: 142, audited: 30 })
  })

  it('⚠️ rend NULL quand rien n’est connu, jamais zéro', async () => {
    // « 0 pièce comptée » à quelqu'un qui vient d'en compter cent est le
    // genre de chiffre qu'on croit. L'écran écrit « — ».
    serveur.panne = true
    await resolveArticle(S, CODE) // constate la coupure
    expect(await getMyCountTotals('session-jamais-vue')).toBeNull()
  })

  it('une fois hors ligne, elle n’interroge plus le serveur', async () => {
    // C'est ce qui rend l'écran instantané en réserve : sans cette garde,
    // chaque ouverture réattend le délai réseau.
    serveur.totaux = { counted: 5, audited: 0 }
    await getMyCountTotals(S)
    serveur.panne = true
    await resolveArticle(S, CODE)
    expect(isOffline()).toBe(true)
    serveur.totaux = { counted: 999, audited: 999 } // le serveur bouge, on ne le demande pas
    expect(await getMyCountTotals(S)).toEqual({ counted: 5, audited: 0 })
  })
})

/**
 * Le catalogue ne repart pas en entier (4 septembre 2026).
 *
 * Chaque téléphone téléchargeait le référentiel complet à chaque ouverture de
 * l'écran de comptage — 116 Mo pour 400 000 références, par appareil. Ces
 * gardes tiennent les deux moitiés du correctif : ne demander que le delta,
 * et **rattraper les suppressions**, qu'aucune date de modification ne dit.
 */
describe('le catalogue hors ligne ne se retélécharge pas pour rien', () => {
  const cat = (n: number, date: string) =>
    Array.from({ length: n }, (_, i) => ({ sku: `A${i}`, date }))
  const skusEnCache = async () =>
    (await getCachedArticles(S)).map((a) => a.sku).sort()

  it('le premier passage prend tout, le second ne demande rien', async () => {
    serveur.catalogue = cat(3, '2026-09-04T10:00:00Z')
    store.clear(); serveur.demandes = []
    expect(await primeOfflineCache(S)).toBe(true)
    expect(serveur.demandes).toEqual([null]) // téléchargement complet
    expect(await skusEnCache()).toEqual(['A0', 'A1', 'A2'])

    serveur.demandes = []
    expect(await primeOfflineCache(S)).toBe(true)
    expect(serveur.demandes).toEqual([]) // rien n'a bougé : aucun appel
    expect(await skusEnCache()).toEqual(['A0', 'A1', 'A2'])
  })

  it('un ajout ne fait descendre que lui, et il rejoint le cache', async () => {
    serveur.catalogue = cat(3, '2026-09-04T10:00:00Z')
    store.clear(); serveur.demandes = []
    await primeOfflineCache(S)

    serveur.catalogue.push({ sku: 'A9', date: '2026-09-04T11:00:00Z' })
    serveur.demandes = []
    await primeOfflineCache(S)
    // Le delta part DU repère précédent, pas du début.
    expect(serveur.demandes).toEqual(['2026-09-04T10:00:00Z'])
    expect(await skusEnCache()).toEqual(['A0', 'A1', 'A2', 'A9'])
  })

  it('⚠️ UNE SUPPRESSION FAIT TOUT RETÉLÉCHARGER', async () => {
    // C'est le point qu'une date de modification ne peut pas dire — et
    // remplacer un fichier d'import efface des lignes. Sans cette garde, un
    // code scanné se résoudrait sur un article que le référentiel ne
    // contient plus.
    serveur.catalogue = cat(3, '2026-09-04T10:00:00Z')
    store.clear(); serveur.demandes = []
    await primeOfflineCache(S)

    serveur.catalogue = [{ sku: 'A0', date: '2026-09-04T10:00:00Z' }]
    serveur.demandes = []
    await primeOfflineCache(S)
    // Le repère n'a pas bougé, mais le compte ne tombe plus : on refait tout.
    expect(serveur.demandes).toEqual([null])
    expect(await skusEnCache()).toEqual(['A0'])
  })

  it('⚠️ un article saisi en réserve ne fausse pas le décompte', async () => {
    // Il est dans le cache et pas encore en base : le compter ferait diverger
    // le total à chaque saisie manuelle, donc retélécharger pour rien.
    serveur.catalogue = cat(2, '2026-09-04T10:00:00Z')
    store.clear(); serveur.demandes = []
    await primeOfflineCache(S)

    serveur.panne = true
    await resolveArticle(S, CODE) // constate la coupure
    await insertArticle(
      { session_id: S, sku: CODE, ean: CODE, brand: '', label: 'INCONNU', unit_purchase_price: 0 },
      '1000',
    )
    serveur.panne = false
    serveur.demandes = []
    await primeOfflineCache(S)
    expect(serveur.demandes).toEqual([]) // aucun téléchargement : le compte tombe juste
    expect(await skusEnCache()).toEqual(['A0', 'A1', CODE].sort())
  })
})
