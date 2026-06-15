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
