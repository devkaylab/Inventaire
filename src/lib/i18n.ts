/**
 * La langue de l'interface (10 septembre 2026).
 *
 * Deux langues : le français, qui est le TEXTE SOURCE, et l'anglais. La clé
 * d'une chaîne est sa phrase française elle-même — le motif de gettext. Trois
 * raisons, et elles se tiennent :
 *
 * - **le code reste lisible** : `t('Clôturer la balise')` se relit sans ouvrir
 *   un dictionnaire, là où `t('scanner.close_tag')` oblige à aller voir ;
 * - **une traduction absente ne casse rien** : la phrase française s'affiche.
 *   C'est le comportement voulu — mieux vaut un mot en français qu'un trou ou
 *   une clé technique devant un compteur ;
 * - **les gardes du dépôt survivent** : des dizaines de tests lisent les écrans
 *   pour y trouver une phrase française. Elle y est toujours, entre `t('` et
 *   `')`.
 *
 * ⚠️ La contrepartie : changer un mot du français change la clé. Un test
 * (`tests/i18n.test.ts`) relève toute clé citée dans `src/` qui n'a pas son
 * entrée anglaise — c'est lui qui rattrape la dérive.
 *
 * ⚠️ CE MODULE N'IMPORTE AUCUN MODULE NATIF, et ne doit pas le faire : les
 * tests l'exécutent sous Node. La lecture de la langue de l'appareil et la
 * persistance vivent dans `langueAppareil.ts`.
 *
 * Pluriels : `tn(singulier, pluriel, n)`. Le français prend le singulier pour
 * 0 et 1 (« 0 pièce »), l'anglais pour 1 seulement (« 0 units »). Le
 * dictionnaire anglais porte alors `{ one, other }` sous la clé du singulier.
 *
 * Interpolation : `%{nom}`. `%{count}` est posé par `tn`, déjà groupé par
 * milliers dans la locale courante.
 *
 * Le module du site (`web/lib/i18n.tsx`) porte la même API, dupliquée : le
 * site et l'application ne compilent pas ensemble.
 */
import { useSyncExternalStore } from 'react'
import { en } from '@/i18n/en'

export type Langue = 'fr' | 'en'
export const LANGUES: readonly Langue[] = ['fr', 'en'] as const

/** Le nom de chaque langue, dans sa propre langue — c'est ainsi qu'on la choisit. */
export const NOM_LANGUE: Record<Langue, string> = { fr: 'Français', en: 'English' }

export type Formes = { one: string; other: string }
export type Entree = string | Formes
export type Dictionnaire = Record<string, Entree>

/**
 * Les clés se comparent SANS distinguer les espaces : le français des écrans
 * porte ses insécables (« Quitter ? » s'écrit avec U+202F avant le point
 * d'interrogation, règle du 31 août 2026), le dictionnaire anglais se tape
 * avec des espaces ordinaires. Sans cette tolérance, une clé sur trois
 * manquerait pour un caractère invisible.
 */
const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')
function indexer(d: Dictionnaire): Dictionnaire {
  const out: Dictionnaire = {}
  for (const k of Object.keys(d)) out[norm(k)] = d[k]
  return out
}
const DICOS: Record<Langue, Dictionnaire> = { fr: {}, en: indexer(en) }

let courante: Langue = 'fr'
const abonnes = new Set<() => void>()

export function langue(): Langue {
  return courante
}

/** Pose la langue et prévient les écrans. La persistance est ailleurs. */
export function poserLangue(l: Langue) {
  if (l === courante) return
  courante = l
  for (const f of abonnes) f()
}

function abonner(f: () => void) {
  abonnes.add(f)
  return () => { abonnes.delete(f) }
}

/** La langue courante, et un nouveau rendu quand elle change. */
export function useLangue(): Langue {
  return useSyncExternalStore(abonner, langue, langue)
}

/**
 * La locale des nombres et des dates. Toujours nommée : `toLocaleString()`
 * nu suivrait la langue du téléphone, pas celle de l'interface.
 */
export function locale(): 'fr-FR' | 'en-GB' {
  return courante === 'en' ? 'en-GB' : 'fr-FR'
}

/** Le séparateur de milliers visible (U+00A0, jamais l'étroite de fr-FR). */
function grouperIci(n: number): string {
  return n.toLocaleString(locale()).replace(/ /g, ' ')
}

function interpoler(texte: string, vars?: Record<string, string | number>): string {
  if (!vars) return texte
  let out = texte
  for (const [k, v] of Object.entries(vars)) out = out.split(`%{${k}}`).join(String(v))
  return out
}

/** Une phrase. La clé est le français ; l'anglais vient du dictionnaire. */
export function t(cle: string, vars?: Record<string, string | number>): string {
  const entree = DICOS[courante][norm(cle)]
  const texte = typeof entree === 'string' ? entree : cle
  return interpoler(texte, vars)
}

function unSeul(l: Langue, n: number): boolean {
  return l === 'fr' ? Math.abs(n) <= 1 : n === 1
}

/**
 * Une phrase au singulier ou au pluriel, selon `n`. Le français s'écrit en
 * clair dans l'appel ; l'anglais est cherché sous la clé du singulier.
 */
export function tn(
  singulier: string,
  pluriel: string,
  n: number,
  vars?: Record<string, string | number>,
): string {
  const entree = DICOS[courante][norm(singulier)]
  let texte: string
  if (entree && typeof entree === 'object') texte = unSeul(courante, n) ? entree.one : entree.other
  else texte = unSeul('fr', n) ? singulier : pluriel
  return interpoler(texte, { count: grouperIci(n), ...vars })
}
