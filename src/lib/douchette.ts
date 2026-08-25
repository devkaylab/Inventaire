/**
 * Douchette : remettre d'aplomb un clavier décalé.
 *
 * Une douchette Bluetooth (Zebra, Honeywell, Inateck, HID générique) ne
 * transmet pas des caractères, elle transmet des **touches** — les mêmes codes
 * qu'un clavier physique. C'est iOS qui décide ensuite quel caractère
 * produire, en suivant la disposition choisie dans Réglages › Général ›
 * Clavier › Clavier physique. Presque toutes les douchettes sortent d'usine en
 * QWERTY ; un iPhone français est en AZERTY. Les deux dispositions ne
 * partagent pas la rangée du haut : la touche « 1 » du QWERTY est la touche
 * « & » de l'AZERTY, et scanner 1234 affiche &é"'.
 *
 * ⚠️ **La disposition française d'iOS est celle du Mac, pas celle de
 * Windows.** Les deux diffèrent sur deux touches, et ce sont justement des
 * chiffres : la touche 6 donne **§** (et non « - »), la touche 8 donne **!**
 * (et non « _ »). Une table écrite d'après un clavier Windows redresse donc
 * onze chiffres sur treize et **abîme les deux autres** — constat de Julien le
 * 25 août 2026, douchette Inateck en Bluetooth : l'EAN 8809652585598 arrivait
 * en `!!ÀÇ§(É(!((Ç!` et ressortait en `//09?525/559/`, les « ! » et le « § »
 * pris pour la touche « / » du bas de clavier. La table ci-dessous est celle
 * d'iOS ; la table Windows ne sert plus qu'à l'arbitrage par clé de contrôle.
 *
 * Trois règles portent la sûreté de ce module :
 *
 * 1. **Les chiffres ne sont jamais retouchés.** Sur AZERTY ils s'obtiennent
 *    avec Majuscule, donc une saisie déjà correcte (au clavier tactile, ou
 *    avec une douchette bien réglée) traverse la fonction sans bouger.
 * 2. **La clé de contrôle d'un code-barres tranche mieux que toute
 *    heuristique.** Un EAN redressé qui tombe juste ne doit rien au hasard :
 *    c'est une preuve, et elle passe avant les indices de disposition. Elle
 *    protège aussi dans l'autre sens — un code déjà valide n'est jamais
 *    converti, même après un scan décalé.
 * 3. **Sinon, on ne convertit que si le décalage est prouvé** par un
 *    caractère qu'aucun code-barres ne contient (é, è, ç, à, ù, §, °…), ou par
 *    un code entièrement fait de la rangée du haut. Le tiret et le souligné
 *    n'entrent dans aucune table : ils s'écrivent dans de vraies références.
 */

/** Les rangées d'une douchette QWERTY, touche par touche. */
const US = '`1234567890-=qwertyuiop[]\\asdfghjkl;\'zxcvbnm,./'
const US_MAJ = '~!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:"ZXCVBNM<>?'

/** Ce que ces mêmes touches produisent sur un iPhone en français (Mac). */
const IOS_FR = '@&é"\'(§è!çà)-azertyuiop^$`qsdfghjklmùwxcvbn,;:='
const IOS_FR_MAJ = '#1234567890°_AZERTYUIOP¨*£QSDFGHJKLM%WXCVBN?./+'

/** La même chose sur un clavier français **Windows** — pour l'arbitrage seul. */
const WIN_FR = '²&é"\'(-è_çà)=azertyuiop^$*qsdfghjklmùwxcvbn,;:!'
const WIN_FR_MAJ = '~1234567890°+AZERTYUIOP¨£µQSDFGHJKLM%WXCVBN?./§'

/**
 * Ce qui s'écrit dans de vraies références, et ne sera donc jamais pris pour
 * une touche déplacée. « SKU_01 » et « REF-12 » existent ; les redresser les
 * détruirait. On y perd les deux touches les plus à droite de la rangée du
 * haut, qu'aucun code-barres n'emploie.
 */
const AMBIGUS = new Set(['-', '_'])

/**
 * @param toutGarder  vrai pour la table d'arbitrage : les ambigus y entrent
 *                    sans danger, puisque son résultat n'est retenu que s'il
 *                    porte une clé de contrôle juste.
 */
function tableDe(fr: string, frMaj: string, toutGarder = false): Map<string, string> {
  const table = new Map<string, string>()
  for (const [vu, voulu] of [
    ...[...fr].map((c, i) => [c, US[i]] as const),
    ...[...frMaj].map((c, i) => [c, US_MAJ[i]] as const),
  ]) {
    // Règle 1 : un chiffre reste un chiffre.
    if (vu >= '0' && vu <= '9') continue
    if (!toutGarder && AMBIGUS.has(vu)) continue
    if (!table.has(vu)) table.set(vu, voulu)
  }
  // Le champ de la douchette est en `autoCapitalize="characters"` : iOS rend
  // donc É plutôt que é. Sans ces entrées, la majuscule accentuée traverserait
  // le redressement sans être reconnue — et le scan resterait faux.
  for (const [vu, voulu] of [...table]) {
    const maj = vu.toUpperCase()
    if (maj !== vu && !/[a-z]/.test(vu) && !table.has(maj)) table.set(maj, voulu)
  }
  return table
}

const IOS = tableDe(IOS_FR, IOS_FR_MAJ)
const WINDOWS = tableDe(WIN_FR, WIN_FR_MAJ, true)

function convertir(texte: string, table: Map<string, string>): string {
  let out = ''
  for (const c of texte) out += table.get(c) ?? c
  return out
}

/**
 * Règle 2 : la clé de contrôle d'un code-barres (EAN-8, UPC-A, EAN-13, ITF-14).
 *
 * C'est la seule preuve sans appel de ce module : la somme pondérée d'un code
 * tiré au hasard tombe juste une fois sur dix, mais un code déformé par un
 * clavier ne fait même pas la bonne longueur. Elle rend le redressement
 * indépendant de la disposition exacte du téléphone — c'est ce qui a manqué le
 * 25 août 2026.
 */
export function gtinValide(code: string): boolean {
  if (!/^\d+$/.test(code)) return false
  if (![8, 12, 13, 14].includes(code.length)) return false
  const chiffres = [...code].map(Number)
  const cle = chiffres.pop() as number
  let somme = 0
  chiffres.reverse().forEach((c, i) => { somme += c * (i % 2 === 0 ? 3 : 1) })
  return (10 - (somme % 10)) % 10 === cle
}

/**
 * Règle 3, premier volet : les caractères qui **prouvent** le décalage. Ce
 * sont les lettres accentuées et les signes propres au clavier français : une
 * douchette transmet de l'ASCII, elle ne peut pas en produire, et aucun
 * code-barres n'en contient. Le « § » y est entré le 25 août 2026 : sur iOS
 * c'est ce que devient la touche 6.
 */
const ACCENTS = new Set(['é', 'è', 'ç', 'à', 'ù', '§', '°', '²', 'µ', '£', '¨'])
// Le champ est en `autoCapitalize="characters"` : é peut arriver en É.
for (const c of [...ACCENTS]) ACCENTS.add(c.toUpperCase())

/**
 * Règle 3, second volet : la rangée du haut au complet. Un code entièrement
 * composé de ces signes est un **nombre** déformé — un numéro de balise, un
 * EAN trop court pour porter une clé — et rien d'autre : il n'existe pas de
 * code-barres fait de « &é"'( ».
 *
 * ⚠️ C'est ce volet, et lui seul, qui rattrape les nombres dont aucun chiffre
 * ne porte d'accent une fois déformé. La balise 1 arrive en « & » : sans cette
 * règle, elle ne serait jamais redressée.
 *
 * ⚠️ Et c'est pourquoi « & » ne prouve rien **au milieu d'une référence
 * alphanumérique** : une enseigne s'appelle M&S, redresser sa référence la
 * détruirait.
 */
const RANGEE_DU_HAUT = new Set([...'&é"\'(§è!çà'])

/** Le texte porte-t-il la marque d'un clavier décalé ? */
export function clavierDecale(texte: string): boolean {
  if (!texte) return false
  for (const c of texte) if (ACCENTS.has(c)) return true
  for (const c of texte) if (!RANGEE_DU_HAUT.has(c)) return false
  return true
}

/**
 * Redresse une saisie de douchette.
 *
 * @param texte  ce que le champ a reçu
 * @param force  vrai une fois le décalage constaté sur un scan précédent. Il
 *               ne se corrigera pas tout seul en cours de comptage : c'est ce
 *               qui rattrape les codes qui ne portent aucune preuve — une
 *               référence sans chiffre, ou un nombre fait des seuls 3, 4 et 5.
 */
export function redresserSaisie(texte: string, force = false): string {
  if (!texte) return texte

  // Règle 2 : la clé de contrôle passe avant tout le reste, dans les deux
  // sens. Un code déjà valide ne se touche pas, même sous `force`.
  if (gtinValide(texte)) return texte
  for (const table of [IOS, WINDOWS]) {
    const essai = convertir(texte, table)
    if (gtinValide(essai)) return essai
  }

  // Règle 3 : à défaut de clé — un SKU, une balise, un EAN mal lu — les
  // indices de disposition, avec la table de la plateforme.
  if (!force && !clavierDecale(texte)) return texte
  return convertir(texte, IOS)
}
