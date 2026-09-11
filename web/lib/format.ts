import { langue, locale, t, tn } from '@/lib/i18n'

// Formatage et parsing partagés par tout le site. L'app mobile a les mêmes
// règles (voir src/app/(supervisor)/[sessionId]/results.tsx) : on les garde
// alignées pour qu'un même inventaire s'affiche à l'identique des deux côtés.

/**
 * Lit une quantité saisie par un utilisateur francophone.
 * `parseFloat('1,5')` renvoie 1 : sur un clavier français, l'arbitrage d'un
 * écart devenait silencieusement faux. On accepte la virgule et le point,
 * et on refuse tout ce qui n'est pas un nombre propre.
 */
export function parseDecimal(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return null
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Quantité : séparateur de milliers, décimales sans zéros inutiles
 * (1500 → « 1 500 », 1.500 → « 1,5 »).
 *
 * ⚠️ LE SÉPARATEUR DE MILLIERS N'EST PAS UN ORNEMENT (3 septembre 2026,
 * demande de Julien : « 1000 > 1 000, plus facile à lire »). Sur un
 * inventaire, la colonne des quantités porte des nombres à cinq ou six
 * chiffres : sans groupement, « 128400 » et « 12840 » se ressemblent au coup
 * d'œil, et c'est précisément là qu'on cherche un écart.
 *
 * ⚠️ ELLE NE SERT QU'À L'AFFICHAGE. Un export, une valeur de champ ou une
 * comparaison prennent le nombre brut — `toLocaleString` insère une espace
 * insécable étroite (U+202F) qu'aucun tableur ne relit comme un chiffre.
 * `parseDecimal` sait la retirer (`\s` la couvre) pour ce que l'on tape.
 *
 * `v || 0` écrase le zéro négatif : `(-0).toLocaleString('fr-FR')` rend « -0 »,
 * ce qui se lit comme un manque alors qu'il ne s'est rien passé.
 */
/**
 * Le séparateur de milliers, en un seul point.
 *
 * ⚠️ `fr-FR` pose une espace insécable ÉTROITE (U+202F), et à la taille du
 * texte courant elle NE SE VOIT PAS sur un nombre à quatre chiffres : Julien a
 * lu « 1146 » à côté d'un « 12 210 » qui, lui, se détachait, et a demandé
 * qu'on harmonise (4 septembre 2026). Les deux portaient pourtant le même
 * caractère — le défaut n'était pas un séparateur manquant, c'était un
 * séparateur invisible.
 *
 * On pose donc l'espace insécable ORDINAIRE (U+00A0) : elle se voit, et elle
 * ne casse pas un montant en fin de ligne.
 *
 * ⚠️ ELLE RESTE DE L'AFFICHAGE, ET RIEN D'AUTRE. Un export, une valeur de
 * champ ou une comparaison prennent le nombre brut — aucun tableur ne relit
 * l'une ou l'autre de ces espaces comme un chiffre. `parseDecimal` les retire
 * toutes les deux (`\s` les couvre).
 */
const SEPARATEUR = '\u00a0'
export function grouper(s: string): string {
  return s.replace(/\u202f/g, SEPARATEUR)
}

export function fmtQty(v: number): string {
  if (!Number.isFinite(v)) return '0'
  return grouper((v || 0).toLocaleString(locale(), { maximumFractionDigits: 3 }))
}

/** Écart signé : on garde le + pour que le sens saute aux yeux. */
export function fmtSigned(v: number): string {
  return v > 0 ? `+${fmtQty(v)}` : fmtQty(v)
}

/**
 * Montant en euros, deux décimales, séparateurs français.
 * `v || 0` écrase aussi le zéro négatif : `(-0).toLocaleString('fr-FR')` rend
 * « -0,00 », ce qui se lit comme une perte alors qu'il ne s'est rien passé.
 */
export function money(v: number): string {
  if (!Number.isFinite(v)) v = 0
  return grouper((v || 0).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
}

/**
 * Montant raccourci pour un tableau de bord : « 12,8 k€ » plutôt que
 * « 12 750,00 € » (3 septembre 2026, demande de Julien).
 *
 * ⚠️ ELLE NE S'EMPLOIE QUE LÀ OÙ LE CHIFFRE EXACT RESTE ATTEIGNABLE — un
 * `title` au survol, ou une bulle. Un montant arrondi qu'on ne peut pas
 * déplier est un montant faux : sur un rapport, sur une facture ou dans un
 * export, c'est `money` et rien d'autre.
 *
 * Sous 1 000 € on garde les centimes : c'est là qu'ils se lisent encore.
 * Au-dessus de 100 k€ on retire la décimale — « 450 k€ » se lit mieux que
 * « 450,3 k€ », et la précision perdue est de l'ordre du bruit.
 */
export function moneyCourt(v: number): string {
  if (!Number.isFinite(v)) v = 0
  v = v || 0
  const abs = Math.abs(v)
  if (abs < 1000) return euro(money(v))
  const k = v / 1000
  return euro(grouper(k.toLocaleString(locale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(k) < 100 ? 1 : 0,
  })), 'k')
}

/**
 * Le symbole de l'euro, placé comme la langue l'écrit : « 12 750,00 € » en
 * français, « €12,750.00 » en anglais. `k` pour la forme abrégée (« 12,8 k€ »,
 * « €12.8k »).
 */
export function euro(montant: string, k?: 'k'): string {
  if (langue() === 'en') return `€${montant}${k ? 'k' : ''}`
  return `${montant} ${k ? 'k€' : '€'}`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(locale())
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(locale(), {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

/** Un entier avec ses séparateurs de milliers : 18402 → « 18 402 ». */
export const nb = (n: number) => grouper(n.toLocaleString(locale()))

/**
 * « il y a 40 s », « il y a 12 min »… Utilisé partout où l'on montre une
 * dernière activité : le superviseur doit pouvoir juger d'un coup d'œil si
 * l'information est fraîche.
 */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return t('jamais')
  const diff = Math.max(0, now - new Date(iso).getTime())
  const sec = Math.round(diff / 1000)
  if (sec < 10) return t("à l'instant")
  if (sec < 60) return t('il y a %{n} s', { n: sec })
  const min = Math.round(sec / 60)
  if (min < 60) return t('il y a %{n} min', { n: min })
  const hours = Math.round(min / 60)
  if (hours < 24) return t('il y a %{h} h', { h: hours })
  const days = Math.round(hours / 24)
  return days === 1 ? t('hier') : tn('il y a %{count} j', 'il y a %{count} j', days)
}

/**
 * Durée d'une activité en cours, formulée « depuis X ».
 * Prend une durée en millisecondes (et non un instant) : la présence temps réel
 * fournit déjà l'écart calculé au moment de la fusion.
 */
export function sinceDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return t('depuis moins d’une minute')
  const min = Math.round(sec / 60)
  if (min < 60) return t('depuis %{n} min', { n: min })
  const hours = Math.round(min / 60)
  return t('depuis %{h} h', { h: hours })
}

/**
 * « 1 balise » / « 3 balises » sans répéter le ternaire partout.
 *
 * ⚠️ Le singulier français est aussi la CLÉ du dictionnaire anglais : l'entrée
 * `'%{count} balise': { one: '%{count} tag', other: '%{count} tags' }` sert
 * les deux formes. Un mot sans entrée reste en français, avec son pluriel
 * français — jamais un pluriel anglais deviné.
 */
export function plural(n: number, singular: string, plural?: string): string {
  return tn(`%{count} ${singular}`, `%{count} ${plural ?? `${singular}s`}`, n)
}

/**
 * Octets en unité lisible — binaire (1 Ko = 1024 o), comme les systèmes de
 * fichiers qui produisent ces chiffres. Les mélanger avec le décimal des
 * disquiers ferait un écart de 7 % sur un Go, silencieux et faux.
 */
export function octets(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const unites = ['o', 'ko', 'Mo', 'Go', 'To']
  let n = Math.abs(v)
  let i = 0
  while (n >= 1024 && i < unites.length - 1) { n /= 1024; i += 1 }
  const arrondi = n < 10 && i > 0 ? Math.round(n * 10) / 10 : Math.round(n)
  return `${grouper(arrondi.toLocaleString(locale()))} ${unites[i]}`
}
