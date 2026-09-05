// Mentions légales — les informations d'identité, isolées du rendu.
//
// La LCEN (art. 6 III) impose à tout éditeur de service en ligne de se rendre
// identifiable. Ce que la loi exige dépend du statut : une entreprise
// individuelle publie son nom, son adresse et son SIREN ; une société y ajoute
// sa forme, son capital, son RCS et son numéro de TVA.
//
// Tant qu'une valeur requise manque, `mentionsCompletes()` est faux : le lien
// du pied de page ne s'affiche pas et la page passe en `noindex`. Une page
// d'identification à trous ne vaut pas mieux que pas de page — autant ne pas
// l'annoncer.

export type Mention = {
  /** Intitulé affiché. */
  libelle: string
  /** Valeur publiée, ou `null` tant qu'elle n'est pas connue. */
  valeur: string | null
  /** Exigée par la LCEN — bloque la publication tant qu'elle manque. */
  requis: boolean
  /** Où trouver la valeur, à l'usage de qui remplira. */
  aide?: string
}

export const EDITEUR: Mention[] = [
  { libelle: 'Éditeur', valeur: 'Devkaylab', requis: true },
  {
    libelle: 'Statut',
    valeur: null,
    requis: true,
    aide: "Forme juridique une fois l'activité immatriculée (entreprise individuelle, SASU, SARL…).",
  },
  {
    libelle: 'Responsable de la publication',
    valeur: null,
    requis: true,
    aide: 'Nom et prénom de la personne responsable du contenu du site.',
  },
  {
    libelle: 'Adresse',
    valeur: null,
    requis: true,
    aide: "Adresse du siège, ou domicile pour une entreprise individuelle.",
  },
  { libelle: 'Courrier électronique', valeur: 'contact@quantinvo.com', requis: true },
  {
    libelle: 'Téléphone',
    valeur: null,
    requis: true,
    aide: 'La LCEN demande des coordonnées permettant de joindre facilement l’éditeur.',
  },
  {
    libelle: 'Numéro d’identification',
    valeur: null,
    requis: true,
    aide: 'SIREN ou SIRET, délivré à l’immatriculation.',
  },
  {
    libelle: 'Registre du commerce et des sociétés',
    valeur: null,
    requis: false,
    aide: 'Ville d’immatriculation et numéro RCS — pour une société uniquement.',
  },
  {
    libelle: 'Capital social',
    valeur: null,
    requis: false,
    aide: 'Pour une société uniquement.',
  },
  {
    libelle: 'Numéro de TVA intracommunautaire',
    valeur: null,
    requis: false,
    aide: 'Si l’activité est assujettie à la TVA.',
  },
]

export const HEBERGEUR: Mention[] = [
  { libelle: 'Hébergeur', valeur: 'Vercel Inc.', requis: true },
  {
    libelle: 'Adresse',
    valeur: null,
    requis: true,
    aide: 'À recopier depuis les informations légales publiées par Vercel — ne pas citer de mémoire.',
  },
  {
    libelle: 'Téléphone',
    valeur: null,
    requis: true,
    aide: 'Idem : la LCEN exige un moyen de joindre l’hébergeur.',
  },
]

/** Intitulés des mentions requises encore vides. */
export function mentionsManquantes(sections: Mention[][] = [EDITEUR, HEBERGEUR]): string[] {
  return sections
    .flat()
    .filter(m => m.requis && !m.valeur?.trim())
    .map(m => m.libelle)
}

/** Vrai quand toutes les mentions requises sont renseignées. */
export function mentionsCompletes(sections: Mention[][] = [EDITEUR, HEBERGEUR]): boolean {
  return mentionsManquantes(sections).length === 0
}

/**
 * La vente en ligne est-elle ouverte ?
 *
 * ⚠️ TRANCHÉ PAR JULIEN LE 5 SEPTEMBRE 2026 : « on ferme en attendant
 * l'immatriculation ». Le site était en ligne, « Inscrire mon entreprise »
 * dans la barre, et un visiteur pouvait dérouler tout le parcours pour
 * atterrir sur une page de paiement en mode TEST.
 *
 * ⚠️ ET C'EST `mentionsCompletes()` QUI DÉCIDE, PAS UN SECOND INTERRUPTEUR.
 * Ce n'est pas une astuce : la LCEN interdit de vendre en ligne sans
 * identification complète de l'éditeur, donc les deux ouvrent ensemble par
 * nature. Un drapeau à part serait un second endroit où se tromper — et
 * surtout un endroit qu'on oublierait de rouvrir le jour de
 * l'immatriculation. Ici, remplir `legal.ts` ouvre la boutique tout seul,
 * comme `PUBLIEE` ouvre les fiches des boutiques d'applications.
 *
 * ⚠️ Elle ne ferme QUE l'acquisition publique — `/inscription` et
 * `/souscrire`. Le libre-service (changer d'offre, ajouter un magasin) vit
 * derrière une session d'administrateur d'entreprise, et il n'existe aucun
 * client réel : le fermer ne protégerait rien.
 *
 * ⚠️ Son jumeau vit dans les deux fonctions edge (`inscription`,
 * `subscribe-online`), qui ne compilent pas avec le site. Une porte fermée à
 * l'écran seulement s'ouvre avec une adresse : un test compare les deux.
 */
export function venteOuverte(): boolean {
  return mentionsCompletes()
}
