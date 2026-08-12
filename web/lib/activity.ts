// Activité réelle d'un inventaire, déduite du journal `counts`.
// Complément indispensable à la présence temps réel : cette couche-ci survit à
// une coupure réseau, à une application fermée et à un téléphone déchargé.

import { supabase } from '@/lib/supabaseClient'
import { errorMessage } from '@/lib/errors'
import type { ActivityRow } from '@/lib/merge'

export type { ActivityRow }

export type CountEvent = {
  id: string
  counted_by: string | null
  zone: string | null
  pass_number: number
  qty: number
  sku: string
  created_at: string
}

function fail(context: string, error: unknown): never {
  console.error(`[activity] ${context}`, error)
  throw new Error(errorMessage(error))
}

/** Une ligne par personne : dernière action, balise, mode, volume récent. */
export async function getSessionActivity(sessionId: string, windowMinutes = 15): Promise<ActivityRow[]> {
  const { data, error } = await supabase.rpc('get_session_activity', {
    p_session_id: sessionId, p_window_minutes: windowMinutes,
  })
  if (error) fail('getSessionActivity', error)
  return (data ?? []) as ActivityRow[]
}

/**
 * Les derniers scans, pour le fil d'activité.
 * Les lignes de quantité négative sont conservées : ce sont des corrections,
 * et le superviseur a justement intérêt à les voir passer.
 */
export async function getRecentCounts(sessionId: string, limit = 40): Promise<CountEvent[]> {
  const { data, error } = await supabase
    .from('counts')
    .select('id,counted_by,zone,pass_number,qty,sku,created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) fail('getRecentCounts', error)
  return (data ?? []) as CountEvent[]
}
