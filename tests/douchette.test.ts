import { describe, expect, it } from 'vitest'
import { clavierDecale, gtinValide, normaliserPonctuation, redresserNumero, redresserSaisie } from '@/lib/douchette'

/**
 * Ce que produit une douchette QWERTY sur un iPhone réglé en français —
 * disposition **Mac**, celle d'iOS. Deux touches la séparent d'un clavier
 * Windows, et ce sont des chiffres : 6 → § (Windows : « - ») et 8 → ! (« _ »).
 */
const IOS: Record<string, string> = {
  '1': '&', '2': 'é', '3': '"', '4': "'", '5': '(',
  '6': '§', '7': 'è', '8': '!', '9': 'ç', '0': 'à',
}
const commeIOS = (n: string) => [...n].map(d => IOS[d] ?? d).join('')

describe('douchette — clavier décalé', () => {
  it('rend les chiffres au scan qui affichait des symboles', () => {
    expect(redresserSaisie('&é"\'')).toBe('1234')
    expect(redresserSaisie(commeIOS('1234567890'))).toBe('1234567890')
  })

  it('redresse l’EAN du 25 août 2026, sur la vraie disposition d’iOS', () => {
    // Constat de Julien, douchette Inateck en Bluetooth sur « Fwee » : le code
    // 8809652585598 arrivait en `!!ÀÇ§(É(!((Ç!` et ressortait en
    // `//09?525/559/` — les « ! » et le « § » pris pour la touche « / ».
    const brut = commeIOS('8809652585598')
    expect(brut).toBe('!!àç§(é(!((ç!')
    expect(redresserSaisie(brut)).toBe('8809652585598')
    // Le champ est en autoCapitalize="characters" : É, À et Ç remontent.
    expect(redresserSaisie(brut.toUpperCase())).toBe('8809652585598')
  })

  it('redresse un EAN complet', () => {
    expect(redresserSaisie(commeIOS('3702134567890'))).toBe('3702134567890')
  })

  it('rend le tiret et les lettres décalées d’une référence', () => {
    // SKU-123 arrive en SKU)&é" : ) pour le tiret, la rangée du haut pour les
    // chiffres. Les lettres S, K, U ne bougent pas entre les deux dispositions.
    expect(redresserSaisie('SKU)&é"')).toBe('SKU-123')
    // A↔Q et Z↔W, une fois le décalage prouvé par le « é ».
    expect(redresserSaisie('QRT&é"')).toBe('ART123')
    expect(redresserSaisie('ZQ&é"')).toBe('WA123')
  })

  it('redresse le deux-points d’un QR de balise', () => {
    expect(redresserSaisie('SCB&M&é"')).toBe('SCB1:123')
  })

  it('ne touche jamais à une saisie déjà correcte', () => {
    for (const code of ['3701234567890', 'SKU-123', 'ART_01', 'ABC123', '0000']) {
      expect(redresserSaisie(code)).toBe(code)
    }
  })

  it('ne prend ni le tiret ni le souligné pour une preuve', () => {
    // Ils s'écrivent dans de vraies références : les traiter comme des touches
    // déplacées corromprait la saisie. Ils ne sont dans aucune table.
    expect(clavierDecale('ART_01')).toBe(false)
    expect(clavierDecale('SKU-123')).toBe(false)
    expect(redresserSaisie('SKU_01', true)).toBe('SKU_01')
    expect(redresserSaisie('REF-12', true)).toBe('REF-12')
    expect(clavierDecale('&é"')).toBe(true)
  })

  it('redresse un nombre sans accent — la balise 1 arrive en « & »', () => {
    // 1, 3, 4 et 5 ne portent aucun accent une fois déformés : seule la rangée
    // du haut au complet prouve le décalage.
    expect(redresserSaisie('&')).toBe('1')
    expect(redresserSaisie('"\'(')).toBe('345')
    expect(redresserSaisie(commeIOS('1568'))).toBe('1568')
  })

  it('ne redresse pas une référence alphanumérique sur un simple « & »', () => {
    // M&S existe ; redresser sa référence la détruirait. Il faut un accent,
    // ou un nombre entier de la rangée du haut.
    expect(clavierDecale('M&S-001')).toBe(false)
    expect(redresserSaisie('M&S-001')).toBe('M&S-001')
    expect(clavierDecale("L'OREAL-12")).toBe(false)
  })

  it('ne prend pas un tiret isolé pour un chiffre', () => {
    expect(clavierDecale('-')).toBe(false)
    expect(clavierDecale('---')).toBe(false)
    expect(redresserSaisie('-')).toBe('-')
  })

  it('rattrape un code sans preuve une fois le décalage constaté', () => {
    // « ABC » ne porte aucune marque ; seul le scan précédent l'a révélé.
    expect(redresserSaisie('QBC')).toBe('QBC')
    expect(redresserSaisie('QBC', true)).toBe('ABC')
    // Et forcer ne casse pas les chiffres.
    expect(redresserSaisie('3701234567890', true)).toBe('3701234567890')
  })

  it('laisse passer une chaîne vide', () => {
    expect(redresserSaisie('')).toBe('')
  })
})

describe('douchette — la clé de contrôle tranche', () => {
  // C'est la seule preuve sans appel du module, et elle rend le redressement
  // indépendant de la disposition exacte du téléphone : ce qui a manqué le
  // 25 août 2026, où une table écrite d'après un clavier Windows abîmait deux
  // chiffres sur treize.
  it('reconnaît les longueurs et les clés des codes-barres', () => {
    expect(gtinValide('8809652585598')).toBe(true)   // EAN-13, le vrai scan
    expect(gtinValide('4006381333931')).toBe(true)   // EAN-13
    expect(gtinValide('96385074')).toBe(true)        // EAN-8
    expect(gtinValide('036000291452')).toBe(true)    // UPC-A
    expect(gtinValide('8809652585597')).toBe(false)  // clé fausse
    expect(gtinValide('880965258559')).toBe(false)   // douze chiffres, clé fausse
    expect(gtinValide('12345')).toBe(false)          // longueur hors norme
    expect(gtinValide('SKU-123')).toBe(false)
    expect(gtinValide('')).toBe(false)
  })

  it('redresse un code valide même sans accent ni rangée du haut', () => {
    // 4006381333931 → seuls des chiffres sans accent : aucune preuve de
    // disposition. La clé, elle, tombe juste.
    const brut = commeIOS('4006381333931')
    expect(clavierDecale(brut)).toBe(true) // rangée du haut au complet
    expect(redresserSaisie(brut)).toBe('4006381333931')
  })

  it('protège un code déjà valide, même le décalage constaté', () => {
    // Une douchette bien réglée au milieu d'un comptage décalé : le drapeau
    // `force` ne doit pas abîmer ce qui est juste.
    expect(redresserSaisie('8809652585598', true)).toBe('8809652585598')
  })


  it('défait la ponctuation typographique d’iOS — le scan du 31 août 2026', () => {
    // Le champ de saisie remplace ' par ’ et " par « » : la substitution
    // frappe les touches 4 et 3, donc tout code portant un 3 ou un 4. Le code
    // 045496428280 arrivait en `À’(’Ç§’é!é!À` et ressortait en `0’5’96’28280`
    // — dix chiffres sur douze, article inconnu.
    const brut = 'À\u2019(\u2019Ç§\u2019é!é!À'
    expect(redresserSaisie(brut)).toBe('045496428280')
    expect(gtinValide('045496428280')).toBe(true)
  })

  it('normalise les quatre substitutions, guillemets français compris', () => {
    expect(normaliserPonctuation('\u2018\u2019\u201C\u201D\u00AB\u00BB')).toBe('\'\'""""')
    // La touche 3 arrive en « ou » selon la position dans la saisie.
    expect(redresserSaisie('&é\u00BB\u2019')).toBe('1234')
    expect(redresserSaisie('&é\u201D\u2019')).toBe('1234')
    // Et la marque du décalage se lit sur le texte normalisé.
    expect(clavierDecale('&é\u00BB\u2019')).toBe(true)
  })


  it('le numéro de balise se redresse aussi sur l’AZERTY de PC (Android)', () => {
    // Sur Android, 6 et 8 arrivent en « - » et « _ ». Un code fait de la
    // SEULE rangée du haut est un nombre : les deux fonctions le redressent.
    expect(redresserSaisie('&-_')).toBe('168')
    expect(redresserNumero('&-_')).toBe('168')
    // Mais dès qu'une lettre entre, ce sont de vraies références : on n'y
    // touche pas, et c'est là que `redresserNumero` seul tranche.
    expect(redresserSaisie('REF-12')).toBe('REF-12')
    expect(redresserSaisie('SKU_01', true)).toBe('SKU_01')
    expect(redresserSaisie('-')).toBe('-')
    expect(redresserNumero('-_')).toBe('68')
    // iOS d'abord : un iPhone n'emprunte jamais la table du PC.
    expect(redresserNumero('&§!')).toBe('168')
    expect(redresserNumero(commeIOS('1000'))).toBe('1000')
    // Un nombre déjà juste ne bouge pas, un QR de balise retombe sur l'autre.
    expect(redresserNumero('1000')).toBe('1000')
    expect(redresserNumero('SCB&M&é"')).toBe('SCB1:123')
    expect(redresserNumero('')).toBe('')
  })


  it('retire l’espace qu’iOS pose avec les guillemets — le scan du 31 août 2026', () => {
    // Le code-barres 5056635611789 (Blu-ray, PM Studios) arrivait en
    // « 50566 35611789 » : les treize chiffres justes, plus une espace juste
    // avant le « 3 ». iOS avait maquillé la touche 3 en guillemet fermant, et
    // la typographie française lui colle une espace insécable.
    const brut = '(à(§§\u202F»(§&&è!ç'
    expect(redresserSaisie(brut)).toBe('5056635611789')
    expect(gtinValide('5056635611789')).toBe(true)
    // Espace insécable ordinaire, et guillemet ouvrant (l'espace suit).
    expect(redresserSaisie('(à(§§\u00A0»(§&&è!ç')).toBe('5056635611789')
    expect(redresserSaisie('(à(§§«\u00A0(§&&è!ç')).toBe('5056635611789')
  })

  it('mais une espace ordinaire reste dans une désignation', () => {
    // Elle ne part que collée à un guillemet qu'on convertit — même arbitrage
    // que « - » et « _ » : on ne touche qu'à ce dont on est sûr.
    expect(normaliserPonctuation('REF 001')).toBe('REF 001')
    expect(normaliserPonctuation('A B C')).toBe('A B C')
    expect(normaliserPonctuation('A \u00BB B')).toBe('A" B')
  })

  it('rattrape aussi un clavier français Windows', () => {
    // Un Android, ou un iPhone d'une autre génération : 6 arrive en « - » et
    // 8 en « _ ». Ces deux signes ne sont dans aucune table — c'est la clé,
    // et elle seule, qui autorise la conversion.
    const win: Record<string, string> = {
      '1': '&', '2': 'é', '3': '"', '4': "'", '5': '(',
      '6': '-', '7': 'è', '8': '_', '9': 'ç', '0': 'à',
    }
    const brut = [...'8809652585598'].map(d => win[d]).join('')
    expect(brut).toBe('__àç-(é(_((ç_')
    expect(redresserSaisie(brut)).toBe('8809652585598')
  })
})

/**
 * Balayage : « est-ce que la douchette lit TOUS les EAN ? »
 *
 * Question de Julien, le 31 août 2026. Trois défauts avaient été trouvés un par
 * un, chaque fois avec le code-barres qu'il avait sous la main — et chaque fois
 * le code d'essai suivant révélait le défaut que le précédent ne pouvait pas
 * montrer (8809652585598 n'a ni 3 ni 4 ; 045496428280 n'a pas de 3). On ne
 * répond donc plus par un exemple : on passe **les dix chiffres à tous les
 * rangs**, sur les deux dispositions, sous toutes les ponctuations connues.
 */
const CLAVIER_IOS: Record<string, string> =
  { '0': 'à', '1': '&', '2': 'é', '3': '"', '4': "'", '5': '(', '6': '§', '7': 'è', '8': '!', '9': 'ç' }
/** L'AZERTY de PC — Android : 6 et 8 y donnent « - » et « _ ». */
const CLAVIER_PC: Record<string, string> = { ...CLAVIER_IOS, '6': '-', '8': '_' }

/** Les substitutions qu'iOS peut appliquer, dans les deux sens de guillemet. */
const PONCTUATIONS: ((c: string) => string)[] = [
  c => c,
  c => (c === '"' ? '\u202F\u00BB' : c === "'" ? '\u2019' : c),  // fermant, insécable étroite
  c => (c === '"' ? '\u00A0\u00BB' : c === "'" ? '\u2019' : c),  // fermant, insécable
  c => (c === '"' ? ' \u00BB' : c === "'" ? '\u2019' : c),        // fermant, espace ordinaire
  c => (c === '"' ? '\u00AB\u202F' : c === "'" ? '\u2018' : c),  // ouvrant
  c => (c === '"' ? '\u00AB ' : c === "'" ? '\u2018' : c),
]

function cleGtin(sansCle: string): string {
  const d = [...sansCle].map(Number).reverse()
  let somme = 0
  d.forEach((c, i) => { somme += c * (i % 2 === 0 ? 3 : 1) })
  return String((10 - (somme % 10)) % 10)
}
const frappe = (code: string, clavier: Record<string, string>, p: (c: string) => string) =>
  [...code].map(d => p(clavier[d])).join('')

/** Chaque chiffre à chaque rang d'un EAN-13, plus les cent couples. */
const CODES: string[] = []
for (let rang = 0; rang < 12; rang++) {
  for (let d = 0; d <= 9; d++) {
    const base = [...'701234567890']
    base[rang] = String(d)
    const douze = base.join('')
    CODES.push(douze + cleGtin(douze))
  }
}
for (let a = 0; a <= 9; a++) {
  for (let b = 0; b <= 9; b++) {
    const douze = `${a}${b}`.repeat(6)
    CODES.push(douze + cleGtin(douze))
  }
}

describe('douchette — tous les chiffres, à tous les rangs', () => {
  it('iOS : les 220 codes reviennent justes, quelle que soit la ponctuation', () => {
    const echecs: string[] = []
    for (const code of CODES) {
      expect(gtinValide(code)).toBe(true)
      for (const [n, p] of PONCTUATIONS.entries()) {
        const sortie = redresserSaisie(frappe(code, CLAVIER_IOS, p))
        if (sortie !== code) echecs.push(`ponctuation ${n} · ${code} → ${sortie}`)
      }
    }
    expect(echecs.slice(0, 5)).toEqual([])
  })

  it('Android : les mêmes codes sur l’AZERTY de PC', () => {
    const echecs: string[] = []
    for (const code of CODES) {
      const sortie = redresserSaisie(frappe(code, CLAVIER_PC, c => c))
      if (sortie !== code) echecs.push(`${code} → ${sortie}`)
    }
    expect(echecs.slice(0, 5)).toEqual([])
  })

  it('les quatre longueurs normalisées, des deux côtés', () => {
    // EAN-8, UPC-A, EAN-13, ITF-14.
    for (const code of ['96385074', '045496428280', '5056635611789', '10614141543219']) {
      expect(gtinValide(code)).toBe(true)
      for (const clavier of [CLAVIER_IOS, CLAVIER_PC]) {
        expect(redresserSaisie(frappe(code, clavier, c => c))).toBe(code)
      }
    }
  })

  it('et les nombres SANS clé de contrôle : code interne, clé fausse', () => {
    // Une étiquette maison, un complément EAN-5, un code interne : aucune clé
    // ne les arbitre. C'est la rangée du haut, tirets compris, qui tranche.
    for (const code of ['2000068', '5056635611788', '00068', '12345']) {
      for (const clavier of [CLAVIER_IOS, CLAVIER_PC]) {
        expect(redresserSaisie(frappe(code, clavier, c => c))).toBe(code)
      }
    }
  })

  it('⚠️ la limite qui reste : sur Android, un nombre fait des SEULS 6 et 8', () => {
    // « 68 » arrive en « -_ », et ces deux signes s'écrivent dans de vraies
    // références (SKU_01, REF-12) : sans un autre chiffre pour prouver le
    // décalage, on ne touche à rien. Il faudrait un code sans clé de contrôle
    // composé uniquement de 6 et de 8 — aucune longueur normalisée ne le
    // permet, la clé les arbitre toutes.
    expect(redresserSaisie(frappe('68', CLAVIER_PC, c => c))).toBe('-_')
    // Le champ d'une balise, lui, n'attend qu'un nombre : il tranche.
    expect(redresserNumero(frappe('68', CLAVIER_PC, c => c))).toBe('68')
    // Et sur iOS la question ne se pose pas : § et ! n'ont aucun autre sens.
    expect(redresserSaisie(frappe('68', CLAVIER_IOS, c => c))).toBe('68')
  })

  it('un code déjà juste n’est jamais abîmé, même le décalage constaté', () => {
    for (const code of CODES) expect(redresserSaisie(code, true)).toBe(code)
  })
})
