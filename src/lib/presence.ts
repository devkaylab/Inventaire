// Contrat de présence temps réel — CÔTÉ APPLICATION MOBILE.
//
// ⚠️ À GARDER SYNCHRONISÉ AVEC web/lib/presence.ts (site).
// Les deux paquets npm sont séparés (Expo/React 19 ici, Next/React 18 là-bas) :
// ce fichier est donc dupliqué volontairement. Une dérive de ce contrat serait
// silencieuse — le site afficherait « aucun appareil connecté » sans que rien
// ne le signale. D'où le champ `v` : le site écarte les charges dont il ne
// connaît pas la version et l'affiche explicitement.
//
// ── Version 2 : la présence ne nomme plus personne ──────────────────────────
//
// La v1 publiait le nom, l'écran ouvert, la balise en cours, le début
// d'activité et l'état d'avant-plan de l'application. Le superviseur suivait
// donc l'activité de chacun, nominativement et en direct (constat E3 de
// l'audit du 13 août 2026). La v2 ne publie plus que le mode et le battement :
// le site en tire des compteurs, sans jamais désigner qui que ce soit.
//
// L'état d'avant-plan a disparu, et c'est le point le plus important : il ne
// disait rien de l'inventaire, seulement du comportement de la personne.
//
// La clé de présence est un identifiant d'appareil tiré au hasard au montage,
// et non plus l'identifiant de l'utilisateur — celui-ci voyageait dans le
// protocole même absent de la charge.
//
// Ce qui reste nominatif : `counts.counted_by`, écrit à chaque scan. Arbitrer
// un écart suppose de savoir qui a compté ; c'est une finalité distincte et
// différée, pas du suivi en direct.
//
// Rien à configurer côté serveur : présence et broadcast passent par le service
// Realtime et ne touchent pas à la réplication logique de Postgres.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

/** v2 : voir l'en-tête. Doit valoir la même chose que dans web/lib/presence.ts. */
export const PRESENCE_V = 2

export const presenceTopic = (sessionId: string) => `session:${sessionId}:presence`

export const SYNC_EVENT = 'sync'

/** Cadence des battements. Le site considère un appareil parti au-delà de
 *  trois battements manqués (90 s). */
const BEAT_MS = 30_000

export type PresenceMode = 'count' | 'audit' | null

/** Tout ce que l'application publie désormais : le mode courant. */
export type PresenceActivity = {
  mode: PresenceMode
}

export const IDLE_ACTIVITY: PresenceActivity = { mode: null }

/** Identifiant d'appareil, tiré au hasard et sans lien avec le compte. */
function newDeviceKey(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `d-${Math.floor(Math.random() * 1e9).toString(36)}${Date.now().toString(36)}`
}

/**
 * Publie la présence de l'appareil courant sur un inventaire.
 *
 * Le superviseur voit alors, depuis le site, **combien** d'appareils sont
 * connectés et dans quel mode — jamais qui fait quoi. Sans effet si
 * l'inventaire ou le profil manquent : l'appel est donc sûr en tête de
 * composant.
 *
 * Le mode passe par une ref mise à jour *dans* un effet, jamais pendant le
 * rendu : la charge est construite au moment de l'émission (battement ou
 * changement de mode), pas au moment du rendu.
 */
export function useSessionPresence(sessionId: string | undefined, activity: PresenceActivity) {
  const { profile } = useAuth()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const activityRef = useRef(activity)

  const userId = profile?.id
  // Une clé par montage : un appareil qui se reconnecte n'est pas compté deux
  // fois, et rien ne relie cette clé au compte.
  const deviceKey = useMemo(() => newDeviceKey(), [])

  const build = useCallback(() => ({
    v: PRESENCE_V,
    mode: activityRef.current.mode,
    beat: Date.now(),
  }), [])

  useEffect(() => { activityRef.current = activity }, [activity])

  // ── Canal : reconstruit seulement si l'inventaire ou l'utilisateur change ──
  useEffect(() => {
    if (!sessionId || !userId) return

    // Canal **privé** : Realtime évalue alors les policies de
    // `realtime.messages`, qui n'autorisent le topic qu'aux participants de
    // l'inventaire (migration 20260813000009). En public — l'état d'origine —
    // aucune autorisation n'était consultée : connaître l'UUID suffisait à
    // écouter le canal.
    const channel = supabase.channel(presenceTopic(sessionId), {
      config: { private: true, presence: { key: deviceKey } },
    })
    channelRef.current = channel

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.track(build())
    })

    const beat = setInterval(() => { void channelRef.current?.track(build()) }, BEAT_MS)

    return () => {
      clearInterval(beat)
      void channel.untrack()
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [sessionId, userId, deviceKey, build])

  // ── Changement de mode : republication immédiate ───────────────────────────
  useEffect(() => {
    void channelRef.current?.track(build())
  }, [activity.mode, build])
}

/**
 * Signale au site qu'il y a du nouveau (scan enregistré, balise ouverte…).
 * Émission au mieux : si le canal n'est pas ouvert, on ne fait rien — le site
 * a de toute façon son sondage de repli.
 */
export function pingSession(sessionId: string, kind: 'count' | 'balise'): void {
  const topic = presenceTopic(sessionId)
  const channel = supabase.getChannels().find(c => c.topic === `realtime:${topic}` || c.topic === topic)
  void channel?.send({ type: 'broadcast', event: SYNC_EVENT, payload: { kind, at: Date.now() } })
}
