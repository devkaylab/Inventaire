/**
 * Douchette : remettre d'aplomb un clavier décalé.
 *
 * Une douchette Bluetooth (Zebra, Honeywell, HID générique) ne transmet pas
 * des caractères, elle transmet des **touches** — les mêmes codes qu'un
 * clavier physique. C'est iOS qui décide ensuite quel caractère produire, en
 * suivant la disposition choisie dans Réglages › Général › Clavier › Clavier
 * physique. Presque toutes les douchettes sortent d'usine en QWERTY ; un
 * iPhone français est en AZERTY. Les deux dispositions ne partagent pas la
 * rangée du haut : la touche « 1 » du QWERTY est la touche « & » de l'AZERTY.
 *
 * Résultat, scanner 1234 affiche &é"' — c'est le défaut relevé par Julien.
 * Les lettres sont touchées aussi (A↔Q, Z↔W, M↔virgule) et le tiret d'un
 * SKU arrive en « ) ».
 *
 * On rétablit donc le texte en le repassant par la disposition inverse.
 *
 * ⚠️ Deux règles portent toute la sûreté de ce module :
 *
 * 1. **Les chiffres ne sont jamais retouchés.** Sur AZERTY ils s'obtiennent
 *    avec Majuscule, donc une saisie déjà correcte (au clavier tactile, ou
 *    avec une douchette bien réglée) traverse la fonction sans bouger. Sans
 *    cette exclusion, on casserait ce qui marche.
 * 2. **On ne convertit que si le décalage est prouvé**, par la présence d'un
 *    caractère qu'aucun code-barres ne contient (é, è, ç, à, ù, ², &, ", ').
 *    Un « - » ou un « _ » ne prouve rien : ils existent pour de vrai dans les
 *    références, et les prendre pour des chiffres corromprait la saisie.
 */

// Les deux rangées, touche par touche, dans le même ordre.
const QWERTY = '`1234567890-=qwertyuiop[]asdfghjkl;\'\\zxcvbnm,./'
const AZERTY = '²&é"\'(-è_çà)=azertyuiop^$qsdfghjklmù*wxcvbn,;:!'

const QWERTY_MAJ = '!@#$%^&*()_+QWERTYUIOP{}ASDFGHJKL:"|ZXCVBNM<>?'
const AZERTY_MAJ = '1234567890°+AZERTYUIOP¨£QSDFGHJKLM%µWXCVBN?./§'

/** Ce qui s'affiche (AZERTY) → ce que la douchette voulait envoyer (QWERTY). */
const REDRESSEMENT = new Map<string, string>()
for (const [vu, voulu] of [
  ...[...AZERTY].map((c, i) => [c, QWERTY[i]] as const),
  ...[...AZERTY_MAJ].map((c, i) => [c, QWERTY_MAJ[i]] as const),
]) {
  // Règle 1 : un chiffre reste un chiffre.
  if (vu >= '0' && vu <= '9') continue
  if (!REDRESSEMENT.has(vu)) REDRESSEMENT.set(vu, voulu)
}

// Le champ de la douchette est en `autoCapitalize="characters"` : iOS peut
// donc rendre É plutôt que é. Sans ces entrées, la majuscule accentuée
// traverserait le redressement sans être reconnue — et le scan resterait faux.
for (const [vu, voulu] of [...REDRESSEMENT]) {
  const maj = vu.toUpperCase()
  if (maj !== vu && !/[a-z]/.test(vu) && !REDRESSEMENT.has(maj)) REDRESSEMENT.set(maj, voulu)
}

/**
 * Règle 2, premier volet : les caractères qui **prouvent** le décalage. Ce
 * sont les lettres accentuées et les signes propres au clavier français : une
 * douchette transmet de l'ASCII, elle ne peut pas en produire, et aucun
 * code-barres n'en contient. La preuve est sans appel.
 */
const ACCENTS = new Set(['é', 'è', 'ç', 'à', 'ù', '²', '°', '§', 'µ', '£', '¨'])
// Le champ est en `autoCapitalize="characters"` : é peut arriver en É.
for (const c of [...ACCENTS]) ACCENTS.add(c.toUpperCase())

/**
 * Règle 2, second volet : la rangée du haut au complet. Un code entièrement
 * composé de ces signes est un **nombre** déformé — un numéro de balise, un
 * EAN — et rien d'autre : il n'existe pas de code-barres fait de « &é"'( ».
 *
 * ⚠️ C'est ce volet, et lui seul, qui rattrape les nombres sans 2, 7, 9 ni 0,
 * les seuls chiffres à porter un accent une fois déformés. La balise 1 arrive
 * en « & » : sans cette règle, elle ne serait jamais redressée.
 *
 * ⚠️ Et c'est pourquoi « & » ne prouve rien **au milieu d'une référence
 * alphanumérique** : une enseigne s'appelle M&S, redresser sa référence la
 * détruirait. Le tiret est dans la rangée pour la raison inverse — il s'écrit
 * dans de vraies références, il ne prouve donc rien à lui seul.
 */
const RANGEE_DU_HAUT = new Set([...'&é"\'(-è_çà'])

/** Le texte porte-t-il la marque d'un clavier décalé ? */
export function clavierDecale(texte: string): boolean {
  if (!texte) return false
  for (const c of texte) if (ACCENTS.has(c)) return true
  let horsTiret = false
  for (const c of texte) {
    if (!RANGEE_DU_HAUT.has(c)) return false
    if (c !== '-') horsTiret = true
  }
  return horsTiret
}

/**
 * Redresse une saisie de douchette.
 *
 * @param texte  ce que le champ a reçu
 * @param force  vrai une fois le décalage constaté sur un scan précédent. Il
 *               ne se corrigera pas tout seul en cours de comptage : c'est ce
 *               qui rattrape les codes qui ne portent aucune preuve — une
 *               référence sans chiffre, ou un nombre fait des seuls 3, 4, 5,
 *               6 et 8.
 */
export function redresserSaisie(texte: string, force = false): string {
  if (!texte) return texte
  if (!force && !clavierDecale(texte)) return texte
  let out = ''
  for (const c of texte) out += REDRESSEMENT.get(c) ?? c
  return out
}
