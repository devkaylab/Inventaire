// Séries de balises.
//
// Une balise est une étiquette QR numérotée, imprimée une fois et réutilisée
// d'un inventaire à l'autre. Il n'existe pas de stock à tenir : le superviseur
// choisit un format de numérotation, un numéro de départ et un nombre, puis
// imprime la planche. Les numéros n'ont aucun sens côté serveur tant qu'ils ne
// sont pas affectés à un emplacement dans un inventaire (define_zone, par plage).
//
// Copie volontaire de src/lib/baliseSeries.ts (app mobile) : les deux doivent
// rester identiques — un test le garde (web/tests/balises.test.ts).

export type BaliseFormat = 'simple' | 'four' | 'five'

export type BaliseFormatInfo = {
  id: BaliseFormat
  /** Libellé court (puce du formulaire). */
  label: string
  /** Exemple de suite, pour se représenter le résultat. */
  example: string
  /** Premier numéro proposé. */
  defaultStart: number
  /** Plus petit et plus grand numéro admis par le format. */
  min: number
  max: number
}

export const BALISE_FORMATS: BaliseFormatInfo[] = [
  { id: 'simple', label: 'Numéros simples', example: '1, 2, 3…', defaultStart: 1, min: 1, max: 999 },
  { id: 'four', label: '4 chiffres', example: '1000, 1001…', defaultStart: 1000, min: 1000, max: 9999 },
  { id: 'five', label: '5 chiffres', example: '10000, 10001…', defaultStart: 10000, min: 10000, max: 99999 },
]

/** Nombre maximal de balises par planche générée (≈ 48 pages A4 de 21 étiquettes). */
export const MAX_BALISES_PER_SHEET = 1000

export function baliseFormat(id: BaliseFormat): BaliseFormatInfo {
  return BALISE_FORMATS.find((f) => f.id === id) ?? BALISE_FORMATS[0]
}

export type BaliseSeries = { from: number; to: number; codes: string[] }

/**
 * Calcule la série à imprimer, ou un message d'erreur en français.
 * `start` et `count` arrivent tels que saisis (texte), pour que les messages
 * parlent de ce que la personne vient de taper.
 */
export function planBaliseSeries(
  format: BaliseFormat,
  start: string,
  count: string
): { ok: true; series: BaliseSeries } | { ok: false; error: string } {
  const f = baliseFormat(format)
  const s = Number(start.trim())
  const n = Number(count.trim())

  if (start.trim() === '' || !Number.isInteger(s)) {
    return { ok: false, error: 'Indiquez le premier numéro de la série.' }
  }
  if (s < f.min || s > f.max) {
    return { ok: false, error: `Avec ce format, le premier numéro va de ${f.min} à ${f.max}.` }
  }
  if (count.trim() === '' || !Number.isInteger(n) || n < 1) {
    return { ok: false, error: 'Indiquez le nombre de balises à créer (au moins 1).' }
  }
  if (n > MAX_BALISES_PER_SHEET) {
    return { ok: false, error: `${MAX_BALISES_PER_SHEET} balises au maximum par planche.` }
  }
  const to = s + n - 1
  if (to > f.max) {
    const room = f.max - s + 1
    return {
      ok: false,
      error: `La série dépasserait ${f.max}. À partir de ${s}, ce format permet ${room} balise${room > 1 ? 's' : ''} au plus.`,
    }
  }
  const codes: string[] = []
  for (let i = s; i <= to; i++) codes.push(String(i))
  return { ok: true, series: { from: s, to, codes } }
}
