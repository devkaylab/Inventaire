/**
 * Le format du QR d'une balise, et rien d'autre.
 *
 * ⚠️ **Séparé de `balises.ts` pour être TESTABLE.** Celui-ci dessine la
 * planche PDF : il importe pdf-lib, `expo-file-system` et `expo-sharing`,
 * donc il ne tourne pas sous vitest (`vitest.config.ts` s'en tient aux
 * modules sans dépendance native). Or ces trois lignes décident si une
 * étiquette scannée ouvre une zone ou part en « article inconnu » — c'est
 * exactement ce qu'il faut pouvoir éprouver sans caméra.
 *
 * `balises.ts` les réexporte : aucun appelant n'a eu à changer.
 */

// Préfixe encodé dans chaque QR de balise. Distingue une balise d'un code-barres
// article. Les balises sont un stock d'entreprise réutilisable → le QR ne contient
// que le numéro (indépendant de l'inventaire) : SCB1:<code>.
//
// ⚠️ Le site encode le même (`web/lib/balisePdf.ts`) : une balise imprimée
// depuis le site doit se scanner comme une balise imprimée depuis l'app. Un
// test du site compare les deux.
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
