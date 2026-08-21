// L'agrégation remplace le suivi nominatif : ces tests figent ce qu'elle
// compte, et surtout ce qu'elle ne peut plus dire (constat E3).
import { describe, expect, it } from 'vitest'
import { summarizePresence } from '@/lib/presence-summary'
import {
  BEAT_V, LEGACY_PRESENCE_V, STALE_MS, flattenPresence, readBeat,
  type PresencePayload,
} from '@/lib/presence'

const now = 1_800_000_000_000

const appareil = (mode: PresencePayload['mode'], beat = now): PresencePayload =>
  ({ v: LEGACY_PRESENCE_V, mode, beat })

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

// ── v3 : le téléphone ne parle qu'au superviseur ─────────────────────────────
//
// Ces tests figent le contrat de battement. Ce qu'ils protègent n'est pas une
// fonctionnalité mais une facture et un plafond : en v2, chaque battement était
// recopié vers tous les téléphones du canal (coût en n²), ce qui rendait un
// magasin à cent compteurs impossible à tenir.
describe('readBeat', () => {
  const battement = (over: Record<string, unknown> = {}) =>
    ({ v: BEAT_V, k: 'appareil-1', mode: 'count', beat: now, ...over })

  it('lit un battement et rend un appareil', () => {
    const r = readBeat(battement())
    expect(r).toEqual({
      kind: 'device',
      key: 'appareil-1',
      payload: { v: BEAT_V, mode: 'count', beat: now },
      dirty: false,
    })
  })

  it('signale les scans survenus depuis le battement précédent', () => {
    // C'est ce qui remplace le `sync` émis à chaque scan en v2 : un seul
    // message porte à la fois « je suis là » et « il y a du nouveau ».
    const r = readBeat(battement({ dirty: true }))
    expect(r.kind === 'device' && r.dirty).toBe(true)
  })

  it('retire l’appareil qui annonce son départ', () => {
    expect(readBeat(battement({ gone: true }))).toEqual({ kind: 'gone', key: 'appareil-1' })
  })

  it('rend la clé d’un appareil de version inconnue, pour compter des appareils', () => {
    // Sans la clé, un seul téléphone pas à jour ferait grimper le compteur
    // d'une unité toutes les trente secondes.
    expect(readBeat(battement({ v: 99 }))).toEqual({
      kind: 'unknown', key: 'appareil-1', beat: now,
    })
  })

  it('ignore sans rien dire une charge inexploitable', () => {
    // Message tronqué ou sonde : ce n'est pas une application plus récente,
    // l'annoncer à l'écran inquiéterait pour rien.
    expect(readBeat(null).kind).toBe('ignored')
    expect(readBeat({ v: BEAT_V, beat: now }).kind).toBe('ignored')
    expect(readBeat(battement({ beat: 'hier' })).kind).toBe('ignored')
  })

  it('ne transporte toujours rien de nominatif', () => {
    // Même garde que la v2 (constat E3) : un champ nominatif glissé dans la
    // charge ne doit pas ressortir de la lecture.
    const r = readBeat(battement({ full_name: 'Nom Prénom', user_id: 'u1' }))
    expect(r.kind === 'device' && Object.keys(r.payload).sort()).toEqual(['beat', 'mode', 'v'])
  })

  it('n’accepte pas la version v2 comme un battement', () => {
    // Les deux contrats coexistent le temps que les téléphones se mettent à
    // jour, mais ils ne se lisent pas l'un pour l'autre.
    expect(readBeat(battement({ v: LEGACY_PRESENCE_V })).kind).toBe('unknown')
  })
})
