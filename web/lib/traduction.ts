/**
 * Le cœur de la traduction, SANS React et sans `'use client'` (11 septembre
 * 2026) : ce module sert aussi bien un composant serveur (les pages de la
 * vitrine, rendues en anglais sous `/en`) qu'un composant client, via
 * `lib/i18n.tsx` qui y ajoute l'abonnement et la persistance.
 *
 * Même contrat que `src/lib/i18n.ts` : la CLÉ d'une chaîne est sa phrase
 * française, l'anglais vient du dictionnaire, une traduction absente laisse le
 * français — jamais un trou.
 */
import { en } from '@/i18n/en'
import { lienVitrine } from '@/lib/vitrine'

export type Langue = 'fr' | 'en'
export const LANGUES: readonly Langue[] = ['fr', 'en'] as const
export const NOM_LANGUE: Record<Langue, string> = { fr: 'Français', en: 'English' }

export type Formes = { one: string; other: string }
export type Entree = string | Formes
export type Dictionnaire = Record<string, Entree>
export type Vars = Record<string, string | number>

/**
 * Les clés se comparent SANS distinguer les espaces : le français des écrans
 * porte ses insécables, le dictionnaire anglais se tape avec des espaces
 * ordinaires. Sans cette tolérance, une clé sur trois manquerait pour un
 * caractère invisible.
 */
export const norm = (s: string) => s.replace(/[  ]/g, ' ')
function indexer(d: Dictionnaire): Dictionnaire {
  const out: Dictionnaire = {}
  for (const k of Object.keys(d)) out[norm(k)] = d[k]
  return out
}
const DICOS: Record<Langue, Dictionnaire> = { fr: {}, en: indexer(en) }

export function estLangue(v: unknown): v is Langue {
  return typeof v === 'string' && (LANGUES as readonly string[]).includes(v)
}

export function localeDe(l: Langue): 'fr-FR' | 'en-GB' {
  return l === 'en' ? 'en-GB' : 'fr-FR'
}

function grouper(l: Langue, n: number): string {
  return n.toLocaleString(localeDe(l)).replace(/[  ]/g, ' ')
}

function interpoler(texte: string, vars?: Vars): string {
  if (!vars) return texte
  let out = texte
  for (const [k, v] of Object.entries(vars)) out = out.split(`%{${k}}`).join(String(v))
  return out
}

export function traduire(l: Langue, cle: string, vars?: Vars): string {
  const entree = DICOS[l][norm(cle)]
  return interpoler(typeof entree === 'string' ? entree : cle, vars)
}

function unSeul(l: Langue, n: number): boolean {
  return l === 'fr' ? Math.abs(n) <= 1 : n === 1
}

export function traduireN(l: Langue, singulier: string, pluriel: string, n: number, vars?: Vars): string {
  const entree = DICOS[l][norm(singulier)]
  let texte: string
  if (entree && typeof entree === 'object') texte = unSeul(l, n) ? entree.one : entree.other
  else texte = unSeul('fr', n) ? singulier : pluriel
  return interpoler(texte, { count: grouper(l, n), ...vars })
}

export type Traduction = {
  langue: Langue
  t: (cle: string, vars?: Vars) => string
  tn: (singulier: string, pluriel: string, n: number, vars?: Vars) => string
  /** Un lien de la vitrine dans la langue de la page : `/tarifs` → `/en/tarifs`. */
  lien: (href: string) => string
}

/** Une traduction LIÉE à une langue — ce que les composants serveur emploient. */
export function traduction(l: Langue): Traduction {
  return {
    langue: l,
    t: (cle, vars) => traduire(l, cle, vars),
    tn: (s, p, n, vars) => traduireN(l, s, p, n, vars),
    lien: (href) => lienVitrine(l, href),
  }
}
