import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { sessionStore } from '@/lib/sessionStore'
import type { Database } from '@/types/database.types'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
