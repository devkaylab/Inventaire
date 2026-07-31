/**
 * Extract a human-readable message from any thrown value.
 * Handles: Error, PostgrestError, plain objects, strings, null.
 */
export function errorMessage(e: unknown): string {
  if (!e) return 'Erreur inconnue'

  // Standard Error or subclass (PostgrestError extends Error in newer versions)
  if (e instanceof Error) return e.message

  // Supabase PostgrestError: { message, details, hint, code }
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>
    const parts: string[] = []
    if (typeof obj.message === 'string' && obj.message) parts.push(obj.message)
    if (typeof obj.details === 'string' && obj.details) parts.push(`(${obj.details})`)
    if (typeof obj.hint === 'string' && obj.hint) parts.push(`Conseil: ${obj.hint}`)
    if (typeof obj.code === 'string' && obj.code) parts.push(`[${obj.code}]`)
    if (parts.length) return parts.join(' ')
    try { return JSON.stringify(e) } catch { /* ignore */ }
  }

  if (typeof e === 'string') return e

  return String(e)
}

/**
 * Message clair pour un échec d'enregistrement de comptage. Traduit les erreurs
 * techniques (notamment RLS / 42501) en explication compréhensible par l'inventoriste.
 */
export function friendlyInsertCountError(e: unknown): string {
  const msg = errorMessage(e)
  if (/row-level security|42501|permission denied/i.test(msg)) {
    return "Enregistrement refusé. Vous n'êtes peut-être plus inscrit à cette session, ou l'inventaire vient d'être clôturé. Rejoignez la session à nouveau (numéro + code) ou contactez le superviseur."
  }
  if (/network|fetch|timeout|Failed to fetch/i.test(msg)) {
    return 'Connexion perdue. Vérifiez votre réseau : le comptage sera enregistrable dès le retour de la connexion.'
  }
  return `Impossible d'enregistrer le comptage : ${msg}`
}
