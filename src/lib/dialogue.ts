/**
 * Les questions et les nouvelles de l'application.
 *
 * Remplace `Alert.alert`, qui n'avait rien de nous : police système, indigo
 * remplacé par le bleu d'iOS, et surtout **deux réponses du même poids** — sur
 * une suppression, « Annuler » et « Supprimer » se ressemblaient trait pour
 * trait. Direction retenue avec Julien le 24 août 2026 (canevas B) : la
 * question s'ouvre au même moment et au même endroit qu'avant, mais dans une
 * carte de l'app, et la réponse voulue est un bouton plein tandis qu'« Annuler »
 * n'est qu'un contour.
 *
 * Deux surfaces, et le partage entre elles est la vraie décision :
 *
 * - **`demander`** pose une question et attend. C'est la seule chose qui
 *   bloque. Elle rend `true` si la personne confirme.
 * - **`avertir`** dit quelque chose qu'il faut avoir lu, et attend le seul
 *   bouton. Réservé à ce qui indique une marche à suivre — « adressez-vous à
 *   l'administrateur de votre entreprise » — que personne ne doit rater.
 * - **`signaler`** annonce ce qui vient de se passer — un PDF sorti, un refus
 *   du serveur — dans un bandeau qui **passe tout seul**. Personne ne doit
 *   toucher « OK » pour un fichier qui s'est bien créé (décision de Julien le
 *   même jour).
 *
 * Le partage entre `avertir` et `signaler.erreur` est le seul endroit où l'on
 * juge : un refus qui dit **quoi faire ensuite** mérite un bouton ; un refus
 * qui constate (« Export impossible », le message du serveur) passe tout seul.
 *
 * ⚠️ **`demander` ne se résout qu'une fois la carte réellement démontée**, et
 * ce n'est pas un détail de confort : iOS refuse d'ouvrir une feuille de
 * partage tant qu'une présentation est en cours. C'est exactement ce qui avait
 * cassé l'impression des balises (voir `GeneratingOverlay` dans AGENTS.md).
 * Une action qui partage un fichier juste après un « oui » doit donc partir
 * quand plus rien n'est présenté.
 */

export type TonQuestion = 'neutre' | 'danger'
export type TonNouvelle = 'succes' | 'erreur' | 'info'

export interface Question {
  /** La question elle-même, avec son point d'interrogation. */
  titre: string
  /** Ce qu'il faut savoir pour répondre. */
  texte?: string
  /** Une précision de second plan, sous un filet. */
  note?: string
  /** Le surtitre coloré qui donne le ton. À défaut, il se déduit du ton. */
  surtitre?: string
  /** Libellé du bouton plein. */
  action?: string
  /** Libellé du bouton de contour. */
  annuler?: string
  ton?: TonQuestion
  /** Un seul bouton, pleine largeur : rien à refuser, seulement à lire. */
  seul?: boolean
}

export interface Nouvelle {
  id: number
  ton: TonNouvelle
  titre: string
  texte?: string
}

interface QuestionPosee extends Question {
  id: number
  repondre: (accepte: boolean) => void
}

interface Etat {
  question: QuestionPosee | null
  nouvelles: Nouvelle[]
}

/** Combien de temps un bandeau reste à l'écran, par ton. */
export const DUREES: Record<TonNouvelle, number> = {
  // Un refus mérite d'être lu jusqu'au bout : il dit souvent quoi corriger.
  erreur: 6000,
  succes: 3500,
  info: 3500,
}

/** Au-delà, les plus anciens s'effacent : trois bandeaux couvrent déjà l'écran. */
const MAX_NOUVELLES = 3

let etat: Etat = { question: null, nouvelles: [] }
let compteur = 0
const abonnes = new Set<() => void>()
/** Les questions arrivées pendant qu'une autre est ouverte attendent leur tour. */
const file: QuestionPosee[] = []

function publier(suivant: Etat) {
  etat = suivant
  for (const f of abonnes) f()
}

export function abonnerDialogue(f: () => void) {
  abonnes.add(f)
  return () => { abonnes.delete(f) }
}

export function lireDialogue() {
  return etat
}

/**
 * Pose une question et attend la réponse.
 *
 * La promesse se résout à `true` sur le bouton plein, `false` sur « Annuler ».
 * ⚠️ Elle ne se résout qu'après le démontage de la carte — voir l'entête.
 */
export function demander(question: Question): Promise<boolean> {
  return new Promise<boolean>((resoudre) => {
    const posee: QuestionPosee = { ...question, id: ++compteur, repondre: resoudre }
    if (etat.question) file.push(posee)
    else publier({ ...etat, question: posee })
  })
}

/**
 * À appeler quand la carte a fini de disparaître : c'est là que la réponse
 * part, et que la question suivante prend la place.
 */
export function questionRefermee(id: number, accepte: boolean) {
  const courante = etat.question
  if (!courante || courante.id !== id) return
  const suivante = file.shift() ?? null
  publier({ ...etat, question: suivante })
  courante.repondre(accepte)
}

function annoncer(ton: TonNouvelle, titre: string, texte?: string) {
  const nouvelle: Nouvelle = { id: ++compteur, ton, titre, texte }
  const gardees = [...etat.nouvelles, nouvelle].slice(-MAX_NOUVELLES)
  publier({ ...etat, nouvelles: gardees })
  return nouvelle.id
}

/**
 * Dit quelque chose qu'il faut avoir lu, et attend.
 *
 * Un seul bouton : il n'y a rien à refuser. À garder pour ce qui indique une
 * marche à suivre — sinon, `signaler.erreur` suffit.
 */
export async function avertir(a: Omit<Question, 'annuler' | 'seul'>): Promise<void> {
  await demander({ ...a, action: a.action ?? 'J’ai compris', seul: true })
}

/** Annonce ce qui vient de se passer, dans un bandeau qui passe tout seul. */
export const signaler = {
  succes: (titre: string, texte?: string) => annoncer('succes', titre, texte),
  erreur: (titre: string, texte?: string) => annoncer('erreur', titre, texte),
  info: (titre: string, texte?: string) => annoncer('info', titre, texte),
}

export function retirerNouvelle(id: number) {
  publier({ ...etat, nouvelles: etat.nouvelles.filter((n) => n.id !== id) })
}

/** Pour les tests : remet tout à zéro sans laisser de promesse en suspens. */
export function reinitialiserDialogue() {
  for (const q of file) q.repondre(false)
  file.length = 0
  etat.question?.repondre(false)
  publier({ question: null, nouvelles: [] })
}
