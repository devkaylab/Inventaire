// Activité réelle d'un inventaire, déduite du journal `counts`.
//
// `get_session_activity` — une ligne nominative par personne, avec sa cadence
// et sa dernière balise — a été supprimée de la base le 19 août 2026 : le
// suivi en direct est agrégé et ne nomme plus personne (constat E3).
//
// `counted_by` n'est pas non plus demandé ci-dessous : le fil des scans ne
// l'affiche plus, et ce qui n'est pas affiché n'a pas à descendre jusqu'au
// navigateur. L'auteur d'un comptage reste en base et ressort dans le
// rapport — c'est là qu'on arbitre un écart, pas dans un flux en direct.

import { supabase } from '@/lib/supabaseClient'
import { errorMessage } from '@/lib/errors'

export type CountEvent = {
  id: string
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

/**
 * Les derniers scans, pour le fil d'activité.
 * Les lignes de quantité négative sont conservées : ce sont des corrections,
 * et le superviseur a justement intérêt à les voir passer.
 */
export async function getRecentCounts(sessionId: string, limit = 40): Promise<CountEvent[]> {
  const { data, error } = await supabase
    .from('counts')
    .select('id,zone,pass_number,qty,sku,created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) fail('getRecentCounts', error)
  return (data ?? []) as CountEvent[]
}
