/**
 * Le décompte d'appareils — le jugement.
 *
 * `appareils_du_magasin` rend des faits ; ce module décide ce qu'ils veulent
 * dire et quelle offre proposer. Même partage que `lib/pipeline.ts`,
 * `lib/entreprise.ts` et `lib/mesure.ts` : une règle qui bougera plus souvent
 * que la requête, et qui se teste sans base ni navigateur.
 *
 * ── ⚠️ LE SIGNAL N'EST PAS LE PIC, C'EST LE REFUS ──────────────────────────
 *
 * Depuis que le verrou ferme la porte au troisième appareil d'un forfait
 * Essential (règle de Julien, 4 septembre 2026 : « on n'accepte ni magasin, ni
 * appareil supplémentaires sans paiement »), **le pic ne peut plus dépasser le
 * plafond, par construction**. « Sept appareils ont compté sur un forfait de
 * deux » n'arrivera plus jamais.
 *
 * Ce qui dit qu'une offre plus large est devenue nécessaire, c'est donc le
 * nombre d'appareils **éconduits** — et `besoin` (`pic + refus` du jour le plus
 * chargé), qui estime ce qu'il aurait fallu.
 *
 * ⚠️ `besoin` MAJORE. Deux appareils refusés à deux heures d'écart s'y
 * additionnent alors qu'ils n'étaient pas simultanés. Le vocabulaire de
 * l'écran doit donc rester prudent — « il en aurait fallu au moins N » —, et
 * un test interdit d'écrire que le chiffre est exact.
 */

import { APPAREILS_MAX, OFFRES, SUPPLEMENT, offrePour, prixCents, type Offre } from '@/lib/offres'

/** Ce que rend `appareils_du_magasin`. */
export type AppareilsMagasin = {
  /** Le haut du palier payé. Nul quand aucune assiette n'est connue. */
  plafond: number | null
  maintenant: number
  pic: number
  pic_le: string | null
  refus: number
  refus_le: string | null
  besoin: number
  besoin_le: string | null
  jours: number
}

export type EtatAppareils = 'sans_assiette' | 'dans_le_forfait' | 'depasse'

/** L'offre à proposer, prête à écrire à l'écran. */
export type Proposition = {
  /** Le nom du palier — jamais réinventé, il vient d'`OFFRES`. */
  nom: string
  /** Le nombre d'appareils que la proposition couvre. */
  couvre: number
  /** Tranches de dix en sus d'Enterprise. Zéro dans le cas courant. */
  tranches: number
  /** Hors taxes, par magasin. */
  mois: number
  an: number
  /** Le libellé du bouton. */
  action: string
}

export type VerdictAppareils = {
  etat: EtatAppareils
  /** Le palier payé aujourd'hui, nommé. Nul sans assiette. */
  offreActuelle: string | null
  proposition: Proposition | null
}

/** Le nom du palier qui correspond à ce plafond. */
export function nomDuPalier(plafond: number | null): string | null {
  if (plafond == null || plafond <= 0) return null
  const o = OFFRES.find((x) => x.max === plafond)
  if (o) return o.nom
  // Au-delà d'Enterprise, le palier ne change pas de nom quand il se prolonge.
  return plafond > APPAREILS_MAX ? OFFRES[OFFRES.length - 1].nom : null
}

/**
 * L'offre qui couvre le besoin constaté.
 *
 * ⚠️ **ELLE COUVRE LE BESOIN, ELLE NE MONTE PAS D'UN CRAN.** Arbitré par
 * Julien le 4 septembre 2026 : un magasin Essential dont le besoin monte à 40
 * se voit proposer **Enterprise**, pas Advanced. Lui proposer le rang suivant
 * le laisserait au-dessus de son forfait dès le lendemain, et il faudrait le
 * rappeler une semaine plus tard.
 *
 * Rend `null` quand le forfait couvre déjà le besoin : il n'y a rien à vendre.
 */
export function proposer(plafond: number | null, besoin: number): Proposition | null {
  if (plafond == null || !Number.isFinite(besoin) || besoin <= plafond) return null

  const o: Offre | null = offrePour(besoin)
  const socle = OFFRES[OFFRES.length - 1]

  if (o) {
    return {
      nom: o.nom,
      couvre: o.max,
      tranches: 0,
      mois: o.mois,
      an: o.an,
      action: `Passer à ${o.nom}`,
    }
  }

  // Au-delà du plafond d'Enterprise : le palier se prolonge par tranches de
  // dix entamées, exactement comme `prixCents` les facture.
  const tranches = Math.ceil((besoin - APPAREILS_MAX) / SUPPLEMENT.par)
  const couvre = APPAREILS_MAX + tranches * SUPPLEMENT.par
  const enPlus = couvre - plafond
  return {
    nom: socle.nom,
    couvre,
    tranches,
    // Le prix vient de la grille, jamais d'une addition faite ici : deux
    // calculs du même montant divergeraient au premier ajustement.
    mois: (prixCents(besoin, 'monthly') ?? 0) / 100,
    an: (prixCents(besoin, 'yearly') ?? 0) / 100,
    action: enPlus > 0 ? `Ajouter ${enPlus} appareils` : `Passer à ${socle.nom}`,
  }
}

/** Ce que la fiche du magasin doit dire. */
export function lireAppareils(a: AppareilsMagasin | null): VerdictAppareils {
  if (!a || a.plafond == null) {
    return { etat: 'sans_assiette', offreActuelle: null, proposition: null }
  }
  const proposition = proposer(a.plafond, a.besoin)
  return {
    etat: proposition ? 'depasse' : 'dans_le_forfait',
    offreActuelle: nomDuPalier(a.plafond),
    proposition,
  }
}

/**
 * Les paliers, tels que ce module les voit — pour le test de concordance avec
 * `plafond_appareils` en base, qui en porte la copie. Le site et la base ne
 * compilent pas ensemble ; c'est la même duplication assumée que la grille de
 * `_shared/devis.ts`, avec le même remède.
 */
export const PALIERS_APPAREILS = OFFRES.map((o) => o.max)
