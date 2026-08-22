// Les ventes en cours : qui attend quoi, à chaque étape.
//
// `admin_pipeline` rend des faits — statut, dates. Ce module en tire un
// jugement : à qui est le tour, depuis combien de temps, et le geste qui
// s'impose. Ces règles changeront plus souvent que la requête (« neuf jours
// sans réponse, c'est long »), et elles se testent sans base ni navigateur.
// Même partage que `lib/entreprise.ts` pour les alertes d'un magasin.

export type EtapeVente = 'pending' | 'quoted' | 'accepted' | 'paid'

export type VenteEnCours = {
  /** Inscription d'une entreprise, ajout d'un magasin, ou suppression. */
  kind: 'company' | 'store' | 'store_removal'
  id: string
  company_id: string | null
  company_name: string
  /** Ce qu'on lit en premier : le nom de l'entreprise ou du magasin. */
  label: string
  /** Ce qui précise : « 3 magasins », ou l'entreprise du magasin. */
  detail: string
  contact: string
  status: EtapeVente
  quote_reference: string
  quote_amount_cents: number | null
  created_at: string
  quote_sent_at: string | null
  quote_expires_at: string | null
  accepted_at: string | null
  paid_at: string | null
}

/** Les seuils se discutent, ils ne se devinent pas. En jours. */
export const SEUILS_VENTE = {
  /** Une demande sans devis au-delà de ce délai, c'est nous qui traînons. */
  deviserSous: 2,
  /** Un devis sans réponse au-delà de ce délai mérite un appel. */
  relancerApres: 7,
} as const

/** À qui est le tour. `nous` = un geste t'attend ; `client` = on attend. */
export type Tour = 'nous' | 'client'

export type LectureVente = {
  tour: Tour
  /** Une ligne, au présent : « Devis envoyé le 22/08 — en attente du client ». */
  etat: string
  /** Le bouton : « Établir le devis », « Facturer », « Créer »… */
  geste: string
  /** Vrai quand ça traîne — de notre côté ou du sien. */
  retard: boolean
}

const jours = (iso: string, maintenant: Date) =>
  Math.floor((maintenant.getTime() - new Date(iso).getTime()) / 86_400_000)

const jourCourt = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

/**
 * Lecture d'une vente à un instant donné.
 *
 * La suppression d'un magasin n'a qu'une étape : elle n'entre jamais dans le
 * devis, et c'est toujours à nous.
 */
export function lireVente(v: VenteEnCours, maintenant = new Date()): LectureVente {
  if (v.kind === 'store_removal') {
    const d = jours(v.created_at, maintenant)
    return {
      tour: 'nous',
      etat: `Suppression demandée le ${jourCourt(v.created_at)}`,
      geste: 'Traiter',
      retard: d >= SEUILS_VENTE.deviserSous,
    }
  }

  switch (v.status) {
    case 'pending': {
      const d = jours(v.created_at, maintenant)
      return {
        tour: 'nous',
        etat: d === 0 ? 'Demande reçue aujourd’hui' : `Demande reçue il y a ${d} j`,
        geste: 'Établir le devis',
        retard: d >= SEUILS_VENTE.deviserSous,
      }
    }
    case 'quoted': {
      const expire = v.quote_expires_at ? new Date(v.quote_expires_at) : null
      const perime = expire !== null && expire.getTime() < maintenant.getTime()
      if (perime) {
        return {
          tour: 'nous',
          etat: `Devis ${v.quote_reference} expiré le ${jourCourt(v.quote_expires_at!)} sans réponse`,
          geste: 'Relancer ou renvoyer',
          retard: true,
        }
      }
      const d = v.quote_sent_at ? jours(v.quote_sent_at, maintenant) : 0
      const traine = d >= SEUILS_VENTE.relancerApres
      return {
        tour: traine ? 'nous' : 'client',
        etat: v.quote_sent_at
          ? `Devis envoyé le ${jourCourt(v.quote_sent_at)} — ${traine ? `sans réponse depuis ${d} j` : 'en attente du client'}`
          : 'Devis envoyé — en attente du client',
        geste: traine ? 'Relancer' : 'Voir',
        retard: traine,
      }
    }
    case 'accepted': {
      // Le paiement passe par Stripe : après l'accord, c'est au client de
      // régler. Passé le seuil, on le relance — un accord sans paiement est
      // une vente qui refroidit.
      const d = v.accepted_at ? jours(v.accepted_at, maintenant) : 0
      const traine = d >= SEUILS_VENTE.relancerApres
      return {
        tour: traine ? 'nous' : 'client',
        etat: v.accepted_at
          ? `Accepté le ${jourCourt(v.accepted_at)} — ${traine ? `paiement attendu depuis ${d} j` : 'en attente du paiement'}`
          : 'Accepté — en attente du paiement',
        geste: traine ? 'Relancer' : 'Voir',
        retard: traine,
      }
    }
    case 'paid': {
      // Le webhook crée dans la foulée du paiement. Voir `paid` sans `created`
      // plus de quelques minutes, c'est un webhook qui n'est pas passé.
      const d = v.paid_at ? jours(v.paid_at, maintenant) : 0
      return {
        tour: 'nous',
        etat: v.paid_at ? `Payé le ${jourCourt(v.paid_at)} — création en attente` : 'Payé — création en attente',
        geste: v.kind === 'company' ? 'Créer l’entreprise' : 'Créer le magasin',
        retard: d >= 1,
      }
    }
  }
}

/**
 * Ordre d'affichage : ce qui nous attend avant ce qui attend le client, et
 * dans chaque groupe le plus ancien d'abord — c'est lui qui a le plus attendu.
 */
export function trierVentes(ventes: VenteEnCours[], maintenant = new Date()): VenteEnCours[] {
  const poids = (v: VenteEnCours) => {
    const l = lireVente(v, maintenant)
    return (l.tour === 'nous' ? 0 : 10) + (l.retard ? 0 : 5)
  }
  return [...ventes].sort((a, b) => {
    const pa = poids(a), pb = poids(b)
    if (pa !== pb) return pa - pb
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

/** Où le geste se fait : la console pour une inscription, la fiche pour un magasin. */
export function lienVente(v: VenteEnCours): string {
  if (v.kind === 'company') return '/admin/console'
  return v.company_id ? `/admin/entreprise/${v.company_id}` : '/admin/entreprises'
}

/** Le revenu annuel que représentent les devis pas encore encaissés. */
export function enAttenteCents(ventes: VenteEnCours[]): number {
  return ventes
    .filter((v) => v.kind !== 'store_removal' && (v.status === 'quoted' || v.status === 'accepted'))
    .reduce((s, v) => s + (v.quote_amount_cents ?? 0), 0)
}
