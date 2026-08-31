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
    // Sur Android, 6 et 8 arrivent en « - » et « _ ». `redresserSaisie` les
    // laisse passer — ils s'écrivent dans de vraies références — mais le champ
    // d'une balise n'attend qu'un nombre : la question est tranchée.
    expect(redresserSaisie('&-_')).toBe('&-_')
    expect(redresserNumero('&-_')).toBe('168')
    // iOS d'abord : un iPhone n'emprunte jamais la table du PC.
    expect(redresserNumero('&§!')).toBe('168')
    expect(redresserNumero(commeIOS('1000'))).toBe('1000')
    // Un nombre déjà juste ne bouge pas, un QR de balise retombe sur l'autre.
    expect(redresserNumero('1000')).toBe('1000')
    expect(redresserNumero('SCB&M&é"')).toBe('SCB1:123')
    expect(redresserNumero('')).toBe('')
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
