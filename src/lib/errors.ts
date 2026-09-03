/**
 * Extract a human-readable message from any thrown value.
 * Handles: Error, PostgrestError, plain objects, strings, null.
 *
 * ⚠️ **CE QUI N'A PAS DE TEXTE NE SE SÉRIALISE PAS EN JSON.** Le site a
 * affiché `{"message":""}` dans un encadré rouge le 3 septembre 2026 : c'est
 * ce que rend `JSON.stringify` d'une erreur PostgREST sans texte, et PostgREST
 * en fabrique une (`{ message: <corps> }`) chaque fois que le serveur répond
 * en erreur AVEC UN CORPS VIDE — un délai dépassé, une passerelle qui coupe.
 * Le cas est donc exactement celui où la personne a le plus besoin d'une
 * phrase, et c'est celui où elle recevait du JSON. Le module du site porte la
 * même correction ; l'objet brut reste tracé par le `console.error` de
 * l'appelant, il n'a rien à faire à l'écran.
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
    // On garde le code technique quand il existe — il retrouve l'incident
    // dans les journaux — et rien d'autre.
    return typeof obj.code === 'string' && obj.code
      ? `Erreur inconnue [${obj.code}]`
      : 'Erreur inconnue'
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
    return "Enregistrement refusé. Vous n'êtes peut-être plus inscrit à cet inventaire, ou il vient d'être clôturé. Rejoignez-le à nouveau (numéro + code) ou contactez le superviseur."
  }
  // Le délai serveur dépassé n'est ni un refus ni une panne de réseau :
  // l'opération est partie et a été interrompue en route.
  if (/57014|statement timeout|canceling statement/i.test(msg)) {
    return 'Le serveur a mis trop de temps à répondre et a interrompu l’opération. Réessayez dans un instant.'
  }
  if (/network|fetch|timeout|Failed to fetch/i.test(msg)) {
    return 'Connexion perdue. Vérifiez votre réseau : le comptage sera enregistrable dès le retour de la connexion.'
  }
  return `Impossible d'enregistrer le comptage : ${msg}`
}

/**
 * Message clair pour un échec de connexion.
 *
 * Sans cette traduction, l'app affichait le message brut de Supabase, en
 * anglais (« Invalid login credentials », « Network request failed ») — à un
 * compteur saisonnier, devant le rayon. Le site, lui, traduisait déjà.
 *
 * ⚠️ **« identifiants invalides » et « compte inconnu » rendent le MÊME
 * texte**, volontairement : dire « ce compte n'existe pas » rouvrirait
 * l'oracle d'énumération d'adresses fermé par le constat M3.
 */
export function friendlySignInError(e: unknown): string {
  const err = e as { name?: string; status?: number; message?: string } | null
  const msg = (err?.message ?? '').toLowerCase()

  const reseau =
    err?.name === 'AuthRetryableFetchError' ||
    /network request failed|fetch failed|failed to fetch|timeout|timed out/.test(msg)
  if (reseau) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.'
  }

  if (err?.status === 429 || /rate limit|too many requests/.test(msg)) {
    return 'Trop de tentatives. Patientez une minute avant de réessayer.'
  }

  if (/email not confirmed|not confirmed/.test(msg)) {
    return "Votre compte n'est pas encore activé. Ouvrez le lien reçu par e-mail pour choisir votre mot de passe."
  }

  // Identifiants refusés. C'est le seul cas où ce texte est juste — et il
  // couvre volontairement « compte inconnu » (constat M3).
  if (/invalid login credentials|invalid credentials|user not found|invalid grant/.test(msg)) {
    return 'Adresse e-mail ou mot de passe incorrect.'
  }

  // ⚠️ Tout le reste ne doit PAS retomber sur « mot de passe incorrect ».
  // La première version le faisait : une panne de configuration ou une erreur
  // serveur s'affichait comme une faute de saisie, et on cherchait au mauvais
  // endroit (constaté le 23 août 2026, Julien ne pouvant plus se connecter).
  if (__DEV__) console.warn('[signIn] erreur non reconnue :', err?.status, err?.name, err?.message)
  return 'Connexion impossible pour le moment. Réessayez dans un instant.'
}
