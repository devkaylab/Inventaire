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
  version: 3,
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
  // ⚠️ LA PART DU MOIS (version 3, 5 octobre 2026). Une semaine de location
  // vaut le mois d'abonnement qui couvre les mêmes appareils, majoré de dix
  // pour cent. Elle valait la MOITIÉ d'un mois : louer coûtait alors 2,4 fois
  // moins que s'abonner au même produit, et le mangeait.
  partDuMois: 1.1,
} as const

/** Jusqu'où va le tarif d'entrée, en appareils. Trois, soit 10 000 pièces. */
export const TARIF_ENTREE_APPAREILS = 3

/**
 * ⚠️⚠️ **LE MOIS D'ABONNEMENT QUI COUVRE CES APPAREILS.**
 *
 * C'est l'ancre de toute la grille ponctuelle. La règle des deux inventaires
 * (Julien, 28 septembre 2026) en faisait la MOITIÉ d'un mois : « comme au
 * cinéma, au-delà de deux séances par mois l'abonnement revient moins cher que
 * la place ». ⚠️ **Mesuré le 5 octobre 2026, le compte ne tombait pas juste** :
 * six appareils, c'est Advanced à 310 € par mois, et on vendait la semaine
 * 129 €. Il fallait VINGT-SIX réservations dans l'année pour que s'abonner
 * redevienne intéressant — personne ne fait vingt-six inventaires. La location
 * mangeait l'abonnement. Décision de Julien : **la semaine vaut le mois + 10 %**.
 *
 * ⚠️ **AVEC UN TARIF D'ENTRÉE JUSQU'À TROIS APPAREILS** — 10 000 pièces, le
 * volume d'un petit magasin. Appliquer le palier plein dès le premier appareil
 * aurait donné 341 € là où envoyer une équipe entière en coûte 589 : 58 % du
 * service rendu complet, pour un logiciel que le client exploite lui-même. Le
 * client se serait dit « pour 250 € de plus, ils viennent le faire ». Au-dessus
 * de 10 000 pièces le rapport redevient tenable (341 contre 949, soit 36 %),
 * et le palier plein s'applique.
 *
 * Le point d'entrée n'est pas inventé : il est sur la droite qui joint
 * Essential à Advanced.
 *
 * ⚠️ Les trois montants sont ceux de `offres.ts` — Essential, Advanced,
 * Enterprise. Ils sont recopiés ici parce que la fonction en base ne peut pas
 * lire ce module, et qu'ils font foi des deux côtés : une garde les compare.
 */
export function moisCouvrant(appareils: number): number {
  if (appareils <= 2) return 8900
  // ⚠️ LE TARIF D'ENTRÉE S'ARRÊTE À TROIS APPAREILS, c'est-à-dire à 10 000
  // pièces : au-delà, le palier plein. Le point est sur la droite Essential →
  // Advanced, il n'est pas inventé.
  if (appareils <= TARIF_ENTREE_APPAREILS) {
    return Math.round(8900 + (31000 - 8900) * (appareils - 2) / 18)
  }
  if (appareils <= 20) return 31000
  if (appareils <= 100) return 89000
  // Au-delà du dernier palier, l'abonnement avance de 64 € par dix appareils :
  // la location suit, majorée comme le reste.
  return 89000 + 6400 * Math.ceil((appareils - 100) / 10)
}

/**
 * Ce que coûte une semaine de location, pour ce nombre d'appareils.
 *
 * Arrondi à l'euro : un prix public ne se lit pas en centimes.
 */
export function prixPonctuel(appareils: number): number {
  return Math.round(moisCouvrant(appareils) * REGLAGES.partDuMois / 100) * 100
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

export type Tranche = {
  cle: string; nom: string; min: number; max: number; prixCents?: number
  /** L'étiquette courte du tunnel. Un bouton de tranche n'a pas la place d'une phrase. */
  court?: string
}

/**
 * ⚠️ **ON RETIENT LE HAUT DE LA TRANCHE, JAMAIS LE MILIEU.** Un prix ferme se
 * calcule sur le cas le plus lourd que le client a lui-même annoncé — c'est ce
 * qui permet de ne pas revenir vers lui le soir de l'inventaire.
 */
export const TRANCHES_ARTICLES: Tranche[] = [
  // ⚠️ `prixCents` N'EST PLUS LE PRIX DE LA TRANCHE (version 3, 5 octobre
  // 2026) : c'est ce que coûte cette tranche AU MINIMUM D'APPAREILS qu'elle
  // impose. Le prix vient de `prixPonctuel(appareils)`. La colonne reste vraie
  // au lieu de rester vieille — c'est elle que lit une vitrine qui veut écrire
  // « à partir de ». Une garde la recalcule depuis la pente.
  { cle: 'a', court: '< 2 000', nom: 'Moins de 2 000 pièces', min: 0, max: 2_000, prixCents: 9_800 },
  { cle: 'b', court: '2–5 000', nom: '2 000 à 5 000 pièces', min: 2_000, max: 5_000, prixCents: 9_800 },
  { cle: 'c', court: '5–10 000', nom: '5 000 à 10 000 pièces', min: 5_000, max: 10_000, prixCents: 11_100 },
  { cle: 'd', court: '10–20 000', nom: '10 000 à 20 000 pièces', min: 10_000, max: 20_000, prixCents: 34_100 },
  { cle: 'e', court: '20–30 000', nom: '20 000 à 30 000 pièces', min: 20_000, max: 30_000, prixCents: 34_100 },
  { cle: 'f', court: '30–50 000', nom: '30 000 à 50 000 pièces', min: 30_000, max: 50_000, prixCents: 34_100 },
  { cle: 'g', court: '50–100 000', nom: '50 000 à 100 000 pièces', min: 50_000, max: 100_000, prixCents: 97_900 },
  { cle: 'h', court: '100–150 000', nom: '100 000 à 150 000 pièces', min: 100_000, max: 150_000, prixCents: 97_900 },
]

/**
 * La tranche qu'impose un nombre de pièces annoncé.
 *
 * ⚠️ **C'EST LA REQUÊTE DE LA BASE, RECOPIÉE.** `prix_mission` cherche
 * `plafond_articles >= p_articles_max order by plafond_articles asc limit 1` :
 * la PREMIÈRE tranche dont le plafond couvre le nombre annoncé. Les deux
 * doivent donner la même, sinon l'écran promet un prix que le moteur refuse —
 * une garde les compare.
 *
 * ⚠️ `null` au-dessus de la dernière tranche, et ce n'est pas un défaut : il
 * n'existe pas de prix plus gros. Au-delà, c'est un inventaire qui se parle,
 * pas qui se réserve en deux clics (`hors_grille`, côté base).
 *
 * ⚠️ La recherche suppose la liste TRIÉE par plafond croissant. Une garde le
 * vérifie plutôt que de compter dessus : insérer une tranche au mauvais rang
 * donnerait un prix trop cher, en silence.
 */
export function trancheDesPieces(pieces: number): Tranche | null {
  if (!Number.isFinite(pieces) || pieces < 1) return null
  return TRANCHES_ARTICLES.find((t) => t.max >= pieces) ?? null
}

/**
 * Le compteur d'appareils qu'impose un volume annoncé.
 *
 * ⚠️⚠️ **IL NE DÉPEND QUE DU VOLUME — c'est tout l'intérêt de l'avoir ici.**
 * Dans l'écran, le compteur était borné par un `Math.max` qui lisait le minimum
 * de la tranche PRÉCÉDENTE : annoncer 150 000 pièces puis 30 000 laissait 43
 * appareils au lieu de 9, et plus rien ne redescendait (défaut trouvé par
 * Julien, 10 octobre 2026). Une fonction du seul volume ne peut pas garder de
 * mémoire : la garde rejoue la séquence qui mordait.
 *
 * Le plancher reste appliqué à l'affichage, là où le client a le droit d'en
 * demander PLUS que le minimum. Ici, c'est le minimum seul.
 */
export function appareilsPourPieces(pieces: number): number {
  const t = trancheDesPieces(pieces)
  return t ? minimumAppareils(t.max) : 1
}

/** Au-delà, on ne réserve plus : on en parle. Déduit de la grille, jamais écrit. */
export const PLAFOND_PIECES =
  TRANCHES_ARTICLES.reduce((a, t) => Math.max(a, t.max), 0)

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
    // ⚠️⚠️ **LE PRIX VIENT DES APPAREILS — plus de la tranche, plus du coût.**
    // Version 3 (`20261005200001`) : une semaine vaut le mois d'abonnement qui
    // couvre ces appareils, majoré de dix pour cent. Avant, il valait la moitié
    // d'un mois, et louer coûtait 2,4 fois moins que s'abonner au même produit.
    // Avant encore, « coût + marge » faisait BAISSER le prix à la pièce quand
    // le volume montait, ce qui est l'inverse de ce qu'il faut.
    //
    // ⚠️ `TRANCHES_ARTICLES` garde son rôle : le nom de la tranche, son plafond
    // d'articles (au-delà, pas de prix) et le minimum d'appareils qu'elle
    // impose. Ce qu'elle ne fait plus, c'est le montant.
    const minimum = minimumAppareils(articlesRetenus)
    const appareils = Math.max(minimum, appareilsDemandes ?? minimum)
    const prixCents = prixPonctuel(appareils)
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
