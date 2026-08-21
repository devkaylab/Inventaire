// Contrat de présence temps réel — CÔTÉ SITE.
//
// ⚠️ À GARDER SYNCHRONISÉ AVEC src/lib/presence.ts (application mobile).
// Les deux paquets npm sont séparés (Next/React 18 d'un côté, Expo/React 19 de
// l'autre) : ce fichier est donc dupliqué volontairement. Une dérive de ce
// contrat serait silencieuse — le site afficherait simplement « aucun appareil
// connecté » sans que rien ne le signale. C'est la raison du champ `v` : le
// site écarte les charges dont il ne connaît pas la version et le dit
// explicitement à l'écran, plutôt que de faire semblant.
//
// ── Version 2 : la présence ne nomme plus personne ──────────────────────────
//
// La v1 transportait le nom, l'écran ouvert, la balise en cours, l'horodatage
// du début d'activité et **l'application au premier plan** — un téléphone rangé
// dans une poche devenait un signal. Le superviseur voyait tout cela
// nominativement et en direct : c'était un dispositif de suivi de l'activité
// des salariés (constat E3 de l'audit du 13 août 2026), avec les obligations
// qui vont avec pour l'entreprise cliente (information, CSE, analyse d'impact).
//
// La v2 ne transporte plus que le **mode** et le **battement**. Le site en
// déduit des compteurs — tant d'appareils connectés, tant en comptage, tant en
// audit — et l'information de pilotage (quelle zone avance) vient de
// l'avancement par zone, rattachée au travail et non aux personnes.
//
// La clé de présence est un **identifiant d'appareil tiré au hasard**, et non
// plus l'identifiant de l'utilisateur : celui-ci voyageait dans le protocole
// même absent de la charge. Plus rien sur ce canal ne désigne une personne.
//
// Ce qui reste nominatif, et doit le rester : `counts.counted_by` en base.
// Arbitrer un écart suppose de savoir qui a compté — c'est une finalité
// distincte, différée, et le cœur du produit. Voir le rapport et l'export.
//
// ── Version 3 : les téléphones ne parlent qu'au superviseur ─────────────────
//
// (21 août 2026, étude de charge « 200 magasins × 100 compteurs ».)
//
// La v2 utilisait la **présence** du service Realtime : chaque téléphone
// rejoignait le canal de l'inventaire et y publiait son battement. Le service
// recopie alors chaque battement vers *tous* les membres du canal — donc vers
// les 99 autres téléphones, qui n'en font rien. Le coût grimpe en n² là où le
// service rendu grimpe en n : à cent compteurs, la présence seule produisait
// environ 336 messages par seconde et par magasin, et le `sync` émis après
// chaque scan un millier de plus. Le plafond de l'abonnement est de 500
// messages par seconde, tous magasins confondus. Ajouté à cela, chaque
// téléphone tenait une connexion ouverte : 20 000 connexions pour un plafond
// de 10 000 au mieux.
//
// En v3, les téléphones **ne rejoignent plus le canal**. Ils envoient leur
// battement par un appel HTTP unique (`channel.httpSend`, service Realtime),
// et seul le tableau de bord du superviseur est abonné. Un battement coûte
// alors deux messages au lieu de cent, et les connexions ouvertes retombent au
// nombre de superviseurs. Les autorisations ne changent pas : le canal reste
// privé et les policies de `realtime.messages` (migration 20260813000009)
// s'appliquent aussi bien à l'envoi HTTP qu'à l'envoi par socket.
//
// L'identifiant d'appareil, que la présence portait comme clé de canal, voyage
// désormais dans la charge (`k`). Rien d'autre ne change : ni le mode, ni le
// battement, ni ce que le site en déduit.
//
// **Transition** : les téléphones déjà installés continuent d'émettre en v2 par
// la présence. Le site écoute donc les deux — présence v2 *et* battements v3 —
// et les fusionne. Cette double écoute pourra disparaître quand le nouveau
// build sera installé partout, pas avant : la retirer trop tôt ferait
// disparaître de l'écran des équipes bel et bien au travail.
//
// Rien à configurer côté serveur : présence et broadcast passent par le service
// Realtime (canaux Phoenix) et ne touchent pas à la réplication logique de
// Postgres — aucune publication, aucune table, aucun trigger.

/** v3 : battement envoyé en broadcast, sans rejoindre le canal. */
export const BEAT_V = 3

/**
 * v2 : ancienne présence, encore émise par les téléphones pas à jour.
 * À retirer — avec `flattenPresence` — quand le build v3 sera partout.
 */
export const LEGACY_PRESENCE_V = 2

export const presenceTopic = (sessionId: string) => `session:${sessionId}:presence`

/** Événement de battement v3. */
export const BEAT_EVENT = 'beat'

/** Événement v2 émis par le mobile après un scan. Transition seulement. */
export const SYNC_EVENT = 'sync'

export type PresenceMode = 'count' | 'audit' | null

export type PresencePayload = {
  v: number
  /** Comptage, audit, ou `null` hors écran de scan. Seul signal conservé. */
  mode: PresenceMode
  /** Dernier battement (epoch ms) — sert à écarter un appareil parti. */
  beat: number
}

/** Charge v3, telle qu'elle circule sur le canal. */
export type BeatPayload = PresencePayload & {
  /** Identifiant d'appareil tiré au hasard. Portait la clé de présence en v2. */
  k: string
  /** Des scans ont eu lieu depuis le battement précédent. */
  dirty?: boolean
  /** Dernier message : l'appareil quitte l'inventaire. */
  gone?: boolean
}

/** Au-delà de trois battements manqués, l'appareil n'est plus considéré connecté. */
export const STALE_MS = 90_000

/**
 * Identifiant d'appareil, tiré au hasard à chaque montage.
 *
 * Sert uniquement à distinguer les appareils entre eux, pour qu'un appareil qui
 * se reconnecte ne soit pas compté deux fois. Il ne survit pas au rechargement
 * et n'est relié à aucun compte : c'est ce qui distingue « compter des
 * appareils » de « suivre des personnes ».
 */
export function newDeviceKey(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // Repli : environnements sans WebCrypto (très anciens navigateurs, tests).
  return `d-${Math.floor(Math.random() * 1e9).toString(36)}${Date.now().toString(36)}`
}

/**
 * Aplatit l'état brut de la **présence v2** en une entrée par appareil.
 *
 * Une entrée par clé de présence, la plus récente si le service en renvoie
 * plusieurs. Les charges d'une version inconnue sont écartées et comptées à
 * part : elles viennent d'une application mobile dont le format ne nous est pas
 * connu.
 *
 * ⚠️ Transition v2 → v3 : cette fonction ne sert plus qu'aux téléphones pas
 * encore mis à jour. Les téléphones à jour passent par `readBeat`.
 */
export function flattenPresence(
  state: Record<string, unknown[]>,
): { devices: Record<string, PresencePayload>; unknownVersions: number } {
  const devices: Record<string, PresencePayload> = {}
  let unknownVersions = 0

  for (const [key, entries] of Object.entries(state ?? {})) {
    const candidates = (entries ?? []) as Partial<PresencePayload>[]
    for (const raw of candidates) {
      if (!raw || typeof raw.beat !== 'number') continue
      if (raw.v !== LEGACY_PRESENCE_V) { unknownVersions += 1; continue }
      const p = raw as PresencePayload
      const known = devices[key]
      if (!known || p.beat > known.beat) devices[key] = p
    }
  }
  return { devices, unknownVersions }
}

/** Ce que le site doit faire d'un battement reçu. */
export type BeatRead =
  /** Appareil vivant : à inscrire ou rafraîchir dans la liste. */
  | { kind: 'device'; key: string; payload: PresencePayload; dirty: boolean }
  /** L'appareil annonce son départ : à retirer tout de suite. */
  | { kind: 'gone'; key: string }
  /**
   * Charge d'une version que le site ne sait pas lire.
   *
   * La clé et le battement sont rendus quand même : c'est ce qui permet de
   * compter des **appareils** et non des messages — sans quoi un seul téléphone
   * pas à jour ferait grimper le compteur d'une unité toutes les trente
   * secondes, indéfiniment.
   */
  | { kind: 'unknown'; key: string; beat: number }
  /** Charge inexploitable (message tronqué, sonde). À ignorer sans rien dire. */
  | { kind: 'ignored' }

/**
 * Lit un battement v3.
 *
 * Séparé du composant pour être testable : c'est le seul endroit où le site
 * décide ce qu'il croit d'un message venu d'un téléphone. Une charge sans clé
 * d'appareil ou sans battement est **ignorée**, pas comptée comme version
 * inconnue : ce n'est pas une application plus récente, c'est un message
 * abîmé — le signaler à l'écran inquiéterait pour rien.
 *
 * `k` et `beat` sont donc la part du contrat qu'une version future ne doit
 * jamais renommer : c'est ce qui permet à ce site-ci de dire « un appareil
 * parle une langue que je ne connais pas » plutôt que de se taire.
 */
export function readBeat(raw: unknown): BeatRead {
  if (!raw || typeof raw !== 'object') return { kind: 'ignored' }
  const p = raw as Partial<BeatPayload>
  if (typeof p.k !== 'string' || !p.k) return { kind: 'ignored' }
  if (typeof p.beat !== 'number') return { kind: 'ignored' }
  if (p.v !== BEAT_V) return { kind: 'unknown', key: p.k, beat: p.beat }
  if (p.gone) return { kind: 'gone', key: p.k }
  const mode: PresenceMode =
    p.mode === 'count' || p.mode === 'audit' ? p.mode : null
  return {
    kind: 'device',
    key: p.k,
    payload: { v: BEAT_V, mode, beat: p.beat },
    dirty: p.dirty === true,
  }
}
