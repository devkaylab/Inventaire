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
 * Quatre règles portent la sûreté de ce module :
 *
 * 0. **La ponctuation typographique d'iOS est défaite d'abord** (voir
 *    `normaliserPonctuation`) : le champ de saisie remplace ' par ’ et " par
 *    « », donc les touches 3 et 4 arrivaient sous une forme qu'aucune table ne
 *    connaît.
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
 * ⚠️ **iOS remplace les apostrophes et les guillemets par leurs jumeaux
 * typographiques**, et c'est une substitution du champ de saisie — pas de la
 * disposition. `autoCorrect={false}` ne la désactive pas, et React Native
 * n'expose pas le réglage iOS qui le ferait. Elle frappe précisément les
 * touches **3** (« ) et **4** (') : tout code-barres contenant un 3 ou un 4
 * arrivait donc avec un caractère absent de toutes les tables, qui traversait
 * le redressement sans bouger.
 *
 * Constat de Julien le 31 août 2026, douchette sur son iPhone : le code
 * 045496428280 arrivait en `À’(’Ç§’é!é!À` et ressortait en `0’5’96’28280` —
 * dix chiffres sur douze redressés, les trois « 4 » perdus, article inconnu.
 * Le scan du 25 août (8809652585598) ne portait ni 3 ni 4 : le défaut était
 * là depuis le début, il ne s'était simplement jamais montré.
 *
 * ⚠️ La normalisation vient **avant tout le reste**, y compris avant la clé
 * de contrôle : un code ainsi maquillé n'est ni valide ni convertible.
 */
const TYPOGRAPHIQUES: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u2032': "'",
  '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u2033': '"',
  '\u00AB': '"', '\u00BB': '"',
  '\u2013': '-', '\u2014': '-', '\u2212': '-',
}

/** Défait les substitutions typographiques du champ de saisie iOS. */
export function normaliserPonctuation(texte: string): string {
  let out = ''
  for (const c of texte) out += TYPOGRAPHIQUES[c] ?? c
  return out
}

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
export function clavierDecale(brut: string): boolean {
  if (!brut) return false
  const texte = normaliserPonctuation(brut)
  for (const c of texte) if (ACCENTS.has(c)) return true
  for (const c of texte) if (!RANGEE_DU_HAUT.has(c)) return false
  return true
}

/**
 * Redresse la saisie d'un **numéro de balise**, et rien d'autre.
 *
 * ⚠️ **C'est le seul endroit où « - » et « _ » se convertissent**, et c'est
 * l'attente du champ qui l'autorise : il ne peut recevoir qu'un nombre. Sur
 * l'AZERTY de PC — celui d'**Android** — les touches 6 et 8 donnent « - » et
 * « _ », que `redresserSaisie` laisse passer parce qu'ils s'écrivent dans de
 * vraies références (SKU_01, REF-12). Ici la question ne se pose pas : si une
 * table rend un nombre là où la saisie n'en était pas un, elle a raison.
 *
 * L'ordre des tables compte : celle d'iOS d'abord, donc un iPhone n'emprunte
 * jamais celle du PC — sur iOS les touches 6 et 8 donnent « § » et « ! », que
 * la première table connaît déjà.
 *
 * Un QR de balise scanné à la douchette (`SCB1:123`) n'est pas un nombre : il
 * retombe sur `redresserSaisie`, qui sait le lire.
 */
export function redresserNumero(brut: string, force = false): string {
  const texte = normaliserPonctuation(brut)
  if (!texte || /^\d+$/.test(texte)) return texte
  for (const table of [IOS, WINDOWS]) {
    const essai = convertir(texte, table)
    if (/^\d+$/.test(essai)) return essai
  }
  return redresserSaisie(texte, force)
}

/**
 * Redresse une saisie de douchette.
 *
 * @param brut   ce que le champ a reçu, avant normalisation typographique
 * @param force  vrai une fois le décalage constaté sur un scan précédent. Il
 *               ne se corrigera pas tout seul en cours de comptage : c'est ce
 *               qui rattrape les codes qui ne portent aucune preuve — une
 *               référence sans chiffre, ou un nombre fait des seuls 3, 4 et 5.
 */
export function redresserSaisie(brut: string, force = false): string {
  if (!brut) return brut
  const texte = normaliserPonctuation(brut)

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
