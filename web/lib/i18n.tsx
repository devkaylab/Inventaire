'use client'

/**
 * La langue de l'espace connecté (10 septembre 2026).
 *
 * Même contrat que `src/lib/i18n.ts`, dupliqué parce que le site et
 * l'application ne compilent pas ensemble : la CLÉ d'une chaîne est sa
 * phrase française, l'anglais vient d'un dictionnaire, et une traduction
 * absente laisse le français — jamais un trou.
 *
 * ⚠️ LA VITRINE RESTE EN FRANÇAIS. Seul l'espace connecté (et les portes qui
 * y mènent : connexion, bienvenue, réinitialisation) passe par `useTraduction`.
 * Les pages publiques n'appellent pas ce module, et n'ont pas à le faire.
 *
 * ⚠️ COMMENT ON ÉVITE LE DÉSACCORD D'HYDRATATION. Le serveur rend en français
 * (il ne connaît pas la préférence) ; le navigateur DOIT rendre la même chose
 * au premier passage, sinon React signale un désaccord et rerend la page. La
 * langue n'est donc JAMAIS lue au chargement du module : `LangueProvider` la
 * relit dans un effet, après l'hydratation, et prévient les composants
 * abonnés. Le prix est une image en français avant l'anglais — sur une page
 * qui affiche de toute façon « Chargement… » tant que la session n'est pas
 * vérifiée, il ne se voit pas.
 *
 * Conséquence : dans un composant, on passe par `useTraduction()`, jamais par
 * `t` importé nu — c'est l'abonnement qui garantit le nouveau rendu. Les
 * fonctions de formatage (`lib/format.ts`) lisent `langue()` au moment de
 * l'appel : appelées dans le rendu d'un composant abonné, elles suivent.
 *
 * La préférence vit dans un cookie (`qlang`, un an) — pour qu'un rendu futur
 * côté serveur puisse la lire — et dans `localStorage` en miroir. Elle n'est
 * pas en base : la langue d'un navigateur n'est pas celle du téléphone, et
 * chaque appareil garde la sienne.
 */
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { en } from '@/i18n/en'

export type Langue = 'fr' | 'en'
export const LANGUES: readonly Langue[] = ['fr', 'en'] as const
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
const COOKIE = 'qlang'

let courante: Langue = 'fr'
const abonnes = new Set<() => void>()

export function langue(): Langue {
  return courante
}

function estLangue(v: unknown): v is Langue {
  return typeof v === 'string' && (LANGUES as readonly string[]).includes(v)
}

export function poserLangue(l: Langue) {
  if (l === courante) return
  courante = l
  if (typeof document !== 'undefined') document.documentElement.lang = l
  for (const f of abonnes) f()
}

function abonner(f: () => void) {
  abonnes.add(f)
  return () => { abonnes.delete(f) }
}

/** Le rendu serveur ne connaît que le français : c'est l'instantané d'hydratation. */
const serveur = (): Langue => 'fr'

export function useLangue(): Langue {
  return useSyncExternalStore(abonner, langue, serveur)
}

export function locale(): 'fr-FR' | 'en-GB' {
  return courante === 'en' ? 'en-GB' : 'fr-FR'
}

function grouperIci(n: number): string {
  return n.toLocaleString(locale()).replace(/ /g, ' ')
}

function interpoler(texte: string, vars?: Record<string, string | number>): string {
  if (!vars) return texte
  let out = texte
  for (const [k, v] of Object.entries(vars)) out = out.split(`%{${k}}`).join(String(v))
  return out
}

function traduire(l: Langue, cle: string, vars?: Record<string, string | number>): string {
  const entree = DICOS[l][norm(cle)]
  return interpoler(typeof entree === 'string' ? entree : cle, vars)
}

function unSeul(l: Langue, n: number): boolean {
  return l === 'fr' ? Math.abs(n) <= 1 : n === 1
}

function traduireN(
  l: Langue, singulier: string, pluriel: string, n: number, vars?: Record<string, string | number>,
): string {
  const entree = DICOS[l][norm(singulier)]
  let texte: string
  if (entree && typeof entree === 'object') texte = unSeul(l, n) ? entree.one : entree.other
  else texte = unSeul('fr', n) ? singulier : pluriel
  return interpoler(texte, { count: grouperIci(n), ...vars })
}

/** Hors composant (formatage, messages d'erreur) : la langue du moment. */
export function t(cle: string, vars?: Record<string, string | number>): string {
  return traduire(courante, cle, vars)
}

export function tn(singulier: string, pluriel: string, n: number, vars?: Record<string, string | number>): string {
  return traduireN(courante, singulier, pluriel, n, vars)
}

export type Traduction = {
  langue: Langue
  t: (cle: string, vars?: Record<string, string | number>) => string
  tn: (singulier: string, pluriel: string, n: number, vars?: Record<string, string | number>) => string
}

/**
 * Dans un composant : `const { t, tn } = useTraduction()`. Les deux fonctions
 * sont liées à l'instantané, donc justes pendant l'hydratation, et le
 * composant se rerend au changement de langue.
 */
export function useTraduction(): Traduction {
  const l = useLangue()
  return useMemo<Traduction>(() => ({
    langue: l,
    t: (cle, vars) => traduire(l, cle, vars),
    tn: (s, p, n, vars) => traduireN(l, s, p, n, vars),
  }), [l])
}

// ── Persistance ─────────────────────────────────────────────────────────────

function lireCookie(): Langue | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(fr|en)`))
  return m ? (m[1] as Langue) : null
}

function lireStockage(): Langue | null {
  try {
    const v = localStorage.getItem(COOKIE)
    return estLangue(v) ? v : null
  } catch {
    return null
  }
}

function langueDuNavigateur(): Langue {
  if (typeof navigator === 'undefined') return 'fr'
  const code = (navigator.language || '').slice(0, 2).toLowerCase()
  return estLangue(code) ? code : 'fr'
}

/** Ce qui vaut pour cet appareil : le choix enregistré, sinon le navigateur. */
export function langueEnregistree(): Langue {
  return lireCookie() ?? lireStockage() ?? langueDuNavigateur()
}

/** Choix explicite depuis Mon compte : posé tout de suite, gardé un an. */
export function changerLangue(l: Langue) {
  poserLangue(l)
  try {
    document.cookie = `${COOKIE}=${l}; Max-Age=31536000; Path=/; SameSite=Lax`
    localStorage.setItem(COOKIE, l)
  } catch {
    // Sans stockage, le choix vaut pour la page ouverte.
  }
}

const Ctx = createContext(false)

/**
 * À poser une fois, dans le layout racine. Il ne rend rien : il relit la
 * préférence après l'hydratation et prévient les abonnés.
 */
export function LangueProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    poserLangue(langueEnregistree())
  }, [])
  return <Ctx.Provider value>{children}</Ctx.Provider>
}

/** Vrai sous le provider — sert aux tests, pas aux écrans. */
export function useSousLangueProvider(): boolean {
  return useContext(Ctx)
}
