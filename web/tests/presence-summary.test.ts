// L'agrégation remplace le suivi nominatif : ces tests figent ce qu'elle
// compte, et surtout ce qu'elle ne dit plus (constat E3).
import { describe, expect, it } from 'vitest'
import { summarizePresence } from '@/lib/presence-summary'
import type { PresencePayload } from '@/lib/presence'

const now = Date.now()

function appareil(p: Partial<PresencePayload> & { user_id: string }): PresencePayload {
  return {
    v: 1, full_name: 'Peu importe', role: 'employee', device: 'android',
    screen: 'scan', mode: 'count', balise: null, balise_name: null,
    foreground: true, since: now, beat: now,
    ...p,
  }
}

describe('summarizePresence', () => {
  it('compte les appareils par mode', () => {
    expect(summarizePresence({
      a: appareil({ user_id: 'a', mode: 'count' }),
      b: appareil({ user_id: 'b', mode: 'count' }),
      c: appareil({ user_id: 'c', mode: 'audit' }),
    })).toEqual({ devices: 3, counting: 2, auditing: 1 })
  })

  it('compte un appareil hors écran de scan sans l’attribuer à un mode', () => {
    // Connecté mais sur l'écran d'accueil : présent, sans plus. La somme des
    // modes est alors inférieure au nombre d'appareils, et c'est voulu.
    const r = summarizePresence({
      a: appareil({ user_id: 'a', screen: 'session', mode: null }),
      b: appareil({ user_id: 'b', mode: 'audit' }),
    })
    expect(r).toEqual({ devices: 2, counting: 0, auditing: 1 })
    expect(r.counting + r.auditing).toBeLessThan(r.devices)
  })

  it('compte des appareils, pas des personnes', () => {
    // Deux téléphones pour un même compte font deux entrées : c'est ce que le
    // superviseur veut savoir, et cela évite de reconstituer une identité.
    expect(summarizePresence({
      'a:1': appareil({ user_id: 'a', mode: 'count' }),
      'a:2': appareil({ user_id: 'a', mode: 'audit' }),
    })).toEqual({ devices: 2, counting: 1, auditing: 1 })
  })

  it('ne compte rien quand personne n’est connecté', () => {
    expect(summarizePresence({})).toEqual({ devices: 0, counting: 0, auditing: 0 })
  })
})
