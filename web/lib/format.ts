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

/** Quantité : entier tel quel, décimal sans zéros inutiles (1.500 → 1,5). */
export function fmtQty(v: number): string {
  if (!Number.isFinite(v)) return '0'
  const s = Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '')
  return s.replace('.', ',')
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
  return (v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  if (abs < 1000) return `${money(v)} €`
  const k = v / 1000
  return `${k.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(k) < 100 ? 1 : 0,
  })} k€`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

/** Un entier avec ses séparateurs de milliers : 18402 → « 18 402 ». */
export const nb = (n: number) => n.toLocaleString('fr-FR')

/**
 * « il y a 40 s », « il y a 12 min »… Utilisé partout où l'on montre une
 * dernière activité : le superviseur doit pouvoir juger d'un coup d'œil si
 * l'information est fraîche.
 */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'jamais'
  const diff = Math.max(0, now - new Date(iso).getTime())
  const sec = Math.round(diff / 1000)
  if (sec < 10) return "à l'instant"
  if (sec < 60) return `il y a ${sec} s`
  const min = Math.round(sec / 60)
  if (min < 60) return `il y a ${min} min`
  const hours = Math.round(min / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'hier' : `il y a ${days} j`
}

/**
 * Durée d'une activité en cours, formulée « depuis X ».
 * Prend une durée en millisecondes (et non un instant) : la présence temps réel
 * fournit déjà l'écart calculé au moment de la fusion.
 */
export function sinceDuration(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return 'depuis moins d’une minute'
  const min = Math.round(sec / 60)
  if (min < 60) return `depuis ${min} min`
  const hours = Math.round(min / 60)
  return `depuis ${hours} h`
}

/** « 1 balise » / « 3 balises » sans répéter le ternaire partout. */
export function plural(n: number, singular: string, plural?: string): string {
  return `${n} ${n > 1 ? (plural ?? `${singular}s`) : singular}`
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
  return `${arrondi.toLocaleString('fr-FR')} ${unites[i]}`
}
