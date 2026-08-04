import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Clé publique (anon) — protégée côté serveur par les règles RLS + is_admin.
export const supabase = createClient(url, anonKey)
