import { supabase } from './supabaseClient'

type ProfilAccueil = {
  role: string | null
  is_admin: boolean | null
  is_company_admin?: boolean | null
}

/**
 * Destination d'accueil d'un utilisateur selon son rôle.
 *
 * L'administrateur d'entreprise n'atterrit pas sur les inventaires : ce sont
 * ceux de ses superviseurs. Il ouvre le site pour savoir où en est son
 * entreprise — c'est son tableau de bord qui répond à ça.
 */
export function homePathForRole(prof: ProfilAccueil | null): string {
  if (prof?.is_admin) return '/admin'
  if (prof?.is_company_admin) return '/entreprise'
  if (prof?.role === 'supervisor') return '/dashboard'
  return '/account'
}

/** Renvoie le chemin de l'espace de l'utilisateur connecté, ou null si non connecté. */
export async function getMySpacePath(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase
    .from('profiles')
    .select('role, is_admin, is_company_admin')
    .eq('id', session.user.id)
    .maybeSingle()
  return homePathForRole(data as ProfilAccueil | null)
}
