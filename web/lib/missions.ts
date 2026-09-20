/**
 * Ce que la console sait d'une mission — vocabulaire partagé.
 *
 * ⚠️ **LES ÉTATS SONT CEUX DE LA BASE, ET LES LIBELLÉS N'EN SONT PAS.** La
 * machine d'état a seize positions (`missions.etat`) ; l'écran en montre cinq,
 * parce qu'un exploitant décide sur « équipe incomplète » ou « prête », pas sur
 * `equipe_complete` versus `prete`. Ne pas confondre les deux listes : la
 * première fait foi, la seconde se lit.
 */

export type MissionConsole = {
  id: string
  reference: string
  magasin_nom: string
  client_nom: string
  ville: string | null
  debut_prevu: string
  duree_prevue_minutes: number
  etat: string
  inventoristes: number
  responsable: boolean
  prix_cents: number
  cout_cents: number
  marge_cents: number
  marge: number
  places: number
  confirmes: number
  en_attente: number
  dernier_desistement: string | null
}

export const ETATS_MISSION = {
  /** Ce qui ne demande plus rien : la mission est derrière nous. */
  finis: ['terminee', 'payee', 'annulee', 'remboursee', 'echouee'],
  /** Ce qui se constitue : c'est là que la console travaille. */
  enConstitution: ['confirmee', 'en_constitution', 'equipe_complete'],
}

const LIBELLES: Record<string, string> = {
  brouillon: 'Brouillon',
  prix_calcule: 'Prix calculé',
  paiement_autorise: 'Paiement autorisé',
  confirmee: 'À constituer',
  en_constitution: 'À constituer',
  equipe_complete: 'Équipe complète',
  prete: 'Prête',
  en_cours: 'En cours',
  controle_qualite: 'Contrôle qualité',
  terminee: 'Terminée',
  paiement_prestataires: 'Versements en cours',
  payee: 'Payée',
  annulee: 'Annulée',
  remboursee: 'Remboursée',
  litige: 'Litige',
  echouee: 'Échouée',
}

export function etatLisible(m: MissionConsole): string {
  // ⚠️ L'ÉTAT SEUL NE SUFFIT PAS. `en_constitution` à trois heures du départ et
  // `en_constitution` dans trois semaines ne demandent pas la même chose — la
  // maquette dit « En danger » pour le premier, « À constituer » pour le
  // second. C'est le temps qui reste qui fait la différence, pas la colonne.
  const u = urgence(m)
  if (u) return u.etiquette
  return LIBELLES[m.etat] ?? m.etat
}

export type Urgence = {
  titre: string
  detail: string
  action: string
  etiquette: string
  grave: boolean
}

/** Heures avant l'arrivée de l'équipe. */
export function heuresAvant(m: MissionConsole, maintenant = new Date()): number {
  return (new Date(m.debut_prevu).getTime() - maintenant.getTime()) / 3_600_000
}

/**
 * Ce qui demande une décision aujourd'hui, et rien d'autre.
 *
 * ⚠️ Rendre `null` est le cas NORMAL : une console qui signale tout ne signale
 * rien. Deux situations seulement remontent — une équipe incomplète dont le
 * départ approche, et un désistement qui n'a pas encore été remplacé.
 */
export function urgence(m: MissionConsole, maintenant = new Date()): Urgence | null {
  if (ETATS_MISSION.finis.includes(m.etat)) return null
  const h = heuresAvant(m, maintenant)
  if (h < 0) return null

  const manque = m.places - m.confirmes
  if (manque <= 0) return null

  // Un désistement récent est le cas le plus urgent : la place était pourvue,
  // elle ne l'est plus, et personne ne l'a encore reprise.
  if (m.dernier_desistement && m.en_attente === 0) {
    return {
      titre: 'un désistement',
      detail: `${manque} place${manque > 1 ? 's' : ''} à reprendre · départ ${dans(h)}.`,
      action: 'Remplacer',
      etiquette: 'Désistement',
      grave: h < 72,
    }
  }

  // ⚠️ LE SEUIL EST À QUARANTE-HUIT HEURES, comme le délai de constitution
  // annoncé au client. En deçà, on a promis une équipe qu'on n'a pas.
  if (h < 48) {
    return {
      titre: `début ${dans(h)}, équipe incomplète`,
      detail: `${m.confirmes} confirmé${m.confirmes > 1 ? 's' : ''} sur ${m.places}`
        + (m.en_attente > 0 ? ` · ${m.en_attente} en attente de réponse.` : '.'),
      action: 'Compléter l’équipe',
      etiquette: 'En danger',
      grave: true,
    }
  }
  return null
}

function dans(heures: number): string {
  if (heures < 1) return `dans ${Math.round(heures * 60)} min`
  if (heures < 48) {
    const h = Math.floor(heures)
    const m = Math.round((heures - h) * 60)
    return m === 0 ? `dans ${h} h` : `dans ${h} h ${String(m).padStart(2, '0')}`
  }
  return `dans ${Math.round(heures / 24)} jours`
}
