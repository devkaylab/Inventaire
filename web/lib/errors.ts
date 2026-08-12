// Messages d'erreur lisibles. Repris de src/lib/errors.ts (l'app mobile), sans
// les dépendances React Native, pour que les deux plateformes disent la même
// chose devant la même panne.

type SupabaseLike = { message?: string; details?: string; hint?: string; code?: string }

export function errorMessage(e: unknown): string {
  if (!e) return 'Erreur inconnue'
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message

  const s = e as SupabaseLike
  if (s.message) {
    let out = s.message
    if (s.details) out += ` (${s.details})`
    if (s.hint) out += ` Conseil : ${s.hint}`
    if (s.code) out += ` [${s.code}]`
    return out
  }
  try { return JSON.stringify(e) } catch { return String(e) }
}

/**
 * Traduit les échecs courants en langage de terrain. Un superviseur qui voit
 * « new row violates row-level security policy » n'a aucune piste ; il en a une
 * avec « vous n'êtes pas participant de cet inventaire ».
 */
export function friendlyError(e: unknown): string {
  const msg = errorMessage(e)
  if (/row-level security|42501|permission denied/i.test(msg)) {
    return "Action refusée. Vous n'êtes probablement pas participant de cet inventaire, ou il vient d'être clôturé."
  }
  if (/forbidden/i.test(msg)) {
    return "Accès refusé : cet inventaire ne vous est pas ouvert. Demandez au créateur de vous y inviter."
  }
  if (/network|fetch|timeout|Failed to fetch/i.test(msg)) {
    return 'Connexion perdue. Vérifiez votre réseau puis réessayez.'
  }
  return msg
}
