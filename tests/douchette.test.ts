import { describe, expect, it } from 'vitest'
import { clavierDecale, redresserSaisie } from '@/lib/douchette'

describe('douchette — clavier décalé', () => {
  it('rend les chiffres au scan qui affichait des symboles', () => {
    // Le défaut relevé : scanner 1234 affichait &é"'.
    expect(redresserSaisie('&é"\'')).toBe('1234')
    expect(redresserSaisie('&é"\'(-è_çà')).toBe('1234567890')
  })

  it('redresse un EAN complet', () => {
    expect(redresserSaisie("\"èàé&\"'(-è_çà")).toBe('3702134567890')
  })

  it('rend le tiret et les lettres décalées d’une référence', () => {
    // SKU-123 arrive en SKU)&é" : ) pour le tiret, la rangée du haut pour
    // les chiffres. Les lettres S, K, U ne bougent pas entre les deux
    // dispositions.
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
    // Ils s'écrivent dans de vraies références : les traiter comme des
    // chiffres corromprait la saisie.
    expect(clavierDecale('ART_01')).toBe(false)
    expect(clavierDecale('SKU-123')).toBe(false)
    expect(clavierDecale('&é"')).toBe(true)
  })

  it('redresse un nombre sans accent — la balise 1 arrive en « & »', () => {
    // 1, 3, 4, 5, 6 et 8 ne portent aucun accent une fois déformés : seule la
    // rangée du haut au complet prouve le décalage.
    expect(redresserSaisie('&')).toBe('1')
    expect(redresserSaisie('"\'(')).toBe('345')
    expect(redresserSaisie('&(-_')).toBe('1568')
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

describe('douchette — majuscules accentuées', () => {
  it('redresse un scan autocapitalisé par iOS', () => {
    // Le champ est en autoCapitalize="characters" : é peut arriver en É.
    expect(redresserSaisie('&É"\'(-È_Çà')).toBe('1234567890')
    expect(clavierDecale('&É"')).toBe(true)
  })

  it('ne renvoie pas les lettres majuscules ordinaires sur la rangée du bas', () => {
    // A et Q se croisent, mais A ne doit pas hériter du redressement de « a ».
    expect(redresserSaisie('QRT&é"')).toBe('ART123')
    expect(redresserSaisie('ART&é"')).toBe('QRT123')
  })
})
