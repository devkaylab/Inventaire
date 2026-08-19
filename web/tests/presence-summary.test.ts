// L'agrégation remplace le suivi nominatif : ces tests figent ce qu'elle
// compte, et surtout ce qu'elle ne peut plus dire (constat E3).
import { describe, expect, it } from 'vitest'
import { summarizePresence } from '@/lib/presence-summary'
import { PRESENCE_V, STALE_MS, flattenPresence, type PresencePayload } from '@/lib/presence'

const now = 1_800_000_000_000

const appareil = (mode: PresencePayload['mode'], beat = now): PresencePayload =>
  ({ v: PRESENCE_V, mode, beat })

describe('summarizePresence', () => {
  it('compte les appareils par mode', () => {
    const r = summarizePresence({
      a: appareil('count'), b: appareil('count'),
      c: appareil('audit'), d: appareil(null),
    }, now)
    expect(r).toEqual({ devices: 4, counting: 2, auditing: 1 })
  })

  it('compte un appareil connecté hors mode, sans le ranger nulle part', () => {
    // Quelqu'un qui a ouvert l'inventaire sans scanner est présent, ni en
    // comptage ni en audit : la somme des deux ne fait pas le total.
    const r = summarizePresence({ a: appareil(null) }, now)
    expect(r).toEqual({ devices: 1, counting: 0, auditing: 0 })
  })

  it('écarte les appareils périmés', () => {
    // Sans ce filtre, une socket fermée brutalement laisserait croire que
    // l'équipe compte encore.
    const r = summarizePresence({
      vivant: appareil('count'),
      fantome: appareil('count', now - STALE_MS - 1),
    }, now)
    expect(r).toEqual({ devices: 1, counting: 1, auditing: 0 })
  })

  it('ne bronche pas sur un état vide', () => {
    expect(summarizePresence({}, now)).toEqual({ devices: 0, counting: 0, auditing: 0 })
  })
})

describe('flattenPresence', () => {
  it('indexe par appareil, pas par personne', () => {
    // Deux appareils = deux entrées : plus rien ne permet de les rattacher à
    // un même compte, et c'est le but.
    const { devices, unknownVersions } = flattenPresence({
      'cle-1': [appareil('count')],
      'cle-2': [appareil('audit')],
    })
    expect(Object.keys(devices)).toHaveLength(2)
    expect(unknownVersions).toBe(0)
  })

  it('garde le battement le plus récent d’un même appareil', () => {
    const { devices } = flattenPresence({
      'cle-1': [appareil('count', now - 5_000), appareil('audit', now)],
    })
    expect(devices['cle-1'].mode).toBe('audit')
  })

  it('écarte et signale une application mobile pas encore mise à jour', () => {
    // La v1 publiait le nom, la balise et l'état d'avant-plan. Une charge v1
    // ne doit surtout pas être lue : elle est comptée à part et l'écran le dit.
    const { devices, unknownVersions } = flattenPresence({
      ancienne: [{ v: 1, user_id: 'u1', full_name: 'Nom', mode: 'count', beat: now }],
      nouvelle: [appareil('count')],
    } as unknown as Record<string, unknown[]>)
    expect(Object.keys(devices)).toEqual(['nouvelle'])
    expect(unknownVersions).toBe(1)
  })
})
