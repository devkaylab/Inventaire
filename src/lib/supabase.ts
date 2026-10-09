import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { sessionStore } from '@/lib/sessionStore'
import { DELAI_DE_FOND_MS } from '@/lib/reseau'
import type { Database } from '@/types/database.types'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

/**
 * ⚠️⚠️ **LE FILET : AUCUNE REQUÊTE NE PEND INDÉFINIMENT** (9 octobre 2026).
 *
 * En zone grise — « ça affiche 5G mais rien ne passe » — une requête n'échoue
 * pas, elle pend. L'app n'avait aucun délai à elle, donc elle attendait celui
 * d'iOS : des dizaines de secondes pendant lesquelles l'écran mouline, et
 * pendant lesquelles `offlineSync` ne sait pas encore qu'il faut basculer.
 *
 * Ce filet est volontairement LARGE (vingt secondes) : il n'est pas là pour
 * rendre l'app vive, il est là pour qu'aucune requête ne soit immortelle. Ce
 * qui rend l'app vive, c'est le budget court posé à la main sur les appels que
 * quelqu'un attend — voir `avecDelai` et `DELAI_INTERACTIF_MS`.
 *
 * ⚠️ **ET IL S'EFFACE DEVANT UN SIGNAL D'APPELANT.** `postgrest-js` passe le
 * signal de `.abortSignal()` dans `init.signal` : l'écraser ici annulerait les
 * budgets courts et ne laisserait que celui-ci. Quand l'appelant a dit combien
 * de temps il accepte d'attendre, c'est lui qui a raison.
 */
const fetchAvecFilet: typeof fetch = (entree, init) => {
  if (init?.signal) return fetch(entree, init)
  const controleur = new AbortController()
  const minuterie = setTimeout(() => controleur.abort(), DELAI_DE_FOND_MS)
  return fetch(entree, { ...init, signal: controleur.signal })
    .finally(() => clearTimeout(minuterie))
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchAvecFilet },
  auth: {
    // ⚠️ Le trousseau du système, pas `AsyncStorage` : un jeton de session vaut
    // trente jours d'inactivité, il n'a rien à faire dans un fichier en clair.
    // Le déménagement des sessions déjà ouvertes est transparent — voir
    // `sessionStore` (constat n°8 de la revue du 28 août 2026).
    storage: sessionStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
