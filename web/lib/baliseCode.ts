/**
 * Le format du QR d'une balise, et rien d'autre.
 *
 * ⚠️⚠️ **CE FICHIER EXISTE EN DEUX EXEMPLAIRES IDENTIQUES**, `src/lib/` pour
 * l'app et `web/lib/` pour le site — comme `baliseSeries.ts` et
 * `baliseDessin.ts`. Ces trois lignes décident si une étiquette scannée ouvre
 * une zone ou part en « article inconnu » : les deux côtés doivent encoder le
 * même préfixe. `web/tests/balises.test.ts` compare les deux textes.
 *
 * ⚠️ **Séparé du dessin pour être TESTABLE.** `balises.ts`, côté app, importe
 * `expo-file-system` et `expo-sharing` : il ne tourne pas sous vitest. Celui-ci
 * n'importe rien. Il est réexporté par les deux, donc aucun appelant n'a à
 * savoir où il habite.
 */

// Préfixe encodé dans chaque QR de balise. Distingue une balise d'un code-barres
// article. Les balises sont un stock d'entreprise réutilisable → le QR ne contient
// que le numéro (indépendant de l'inventaire) : SCB1:<code>.
export const BALISE_PREFIX = 'SCB1'

/** Charge utile du QR d'une balise : SCB1:<code>. */
export function balisePayload(code: string): string {
  return `${BALISE_PREFIX}:${code}`
}

/** Analyse un code scanné : est-ce une balise ? Renvoie son numéro, sinon null. */
export function parseBalise(raw: string): { code: string } | null {
  const parts = (raw ?? '').trim().split(':')
  if (parts[0] !== BALISE_PREFIX) return null
  const code = parts.slice(1).join(':').trim()
  return code ? { code } : null
}
