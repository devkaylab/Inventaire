// Contrat de présence temps réel — CÔTÉ SITE.
//
// ⚠️ À GARDER SYNCHRONISÉ AVEC src/lib/presence.ts (application mobile).
// Les deux paquets npm sont séparés (Next/React 18 d'un côté, Expo/React 19 de
// l'autre) : ce fichier est donc dupliqué volontairement. Une dérive de ce
// contrat serait silencieuse — le site afficherait simplement « personne
// connectée » sans que rien ne signale l'erreur. C'est la raison du champ `v` :
// le site ignore les charges dont il ne connaît pas la version et le dit
// explicitement à l'écran, plutôt que de faire semblant.
//
// Rien à configurer côté serveur : la présence et le broadcast passent par le
// service Realtime (canaux Phoenix) et ne touchent pas à la réplication
// logique de Postgres — aucune publication, aucune table, aucun trigger.

export const PRESENCE_V = 1

export const presenceTopic = (sessionId: string) => `session:${sessionId}:presence`

/** Événement de broadcast émis par le mobile après un scan ou un changement de balise. */
export const SYNC_EVENT = 'sync'

export type PresenceMode = 'count' | 'audit' | null

export type PresencePayload = {
  v: number
  user_id: string
  full_name: string
  role: string
  device: 'ios' | 'android' | 'web'
  /** Où la personne se trouve dans l'application. */
  screen: 'session' | 'scan'
  /** Passe 1 = comptage, passe 2 = audit. `null` hors écran de scan. */
  mode: PresenceMode
  /** Code de la balise actuellement ouverte dans le scanner. */
  balise: string | null
  balise_name: string | null
  /** Application au premier plan — un téléphone en poche n'est pas au travail. */
  foreground: boolean
  /** Début de l'activité EN COURS (epoch ms) — sert au « depuis 4 min ». */
  since: number
  /** Dernier battement (epoch ms) — sert à détecter une socket fantôme. */
  beat: number
}

/**
 * Signature d'activité : `since` n'est remis à zéro que lorsqu'elle change.
 * Sans cela, chaque battement redémarrerait le « depuis 4 min » et le chiffre
 * affiché serait faux.
 */
export function activitySignature(p: Pick<PresencePayload, 'screen' | 'mode' | 'balise'>): string {
  return `${p.screen}|${p.mode}|${p.balise}`
}

/**
 * Aplatit l'état brut du canal en une entrée par personne.
 * Un même utilisateur sur deux appareils produit deux entrées : on garde la
 * plus récente. Les versions de contrat inconnues sont écartées.
 */
export function flattenPresence(
  state: Record<string, unknown[]>,
): { people: Record<string, PresencePayload>; unknownVersions: number } {
  const people: Record<string, PresencePayload> = {}
  let unknownVersions = 0

  for (const entries of Object.values(state ?? {})) {
    const candidates = (entries ?? []) as Partial<PresencePayload>[]
    for (const raw of candidates) {
      if (!raw || typeof raw.user_id !== 'string') continue
      if (raw.v !== PRESENCE_V) { unknownVersions += 1; continue }
      const p = raw as PresencePayload
      const known = people[p.user_id]
      if (!known || (p.beat ?? 0) > (known.beat ?? 0)) people[p.user_id] = p
    }
  }
  return { people, unknownVersions }
}
