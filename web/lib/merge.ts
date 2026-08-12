// Fusion des trois sources qui, ensemble, répondent honnêtement à « qui est
// connecté et qui compte quelle balise ».
//
//  1. la PRÉSENCE (canal Realtime) dit qui a une socket ouverte, à l'instant ;
//  2. l'ACTIVITÉ (RPC get_session_activity, déduite de `counts`) dit qui a
//     réellement travaillé, sur quelle balise et dans quel mode ;
//  3. les MEMBRES disent qui est censé participer.
//
// Aucune des trois ne suffit seule. Une socket peut survivre à un téléphone
// oublié dans une poche ; à l'inverse, une personne en plein comptage dans une
// réserve sans réseau disparaît de la présence alors qu'elle travaille. La
// règle appliquée ici : la présence ne l'emporte que si son dernier battement
// est récent, et on ne dit jamais « compte LA balise X » sur la foi d'une
// présence périmée — on dit « DERNIÈRE balise X ».
//
// Module volontairement pur (ni React, ni Supabase) : c'est ce qui le rend
// testable, et cette logique est trop facile à casser sans s'en apercevoir.

import type { PresencePayload, PresenceMode } from '@/lib/presence'

/** Présence considérée périmée après 3 battements manqués (battement : 30 s). */
export const STALE_MS = 90_000
/** En deçà, on parle d'une personne « active récemment ». */
export const RECENT_MS = 10 * 60_000

export type Tier = 'online' | 'recent' | 'idle'

export type ActivityRow = {
  user_id: string
  full_name: string | null
  last_action_at: string
  last_zone: string | null
  last_pass: number | null
  events_window: number
  units_window: number
  events_total: number
  first_action_at: string | null
}

export type MemberLike = {
  user_id: string
  full_name: string | null
  role: string | null
  session_role?: string | null
}

export type PersonRow = {
  userId: string
  name: string
  /** Rôle dans l'inventaire : créateur, co-superviseur ou compteur. */
  sessionRole: 'creator' | 'supervisor' | 'counter'
  tier: Tier
  mode: PresenceMode
  balise: string | null
  baliseName: string | null
  /** true : balise et mode viennent de la présence (temps réel).
   *  false : ils sont déduits du dernier scan enregistré. */
  live: boolean
  /** Durée de l'activité en cours, en ms (présence seule). */
  sinceMs: number | null
  lastActionAt: string | null
  eventsWindow: number
  unitsWindow: number
  device: string | null
  /** Présent mais application en arrière-plan. */
  paused: boolean
  /** Membre de l'inventaire (par opposition à une présence inattendue). */
  isMember: boolean
}

export type MergeInput = {
  members: MemberLike[]
  createdBy: string | null
  presence: Record<string, PresencePayload>
  activity: ActivityRow[]
  /** code de balise → nom d'emplacement, pour enrichir l'activité déduite. */
  zoneNames?: Record<string, string | null>
  now?: number
}

function roleOf(userId: string, createdBy: string | null, member?: MemberLike): PersonRow['sessionRole'] {
  if (createdBy && userId === createdBy) return 'creator'
  if (member?.session_role === 'supervisor') return 'supervisor'
  return 'counter'
}

export function mergePeople(input: MergeInput): PersonRow[] {
  const { members, createdBy, presence, activity, zoneNames = {}, now = Date.now() } = input

  const byActivity = new Map(activity.map(a => [a.user_id, a]))
  const byMember = new Map(members.map(m => [m.user_id, m]))

  // Le créateur est participant sans forcément avoir de ligne dans
  // session_members : sans ce complément il disparaîtrait de la liste dès
  // qu'il est hors ligne.
  const ids = new Set<string>([
    ...members.map(m => m.user_id),
    ...Object.keys(presence),
    ...byActivity.keys(),
  ])
  if (createdBy) ids.add(createdBy)

  const rows: PersonRow[] = [...ids].map((userId) => {
    const member = byMember.get(userId)
    const act = byActivity.get(userId)
    const pres = presence[userId]

    const fresh = !!pres && now - (pres.beat ?? 0) <= STALE_MS
    const lastMs = act ? new Date(act.last_action_at).getTime() : 0
    const tier: Tier = fresh
      ? 'online'
      : lastMs > 0 && now - lastMs < RECENT_MS ? 'recent' : 'idle'

    // Mode et balise : la présence gagne si elle est fraîche, sinon on retombe
    // sur le dernier scan connu.
    const derivedMode: PresenceMode = act?.last_pass === 2 ? 'audit' : act?.last_pass === 1 ? 'count' : null
    const mode = fresh ? pres.mode : derivedMode
    const balise = (fresh ? pres.balise : null) ?? act?.last_zone ?? null
    const baliseName = (fresh ? pres.balise_name : null) ?? (balise ? zoneNames[balise] ?? null : null)

    return {
      userId,
      name: pres?.full_name || act?.full_name || member?.full_name || 'Sans nom',
      sessionRole: roleOf(userId, createdBy, member),
      tier,
      mode,
      balise,
      baliseName,
      live: fresh && !!pres.balise,
      sinceMs: fresh ? Math.max(0, now - (pres.since ?? now)) : null,
      lastActionAt: act?.last_action_at ?? null,
      eventsWindow: act?.events_window ?? 0,
      unitsWindow: Number(act?.units_window ?? 0),
      device: pres?.device ?? null,
      paused: fresh && pres.foreground === false,
      isMember: !!member || userId === createdBy,
    }
  })

  return rows.sort(compare)
}

const TIER_RANK: Record<Tier, number> = { online: 0, recent: 1, idle: 2 }

function compare(a: PersonRow, b: PersonRow): number {
  if (TIER_RANK[a.tier] !== TIER_RANK[b.tier]) return TIER_RANK[a.tier] - TIER_RANK[b.tier]
  const ta = a.lastActionAt ? Date.parse(a.lastActionAt) : 0
  const tb = b.lastActionAt ? Date.parse(b.lastActionAt) : 0
  if (ta !== tb) return tb - ta
  return a.name.localeCompare(b.name, 'fr')
}

/** Phrase d'état affichée sous le nom. Volontairement explicite sur la source. */
export function describePerson(p: PersonRow, relative: (iso: string) => string, since: (ms: number) => string): string {
  const at = p.balise ? `balise ${p.balise}${p.baliseName ? ` · ${p.baliseName}` : ''}` : null

  if (p.tier === 'online') {
    if (p.paused) return 'connecté · application en arrière-plan'
    if (p.live && at) return `${at} · ${since(p.sinceMs ?? 0)}`
    if (p.mode) return 'scanner ouvert · aucune balise ouverte'
    return 'connecté · ne scanne pas'
  }
  if (p.tier === 'recent') {
    return at
      ? `hors ligne · dernier scan ${relative(p.lastActionAt!)} · ${at}`
      : `hors ligne · dernier scan ${relative(p.lastActionAt!)}`
  }
  if (p.lastActionAt) {
    return at
      ? `dernier scan ${relative(p.lastActionAt)} · ${at}`
      : `dernier scan ${relative(p.lastActionAt)}`
  }
  return 'aucun scan enregistré'
}

export const TIER_LABELS: Record<Tier, string> = {
  online: 'En ligne',
  recent: 'Actif',
  idle: 'Inscrit',
}

export const MODE_LABELS: Record<'count' | 'audit', string> = {
  count: 'Comptage',
  audit: 'Audit',
}
