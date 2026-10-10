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
  const { data, error } = await supabase
    .from('profiles')
    .select('role, is_admin, is_company_admin')
    .eq('id', session.user.id)
    .maybeSingle()
  /**
   * ⚠️⚠️ **UN PROFIL ILLISIBLE NE DONNE PAS UN ESPACE PAR DÉFAUT** (10 octobre
   * 2026). `homePathForRole(null)` rend `/account` : sur un échec de lecture,
   * `/login` envoyait donc vers un écran authentifié, dont la garde renvoyait
   * à `/login`, qui renvoyait à `/account`… Julien l'a vu clignoter, et je
   * l'ai mesuré en direct — l'onglet passait de l'un à l'autre toutes les
   * quelques secondes.
   *
   * Rendre `null` garde la personne sur `/login`, qui sait quoi faire d'elle.
   * C'est la moitié de la fermeture ; l'autre est dans `useAuthGuard`, qui
   * DÉCONNECTE avant de renvoyer ici. Il faut les deux : une boucle a toujours
   * deux côtés, et n'en fermer qu'un la déplace.
   */
  if (error || !data) return null
  return homePathForRole(data as ProfilAccueil | null)
}
