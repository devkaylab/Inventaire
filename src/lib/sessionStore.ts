/**
 * Où vit le jeton de session sur le téléphone.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. Jusqu'au 28 août 2026, supabase-js rangeait la
 * session dans `AsyncStorage` : un fichier en clair dans le bac à sable de
 * l'application. Le bac à sable la protège des autres applications, pas d'un
 * téléphone déverrouillé, d'une sauvegarde non chiffrée ni d'un appareil
 * débridé — et une session vaut trente jours d'inactivité. Constat n°8 de la
 * revue de sécurité.
 *
 * Elle vit désormais dans le **trousseau** (`expo-secure-store`), c'est-à-dire
 * le Keychain d'iOS et le Keystore d'Android : chiffré par le système, lié à
 * l'appareil, et inaccessible tant que le téléphone n'a pas été déverrouillé
 * une première fois depuis son démarrage.
 *
 * ── LES TROIS PIÈGES, ET CE QU'ILS IMPOSENT ────────────────────────────────
 *
 * 1. **Le trousseau ne prend pas de grandes valeurs.** Expo annonce 2 048
 *    octets par entrée, et prévient qu'au-delà l'écriture pourra échouer. Or
 *    une session Supabase — deux jetons JWT et l'objet utilisateur — dépasse
 *    couramment ce seuil. On la **découpe** donc en morceaux de 1 800 octets,
 *    rangés sous `<clé>__0`, `<clé>__1`… avec leur nombre sous `<clé>`.
 *    ⚠️ Ne pas remplacer ce découpage par un `setItemAsync` direct : ça
 *    marchera sur une session courte et cassera sur une longue, donc plus tard,
 *    et sur le téléphone de quelqu'un d'autre.
 *
 * 2. **Personne ne doit être déconnecté par ce changement.** À la première
 *    lecture, si le trousseau est vide, on regarde dans `AsyncStorage` : si la
 *    session de l'ancien monde y est, on la **déménage** puis on efface
 *    l'ancienne copie. Sans cela, tous les compteurs installés se
 *    retrouveraient devant l'écran de connexion — un matin d'inventaire, ça se
 *    paie cher.
 *
 * 3. **Le trousseau n'existe pas sur le web.** `react-native-web` est dans les
 *    dépendances ; sur cette plateforme on retombe sur `AsyncStorage`, faute de
 *    mieux. Le web n'est pas la cible du produit, mais il ne doit pas planter.
 *
 * Le reste du cache hors ligne (catalogue d'articles, file de comptages) reste
 * dans `AsyncStorage` : il est volumineux, et il est effacé à la déconnexion
 * par `oublierCachesLocaux`. Le trousseau est pour le secret, pas pour le
 * volume.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

/** Sous la limite annoncée de 2 048 octets, avec de la marge pour l'UTF-8. */
const TAILLE_MORCEAU = 1800

const morceau = (cle: string, i: number) => `${cle}__${i}`

/** Le trousseau n'accepte que ces caractères dans une clé. */
const cleValide = (cle: string) => /^[A-Za-z0-9._-]+$/.test(cle)

const surLeWeb = Platform.OS === 'web'

async function lireNombre(cle: string): Promise<number> {
  const brut = await SecureStore.getItemAsync(cle)
  const n = brut === null ? NaN : Number(brut)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

async function effacerMorceaux(cle: string, jusqua: number): Promise<void> {
  for (let i = 0; i < jusqua; i++) await SecureStore.deleteItemAsync(morceau(cle, i))
}

export const sessionStore = {
  async getItem(cle: string): Promise<string | null> {
    if (surLeWeb || !cleValide(cle)) return AsyncStorage.getItem(cle)

    const n = await lireNombre(cle)
    if (n > 0) {
      const parts: string[] = []
      for (let i = 0; i < n; i++) {
        const p = await SecureStore.getItemAsync(morceau(cle, i))
        // Un morceau manquant rend la valeur illisible : mieux vaut rendre
        // `null` — supabase-js redemandera une connexion — que de rendre un
        // JSON tronqué qu'il ne saura pas analyser.
        if (p === null) return null
        parts.push(p)
      }
      return parts.join('')
    }

    // Rien dans le trousseau : la session de l'ancien monde est peut-être
    // encore dans AsyncStorage. On la déménage plutôt que de déconnecter.
    const ancienne = await AsyncStorage.getItem(cle)
    if (ancienne === null) return null
    await this.setItem(cle, ancienne)
    await AsyncStorage.removeItem(cle)
    return ancienne
  },

  async setItem(cle: string, valeur: string): Promise<void> {
    if (surLeWeb || !cleValide(cle)) return AsyncStorage.setItem(cle, valeur)

    const avant = await lireNombre(cle)
    const parts: string[] = []
    for (let i = 0; i < valeur.length; i += TAILLE_MORCEAU) {
      parts.push(valeur.slice(i, i + TAILLE_MORCEAU))
    }

    for (let i = 0; i < parts.length; i++) {
      await SecureStore.setItemAsync(morceau(cle, i), parts[i])
    }
    // Une session plus courte que la précédente laisserait des morceaux
    // orphelins, qu'une lecture ultérieure recollerait à la suite.
    for (let i = parts.length; i < avant; i++) {
      await SecureStore.deleteItemAsync(morceau(cle, i))
    }
    await SecureStore.setItemAsync(cle, String(parts.length))
  },

  async removeItem(cle: string): Promise<void> {
    if (surLeWeb || !cleValide(cle)) return AsyncStorage.removeItem(cle)

    const n = await lireNombre(cle)
    await effacerMorceaux(cle, n)
    await SecureStore.deleteItemAsync(cle)
    // Et la copie de l'ancien monde, si le déménagement n'a jamais eu lieu.
    await AsyncStorage.removeItem(cle)
  },
}
