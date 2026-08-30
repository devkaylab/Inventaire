/**
 * Les trois offres, en un seul point.
 *
 * ⚠️ À ne pas confondre avec `lib/tarifs.ts`, qui porte l'ANCIENNE grille au
 * volume de stock : celle-ci ne tarife plus rien depuis le 30 août 2026, mais
 * ses tranches servent encore à dimensionner une installation (`MagasinSaisie`)
 * et sa fonction `densite` au recoupement stock/surface de `lib/secteurs.ts`.
 * Les deux modules coexistent le temps que le parcours d'inscription soit
 * repris ; c'est celui-ci qui dit le prix.
 *
 *
 * Décidées le 30 août 2026 (hypothèse 4 de docs/entreprise/hypotheses-tarifaires.md) :
 * on facture le nombre d'appareils qui comptent EN MÊME TEMPS dans un magasin,
 * parce que c'est la seule assiette que le client puisse vérifier et que nous
 * puissions mesurer. Le volume de stock ne tarife plus.
 *
 * ⚠️ Trois invariants portés par web/tests/offres.test.ts, à ne pas défaire :
 *
 * 1. Le prix par appareil DÉCROÎT à chaque palier (345 → 120 → 69 → 50 €).
 *    C'est ce qui rend l'empilement perdant : dix Essential coûtent 6 900 €
 *    quand Advanced en demande 2 400. Aucun verrou juridique n'est nécessaire
 *    tant que l'arithmétique tient — un prix qui a besoin d'un verrou pour
 *    tenir est un prix mal calé.
 * 2. Payer à l'année coûte MOINS cher que douze mensualités, dans les trois
 *    offres.
 * 3. Une licence couvre UN magasin. Le nombre d'appareils est celui qui compte
 *    dans ce magasin, pas dans l'entreprise.
 *
 * La remise réseau (−10 / −20 / −30 % selon le parc) est chiffrée dans le
 * document mais REPORTÉE après le lancement : le multi-magasins passe par un
 * devis. Ne pas l'ajouter ici sans que Julien rouvre le sujet.
 */

export type CleOffre = 'essential' | 'advanced' | 'enterprise'

export type Offre = {
  cle: CleOffre
  nom: string
  /** Nombre d'appareils comptant en même temps, dans UN magasin. */
  min: number
  max: number
  plage: string
  /** Hors taxes, par magasin. */
  mois: number
  an: number
  pour: string
  points: string[]
}

export const OFFRES: Offre[] = [
  {
    cle: 'essential',
    nom: 'Essential',
    min: 1,
    max: 2,
    plage: '2 appareils',
    mois: 65,
    an: 690,
    pour: 'Vous comptez seul ou à deux, dans un magasin.',
    points: [
      'Un magasin, deux comptes',
      'Comptage et audit en seconde passe',
      'Rapport d’écarts et export Excel',
      'Import CSV et Excel sans reformater',
      'Aide en ligne',
    ],
  },
  {
    cle: 'advanced',
    nom: 'Advanced',
    min: 3,
    max: 20,
    plage: '3 à 20 appareils',
    mois: 225,
    an: 2400,
    pour: 'Vous montez une équipe le jour de l’inventaire.',
    points: [
      'Tout ce que contient Essential',
      'Équipe, rôles et supervision',
      'Balises imprimées et zones de comptage',
      'Suivi de l’avancement en direct',
      'Réponse par e-mail sous un jour ouvré',
    ],
  },
  {
    cle: 'enterprise',
    nom: 'Enterprise',
    min: 21,
    max: 100,
    plage: '21 à 100 appareils',
    mois: 650,
    an: 6900,
    pour: 'La grande surface, qui mobilise une équipe entière.',
    points: [
      'Tout ce que contient Advanced',
      'Console d’entreprise et journal des actions',
      'Accompagnement du premier inventaire',
      'Engagement de disponibilité',
      'Interlocuteur nommé',
    ],
  },
]

/** L'offre mise en avant sur la page. */
export const OFFRE_PHARE: CleOffre = 'advanced'

/**
 * Au-delà de 100 appareils sur un même magasin, par tranche de 10.
 *
 * ⚠️ 500 € et non 700 : à 700, le supplément reconduisait exactement le tarif
 * moyen d'Enterprise (6 900 ÷ 100 = 69 € par appareil) et cassait la
 * dégressivité de la grille. 500 € en est le cran suivant, soit 50 €.
 */
export const SUPPLEMENT = { par: 10, mois: 47, an: 500 } as const

/** Le plafond au-delà duquel le tarif se construit avec le client. */
export const APPAREILS_MAX = 100

/**
 * Le taux de TVA appliqué en France.
 *
 * ⚠️ Tous les prix de ce module sont HORS TAXES — c'est ce qu'affiche la page
 * de tarifs, et c'est l'usage en B2B. Mais au moment de payer, le client voit
 * le montant qu'on va réellement débiter : annoncer 225 € et prélever 270 €
 * est le genre d'écart qui fait abandonner un panier, ou pire, contester un
 * prélèvement.
 *
 * Côté Stripe, le taux vit dans le tableau de bord (`STRIPE_TAX_RATE`, en mode
 * exclusif) et non ici : c'est lui qui fait foi sur la facture. Cette
 * constante ne sert qu'à AFFICHER. Les deux doivent bouger ensemble.
 */
export const TVA = 0.2

/** Le montant toutes taxes comprises, pour l'afficher au moment de payer. */
export function ttc(ht: number): number {
  return Math.round(ht * (1 + TVA) * 100) / 100
}

/** Ce que le paiement annuel fait économiser sur douze mensualités. */
export function economie(o: Offre): number {
  return o.mois * 12 - o.an
}

/** Le prix par appareil au plafond du palier — la mesure de la dégressivité. */
export function parAppareil(o: Offre): number {
  return o.an / o.max
}

/** L'offre qui couvre ce nombre d'appareils, ou null au-delà du plafond. */
export function offrePour(appareils: number): Offre | null {
  return OFFRES.find((o) => appareils <= o.max) ?? null
}

/**
 * Mise en forme d'un montant en euros.
 *
 * ⚠️ Le groupement est fait à la main, pas par `toLocaleString` : le caractère
 * de séparation d'ICU diffère entre Node et le navigateur selon les versions,
 * ce qui produit une erreur d'hydratation Next sur une page rendue des deux
 * côtés. Ici le résultat est le même partout.
 */
export function euros(v: number): string {
  return `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`
}
