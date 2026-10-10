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

import { porteeDuBuild } from '@/lib/apercuSansBase'

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

// Devkaylab est immatriculée depuis le 8 septembre 2026 : SASU au capital de
// 100 €, 109 680 389 R.C.S. Paris, EUID FR7501.109680389, siège domicilié au
// 47 rue Vivienne 75002 Paris.
//
// ⚠️ **LES MENTIONS SONT COMPLÈTES DEPUIS LE 7 OCTOBRE 2026.** La page est donc
// publiée, indexable, et son lien s'affiche au pied de page. ⚠️ **LA VENTE RESTE
// FERMÉE POUR AUTANT**, et par un drapeau distinct : voir `STRIPE_LIVE_PRET` et
// `venteOuverte()` plus bas. Les deux fonctions edge restent d'accord avec le
// site, et un test le vérifie.
export const EDITEUR: Mention[] = [
  { libelle: 'Éditeur', valeur: 'Devkaylab', requis: true },
  {
    libelle: 'Statut',
    valeur: 'Société par actions simplifiée à associé unique (SASU)',
    requis: true,
  },
  {
    libelle: 'Responsable de la publication',
    valeur: 'Julien Thiong-Kay',
    requis: true,
  },
  {
    libelle: 'Adresse',
    valeur: '47 rue Vivienne, 75002 Paris',
    requis: true,
  },
  { libelle: 'Courrier électronique', valeur: 'contact@quantinvo.com', requis: true },
  {
    libelle: 'Téléphone',
    valeur: '+33 6 88 59 27 65',
    requis: true,
  },
  {
    libelle: 'Numéro d’identification',
    valeur: 'SIREN 109 680 389',
    requis: true,
  },
  {
    libelle: 'Registre du commerce et des sociétés',
    valeur: '109 680 389 R.C.S. Paris',
    requis: false,
  },
  {
    libelle: 'Capital social',
    valeur: '100,00 €',
    requis: false,
  },
  {
    libelle: 'Numéro de TVA intracommunautaire',
    valeur: null,
    requis: false,
    // ⚠️ Volontairement vide : Devkaylab est en franchise en base (article
    // 293 B du CGI, voir `offres.ts`). Un numéro existe bien — il se demande —
    // mais l'afficher laisserait croire que la TVA est facturée, ce qui est
    // faux. À remplir le jour où la franchise tombe, avec `TVA_APPLICABLE`.
    aide: 'Si l’activité est assujettie à la TVA.',
  },
]

// ⚠️ **POSÉES LE 7 OCTOBRE 2026, ET RELEVÉES — JAMAIS CITÉES DE MÉMOIRE.** Les
// deux sources sont publiées par Vercel elle-même : le « Contact Us » de sa
// notice de confidentialité (vercel.com/legal/privacy-notice) pour l'adresse,
// et sa fiche du Data Privacy Framework (dataprivacyframework.gov, rubrique
// « Questions or Complaints ») pour l'adresse ET le téléphone.
//
// ⚠️⚠️ **ELLES ÉTAIENT CONNUES DEPUIS LE 15 SEPTEMBRE ET RETENUES EXPRÈS**, et
// c'était une erreur de câblage, pas de prudence. `venteOuverte()` valait
// `mentionsCompletes()` : les poser ouvrait la boutique, donc on ne les posait
// pas. Autrement dit, un devoir légal restait inaccompli pour empêcher une
// décision commerciale — la page d'identification restait à trous et en
// `noindex` pendant trois semaines, ce qui est précisément l'irrégularité que
// la LCEN vise. Julien, le 7 octobre : « pourquoi attendre pour compléter les
// infos Vercel ? » Il n'y avait pas de raison. Les deux conditions sont
// désormais séparées (voir `venteOuverte` plus bas).
//
export const HEBERGEUR: Mention[] = [
  { libelle: 'Hébergeur', valeur: 'Vercel Inc.', requis: true },
  {
    libelle: 'Adresse',
    valeur: '440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis',
    requis: true,
  },
  {
    libelle: 'Téléphone',
    valeur: '+1 415 398 5463',
    requis: true,
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
/**
 * ⚠️⚠️ **LA BOUTIQUE EST PRÊTE À ENCAISSER ?** Faux tant que Stripe est en test.
 *
 * Ce drapeau est né le 7 octobre 2026 d'une question de Julien — « pourquoi
 * attendre pour compléter les infos Vercel ? » — et de la réponse : parce qu'une
 * seule fonction portait DEUX choses qui n'ont rien à voir.
 *
 *   · publier qui édite le site est un **devoir légal**, qu'on accomplit dès
 *     qu'on connaît les valeurs ;
 *   · ouvrir la boutique est une **décision commerciale**, qui attend que
 *     Stripe encaisse pour de vrai.
 *
 * Les confondre revenait à retenir le premier pour empêcher la seconde.
 *
 * ⚠️ **LE 5 SEPTEMBRE 2026, UN SECOND DRAPEAU AVAIT ÉTÉ ÉCARTÉ** : « ce serait
 * un endroit de plus où se tromper, et surtout un endroit qu'on oublierait de
 * rouvrir le jour venu. » L'argument se retourne, et c'est pourquoi la
 * composition est un `&&` : **oublier ce drapeau garde la vente FERMÉE**, jamais
 * ouverte. Il échoue du bon côté. Un `||` aurait mérité le reproche.
 *
 * Ce qu'il attend, et qui se vérifie (AGENTS.md, « Stripe ») : le compte en
 * LIVE, les huit Price recréés aux montants de la grille, et la permission
 * Subscriptions sur la clé. Le lever sans ça enverrait un prospect sur une page
 * de paiement qui refuserait sa carte.
 */
export const STRIPE_LIVE_PRET = false

/**
 * ⚠️ DEUX CONDITIONS, ET IL LES FAUT TOUTES LES DEUX. La LCEN interdit de
 * vendre sans identification complète de l'éditeur : `mentionsCompletes()` reste
 * donc nécessaire. Elle n'est simplement plus suffisante.
 */
export function venteOuverte(): boolean {
  return (mentionsCompletes() && STRIPE_LIVE_PRET) || bancDApercu()
}

/**
 * ⚠️⚠️ **LA PORTE DU BANC — ET LE `||` CI-DESSUS EST ASSUMÉ.**
 *
 * Le commentaire de `STRIPE_LIVE_PRET` met en garde, à juste titre, contre un
 * `||` : il échoue du MAUVAIS côté, un oubli OUVRANT la vente. Celui-ci n'est
 * admis que parce que le disjoint est lui-même une **conjonction de conditions
 * qui ne peuvent pas être vraies sur le site en ligne** :
 *
 *   1. Vercel annonce « preview » pour ce build — `www.quantinvo.com` annonce
 *      « production », et c'est le déploiement, pas le code, qui le décide ;
 *   2. `NEXT_PUBLIC_BANC_STRIPE_TEST` vaut explicitement `true`, et cette
 *      variable se pose avec la portée **Preview** seulement.
 *
 * Chacune échoue vers le FERMÉ : variable absente, portée vide, réglage Vercel
 * décoché — tout cela garde la vente fermée. C'est la forme des deux portes
 * posées le même jour dans `inscription` et `mission-empreinte`, où la
 * condition structurelle est « la clé Stripe est une clé de test ».
 *
 * ⚠️ **ET ELLE NE MET RIEN EN LIVE.** Aucune clé ne change : le compte Stripe
 * reste en mode test, et `STRIPE_LIVE_PRET` — mal nommé pour qui le lit vite —
 * ne bascule pas. Ce drapeau dit « le compte est prêt pour du réel », il
 * n'actionne rien chez Stripe.
 *
 * Pourquoi elle existe : le 10 octobre 2026, le parcours de réservation
 * On-Demand ne pouvait pas être éprouvé de bout en bout. Le compte d'essai du
 * jumeau porte toutes les casquettes à la fois — « est-ce qu'on peut faire un
 * test de A à Z ? » — alors qu'un vrai prospect ouvre son compte DANS le
 * parcours. Les deux fonctions edge avaient été ouvertes sur le jumeau ; la
 * page, elle, désactivait ses boutons dès la première étape.
 *
 * ⚠️ Les six sessions Checkout de septembre, elles, étaient passées par
 * `libre-service` — qui ne porte aucun drapeau, parce qu'elle sert un client
 * DÉJÀ abonné. Une réservation est un engagement neuf : d'où la différence, et
 * d'où le fait que cette porte-ci ait dû être ouverte.
 */
function bancDApercu(): boolean {
  if (process.env.NEXT_PUBLIC_BANC_STRIPE_TEST !== 'true') return false
  return porteeDuBuild === 'preview'
}
