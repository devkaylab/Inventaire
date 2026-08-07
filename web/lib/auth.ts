import { supabase } from './supabaseClient'

/** Destination d'accueil d'un utilisateur selon son rôle. */
export function homePathForRole(prof: { role: string | null; is_admin: boolean | null } | null): string {
  if (prof?.is_admin) return '/admin'
  if (prof?.role === 'supervisor') return '/dashboard'
  return '/account'
}

/** Renvoie le chemin de l'espace de l'utilisateur connecté, ou null si non connecté. */
export async function getMySpacePath(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', session.user.id)
    .maybeSingle()
  return homePathForRole(data as { role: string | null; is_admin: boolean | null } | null)
}
