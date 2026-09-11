/**
 * D'où vient la langue, et où elle se garde.
 *
 * Séparé de `i18n.ts` parce qu'il touche à deux modules natifs —
 * `expo-localization` et le stockage — que les tests n'ont pas.
 *
 * L'ordre : la préférence enregistrée sur cet appareil, sinon la langue du
 * téléphone si on la parle, sinon le français. La préférence n'est pas un
 * secret : elle vit dans AsyncStorage, comme le thème, et `oublierCachesLocaux`
 * l'efface à la déconnexion — c'est voulu, un téléphone partagé repart de la
 * langue de l'appareil.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getLocales } from 'expo-localization'
import { LANGUES, poserLangue, type Langue } from '@/lib/i18n'

const CLE = 'ui.langue.v1'

function estLangue(v: unknown): v is Langue {
  return typeof v === 'string' && (LANGUES as readonly string[]).includes(v)
}

/** La langue du téléphone, si le produit la parle. */
export function langueDeLAppareil(): Langue {
  try {
    const code = getLocales()[0]?.languageCode
    return estLangue(code) ? code : 'fr'
  } catch {
    return 'fr'
  }
}

/** À l'ouverture : relit la préférence et pose la langue. Rend celle choisie. */
export async function chargerLangue(): Promise<Langue> {
  let l = langueDeLAppareil()
  try {
    const stockee = await AsyncStorage.getItem(CLE)
    if (estLangue(stockee)) l = stockee
  } catch {
    // Stockage indisponible : la langue de l'appareil suffit.
  }
  poserLangue(l)
  return l
}

/** Choix explicite depuis Mon compte : posé tout de suite, gardé pour la suite. */
export async function changerLangue(l: Langue): Promise<void> {
  poserLangue(l)
  try {
    await AsyncStorage.setItem(CLE, l)
  } catch {
    // Sans stockage, le choix vaut pour la session ; on ne bloque personne.
  }
}
