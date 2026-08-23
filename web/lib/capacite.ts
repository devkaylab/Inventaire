/**
 * Capacité serveur — le jugement.
 *
 * `admin-metrics` rend l'état de l'instance, `admin_charge_pointes` rend le
 * pic applicatif. Ce module décide ce que ces chiffres veulent dire : à quel
 * moment un plafond appelle un geste, et lequel.
 *
 * Même partage que `lib/mesure.ts` et `lib/pipeline.ts` — les seuils bougeront
 * plus souvent que les requêtes, et ils se testent sans base ni réseau.
 *
 * ── ⚠️ Trois sources, et il faut les distinguer à l'écran ───────────────────
 *
 *   · `flux`    — l'instant, lu sur le flux de métriques du projet ;
 *   · `base`    — le pic, retrouvé dans `counts` ;
 *   · `facture` — ce que Supabase compte et que rien n'expose. Les messages
 *                 temps réel et la sortie réseau du mois sont dans ce cas :
 *                 la seule série temps réel du flux
 *                 (`realtime_postgres_changes_*`) compte les abonnements
 *                 postgres_changes, or la présence passe par du broadcast.
 *
 * Afficher les trois sans le dire ferait passer un chiffre de facture vieux
 * d'un mois pour une mesure en direct.
 */

export type SourceMesure = 'flux' | 'base' | 'facture'
export type EtatPlafond = 'ok' | 'surveiller' | 'agir' | 'inconnu'

export type Capacite = {
  connexions: number | null
  connexionsMax: number | null
  disqueTotal: number | null
  disqueLibre: number | null
  baseOctets: number | null
  walMo: number | null
  memoireTotale: number | null
  memoireDispo: number | null
  coeurs: number | null
  charge1: number | null
  comptes: number | null
}

export type Pointes = {
  ecritures_min: number | null
  ecritures_quand: string | null
  compteurs_max: number | null
  inventaires_max: number | null
  minutes_actives: number | null
  lignes: number | null
}

export type Plafond = {
  cle: string
  nom: string
  /** Ce qu'on observe, déjà mis en forme. */
  valeur: string
  /** La borne, déjà mise en forme. Vide quand il n'y en a pas. */
  borne: string
  /** 0 à 1. Nul quand la part n'a pas de sens ou n'est pas mesurable. */
  part: number | null
  etat: EtatPlafond
  source: SourceMesure
  /** Ce qu'il faut savoir ou faire. Toujours une phrase, jamais un mot. */
  note: string
}

/**
 * Seuils, réunis pour qu'ils se discutent au lieu de se deviner.
 *
 * `DISQUE_AGRANDIT` n'est pas un choix : Supabase agrandit le disque de 50 %
 * quand il atteint 90 %, et bascule la base en lecture seule à 95 %. On
 * surveille donc bien avant.
 */
export const SEUILS = {
  CONNEXIONS_SURVEILLER: 0.6,
  CONNEXIONS_AGIR: 0.85,
  DISQUE_SURVEILLER: 0.7,
  DISQUE_AGRANDIT: 0.9,
  MEMOIRE_SURVEILLER: 0.85,
  MEMOIRE_AGIR: 0.95,
  /** Charge par cœur : au-delà de 1, les requêtes attendent. */
  CHARGE_SURVEILLER: 0.7,
  CHARGE_AGIR: 1,
  /** Écritures par seconde qu'encaisse une Micro — étude du 21 août 2026. */
  ECRITURES_MICRO_S: 300,
  ECRITURES_SURVEILLER: 0.5,
  ECRITURES_AGIR: 0.8,
} as const

function etatDe(part: number | null, surveiller: number, agir: number): EtatPlafond {
  if (part === null) return 'inconnu'
  if (part >= agir) return 'agir'
  if (part >= surveiller) return 'surveiller'
  return 'ok'
}

const pourcent = (p: number | null) => (p === null ? '—' : `${Math.round(p * 100)} %`)

/**
 * Les plafonds, dans l'ordre où ils comptent.
 *
 * Les deux derniers n'ont pas de valeur et c'est volontaire : on ne fabrique
 * pas un chiffre pour remplir une ligne. Ils disent où le lire.
 */
export function lirePlafonds(
  c: Capacite | null,
  p: Pointes | null,
  fmt: { octets: (v: number | null) => string },
): Plafond[] {
  const partConnexions =
    c?.connexions != null && c.connexionsMax ? c.connexions / c.connexionsMax : null

  const disqueUtilise =
    c?.disqueTotal != null && c.disqueLibre != null ? c.disqueTotal - c.disqueLibre : null
  const partDisque =
    disqueUtilise != null && c?.disqueTotal ? disqueUtilise / c.disqueTotal : null

  const memUtilisee =
    c?.memoireTotale != null && c.memoireDispo != null ? c.memoireTotale - c.memoireDispo : null
  const partMemoire =
    memUtilisee != null && c?.memoireTotale ? memUtilisee / c.memoireTotale : null

  const partCharge = c?.charge1 != null && c.coeurs ? c.charge1 / c.coeurs : null

  const ecrituresS = p?.ecritures_min != null ? p.ecritures_min / 60 : null
  const partEcritures = ecrituresS === null ? null : ecrituresS / SEUILS.ECRITURES_MICRO_S

  return [
    {
      cle: 'connexions',
      nom: 'Connexions Postgres',
      valeur: c?.connexions != null ? String(c.connexions) : '—',
      borne: c?.connexionsMax != null ? String(c.connexionsMax) : '',
      part: partConnexions,
      etat: etatDe(partConnexions, SEUILS.CONNEXIONS_SURVEILLER, SEUILS.CONNEXIONS_AGIR),
      source: 'flux',
      note: c?.connexionsMax
        ? `Plafond de l’instance. Les téléphones passent par le pooler et n’en consomment pas une chacun.`
        : 'Non relevé.',
    },
    {
      cle: 'disque',
      nom: 'Disque de données',
      valeur: fmt.octets(disqueUtilise),
      borne: fmt.octets(c?.disqueTotal ?? null),
      part: partDisque,
      etat: etatDe(partDisque, SEUILS.DISQUE_SURVEILLER, SEUILS.DISQUE_AGRANDIT),
      source: 'flux',
      // Le point que la facturation cache : les 8 Go inclus sont un seuil de
      // prix, pas la taille du disque. Le disque réel est bien plus petit.
      note: `Le disque provisionné, pas les 8 Go inclus dans le forfait : ceux-là sont un seuil de prix. Supabase l’agrandit de moitié à ${Math.round(SEUILS.DISQUE_AGRANDIT * 100)} %, et passe la base en lecture seule à 95 %.`,
    },
    {
      cle: 'memoire',
      nom: 'Mémoire',
      valeur: fmt.octets(memUtilisee),
      borne: fmt.octets(c?.memoireTotale ?? null),
      part: partMemoire,
      etat: etatDe(partMemoire, SEUILS.MEMOIRE_SURVEILLER, SEUILS.MEMOIRE_AGIR),
      source: 'flux',
      note: 'Postgres met le cache en mémoire : une part élevée est normale, c’est la mémoire disponible qui compte.',
    },
    {
      cle: 'charge',
      nom: 'Charge processeur',
      valeur: c?.charge1 != null ? c.charge1.toFixed(2) : '—',
      borne: c?.coeurs != null ? `${c.coeurs} cœur${c.coeurs > 1 ? 's' : ''}` : '',
      part: partCharge,
      etat: etatDe(partCharge, SEUILS.CHARGE_SURVEILLER, SEUILS.CHARGE_AGIR),
      source: 'flux',
      note: 'Moyenne sur une minute, à l’instant du relevé. Au-delà d’un par cœur, les requêtes attendent.',
    },
    {
      cle: 'ecritures',
      nom: 'Écritures en pointe',
      valeur: ecrituresS === null ? '—' : `${ecrituresS.toFixed(2)} / s`,
      borne: `≈ ${SEUILS.ECRITURES_MICRO_S} / s`,
      part: partEcritures,
      etat: etatDe(partEcritures, SEUILS.ECRITURES_SURVEILLER, SEUILS.ECRITURES_AGIR),
      source: 'base',
      note: 'La minute la plus chargée des douze derniers mois. C’est le pic qui dimensionne la machine, jamais la moyenne.',
    },
    {
      cle: 'temps-reel',
      nom: 'Messages temps réel',
      valeur: '—',
      borne: '5 M / mois',
      part: null,
      etat: 'inconnu',
      source: 'facture',
      note: 'Compté par Supabase, pas exposé : la seule série du flux suit les abonnements postgres_changes, or la présence passe par du broadcast. À relever sur la facture.',
    },
    {
      cle: 'egress',
      nom: 'Sortie réseau',
      valeur: '—',
      borne: '250 Go / mois',
      part: null,
      etat: 'inconnu',
      source: 'facture',
      note: 'Compteur de facturation mensuel. Le flux donne le trafic depuis le dernier redémarrage, qui ne s’y compare pas.',
    },
  ]
}

/** Ce qui appelle un geste, le plus tendu d'abord. */
export function aSurveiller(plafonds: Plafond[]): Plafond[] {
  const rang = { agir: 0, surveiller: 1, ok: 2, inconnu: 3 }
  return plafonds
    .filter((x) => x.etat === 'agir' || x.etat === 'surveiller')
    .sort((a, b) => rang[a.etat] - rang[b.etat] || (b.part ?? 0) - (a.part ?? 0))
}

export const LIBELLES_ETAT: Record<EtatPlafond, string> = {
  ok: 'De la marge',
  surveiller: 'À surveiller',
  agir: 'À relever',
  inconnu: 'Non mesuré',
}

export const LIBELLES_SOURCE: Record<SourceMesure, string> = {
  flux: 'instance',
  base: 'pic sur 12 mois',
  facture: 'facture Supabase',
}

export { pourcent }
