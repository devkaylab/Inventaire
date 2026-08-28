// Le jeton de session vit dans le trousseau (28 août 2026).
//
// Constat n°8 de la revue de sécurité. Ces tests couvrent les trois choses que
// la relecture ne voit pas : le découpage sous la limite du trousseau, le
// déménagement des sessions déjà ouvertes, et les morceaux orphelins qu'une
// session plus courte laisserait derrière elle.
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Les deux modules natifs, remplacés par des Map.
const trousseau = new Map<string, string>()
const asyncStore = new Map<string, string>()

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => trousseau.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void trousseau.set(k, v),
  deleteItemAsync: async (k: string) => void trousseau.delete(k),
}))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => asyncStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void asyncStore.set(k, v),
    removeItem: async (k: string) => void asyncStore.delete(k),
  },
}))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

import { sessionStore } from '@/lib/sessionStore'

const CLE = 'sb-heabesqvlinzarqenymj-auth-token'
/** Une session Supabase réelle pèse plusieurs kilo-octets. */
const session = (n: number) => JSON.stringify({ access_token: 'x'.repeat(n), user: { id: 'u1' } })

beforeEach(() => {
  trousseau.clear()
  asyncStore.clear()
})

describe('le jeton de session dans le trousseau', () => {
  it('rend exactement ce qu’on lui a donné', async () => {
    const v = session(50)
    await sessionStore.setItem(CLE, v)
    expect(await sessionStore.getItem(CLE)).toBe(v)
  })

  it('⚠️ découpe une session trop grande pour une entrée', async () => {
    // Expo annonce 2 048 octets par entrée et prévient qu'au-delà l'écriture
    // pourra échouer. Une vraie session dépasse couramment ce seuil : sans
    // découpage, ça marche en essai et casse en production.
    const v = session(6000)
    await sessionStore.setItem(CLE, v)

    expect(await sessionStore.getItem(CLE)).toBe(v)
    // Aucun morceau ne dépasse la limite.
    for (const [k, morceau] of trousseau) {
      if (k !== CLE) expect(morceau.length).toBeLessThanOrEqual(2048)
    }
    // Et le compte des morceaux est bien rangé sous la clé elle-même.
    expect(Number(trousseau.get(CLE))).toBeGreaterThan(1)
  })

  it('⚠️ ne laisse pas de morceaux orphelins quand la session raccourcit', async () => {
    // Sans ce ménage, une lecture ultérieure recollerait la queue de l'ancienne
    // session à la nouvelle, et rendrait un JSON illisible.
    await sessionStore.setItem(CLE, session(9000))
    const courte = session(100)
    await sessionStore.setItem(CLE, courte)

    expect(await sessionStore.getItem(CLE)).toBe(courte)
    expect(Number(trousseau.get(CLE))).toBe(1)
    expect(trousseau.has(`${CLE}__1`)).toBe(false)
  })

  it('rend null plutôt qu’un JSON tronqué si un morceau manque', async () => {
    await sessionStore.setItem(CLE, session(6000))
    trousseau.delete(`${CLE}__1`)
    // supabase-js redemandera une connexion : c'est préférable à une valeur
    // qu'il ne saura pas analyser.
    expect(await sessionStore.getItem(CLE)).toBeNull()
  })

  it('efface tout, morceaux compris', async () => {
    await sessionStore.setItem(CLE, session(6000))
    await sessionStore.removeItem(CLE)
    expect(await sessionStore.getItem(CLE)).toBeNull()
    expect([...trousseau.keys()].filter((k) => k.startsWith(CLE))).toEqual([])
  })
})

describe('⚠️ personne n’est déconnecté par le changement', () => {
  it('déménage une session restée dans l’ancien stockage', async () => {
    // Sans cela, tous les compteurs déjà installés se retrouveraient devant
    // l'écran de connexion — un matin d'inventaire, ça se paie cher.
    const v = session(3000)
    asyncStore.set(CLE, v)

    expect(await sessionStore.getItem(CLE)).toBe(v)
    // Et l'ancienne copie en clair ne traîne plus.
    expect(asyncStore.has(CLE)).toBe(false)
    expect(Number(trousseau.get(CLE))).toBeGreaterThan(0)

    // La relecture suivante passe par le trousseau, sans rien redemander.
    expect(await sessionStore.getItem(CLE)).toBe(v)
  })

  it('la déconnexion emporte aussi la copie de l’ancien monde', async () => {
    asyncStore.set(CLE, session(50))
    await sessionStore.removeItem(CLE)
    expect(asyncStore.has(CLE)).toBe(false)
  })
})
