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

let trousseauPresent = true
vi.mock('expo-secure-store', () => ({
  isAvailableAsync: async () => {
    // Un module natif absent ne rend pas `false` : il lève.
    if (!trousseauPresent) throw new Error('Cannot find native module ExpoSecureStore')
    return true
  },
  getItemAsync: async (k: string) => trousseau.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void trousseau.set(k, v),
  deleteItemAsync: async (k: string) => void trousseau.delete(k),
}))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => asyncStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void asyncStore.set(k, v),
    removeItem: async (k: string) => void asyncStore.delete(k),
    // ⚠️ Sans `getAllKeys`, le contrôle d'installation neuve LÈVE, son
    // `catch` l'avale, et tous les tests passent sans rien éprouver.
    getAllKeys: async () => [...asyncStore.keys()],
  },
}))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

import { sessionStore } from '@/lib/sessionStore'

const CLE = 'sb-heabesqvlinzarqenymj-auth-token'
/** Une session Supabase réelle pèse plusieurs kilo-octets. */
const session = (n: number) => JSON.stringify({ access_token: 'x'.repeat(n), user: { id: 'u1' } })

const MARQUE = 'quantinvo.installation'

beforeEach(() => {
  trousseau.clear()
  asyncStore.clear()
  // ⚠️ Sans cette marque, chaque test décrirait une installation NEUVE et la
  // session serait effacée à la première lecture. Les tests ci-dessous
  // parlent d'une application déjà installée ; ceux de la réinstallation
  // s'en occupent à part.
  asyncStore.set(MARQUE, '1')
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

describe('⚠️ un module natif absent ne donne pas un écran blanc', () => {
  // Arrivé le 28 août 2026 : la dépendance était dans `package.json`, le
  // `pod install` n'avait pas été fait, et deux téléphones reconstruits n'ont
  // plus rien affiché. Ce fichier est chargé par la racine de l'application :
  // une exception ici ne casse pas une page, elle empêche l'app de monter.
  it('retombe sur le stockage ordinaire, et le dit', async () => {
    const alerte = vi.spyOn(console, 'warn').mockImplementation(() => {})
    trousseauPresent = false
    // Le module garde son verdict en mémoire : on le recharge pour repartir
    // d'une page blanche.
    vi.resetModules()
    const { sessionStore: repli } = await import('@/lib/sessionStore')

    const v = session(4000)
    await repli.setItem(CLE, v)
    expect(await repli.getItem(CLE)).toBe(v)
    // Rien dans le trousseau, tout dans le stockage ordinaire.
    expect(trousseau.size).toBe(0)
    expect(asyncStore.get(CLE)).toBe(v)
    expect(alerte).toHaveBeenCalled()

    trousseauPresent = true
    alerte.mockRestore()
  })
})

/**
 * ⚠️⚠️ **SUPPRIMER L'APPLICATION DOIT DÉCONNECTER.**
 *
 * Le trousseau d'iOS survit à la suppression de l'app : Julien a réinstallé
 * depuis TestFlight le 22 septembre 2026 et s'est retrouvé connecté, sans mot
 * de passe. Sur un téléphone d'équipe, ce n'est pas acceptable.
 *
 * Le piège est dans la détection : au premier lancement qui suit une MISE À
 * JOUR, la marque d'installation n'existe pas non plus. S'en contenter
 * déconnecterait tout le monde ce jour-là. D'où le second critère — le
 * stockage ordinaire entièrement vide.
 */
describe('supprimer l’application déconnecte', () => {
  /** Le module retient son verdict : on repart d'une page blanche à chaque fois. */
  async function demarrer() {
    vi.resetModules()
    return (await import('@/lib/sessionStore')).sessionStore
  }

  it('⚠️ une installation neuve n’hérite pas de la session restée au trousseau', async () => {
    // Ce que laisse une désinstallation : le trousseau plein, le reste vide.
    trousseau.set(CLE, '1')
    trousseau.set(`${CLE}__0`, session(50))
    asyncStore.clear()

    const store = await demarrer()
    expect(await store.getItem(CLE), 'la session d’avant ne ressort pas').toBeNull()
    expect(trousseau.size, 'et elle est effacée, pas seulement masquée').toBe(0)
  })

  it('⚠️ mais une simple MISE À JOUR ne déconnecte personne', async () => {
    const v = session(50)
    trousseau.set(CLE, '1')
    trousseau.set(`${CLE}__0`, v)
    // Pas encore de marque — cette version vient d'arriver — mais le stockage
    // ordinaire porte les traces de l'usage précédent.
    asyncStore.clear()
    asyncStore.set('quantinvo.langue', 'fr')

    const store = await demarrer()
    expect(await store.getItem(CLE), 'la session tient').toBe(v)
    expect(asyncStore.get(MARQUE), 'et la marque est posée pour la suite').toBeDefined()
  })

  it('le contrôle ne se fait qu’une fois, pas à chaque lecture', async () => {
    const v = session(50)
    asyncStore.set(MARQUE, '1')
    const store = await demarrer()
    await store.setItem(CLE, v)
    expect(await store.getItem(CLE)).toBe(v)
    // Le stockage ordinaire se vide en cours de route (déconnexion, purge des
    // caches) : la lecture suivante ne doit pas conclure « installation neuve ».
    asyncStore.clear()
    expect(await store.getItem(CLE), 'toujours là').toBe(v)
  })
})
