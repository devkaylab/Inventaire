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
 * ⚠️ `besoin` MAJORE — ET LE VOCABULAIRE DOIT DIRE « JUSQU'À », JAMAIS
 * « AU MOINS ». Deux appareils refusés à deux heures d'écart s'y additionnent
 * alors qu'ils n'étaient pas simultanés : le vrai besoin est donc **au plus**
 * ce chiffre. La première version de l'écran écrivait « au moins », c'est-à-dire
 * l'inverse de la vérité. Un test fige la formule.
 *
 * ⚠️ ET ON N'ÉCRIT PAS « PIC » À UN CLIENT. Constat de Julien le 4 septembre
 * 2026 : « un pic signifie que ça va redescendre après, donc pas d'intérêt de
 * passer à la tranche supérieure ». Il a raison, et ce n'est pas qu'un mot : ce
 * qui justifie une montée d'offre n'est pas un maximum atteint une fois, c'est
 * que des appareils aient été **refusés**. Le pic reste dans les faits rendus
 * par la base — il ne s'affiche pas sur la fiche du client.
 *
 * ⚠️ « ASSIETTE » NON PLUS. C'est notre mot, pas le sien. À l'écran on écrit
 * « forfait ».
 */

import { APPAREILS_MAX, OFFRES, SUPPLEMENT, offrePour, prixCents, type Offre } from '@/lib/offres'

/** Ce que rend `appareils_du_magasin`. */
export type AppareilsMagasin = {
  /** Le haut du palier payé. Nul quand aucun forfait n'est connu. */
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

/**
 * Un magasin vu par la console Quantinvo — `appareils_des_magasins` en rend un
 * par magasin de l'entreprise, en un seul appel.
 *
 * ⚠️ Il n'y a PAS de `pic` : depuis que le verrou ferme la porte, il ne peut
 * plus dépasser le plafond, donc il ne dit plus rien.
 */
export type AppareilsDuMagasin = {
  store_id: string
  nom: string
  plafond: number | null
  maintenant: number
  refus: number
  besoin: number
}

export type EtatAppareils = 'sans_forfait' | 'dans_le_forfait' | 'depasse'

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
  /** ⚠️ Le libellé du bouton. Il commence TOUJOURS par « Passer à » — un test
   *  le vérifie. Un bouton qui change de verbe selon le palier laisse croire
   *  qu'il fait autre chose. */
  action: string
}

export type VerdictAppareils = {
  etat: EtatAppareils
  /** Le palier payé aujourd'hui, nommé. Nul sans forfait connu. */
  offreActuelle: string | null
  proposition: Proposition | null
}

/** Le libellé de l'état, tel que la console l'affiche en pastille. */
export const ETIQUETTE: Record<EtatAppareils, string> = {
  sans_forfait: 'Forfait non défini',
  dans_le_forfait: 'Dans le forfait',
  depasse: 'Forfait trop juste',
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
  return {
    nom: socle.nom,
    couvre,
    tranches,
    // Le prix vient de la grille, jamais d'une addition faite ici : deux
    // calculs du même montant divergeraient au premier ajustement.
    mois: (prixCents(besoin, 'monthly') ?? 0) / 100,
    an: (prixCents(besoin, 'yearly') ?? 0) / 100,
    // ⚠️ « Passer à … », et rien d'autre — décision de Julien le 4 septembre
    // 2026. Ici le palier ne change pas de nom, donc c'est le nombre
    // d'appareils qui suit le verbe : « Ajouter 20 appareils » décrivait un
    // geste différent des autres boutons pour la même chose.
    action: `Passer à ${couvre} appareils`,
  }
}

/**
 * Comment le prix se compose, quand il ne tient pas dans un seul palier.
 *
 * ⚠️ ELLE EXISTE PARCE QUE LA PAGE STRIPE, ELLE, DÉCOMPOSE. Julien a saisi
 * 137 appareils et découvert sur la page de paiement deux lignes —
 * « Enterprise » et « Appareils supplémentaires, Qté 4 » — sans que rien ne
 * l'y ait préparé : « pourquoi j'ai un Qté 4 ? ». Notre écran annonçait le
 * total (140 appareils, 12 210 €) et taisait l'addition qui y mène.
 *
 * ⚠️ ET ELLE DIT L'ARRONDI. Une tranche ENTAMÉE se paie entière : 137 demandés,
 * 140 couverts. C'est la règle de la grille depuis le 30 août, et elle ne se
 * devine pas — la découvrir sur une facture, c'est la découvrir trop tard.
 *
 * Rend `null` tant qu'on est dans un palier : il n'y a alors rien à décomposer.
 */
export function compositionOffre(p: Proposition): string | null {
  if (p.tranches <= 0) return null
  return `${APPAREILS_MAX} appareils + ${p.tranches} tranche${p.tranches > 1 ? 's' : ''} de ${SUPPLEMENT.par}`
}

/**
 * Ce qu'il faut dire d'un magasin.
 *
 * ⚠️ Elle ne demande que le plafond et le besoin, pas la forme complète : la
 * fiche du magasin et la console lisent le même jugement à partir de deux
 * sources qui ne rendent pas les mêmes colonnes. Deux fonctions de jugement
 * divergeraient au premier ajustement.
 */
export function lireAppareils(a: Pick<AppareilsMagasin, 'plafond' | 'besoin'> | null): VerdictAppareils {
  if (!a || a.plafond == null) {
    return { etat: 'sans_forfait', offreActuelle: null, proposition: null }
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
