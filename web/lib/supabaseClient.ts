import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// `createClient` lève si l'URL est absente. Comme ce module est importé par
// toutes les pages, une variable d'environnement manquante faisait échouer le
// prérendu de `next build` avec un message sans rapport (« supabaseUrl is
// required »). On échoue donc explicitement au premier usage, côté navigateur,
// avec un message qui dit quoi corriger.
const placeholder = 'https://unconfigured.supabase.co'

if (!url || !anonKey) {
  const message =
    'Configuration Supabase manquante : renseignez NEXT_PUBLIC_SUPABASE_URL et ' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY (voir .env.example à la racine du dépôt).'
  if (typeof window !== 'undefined') console.error(message)
}

// Clé publique (anon) — l'accès réel est borné côté serveur par les règles RLS.
export const supabase = createClient(url || placeholder, anonKey || 'unconfigured', {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** `false` quand le site tourne sans configuration Supabase exploitable. */
export const supabaseConfigured = Boolean(url && anonKey)
