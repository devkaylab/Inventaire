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
// ── Version 3 : le téléphone ne parle qu'au superviseur ─────────────────────
//
// (21 août 2026, étude de charge « 200 magasins × 100 compteurs ».)
//
// En v2, le téléphone **rejoignait** le canal de l'inventaire pour y publier sa
// présence. Le service Realtime recopie alors chaque battement vers tous les
// membres du canal : à cent compteurs, chaque battement partait en 99
// exemplaires vers des téléphones qui n'en font rien. Le coût grimpait en n²,
// le service rendu en n. Mesuré : environ 336 messages par seconde et par
// magasin pour la seule présence, et près de mille de plus pour le `sync` émis
// après chaque scan — contre un plafond d'abonnement de 500 par seconde, tous
// magasins confondus. Et 100 connexions ouvertes par magasin, pour un plafond
// de 10 000 au mieux.
//
// En v3, le téléphone **ne rejoint plus le canal**. Il envoie son battement par
// un appel HTTP unique (`channel.httpSend`), et seul le tableau de bord du
// superviseur est abonné : un battement coûte deux messages au lieu de cent, et
// l'application n'ouvre plus aucune connexion permanente. Économie de batterie
// au passage.
//
// Les autorisations ne changent pas : le canal reste privé, et les policies de
// `realtime.messages` (migration 20260813000009) s'appliquent à l'envoi HTTP
// comme à l'envoi par socket. Un téléphone qui n'est pas participant de
// l'inventaire se voit refuser l'envoi, exactement comme avant. Un envoi
// déclaré public n'atteindrait pas le tableau de bord : Realtime achemine les
// messages privés et publics sur deux files distinctes, et le site s'abonne en
// privé.
//
// ⚠️ Piège à connaître : le point d'entrée HTTP répond **202 dans tous les
// cas**. Un message refusé faute de droits est écarté en silence, sans erreur.
// Autrement dit, `httpSend` qui réussit ne prouve pas que le message est
// arrivé. Si un jour le tableau de bord n'affiche aucun appareil alors que les
// téléphones comptent, c'est là qu'il faut regarder — du côté des droits sur
// l'inventaire, pas du côté du réseau.
//
// La cadence a deux bornes, et elles comptent autant que le reste :
//   · au plus un message toutes les `MIN_GAP_MS` — une rafale de scans ne
//     produit qu'un seul message, c'est ce qui remplace l'ancien `sync` par
//     scan ;
//   · au moins un message toutes les `BEAT_MS` — sans quoi le site croirait
//     l'appareil parti au bout de `STALE_MS`.
//
// Rien à configurer côté serveur : le broadcast passe par le service Realtime
// et ne touche pas à la réplication logique de Postgres.

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

/** v3 : voir l'en-tête. Doit valoir la même chose que dans web/lib/presence.ts. */
export const BEAT_V = 3

export const presenceTopic = (sessionId: string) => `session:${sessionId}:presence`

/** Événement de battement v3. */
export const BEAT_EVENT = 'beat'

/** Cadence des battements. Le site considère un appareil parti au-delà de
 *  trois battements manqués (90 s). */
const BEAT_MS = 30_000

/** Intervalle minimal entre deux messages : une rafale de scans est regroupée. */
const MIN_GAP_MS = 5_000

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
 * Une clé par **lancement de l'application**, pas par montage de composant.
 *
 * Anomalie relevée par Julien le 22 août 2026 : « j'ai 1 appareil connecté
 * physiquement, quand il passe en comptage ou en audit le nombre passe à 2 ».
 * La clé était tirée dans `useMemo` à chaque montage du hook — or **deux
 * écrans le montent en même temps** : l'écran de l'inventaire reste monté dans
 * la pile sous l'écran de comptage. Deux clés, deux appareils à l'écran du
 * superviseur, pour un seul téléphone. Ne jamais la redescendre au niveau du
 * composant.
 *
 * Elle ne survit pas au redémarrage de l'application et n'est reliée à aucun
 * compte : c'est ce qui distingue « compter des appareils » de « suivre des
 * personnes ».
 */
const DEVICE_KEY = newDeviceKey()

/**
 * Les écrans qui déclarent une activité, dans l'ordre où ils se sont montés.
 *
 * C'est une pile, comme la navigation : **le dernier monté donne le mode**.
 * Ouvrir le comptage par-dessus l'écran de l'inventaire fait donc passer
 * l'appareil en « comptage » ; le refermer le rend à « rien », sans qu'aucun
 * message de départ ne parte entre-temps.
 */
type Holder = { id: number; sessionId: string; mode: PresenceMode }
let holders: Holder[] = []
let nextHolderId = 1

/** L'écran du dessus, celui dont le mode fait foi. */
function top(): Holder | undefined {
  return holders[holders.length - 1]
}

/**
 * L'émetteur unique de l'appareil.
 *
 * Un seul canal, un seul battement, une seule clé — quel que soit le nombre
 * d'écrans montés. Avant, chaque écran avait le sien, ce qui multipliait les
 * appareils vus par le superviseur **et** cassait `pingSession` : le second
 * montage écrasait `currentEmitter`, et son démontage le remettait à `null`
 * alors que le premier écran vivait toujours.
 */
type Engine = { sessionId: string; markDirty: () => void; stop: () => void }
let engine: Engine | null = null

/**
 * Signale au site qu'il y a du nouveau (scan enregistré, balise ouverte…).
 *
 * Émission au mieux, et surtout **regroupée** : l'appel ne provoque pas un
 * message à chaque scan, il marque l'appareil « il s'est passé quelque chose »
 * et laisse le prochain battement le dire. C'est tout l'intérêt de la v3 —
 * en v2, cent compteurs produisaient un millier de messages par seconde à eux
 * seuls. Le tableau de bord sonde par ailleurs : rien ne se perd, tout arrive
 * au plus tard au battement suivant.
 *
 * `kind` n'est plus transmis : le site rafraîchit ses agrégats de la même
 * manière quel que soit l'événement. Le paramètre reste dans la signature pour
 * ne pas retoucher le scanner.
 */
export function pingSession(sessionId: string, _kind: 'count' | 'balise'): void {
  if (engine?.sessionId === sessionId) engine.markDirty()
}

/** Démarre l'émetteur pour un inventaire. Un seul à la fois. */
function startEngine(sessionId: string): Engine {
  // Canal **privé**, mais jamais `subscribe()` : on ne s'en sert que comme
  // adresse d'envoi. `supabase.channel()` n'ouvre aucune connexion tant qu'on
  // ne s'abonne pas — c'est ce qui fait disparaître les milliers de sockets.
  // Le drapeau `private` est lu par `httpSend`, qui le transmet au service :
  // les policies de `realtime.messages` sont donc bien évaluées.
  const channel = supabase.channel(presenceTopic(sessionId), {
    config: { private: true },
  })

  let disposed = false
  let dirty = false
  // Daté au démarrage, et non à zéro : le premier message est celui qu'envoie
  // la mise en place du jeton, juste en dessous. Sans cela, un scan survenu
  // dans la première seconde partirait avant que le jeton soit posé, donc
  // pour rien.
  let lastSentAt = Date.now()
  let gapTimer: ReturnType<typeof setTimeout> | null = null

  const emit = (gone = false) => {
    lastSentAt = Date.now()
    const payload = {
      v: BEAT_V,
      k: DEVICE_KEY,
      // Le mode vient de l'écran du dessus, lu à l'émission — jamais figé au
      // démarrage de l'émetteur, qui survit aux changements d'écran.
      mode: gone ? null : (top()?.mode ?? null),
      beat: lastSentAt,
      ...(dirty ? { dirty: true } : {}),
      ...(gone ? { gone: true } : {}),
    }
    // Le drapeau est consommé à l'émission, qu'elle aboutisse ou non : si le
    // réseau est coupé, le scan est de toute façon en file locale et le
    // tableau de bord le verra à la synchronisation.
    dirty = false
    // Émission au mieux : un battement perdu ne se rejoue pas, le suivant
    // arrive au plus tard dans trente secondes. Surtout, ne jamais laisser
    // cette promesse échouer bruyamment — le comptage ne dépend pas d'elle.
    void channel.httpSend(BEAT_EVENT, payload).catch(() => {})
  }

  /** Émet maintenant si l'intervalle minimal est écoulé, sinon le programme. */
  const emitThrottled = () => {
    if (disposed || gapTimer) return
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastSentAt))
    if (wait === 0) { emit(); return }
    gapTimer = setTimeout(() => {
      gapTimer = null
      if (!disposed) emit()
    }, wait)
  }

  // Le jeton d'accès du service Realtime est posé par supabase-js à la
  // connexion et à chaque renouvellement. On le redemande une fois au
  // démarrage pour le cas où l'émetteur parte avant que ce soit fait : sans
  // jeton, l'envoi sur un canal privé serait refusé.
  void supabase.realtime.setAuth().catch(() => {}).then(() => {
    if (!disposed) emit()
  })

  const beat = setInterval(() => { if (!disposed) emit() }, BEAT_MS)

  return {
    sessionId,
    markDirty: () => { dirty = true; emitThrottled() },
    stop: () => {
      disposed = true
      clearInterval(beat)
      if (gapTimer) clearTimeout(gapTimer)
      // Dernier mot : l'appareil disparaît tout de suite de l'écran du
      // superviseur, au lieu d'y rester quatre-vingt-dix secondes.
      emit(true)
      void supabase.removeChannel(channel)
    },
  }
}

/**
 * Aligne l'émetteur sur la pile des écrans.
 *
 * Appelé à chaque montage, démontage et changement de mode. Il ne redémarre
 * que si l'inventaire change : passer de l'écran d'un inventaire à son écran
 * de comptage ne coupe rien, ne renvoie pas de message de départ, et ne fait
 * pas clignoter l'appareil sur le tableau de bord.
 */
let lastTopId: number | null = null

function syncEngine(): void {
  const holder = top()
  if (!holder) {
    engine?.stop()
    engine = null
    lastTopId = null
    return
  }
  const change = holder.id !== lastTopId
  lastTopId = holder.id
  if (engine && engine.sessionId === holder.sessionId) {
    // Même inventaire, écran différent : on ne redémarre rien, mais le mode
    // vient de changer. Sans ce rappel, fermer le comptage laisserait
    // l'appareil affiché « en comptage » jusqu'au battement suivant, soit
    // trente secondes. `markDirty` regroupe : un aller-retour rapide entre
    // deux écrans ne produit pas deux messages.
    if (change) engine.markDirty()
    return
  }
  engine?.stop()
  engine = startEngine(holder.sessionId)
}

/**
 * Publie la présence de l'appareil courant sur un inventaire.
 *
 * Le superviseur voit alors, depuis le site, **combien** d'appareils sont
 * connectés et dans quel mode — jamais qui fait quoi. Sans effet si
 * l'inventaire ou le profil manquent : l'appel est donc sûr en tête de
 * composant.
 *
 * Plusieurs écrans peuvent l'appeler en même temps — c'est même le cas normal,
 * l'écran de comptage se montant par-dessus celui de l'inventaire. Ils
 * s'inscrivent alors dans une pile, et seul le dernier donne le mode ; il n'y
 * a toujours qu'un émetteur et qu'une clé d'appareil.
 */
export function useSessionPresence(sessionId: string | undefined, activity: PresenceActivity) {
  const { profile } = useAuth()
  const userId = profile?.id
  const idRef = useRef<number | null>(null)

  // Inscription dans la pile. `mode` n'est pas dans les dépendances : il est
  // mis à jour par l'effet suivant, sans réinscrire l'écran — se réinscrire
  // le ferait passer au-dessus de l'écran de comptage ouvert par-dessus lui.
  useEffect(() => {
    if (!sessionId || !userId) return
    const id = nextHolderId++
    idRef.current = id
    holders = [...holders, { id, sessionId, mode: activityRefMode(activity) }]
    syncEngine()
    return () => {
      holders = holders.filter(h => h.id !== id)
      idRef.current = null
      syncEngine()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, userId])

  // Changement de mode : on met à jour l'entrée et on prévient tout de suite.
  // Passer de comptage à audit doit se voir ; `markDirty` regroupe, donc un
  // aller-retour rapide entre deux modes ne produit pas deux messages.
  useEffect(() => {
    const id = idRef.current
    if (id == null) return
    const h = holders.find(x => x.id === id)
    if (!h || h.mode === activity.mode) return
    h.mode = activity.mode
    if (h.id === top()?.id) engine?.markDirty()
  }, [activity.mode])
}

/** Lecture défensive : un appelant peut passer un objet sans `mode`. */
function activityRefMode(activity: PresenceActivity): PresenceMode {
  return activity?.mode ?? null
}

