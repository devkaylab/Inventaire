/**
 * Le prix d'un inventaire à la demande — la copie d'affichage.
 *
 * ⚠️ **AUCUN PRIX N'EST DÉCIDÉ ICI.** Ce module sert à MONTRER un montant
 * pendant que le visiteur répond aux trois questions, avant qu'il ait un
 * compte. Le montant qui engage vient de `prix_mission` / `prix_ferme_mission`, en
 * base — même règle que `prixCents` et `prix_offre` pour l'abonnement :
 * « laisser le client porter un montant, c'est le laisser réserver à un
 * centime » (`docs/notes/074`).
 *
 * ⚠️ **C'EST DONC UN DOUBLON VOLONTAIRE**, le sixième du projet, et il suit la
 * même discipline que les cinq autres : une garde compare cette copie à celle
 * qui fait foi (`web/tests/prix-on-demand.test.ts`, qui lit les réglages dans
 * la migration). Les deux bougent ensemble ou la garde tombe.
 *
 * ⚠️ **ET IL EXISTE POUR NE PAS OUVRIR UNE CINQUIÈME FONCTION À `anon`.** Il y
 * en a quatre, c'est mesuré à chaque revue de sécurité, et en ajouter une est
 * une décision. La maquette promet « trois questions et votre prix s'affiche,
 * vous ne créerez un compte qu'au moment de réserver » : cette copie tient la
 * promesse sans rien ouvrir.
 *
 * Conception : docs/entreprise/on-demand/02-le-prix.md
 */

/** Les réglages de la version en vigueur. Copie de `reglages_prix`. */
export const REGLAGES = {
  version: 2,
  tauxInventoristeCents: 2000,
  tauxResponsableCents: 2800,
  productivite: 800,
  dureeCibleMinutes: 270,
  fraisFixesCents: 4600,
  responsableDesN: 3,
  arrondiMinutes: 30,
  margeCible: 0.25,
  margeMinimum: 0.22,
  // ⚠️ Les deux réglages de la formule « logiciel seul ». Ils ne vivent pas
  // dans le même `insert` que les autres — ils sont arrivés plus tard, par un
  // `alter table … default` — et la garde les lit là où ils sont.
  tarifAppareilCents: 1600,
  fraisFixesLogicielCents: 1900,
  // ⚠️ Les quatre réglages de la grille à deux axes (version 2). Ils vivent
  // dans la même migration que les autres, en clair, et la garde les compare.
  supplementAppareilCents: 2500,
  tolerancePct: 10,
  fenetreJours: 7,
  soireeMinutes: 420,
  // ⚠️ UNE SECONDE PRODUCTIVITÉ, ET C'EST VOULU. `productivite` (800) sert à
  // la formule ÉQUIPE, dont les exemples validés vivent dans son document de
  // conception : cette formule est FERMÉE, et re-chiffrer une formule fermée
  // sans la revalider est pire que la laisser telle quelle. 500 est le repère
  // de Julien pour un inventoriste moyen, et c'est lui qui dimensionne le
  // ponctuel.
  productivitePonctuel: 500,
} as const

/**
 * ⚠️⚠️ **LE MOIS D'ABONNEMENT QUI COUVRE CES APPAREILS**, et sa moitié.
 *
 * C'est l'ancre de toute la grille ponctuelle — la règle des deux inventaires
 * (Julien, 28 septembre 2026) : « comme au cinéma, au-delà de deux séances par
 * mois l'abonnement revient moins cher que la place ». Deux réservations
 * restent sous le mois, trois le dépassent.
 *
 * ⚠️ Les trois montants sont ceux de `offres.ts` — Essential, Advanced,
 * Enterprise. Ils sont recopiés ici parce que la fonction en base ne peut pas
 * lire ce module, et qu'ils font foi des deux côtés : une garde les compare.
 */
export function moisCouvrant(appareils: number): number {
  return appareils <= 2 ? 8900 : (appareils <= 20 ? 31000 : 89000)
}

/** La moitié du mois : le plafond d'une réservation ponctuelle. */
export function plafondPonctuel(appareils: number): number {
  return Math.floor(moisCouvrant(appareils) / 2)
}

/**
 * Le minimum d'appareils qu'impose la taille.
 *
 * ⚠️ **SANS LUI, LA RÈGLE SE RETOURNE** : déclarer 100 000 pièces sur deux
 * appareils ramènerait le mois de référence à Essential, donc le prix à 44 €.
 * Défaut trouvé par Julien en manipulant la maquette. Physiquement, deux
 * appareils ne comptent pas 100 000 pièces en sept jours — à 500 à l'heure,
 * ils en font 70 000 au plus. La licence est dimensionnée pour le travail.
 */
export function minimumAppareils(articles: number): number {
  return Math.max(1, Math.ceil(
    articles / (REGLAGES.productivitePonctuel * (REGLAGES.soireeMinutes / 60))))
}

/**
 * Les deux formules de la même réservation.
 *
 * ⚠️ **`logiciel_seul` EST NÉ D'UN CONTRESENS**, relevé par Julien le
 * 20 septembre 2026 : la page « À la demande » envoyait « vous, avec votre
 * équipe » vers un abonnement ANNUEL. Quelqu'un qui compte une fois par an n'a
 * aucune raison d'acheter douze mois de logiciel — et le lui proposer sur la
 * page « à la demande », c'est lui proposer l'inverse de ce qu'il est venu
 * chercher.
 */
export type Formule = 'equipe_quantinvo' | 'logiciel_seul'

/**
 * ⚠️⚠️ **LA FORMULE ÉQUIPE EST FERMÉE.** Décision de Julien, 28 septembre
 * 2026 : « on laisse tomber "Nous, avec la nôtre" pour le moment, trop lourd
 * juridiquement parlant et trop tôt pour Quantinvo ».
 *
 * **Rien n'est supprimé, tout devient inatteignable.** Le code de la formule
 * équipe — chaîne de prix, zones, délai de 48 h, page « devenir inventoriste »
 * — reste écrit et testé : il rouvrira le jour où le statut des inventoristes
 * sera tranché avec un avocat et où Stripe Connect sera en place. Ces deux-là
 * étaient les seules dépendances EXTÉRIEURES du projet, et les fermer est
 * précisément ce qui rend le logiciel seul livrable tout de suite.
 *
 * ⚠️ Le drapeau ne se contourne pas par l'adresse : `?formule=equipe` ne
 * rouvre rien tant qu'il vaut `false`. Garde : `web/tests/prix-on-demand.test.ts`.
 */
export const FORMULE_EQUIPE_OUVERTE = false

/** La formule par défaut, et la seule quand l'équipe est fermée. */
export function formuleParDefaut(): Formule {
  return FORMULE_EQUIPE_OUVERTE ? 'equipe_quantinvo' : 'logiciel_seul'
}

/** Ce que l'adresse a le droit de demander. Une formule fermée retombe sur l'autre. */
export function formuleDemandee(parametre: string | null): Formule {
  if (parametre === 'equipe' && FORMULE_EQUIPE_OUVERTE) return 'equipe_quantinvo'
  if (parametre === 'logiciel') return 'logiciel_seul'
  return formuleParDefaut()
}

/** Les départements où une équipe peut être constituée. Copie de `zones_desservies`. */
export const DEPARTEMENTS_DESSERVIS = [
  '59', '69', '75', '77', '78', '91', '92', '93', '94', '95',
] as const

/** Ce qu'on annonce au visiteur, en toutes lettres (maquette Etape1-Visiteur). */
export const OU_NOUS_ALLONS = 'Paris et en Île-de-France, à Lyon et à Lille'

export type Secteur = 'textile' | 'chaussures' | 'cosmetique' | 'sport' | 'electronique' | 'autre'

export const SECTEURS: { cle: Secteur; nom: string }[] = [
  { cle: 'textile', nom: 'Textile' },
  { cle: 'chaussures', nom: 'Chaussures' },
  { cle: 'cosmetique', nom: 'Cosmétique' },
  { cle: 'sport', nom: 'Sport' },
  { cle: 'electronique', nom: 'Électronique' },
  { cle: 'autre', nom: 'Autre' },
]

export type Tranche = { cle: string; nom: string; min: number; max: number; prixCents?: number }

/**
 * ⚠️ **ON RETIENT LE HAUT DE LA TRANCHE, JAMAIS LE MILIEU.** Un prix ferme se
 * calcule sur le cas le plus lourd que le client a lui-même annoncé — c'est ce
 * qui permet de ne pas revenir vers lui le soir de l'inventaire.
 */
export const TRANCHES_ARTICLES: Tranche[] = [
  { cle: 'a', nom: 'Moins de 2 000 pièces', min: 0, max: 2_000, prixCents: 3_900 },
  { cle: 'b', nom: '2 000 à 5 000 pièces', min: 2_000, max: 5_000, prixCents: 4_400 },
  { cle: 'c', nom: '5 000 à 10 000 pièces', min: 5_000, max: 10_000, prixCents: 10_900 },
  { cle: 'd', nom: '10 000 à 20 000 pièces', min: 10_000, max: 20_000, prixCents: 12_900 },
  { cle: 'e', nom: '20 000 à 30 000 pièces', min: 20_000, max: 30_000, prixCents: 14_500 },
  { cle: 'f', nom: '30 000 à 50 000 pièces', min: 30_000, max: 50_000, prixCents: 15_500 },
  { cle: 'g', nom: '50 000 à 100 000 pièces', min: 50_000, max: 100_000, prixCents: 34_900 },
  { cle: 'h', nom: '100 000 à 150 000 pièces', min: 100_000, max: 150_000, prixCents: 44_500 },
]

export const TRANCHES_REFERENCES: Tranche[] = [
  { cle: 'a', nom: 'Moins de 500 références', min: 0, max: 500 },
  { cle: 'b', nom: '500 à 1 000 références', min: 500, max: 1_000 },
  { cle: 'c', nom: '1 000 à 3 000 références', min: 1_000, max: 3_000 },
  { cle: 'd', nom: '3 000 à 5 000 références', min: 3_000, max: 5_000 },
  { cle: 'e', nom: '5 000 à 10 000 références', min: 5_000, max: 10_000 },
  { cle: 'f', nom: 'Plus de 10 000 références', min: 10_000, max: 40_000 },
]

/**
 * Les inventaires se déroulent à n'importe quelle heure — avant l'ouverture,
 * en pleine journée, après la fermeture. C'est une correction de Julien sur la
 * maquette : ne proposer que le soir écarte la moitié des magasins.
 */
export const MOMENTS = [
  { cle: 'avant_ouverture', nom: 'Avant l’ouverture', heures: ['05:00', '06:00', '07:00'] },
  { cle: 'journee', nom: 'En journée', heures: ['10:00', '13:00', '15:00'] },
  { cle: 'apres_fermeture', nom: 'Après la fermeture', heures: ['20:00', '21:00', '22:00'] },
] as const

export type MomentCle = (typeof MOMENTS)[number]['cle']

export type Chaine = {
  formule: Formule
  articlesRetenus: number
  heuresPersonne: number
  inventoristes: number
  compteursAttendus: number
  appareils: number
  licenceCents: number
  responsable: boolean
  dureeMinutes: number
  equipeCents: number
  coutCents: number
  prixCents: number
  margeCents: number
  marge: number
  remunerationInventoristeCents: number
  remunerationResponsableCents: number
}

/**
 * La chaîne de `prix_mission`, pas à pas. Tout en centimes.
 *
 * ⚠️ **LE DIMENSIONNEMENT EST LE MÊME POUR LES DEUX FORMULES** — articles,
 * heures-personne, nombre de personnes, durée. C'est la demande de Julien
 * (« tarifs sur les mêmes critères on demand mais sans les compteurs ») et
 * c'est aussi ce qui rend les deux prix comparables sur la même page. Ce qui
 * change commence à la ligne du coût.
 */
export function chaine(
  articlesRetenus: number,
  coefficient = 1,
  formule: Formule = 'logiciel_seul',
  appareilsDemandes?: number,
): Chaine {
  const r = REGLAGES
  const logiciel = formule === 'logiciel_seul'
  const heuresPersonne = articlesRetenus / r.productivite

  if (logiciel) {
    // ⚠️⚠️ **LE PRIX VIENT DE LA TRANCHE, PLUS DU COÛT.** Voir la migration
    // `20260928120001` pour le pourquoi : « coût + marge » faisait BAISSER le
    // prix à la pièce quand le volume montait, ce qui est l'inverse de ce
    // qu'il faut. L'ancre est la règle des deux inventaires.
    const minimum = minimumAppareils(articlesRetenus)
    const appareils = Math.max(minimum, appareilsDemandes ?? minimum)
    const bande = TRANCHES_ARTICLES.find((t) => t.max >= articlesRetenus)
    const base = bande?.prixCents ?? 0
    const prixCents = Math.min(
      base + r.supplementAppareilCents * Math.max(0, appareils - minimum),
      plafondPonctuel(appareils),
    )
    const dureeMinutes = Math.ceil(
      (articlesRetenus / (r.productivitePonctuel * appareils)) * 60 / r.arrondiMinutes,
    ) * r.arrondiMinutes
    const coutCents = r.fraisFixesLogicielCents
    return {
      formule, articlesRetenus, heuresPersonne,
      inventoristes: 0,
      compteursAttendus: appareils,
      appareils,
      licenceCents: prixCents,
      responsable: false,
      dureeMinutes,
      equipeCents: 0,
      coutCents,
      prixCents,
      margeCents: prixCents - coutCents,
      marge: prixCents === 0 ? 0 : (prixCents - coutCents) / prixCents,
      remunerationInventoristeCents: 0,
      remunerationResponsableCents: 0,
    }
  }

  // La formule équipe, inchangée : fermée côté site, pas supprimée.
  const compteursAttendus = Math.ceil(heuresPersonne / (r.dureeCibleMinutes / 60))
  const dureeMinutes =
    Math.ceil((heuresPersonne / compteursAttendus) * 60 / r.arrondiMinutes) * r.arrondiMinutes
  const responsable = compteursAttendus >= r.responsableDesN
  const appareils = compteursAttendus + (responsable ? 1 : 0)
  const heuresFacturees = dureeMinutes / 60
  const equipeCents = Math.round(
    (compteursAttendus * r.tauxInventoristeCents
      + (responsable ? r.tauxResponsableCents : 0)) * heuresFacturees,
  )
  const coutCents = equipeCents + r.fraisFixesCents
  const prixCents = Math.round((coutCents / (1 - r.margeCible)) * coefficient / 100) * 100
  return {
    formule, articlesRetenus, heuresPersonne,
    inventoristes: compteursAttendus,
    compteursAttendus, appareils, licenceCents: 0,
    responsable,
    dureeMinutes, equipeCents, coutCents, prixCents,
    margeCents: prixCents - coutCents,
    marge: prixCents === 0 ? 0 : (prixCents - coutCents) / prixCents,
    remunerationInventoristeCents: Math.round(r.tauxInventoristeCents * heuresFacturees),
    remunerationResponsableCents:
      responsable ? Math.round(r.tauxResponsableCents * heuresFacturees) : 0,
  }
}

export type Refus = 'hors_zone' | 'trop_tot' | 'marge_insuffisante' | 'incomplet'

export type Reponses = {
  codePostal: string
  secteur: Secteur | ''
  trancheArticles: string
  debut: Date | null
  formule?: Formule
  /** Ce que le client a demandé. En deçà du minimum, le minimum gagne. */
  appareils?: number
}

/**
 * ⚠️ **CE N'EST PAS UN DEVIS, ET LE TYPE NE DOIT PAS LE DIRE.** Il s'appelait
 * `Devis`. « Quel devis ? » — Julien, 20 septembre 2026, et il avait raison :
 * ce produit tient sur « trois questions, votre prix s'affiche, le prix
 * affiché est le prix payé ». Il n'y a rien à valider entre ce montant et le
 * paiement.
 *
 * ⚠️ Et le mot est pris, ailleurs, pour son vrai sens : Quantinvo OS a de
 * vrais devis (`lib/devis.ts`, `/devis/[token]`) — des abonnements négociés
 * qu'on accepte ou qu'on refuse. Deux choses opposées sous le même mot dans le
 * même dépôt finissent confondues le jour où il faut aller vite.
 */
export type PrixFerme =
  | { ok: true; chaine: Chaine; arrivee: Date; finPrevue: Date; annulationGratuiteJusquAu: Date }
  | { ok: false; refus: Refus }

/** Le délai de constitution d'une équipe. Copie de `prix_ferme_mission`. */
export const DELAI_HEURES = 48

export function departementDe(codePostal: string): string {
  return codePostal.replace(/\D/g, '').slice(0, 2)
}

export function estDesservi(codePostal: string): boolean {
  return (DEPARTEMENTS_DESSERVIS as readonly string[]).includes(departementDe(codePostal))
}

/** Le prix ferme affiché pendant le parcours. La base refait le même calcul. */
export function prixFerme(r: Reponses, maintenant = new Date()): PrixFerme {
  const formule = r.formule ?? formuleParDefaut()
  const logiciel = formule === 'logiciel_seul'
  const tranche = TRANCHES_ARTICLES.find((t) => t.cle === r.trancheArticles)
  // ⚠️ **CHAQUE FORMULE N'EXIGE QUE CE QU'ELLE DEMANDE.** Le logiciel seul ne
  // pose plus ni l'adresse ni le secteur : l'une ne sert qu'à faire venir une
  // équipe, l'autre qu'aux coefficients de pénibilité. Les exiger quand même
  // renvoyait « il manque une réponse » sur un tunnel qui ne posait plus la
  // question — trouvé en cliquant jusqu'au prix, pas en relisant le code.
  // Ce que les deux formules exigent, d'abord — et dans cet ordre, pour que
  // TypeScript sache ensuite que `tranche` et `r.debut` existent.
  if (!tranche || !r.debut) return { ok: false, refus: 'incomplet' }
  // Puis ce que seule l'équipe exige, parce qu'elle se déplace.
  if (!logiciel && (!r.codePostal || !r.secteur)) return { ok: false, refus: 'incomplet' }
  // ⚠️ DEUX REFUS NE VALENT QUE POUR L'ÉQUIPE, et c'est par nécessité : la
  // zone existe parce que six personnes doivent pouvoir se déplacer, le délai
  // parce qu'une équipe se constitue. Le logiciel se livre partout, tout de
  // suite — le refuser serait refuser de vendre ce qu'on sait livrer.
  if (!logiciel && !estDesservi(r.codePostal)) return { ok: false, refus: 'hors_zone' }
  const delai = logiciel ? 0 : DELAI_HEURES
  if (r.debut.getTime() < maintenant.getTime() + delai * 3600_000) {
    return { ok: false, refus: 'trop_tot' }
  }
  const c = chaine(tranche.max, 1, formule, r.appareils)
  if (c.marge < REGLAGES.margeMinimum) return { ok: false, refus: 'marge_insuffisante' }
  return {
    ok: true,
    chaine: c,
    arrivee: new Date(r.debut.getTime() - (logiciel ? 0 : 15) * 60_000),
    // ⚠️ POUR LE LOGICIEL, LA LICENCE COURT UNE SEMAINE, pas le temps du
    // comptage : « l'inventaire peut durer assez longtemps, on ne compte en
    // général pas plus longtemps » (Julien, 28 septembre 2026).
    finPrevue: new Date(r.debut.getTime() + (logiciel
      ? REGLAGES.fenetreJours * 24 * 3600_000
      : c.dureeMinutes * 60_000)),
    annulationGratuiteJusquAu: new Date(r.debut.getTime() - 3 * 24 * 3600_000),
  }
}

/** « 4 h 30 », « 3 h », « 45 min ». */
export function duree(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}
