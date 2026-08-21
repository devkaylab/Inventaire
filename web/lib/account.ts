import { supabase } from '@/lib/supabaseClient'
import { errorMessage } from '@/lib/errors'

/**
 * Données de l'espace « Mon compte », en miroir de l'écran Profil de
 * l'application. Les requêtes sont volontairement les mêmes : c'est la RLS qui
 * borne le périmètre (entreprise du membre), pas le client.
 */

export type Company = { id: string; name: string }
export type TeamMember = { id: string; full_name: string | null; role: string | null }
export type TeamInvitation = { id: string; email: string; full_name: string | null; created_at: string }

function fail(context: string, error: unknown): never {
  console.error(`[account] ${context}`, error)
  throw new Error(errorMessage(error))
}

/** L'entreprise du membre courant. RLS n'en renvoie qu'une. */
export async function getMyCompany(): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name')
    .limit(1)
    .maybeSingle()
  if (error) fail('getMyCompany', error)
  return (data as Company) ?? null
}

/** Membres de l'entreprise (superviseurs et compteurs). */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('role', { ascending: true })
    .order('full_name', { ascending: true })
  if (error) fail('getTeamMembers', error)
  return (data ?? []) as TeamMember[]
}

/** Compteurs pré-inscrits qui n'ont pas encore créé leur compte. */
export async function getTeamInvitations(): Promise<TeamInvitation[]> {
  const { data, error } = await supabase
    .from('team_invitations')
    .select('id, email, full_name, created_at')
    .order('created_at', { ascending: false })
  if (error) fail('getTeamInvitations', error)
  return (data ?? []) as TeamInvitation[]
}
