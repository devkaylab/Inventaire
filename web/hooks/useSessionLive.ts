'use client'

// Une seule socket par tableau de bord, qui rend trois services :
//
//  1. la présence : combien d'appareils comptent, et dans quel mode ;
//  2. le déclenchement : le mobile signale qu'il s'est passé quelque chose,
//     le site rafraîchit ses agrégats — dans la limite fixée plus bas ;
//  3. le repli : un sondage régulier, actif uniquement quand l'onglet est
//     visible.
//
// Pourquoi pas `postgres_changes` ? Il faudrait publier `counts` dans
// `supabase_realtime`, passer la table en REPLICA IDENTITY FULL pour que les
// suppressions portent le `session_id` du filtre, et surtout Realtime
// réévaluerait la policy SELECT de `counts` (deux fonctions SECURITY DEFINER,
// dont un `exists` corrélé) pour chaque ligne et chaque abonné — pendant une
// rafale de scans. Le tout pour apprendre « quelque chose a changé », ce que le
// broadcast dit déjà pour rien. Sondage + broadcast laissent l'accès aux
// données exactement là où il est aujourd'hui : PostgREST et ses policies.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import {
  BEAT_EVENT, STALE_MS, SYNC_EVENT, flattenPresence, presenceTopic, readBeat,
  type PresencePayload,
} from '@/lib/presence'

// ── Cadence de rafraîchissement ──────────────────────────────────────────────
//
// Un rafraîchissement fait recalculer à la base l'avancement par zone et les
// totaux de l'inventaire, c'est-à-dire un parcours de tous ses comptages.
// Le coût est le même quel que soit le déclencheur — le sondage régulier ou un
// scan qui vient d'arriver. **Le seul chiffre qui compte est donc : à quelle
// fréquence un tableau de bord recalcule.** Poser une limite sur le sondage
// sans la poser sur les scans ne changerait rien un jour de gros inventaire,
// où les scans arrivent en continu.
//
// D'où une règle unique, `AUTO_MIN_GAP_MS` : au plus un rafraîchissement
// automatique par minute, quelle qu'en soit la cause. À 200 magasins, cela
// ramène la charge de ~50 calculs par seconde à moins de 7.
//
// Ce que ça ne ralentit pas, et c'est ce qui rend une minute acceptable :
//   · la limite est à **seuil franchi**, pas à cadence fixe — sur un inventaire
//     calme, le premier scan venu rafraîchit tout de suite ;
//   · le bouton « Mis à jour… » de l'en-tête actualise à la demande, sans
//     limite, et affiche l'âge des chiffres ;
//   · revenir sur l'onglet actualise aussi ;
//   · les compteurs d'appareils connectés ne passent pas par là : ils suivent
//     les battements en direct.
const AUTO_MIN_GAP_MS = 60_000

// Le sondage bat plus vite que la limite : c'est lui qui rattrape un scan
// arrivé pendant la minute de repos. Sans cela, un rafraîchissement déclenché
// à la dixième seconde ferait sauter le sondage suivant, et l'écran pourrait
// rester deux minutes sans bouger.
const POLL_MS = 15_000

// ── Repos quand rien ne se passe ─────────────────────────────────────────────
//
// Un inventaire ouvert où personne ne scanne — la pause de midi, un magasin
// préparé la veille — n'a aucune raison de faire recalculer ses agrégats
// soixante fois par heure. Le mobile signale ses scans (battements `dirty`,
// file hors ligne qui remonte) : sans aucun signal, le sondage se contente
// d'une passe toutes les cinq minutes, de quoi rattraper ce qui aurait échappé
// aux messages.
//
// **La sécurité tient dans la condition de repli** : ce repos ne s'applique que
// si le canal est bien ouvert. Un tableau de bord dont le temps réel est tombé
// ne reçoit plus aucun signal — s'endormir dans ce cas afficherait des chiffres
// figés cinq minutes durant, sans que rien ne l'explique.
const IDLE_MAX_MS = 5 * 60_000

export type LiveState = {
  /** Une entrée par appareil connecté, indexée par clé de présence anonyme. */
  presence: Record<string, PresencePayload>
  /** Appareils dont la version de contrat est inconnue (mobile pas à jour). */
  unknownVersions: number
  channelReady: boolean
  lastRefreshAt: number
  refreshing: boolean
  refresh: () => void
}

export function useSessionLive(
  sessionId: string | undefined,
  /** Faux tant que la session d'authentification n'est pas prête : s'abonner
   *  avant ferait échouer l'autorisation du canal privé. */
  ready: boolean,
  onRefresh: () => Promise<void> | void,
  options?: { enabled?: boolean; pollMs?: number },
): LiveState {
  const enabled = options?.enabled ?? true
  const pollMs = options?.pollMs ?? POLL_MS

  const [presence, setPresence] = useState<Record<string, PresencePayload>>({})
  const [unknownVersions, setUnknownVersions] = useState(0)
  const [channelReady, setChannelReady] = useState(false)
  const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now())
  const [refreshing, setRefreshing] = useState(false)

  // `onRefresh` change à chaque rendu du parent ; on garde une référence pour
  // ne pas reconstruire la socket à chaque fois.
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh
  const inFlight = useRef(false)
  // Date du dernier rafraîchissement, en référence et non en état : la limite
  // est consultée depuis des rappels créés une fois pour toutes (sondage,
  // messages du canal), qui ne verraient jamais un état plus récent.
  const lastRefreshRef = useRef(Date.now())
  // « Le mobile m'a signalé quelque chose depuis le dernier rafraîchissement. »
  const activityRef = useRef(false)
  // L'état du canal, en référence : le sondage est créé une fois et ne verrait
  // jamais un état plus récent.
  const channelReadyRef = useRef(false)

  /**
   * Rafraîchit les agrégats de l'inventaire.
   *
   * `force` est réservé à ce que la personne demande explicitement — le bouton
   * de l'en-tête, le retour sur l'onglet. Tout le reste est automatique, et
   * passe donc par la limite d'une minute.
   */
  const refresh = useCallback((force = false) => {
    if (inFlight.current) return
    if (!force && Date.now() - lastRefreshRef.current < AUTO_MIN_GAP_MS) return
    inFlight.current = true
    // Remis à zéro **avant** l'appel, pas après : un scan qui arrive pendant le
    // chargement ne sera pas dans les données reçues, et doit donc rester un
    // signal en attente. L'effacer à la fin le perdrait.
    activityRef.current = false
    setRefreshing(true)
    void Promise.resolve(refreshRef.current())
      .catch(err => console.error('[live] refresh', err))
      .finally(() => {
        inFlight.current = false
        setRefreshing(false)
        lastRefreshRef.current = Date.now()
        setLastRefreshAt(lastRefreshRef.current)
      })
  }, [])

  /** Ce que le bouton de l'en-tête appelle : sans limite, et tout de suite. */
  const refreshNow = useCallback(() => refresh(true), [refresh])

  // ── Canal : battements v3 + présence v2 ────────────────────────────────────
  //
  // Deux sources pendant la transition (voir l'en-tête de lib/presence.ts) :
  //
  //  · les téléphones à jour envoient un **battement** en broadcast, sans
  //    rejoindre le canal — c'est ce qui divise par cinquante le trafic et
  //    supprime une connexion ouverte par compteur ;
  //  · les téléphones pas encore mis à jour publient encore leur **présence**.
  //
  // Le site fusionne les deux. Retirer la lecture de la présence avant que le
  // nouveau build soit installé partout ferait disparaître de l'écran des
  // équipes bel et bien au travail.
  useEffect(() => {
    if (!sessionId || !ready) return

    let disposed = false

    // Canal **privé** : Realtime évalue alors les policies de
    // `realtime.messages`, qui n'autorisent le topic qu'aux participants de
    // l'inventaire (migration 20260813000009). En public — l'état d'origine —
    // aucune autorisation n'était consultée : connaître l'UUID suffisait à
    // écouter l'activité des compteurs, y compris depuis une autre entreprise,
    // et y compris après avoir été retiré de l'inventaire.
    //
    // Le site **écoute sans publier** : il ne se déclare pas présent. Les
    // appareils comptés sont donc ceux de l'équipe sur le terrain, ce qui est
    // l'information utile — et c'est une émission de moins.
    const channel: RealtimeChannel = supabase.channel(presenceTopic(sessionId), {
      config: { private: true },
    })

    // Appareils v3, tenus à jour au fil des battements. En ref et non en état :
    // c'est `publish` qui décide quand le rendu doit changer.
    const beats: Record<string, PresencePayload> = {}
    /** Appareils v3 dont la version dépasse la nôtre, par clé et par battement. */
    const beatUnknown: Record<string, number> = {}
    let legacy: { devices: Record<string, PresencePayload>; unknownVersions: number } =
      { devices: {}, unknownVersions: 0 }

    const publish = () => {
      if (disposed) return
      // Un appareil dont on n'a plus de nouvelles depuis trois battements est
      // oublié : sans cette purge, les tables grossiraient indéfiniment (chaque
      // ouverture d'écran tire une nouvelle clé d'appareil) sur un tableau de
      // bord laissé ouvert toute la journée. C'est aussi ce qui fait qu'on
      // compte des appareils et non des messages reçus.
      const cutoff = Date.now() - STALE_MS
      for (const [key, p] of Object.entries(beats)) {
        if (p.beat < cutoff) delete beats[key]
      }
      for (const [key, beat] of Object.entries(beatUnknown)) {
        if (beat < cutoff) delete beatUnknown[key]
      }
      setPresence({ ...legacy.devices, ...beats })
      setUnknownVersions(legacy.unknownVersions + Object.keys(beatUnknown).length)
    }

    /**
     * Un scan vient d'arriver.
     *
     * Aucune temporisation ici : c'est `refresh` qui porte la limite d'une
     * minute, et il la porte pour tous les déclencheurs à la fois. La version
     * précédente reportait l'appel de 750 ms à chaque message reçu — sur un
     * inventaire animé, où les messages arrivent plus vite que ça, le report
     * n'arrivait jamais à son terme et ce déclencheur ne servait plus à rien
     * sans que cela se voie.
     */
    const askRefresh = () => {
      if (disposed) return
      activityRef.current = true
      refresh()
    }

    const readPresence = () => {
      if (disposed) return
      legacy = flattenPresence(
        channel.presenceState() as unknown as Record<string, unknown[]>,
      )
      publish()
    }

    channel
      .on('presence', { event: 'sync' }, readPresence)
      .on('presence', { event: 'join' }, readPresence)
      .on('presence', { event: 'leave' }, readPresence)
      .on('broadcast', { event: BEAT_EVENT }, (message) => {
        if (disposed) return
        const read = readBeat((message as { payload?: unknown }).payload)
        switch (read.kind) {
          case 'device':
            beats[read.key] = read.payload
            publish()
            // Le battement porte lui-même le « il s'est passé quelque chose » :
            // c'est ce qui remplace le `sync` par scan de la v2.
            if (read.dirty) askRefresh()
            break
          case 'gone':
            delete beats[read.key]
            delete beatUnknown[read.key]
            publish()
            break
          case 'unknown':
            beatUnknown[read.key] = read.beat
            publish()
            break
          case 'ignored':
            break
        }
      })
      .on('broadcast', { event: SYNC_EVENT }, askRefresh)
      .subscribe((status) => {
        if (disposed) return
        channelReadyRef.current = status === 'SUBSCRIBED'
        setChannelReady(channelReadyRef.current)
      })

    return () => {
      disposed = true
      void supabase.removeChannel(channel)
      channelReadyRef.current = false
      setChannelReady(false)
    }
  }, [sessionId, ready, refresh])

  // ── Sondage : onglet du navigateur visible, et section qui regarde ─────────
  //
  // `enabled` est faux sur les sections qui ne suivent pas l'inventaire en
  // direct (Rapport, Équipe, Écarts…) : on y lit et on y agit, on n'y observe
  // pas l'avancement. Y sonder ferait recalculer l'inventaire entier pour un
  // écran qui n'en montre rien.
  useEffect(() => {
    if (!enabled || !sessionId) return

    // Arriver sur la section doit montrer l'état réel, pas celui d'il y a dix
    // minutes. Appel **limité** et non forcé : aller et venir entre deux
    // sections ne doit pas devenir une façon de contourner la limite.
    refresh()

    const tick = () => {
      if (document.visibilityState !== 'visible') return
      // Trois raisons de rafraîchir, et une seule suffit : le mobile a signalé
      // du nouveau ; le canal est tombé, donc plus rien ne nous signalera quoi
      // que ce soit ; ou il est temps de vérifier par nous-mêmes.
      const tropVieux = Date.now() - lastRefreshRef.current >= IDLE_MAX_MS
      if (activityRef.current || !channelReadyRef.current || tropVieux) refresh()
    }
    const timer = setInterval(tick, pollMs)

    // Revenir sur l'onglet doit montrer l'état réel, pas celui d'il y a 20 min.
    // Sans limite, donc : c'est un geste de la personne, pas un automatisme.
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(true) }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, sessionId, pollMs, refresh])

  return useMemo(() => ({
    presence, unknownVersions, channelReady, lastRefreshAt, refreshing,
    refresh: refreshNow,
  }), [presence, unknownVersions, channelReady, lastRefreshAt, refreshing, refreshNow])
}
