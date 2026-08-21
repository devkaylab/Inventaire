// Règles de mot de passe — copie volontaire de `web/lib/password.ts`.
//
// Le site et l'app appliquent les mêmes exigences que la console Supabase, et
// les énoncent en français avant l'envoi. Ce module est dupliqué plutôt que
// partagé : l'app et le site n'ont pas de code commun compilé ensemble. Les
// deux fichiers doivent bouger ensemble — `web/tests/password.test.ts` échoue
// s'ils divergent.
//
// À maintenir avec la console : Authentication → Providers → Email.

/** Longueur minimale, seuil CNIL pour un mot de passe seul (sans second facteur). */
export const MIN_PASSWORD_LENGTH = 12

/** Un symbole est tout ce qui n'est ni lettre, ni chiffre, ni espace. */
const SYMBOL = /[^\p{L}\p{N}\s]/u

export type PasswordCheck = {
  length: boolean
  lower: boolean
  upper: boolean
  digit: boolean
  symbol: boolean
}

/** Détail règle par règle, pour afficher une liste d'exigences cochées. */
export function checkPassword(password: string): PasswordCheck {
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    lower: /\p{Ll}/u.test(password),
    upper: /\p{Lu}/u.test(password),
    digit: /\p{Nd}/u.test(password),
    symbol: SYMBOL.test(password),
  }
}

export function passwordSatisfies(password: string): boolean {
  return Object.values(checkPassword(password)).every(Boolean)
}

/**
 * Message d'erreur, ou null si le mot de passe convient.
 *
 * Un seul message énumérant ce qui manque : trois refus successifs, un critère
 * à la fois, sont la meilleure façon de faire abandonner quelqu'un.
 */
export function passwordError(password: string): string | null {
  const c = checkPassword(password)
  if (Object.values(c).every(Boolean)) return null

  const manque: string[] = []
  if (!c.lower) manque.push('une minuscule')
  if (!c.upper) manque.push('une majuscule')
  if (!c.digit) manque.push('un chiffre')
  if (!c.symbol) manque.push('un symbole (par exemple ! ? * -)')

  if (!c.length && manque.length === 0) {
    return `Le mot de passe doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères.`
  }
  const liste = enumerer(manque)
  return c.length
    ? `Il manque ${liste} à votre mot de passe.`
    : `Le mot de passe doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères, et il lui manque ${liste}.`
}

/** « a », « a et b », « a, b et c ». */
function enumerer(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`
}

/** Libellés des règles, pour la liste affichée sous le champ. */
export const PASSWORD_RULES: { key: keyof PasswordCheck; label: string }[] = [
  { key: 'length', label: `${MIN_PASSWORD_LENGTH} caractères minimum` },
  { key: 'lower', label: 'une minuscule' },
  { key: 'upper', label: 'une majuscule' },
  { key: 'digit', label: 'un chiffre' },
  { key: 'symbol', label: 'un symbole' },
]

/**
 * Traduit le refus du serveur.
 *
 * Deux règles ne peuvent pas se vérifier ici : la présence du mot de passe dans
 * les fuites connues (HaveIBeenPwned, vérifiée par Supabase) et l'interdiction
 * de réutiliser l'ancien. Elles reviennent en anglais, d'une API qui n'a aucune
 * raison de parler la langue de la personne — d'où cette traduction.
 */
export function friendlyPasswordError(message: string): string {
  if (/pwned|compromis|leaked|data breach|breached/i.test(message)) {
    return 'Ce mot de passe figure dans une fuite de données connue : il est déjà à la disposition des attaquants. Choisissez-en un autre.'
  }
  if (/should be different from the old|same.*(old|previous) password/i.test(message)) {
    return 'Le nouveau mot de passe doit être différent de l’ancien.'
  }
  if (/at least|minimum|characters|lowercase|uppercase|digit|symbol|weak/i.test(message)) {
    return `Mot de passe refusé : il doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères, dont une minuscule, une majuscule, un chiffre et un symbole.`
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'
  }
  return message
}
