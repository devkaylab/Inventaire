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
// Rien à configurer côté serveur : la présence et le broadcast passent par le
// service Realtime (canaux Phoenix) et ne touchent pas à la réplication
// logique de Postgres — aucune publication, aucune table, aucun trigger.

/** v2 : voir l'en-tête. Une charge v1 est écartée et signalée à l'écran. */
export const PRESENCE_V = 2

export const presenceTopic = (sessionId: string) => `session:${sessionId}:presence`

/** Événement de broadcast émis par le mobile après un scan ou un changement de balise. */
export const SYNC_EVENT = 'sync'

export type PresenceMode = 'count' | 'audit' | null

export type PresencePayload = {
  v: number
  /** Comptage, audit, ou `null` hors écran de scan. Seul signal conservé. */
  mode: PresenceMode
  /** Dernier battement (epoch ms) — sert à écarter une socket fantôme. */
  beat: number
}

/** Au-delà de trois battements manqués, l'appareil n'est plus considéré connecté. */
export const STALE_MS = 90_000

/**
 * Identifiant d'appareil, tiré au hasard à chaque montage.
 *
 * Sert uniquement de clé de présence, pour qu'un appareil qui se reconnecte ne
 * soit pas compté deux fois. Il ne survit pas au rechargement et n'est relié à
 * aucun compte : c'est ce qui distingue « compter des appareils » de « suivre
 * des personnes ».
 */
export function newDeviceKey(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // Repli : environnements sans WebCrypto (très anciens navigateurs, tests).
  return `d-${Math.floor(Math.random() * 1e9).toString(36)}${Date.now().toString(36)}`
}

/**
 * Aplatit l'état brut du canal en une entrée par appareil.
 *
 * Une entrée par clé de présence, la plus récente si le service en renvoie
 * plusieurs. Les charges d'une version inconnue sont écartées et comptées à
 * part : elles viennent d'une application mobile pas encore mise à jour.
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
      if (raw.v !== PRESENCE_V) { unknownVersions += 1; continue }
      const p = raw as PresencePayload
      const known = devices[key]
      if (!known || p.beat > known.beat) devices[key] = p
    }
  }
  return { devices, unknownVersions }
}
