'use client'

/**
 * La langue de l'espace connecté (10 septembre 2026).
 *
 * Même contrat que `src/lib/i18n.ts`, dupliqué parce que le site et
 * l'application ne compilent pas ensemble : la CLÉ d'une chaîne est sa
 * phrase française, l'anglais vient d'un dictionnaire, et une traduction
 * absente laisse le français — jamais un trou.
 *
 * ⚠️ LA VITRINE A DEUX ADRESSES PAR PAGE (11 septembre 2026) : `/tarifs` en
 * français, `/en/tarifs` en anglais, toutes deux indexables. Là, c'est
 * l'ADRESSE qui fixe la langue (`lib/vitrine.ts`), pas le cookie — voir
 * `useLangue`. Le cookie ne gouverne que l'espace connecté et ses portes.
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
import { usePathname } from 'next/navigation'
import {
  estLangue, localeDe, traduire, traduireN, traduction as lier,
  type Langue, type Traduction, type Vars,
} from '@/lib/traduction'
import { langueDuChemin } from '@/lib/vitrine'

export { LANGUES, NOM_LANGUE } from '@/lib/traduction'
export type { Dictionnaire, Entree, Formes, Langue, Traduction } from '@/lib/traduction'

const COOKIE = 'qlang'

let courante: Langue = 'fr'
const abonnes = new Set<() => void>()

export function langue(): Langue {
  return courante
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

/**
 * La langue d'un composant. ⚠️ SUR LA VITRINE, C'EST L'ADRESSE QUI DÉCIDE
 * (`/en/tarifs` est en anglais, `/tarifs` en français), et elle est connue du
 * serveur : les pages `/en` sortent en anglais dès le premier octet, sans
 * désaccord d'hydratation. Ailleurs — connexion, espace connecté, devis — la
 * langue est celle de l'appareil, relue après l'hydratation.
 */
export function useLangue(): Langue {
  const chemin = usePathname()
  const imposee = langueDuChemin(chemin)
  const choisie = useSyncExternalStore(abonner, langue, serveur)
  return imposee ?? choisie
}

export function locale(): 'fr-FR' | 'en-GB' {
  return localeDe(courante)
}

/** Hors composant (formatage, messages d'erreur) : la langue du moment. */
export function t(cle: string, vars?: Vars): string {
  return traduire(courante, cle, vars)
}

export function tn(singulier: string, pluriel: string, n: number, vars?: Vars): string {
  return traduireN(courante, singulier, pluriel, n, vars)
}

/**
 * Dans un composant : `const { t, tn, lien } = useTraduction()`. Les fonctions
 * sont liées à l'instantané, donc justes pendant l'hydratation, et le
 * composant se rerend au changement de langue.
 */
export function useTraduction(): Traduction {
  const l = useLangue()
  return useMemo<Traduction>(() => lier(l), [l])
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
  const chemin = usePathname()
  useEffect(() => {
    // Sur la vitrine l'adresse impose la langue (les helpers hors composant —
    // `t`, `locale`, le formatage — doivent la suivre aussi) ; ailleurs, c'est
    // la préférence de l'appareil.
    poserLangue(langueDuChemin(chemin) ?? langueEnregistree())
  }, [chemin])
  return <Ctx.Provider value>{children}</Ctx.Provider>
}

/** Vrai sous le provider — sert aux tests, pas aux écrans. */
export function useSousLangueProvider(): boolean {
  return useContext(Ctx)
}
