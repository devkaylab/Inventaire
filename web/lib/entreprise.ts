// L'entreprise vue par son administrateur.
//
// Les chiffres viennent de `ca_company_overview` ; ce module ne fait que les
// lire. Les **alertes**, en revanche, se calculent ici plutôt qu'en SQL : ce
// sont des règles de jugement (« neuf jours, c'est long »), elles changeront
// plus souvent que la requête, et elles se testent sans base ni navigateur.

export type SessionBloc = {
  id: string
  name: string
  inventory_number: string
  status: 'open' | 'counting' | 'closed'
  uses_zones: boolean
  created_at: string
  closed_at: string | null
  created_by_label: string | null
  members: number
  pieces: number
  expected: number
  last_count_at: string | null
}

export type StoreBloc = {
  id: string
  name: string
  join_code: string
  supervisors: { id: string; full_name: string | null }[]
  counters: number
  counters_active: number
  last_session_at: string | null
  sessions: SessionBloc[]
}

export type Totaux = {
  stores: number
  sessions_open: number
  people: number
  supervisors: number
  counters: number
  active_today: number
  pieces_month: number
  sessions_month: number
  store_requests: number
  never_signed_in: number
}

export type ApercuEntreprise = {
  company: { id: string; name: string }
  totals: Totaux
  stores: StoreBloc[]
}

export type Alerte = { cle: string; titre: string; detail: string }

/** Nombre de jours entiers écoulés depuis une date ISO. */
export function joursDepuis(iso: string | null, maintenant = Date.now()): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor((maintenant - t) / 86_400_000)
}

const jours = (n: number) => `${n} jour${n > 1 ? 's' : ''}`

/** Les seuils, en un seul endroit — ils se discutent, ils ne se devinent pas. */
export const SEUILS = {
  /** Un inventaire ouvert plus longtemps que ça traîne. */
  inventaireOuvert: 7,
  /** Un inventaire en cours sans le moindre scan depuis ce délai est à l'arrêt. */
  sansScan: 3,
  /** Un magasin qui n'a pas compté depuis ce délai décroche. */
  magasinInactif: 90,
}

/**
 * Ce qui, dans un magasin, demande l'attention de l'administrateur.
 *
 * Rien de bavard : un magasin dont tout va bien ne produit aucune ligne, il
 * est simplement plus court à lire. C'est ce qui donne du poids aux autres.
 */
export function alertesMagasin(store: StoreBloc, maintenant = Date.now()): Alerte[] {
  const alertes: Alerte[] = []
  const ouverts = store.sessions.filter((s) => s.status !== 'closed')

  for (const s of ouverts) {
    const age = joursDepuis(s.created_at, maintenant)
    if (age !== null && age >= SEUILS.inventaireOuvert) {
      alertes.push({
        cle: `ouvert-${s.id}`,
        titre: `Inventaire ouvert depuis ${jours(age)}`,
        detail: s.name,
      })
    }
    const dernier = joursDepuis(s.last_count_at, maintenant)
    if (s.last_count_at === null) {
      // Un inventaire créé il y a une heure n'a normalement pas encore de
      // scan : on ne le signale qu'au bout d'une journée.
      if (age !== null && age >= 1) {
        alertes.push({
          cle: `vide-${s.id}`,
          titre: 'Personne n’a encore compté',
          detail: s.name,
        })
      }
    } else if (dernier !== null && dernier >= SEUILS.sansScan) {
      alertes.push({
        cle: `arret-${s.id}`,
        titre: `Personne n’a compté depuis ${jours(dernier)}`,
        detail: s.name,
      })
    }
  }

  if (store.sessions.length === 0 && store.last_session_at === null) {
    alertes.push({
      cle: `jamais-${store.id}`,
      titre: 'Aucun inventaire n’a jamais été lancé ici',
      detail: store.counters > 0
        ? `${store.counters} compteur${store.counters > 1 ? 's' : ''} y ${store.counters > 1 ? 'sont rattachés' : 'est rattaché'}`
        : 'Aucun compteur n’y est rattaché',
    })
  } else if (ouverts.length === 0) {
    const depuis = joursDepuis(store.last_session_at, maintenant)
    if (depuis !== null && depuis >= SEUILS.magasinInactif) {
      alertes.push({
        cle: `dormant-${store.id}`,
        titre: `Aucun inventaire depuis ${jours(depuis)}`,
        detail: 'Le dernier date de plus de trois mois',
      })
    }
  }

  return alertes
}

/** L'état d'un magasin, tel qu'il se lit d'un coup d'œil en tête de son bloc. */
export function etatMagasin(store: StoreBloc): { cle: string; libelle: string } | null {
  const ouvert = store.sessions.find((s) => s.status !== 'closed')
  if (!ouvert) return null
  return ouvert.status === 'counting'
    ? { cle: 'counting', libelle: 'Comptage en cours' }
    : { cle: 'open', libelle: 'Inventaire ouvert' }
}

/**
 * L'avancement d'un inventaire, quand il est calculable.
 *
 * On ne le recalcule pas zone par zone — ce serait reparcourir tout
 * l'inventaire à chaque ouverture de la page, le motif retiré pour la tenue en
 * charge. On rapporte les pièces comptées au stock théorique quand un fichier
 * attendu a été importé ; sinon il n'y a pas de pourcentage honnête à donner.
 */
export function avancement(s: SessionBloc): number | null {
  if (s.expected <= 0) return null
  return Math.min(100, Math.round((s.pieces / s.expected) * 100))
}
