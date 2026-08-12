import { describe, expect, it } from 'vitest'
import { mergePeople, describePerson, RECENT_MS, STALE_MS, type ActivityRow } from '@/lib/merge'
import { PRESENCE_V, type PresencePayload } from '@/lib/presence'
import { relativeTime, sinceDuration } from '@/lib/format'

const NOW = Date.parse('2026-08-12T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

function presence(p: Partial<PresencePayload> & { user_id: string }): PresencePayload {
  return {
    v: PRESENCE_V,
    full_name: 'Marie',
    role: 'employee',
    device: 'ios',
    screen: 'scan',
    mode: 'count',
    balise: '5372',
    balise_name: 'Réserve',
    foreground: true,
    since: NOW - 4 * 60_000,
    beat: NOW - 5_000,
    ...p,
  }
}

function activity(p: Partial<ActivityRow> & { user_id: string }): ActivityRow {
  return {
    full_name: 'Marie',
    last_action_at: ago(60_000),
    last_zone: '5372',
    last_pass: 1,
    events_window: 12,
    units_window: 12,
    events_total: 40,
    first_action_at: ago(3600_000),
    ...p,
  }
}

const member = (user_id: string, full_name = 'Marie') => ({
  user_id, full_name, role: 'employee', session_role: 'counter',
})

describe('mergePeople — hiérarchie des états', () => {
  it('classe « en ligne » une présence fraîche', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null,
      presence: { u1: presence({ user_id: 'u1' }) }, activity: [], now: NOW,
    })
    expect(p.tier).toBe('online')
    expect(p.live).toBe(true)
    expect(p.balise).toBe('5372')
    expect(p.sinceMs).toBe(4 * 60_000)
  })

  it('rétrograde une présence périmée : la socket a survécu au téléphone', () => {
    // Cas réel : batterie vide ou tunnel. Le canal reste ouvert côté serveur et
    // le tableau de bord affirmerait « compte la balise 5372 » alors que
    // personne n'est là depuis un quart d'heure.
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null,
      presence: { u1: presence({ user_id: 'u1', beat: NOW - STALE_MS - 1_000 }) },
      activity: [activity({ user_id: 'u1', last_action_at: ago(2 * 60_000) })],
      now: NOW,
    })
    expect(p.tier).toBe('recent')
    expect(p.live).toBe(false)
    expect(p.sinceMs).toBeNull()
    // La balise reste connue, mais comme *dernière* position, pas comme actuelle.
    expect(p.balise).toBe('5372')
  })

  it('classe « actif » quelqu’un hors ligne mais qui vient de scanner', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null, presence: {},
      activity: [activity({ user_id: 'u1', last_action_at: ago(3 * 60_000) })], now: NOW,
    })
    expect(p.tier).toBe('recent')
    expect(p.mode).toBe('count')
  })

  it('classe « inscrit » au-delà de la fenêtre récente', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null, presence: {},
      activity: [activity({ user_id: 'u1', last_action_at: ago(RECENT_MS + 60_000) })], now: NOW,
    })
    expect(p.tier).toBe('idle')
  })

  it('n’invente jamais « en ligne » à partir des seuls comptages', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null, presence: {},
      activity: [activity({ user_id: 'u1', last_action_at: ago(1_000) })], now: NOW,
    })
    expect(p.tier).not.toBe('online')
  })
})

describe('mergePeople — sources et complétude', () => {
  it('déduit le mode audit de la passe 2', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null, presence: {},
      activity: [activity({ user_id: 'u1', last_pass: 2 })], now: NOW,
    })
    expect(p.mode).toBe('audit')
  })

  it('garde le créateur, qui n’a pas forcément de ligne session_members', () => {
    const rows = mergePeople({
      members: [], createdBy: 'boss', presence: {}, activity: [], now: NOW,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].sessionRole).toBe('creator')
    expect(rows[0].isMember).toBe(true)
  })

  it('distingue co-superviseur et compteur', () => {
    const rows = mergePeople({
      members: [
        { user_id: 'u1', full_name: 'A', role: 'supervisor', session_role: 'supervisor' },
        { user_id: 'u2', full_name: 'B', role: 'employee', session_role: 'counter' },
      ],
      createdBy: 'u3', presence: {}, activity: [], now: NOW,
    })
    expect(rows.find(r => r.userId === 'u1')!.sessionRole).toBe('supervisor')
    expect(rows.find(r => r.userId === 'u2')!.sessionRole).toBe('counter')
  })

  it('signale une personne présente sans être inscrite', () => {
    const [p] = mergePeople({
      members: [], createdBy: null,
      presence: { u9: presence({ user_id: 'u9' }) }, activity: [], now: NOW,
    })
    expect(p.isMember).toBe(false)
  })

  it('sur deux appareils, retient le battement le plus récent', () => {
    // flattenPresence dédoublonne en amont ; ici on vérifie que la fusion suit
    // bien l'entrée fournie sans en fabriquer une seconde.
    const rows = mergePeople({
      members: [member('u1')], createdBy: null,
      presence: { u1: presence({ user_id: 'u1', balise: '9999' }) }, activity: [], now: NOW,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].balise).toBe('9999')
  })

  it('résout le nom d’emplacement depuis la carte des balises', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null, presence: {},
      activity: [activity({ user_id: 'u1' })],
      zoneNames: { '5372': 'Surface de vente' }, now: NOW,
    })
    expect(p.baliseName).toBe('Surface de vente')
  })
})

describe('mergePeople — tri', () => {
  it('remonte les personnes en ligne, puis les plus récemment actives', () => {
    const rows = mergePeople({
      members: [member('u1', 'Idle'), member('u2', 'Recent'), member('u3', 'Online')],
      createdBy: null,
      presence: { u3: presence({ user_id: 'u3', full_name: 'Online' }) },
      activity: [
        activity({ user_id: 'u1', full_name: 'Idle', last_action_at: ago(RECENT_MS + 60_000) }),
        activity({ user_id: 'u2', full_name: 'Recent', last_action_at: ago(60_000) }),
      ],
      now: NOW,
    })
    expect(rows.map(r => r.name)).toEqual(['Online', 'Recent', 'Idle'])
  })
})

describe('describePerson', () => {
  const say = (p: Parameters<typeof describePerson>[0]) => describePerson(p, iso => relativeTime(iso, NOW), sinceDuration)

  it('dit où en est quelqu’un en direct', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null,
      presence: { u1: presence({ user_id: 'u1' }) }, activity: [], now: NOW,
    })
    expect(say(p)).toBe('balise 5372 · Réserve · depuis 4 min')
  })

  it('signale une application en arrière-plan plutôt que de la dire au travail', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null,
      presence: { u1: presence({ user_id: 'u1', foreground: false }) }, activity: [], now: NOW,
    })
    expect(p.paused).toBe(true)
    expect(say(p)).toMatch(/arrière-plan/)
  })

  it('dit « scanner ouvert » quand aucune balise n’est ouverte', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null,
      presence: { u1: presence({ user_id: 'u1', balise: null, balise_name: null }) },
      activity: [], now: NOW,
    })
    expect(say(p)).toMatch(/aucune balise/)
  })

  it('parle de « dernier scan » dès que la présence n’est plus fiable', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null, presence: {},
      activity: [activity({ user_id: 'u1', last_action_at: ago(3 * 60_000) })], now: NOW,
    })
    expect(say(p)).toMatch(/hors ligne · dernier scan il y a 3 min/)
  })

  it('reste explicite quand la personne n’a rien fait', () => {
    const [p] = mergePeople({
      members: [member('u1')], createdBy: null, presence: {}, activity: [], now: NOW,
    })
    expect(say(p)).toBe('aucun scan enregistré')
  })
})
