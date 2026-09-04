import { describe, expect, it } from 'vitest'
import { fmtQty, fmtSigned, money, moneyCourt, nb, parseDecimal, plural, relativeTime, sinceDuration } from '@/lib/format'

describe('parseDecimal', () => {
  it('accepte la virgule décimale française', () => {
    // Le bug d'origine : parseFloat('1,5') vaut 1, et l'arbitrage d'un écart
    // partait silencieusement avec la mauvaise quantité.
    expect(parseDecimal('1,5')).toBe(1.5)
    expect(parseDecimal('12,750')).toBe(12.75)
  })

  it('accepte le point décimal', () => {
    expect(parseDecimal('1.5')).toBe(1.5)
    expect(parseDecimal('42')).toBe(42)
  })

  it('tolère les espaces', () => {
    expect(parseDecimal('  3,5 ')).toBe(3.5)
    expect(parseDecimal('1 5')).toBe(15)
  })

  it('refuse ce qui n’est pas un nombre plutôt que de deviner', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
    expect(parseDecimal('1..2')).toBeNull()
    expect(parseDecimal('12 pièces')).toBeNull()
  })

  it('lit les valeurs négatives (corrections de comptage)', () => {
    expect(parseDecimal('-2')).toBe(-2)
    expect(parseDecimal('-1,5')).toBe(-1.5)
  })
})

describe('fmtQty', () => {
  it('affiche les entiers sans décimale', () => {
    expect(fmtQty(4)).toBe('4')
    expect(fmtQty(0)).toBe('0')
  })

  it('supprime les zéros inutiles et utilise la virgule', () => {
    expect(fmtQty(1.5)).toBe('1,5')
    expect(fmtQty(1.25)).toBe('1,25')
  })

  it('encaisse les valeurs non finies', () => {
    expect(fmtQty(NaN)).toBe('0')
  })
})

describe('fmtSigned', () => {
  it('marque explicitement les écarts positifs', () => {
    expect(fmtSigned(3)).toBe('+3')
    expect(fmtSigned(-3)).toBe('-3')
    expect(fmtSigned(0)).toBe('0')
  })
})

describe('money', () => {
  it('formate en français avec deux décimales', () => {
    expect(money(1234.5).replace(/ | /g, ' ')).toBe('1 234,50')
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-08-12T12:00:00Z')
  const ago = (ms: number) => new Date(now - ms).toISOString()

  it('décrit la fraîcheur d’une information', () => {
    expect(relativeTime(ago(3_000), now)).toBe("à l'instant")
    expect(relativeTime(ago(45_000), now)).toBe('il y a 45 s')
    expect(relativeTime(ago(5 * 60_000), now)).toBe('il y a 5 min')
    expect(relativeTime(ago(3 * 3600_000), now)).toBe('il y a 3 h')
    expect(relativeTime(ago(26 * 3600_000), now)).toBe('hier')
  })

  it('gère l’absence de date', () => {
    expect(relativeTime(null, now)).toBe('jamais')
  })
})

describe('sinceDuration', () => {
  it('formule une durée en cours', () => {
    expect(sinceDuration(30_000)).toBe('depuis moins d’une minute')
    expect(sinceDuration(4 * 60_000)).toBe('depuis 4 min')
    expect(sinceDuration(2 * 3600_000)).toBe('depuis 2 h')
  })
})

/**
 * Les montants abrégés du tableau de bord (3 septembre 2026, demande de
 * Julien : « affiche les valeurs en k€ quand supérieur ou égal à 1000, avec
 * détail réel dans une bulle quand la souris passe au-dessus, pas pour le
 * nombre de pièces »).
 */
describe('moneyCourt', () => {
  /**
   * ⚠️ `toLocaleString('fr-FR')` sépare les milliers par une espace
   * INSÉCABLE ÉTROITE (U+202F), pas par une espace ordinaire. Comparer à une
   * chaîne tapée au clavier échoue avec un message où les deux valeurs
   * paraissent identiques.
   */
  const lisible = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ')

  it('garde les centimes sous mille euros', () => {
    // C'est là qu'ils se lisent encore ; « 0,9 k€ » perdrait de l'information
    // sans rien gagner en place.
    expect(moneyCourt(0)).toBe('0,00 €')
    expect(moneyCourt(12.5)).toBe('12,50 €')
    expect(moneyCourt(999.99)).toBe('999,99 €')
  })

  it('passe en k€ à partir de mille, avec une décimale', () => {
    expect(moneyCourt(1000)).toBe('1 k€')
    expect(moneyCourt(1234)).toBe('1,2 k€')
    expect(moneyCourt(12750)).toBe('12,8 k€')
  })

  it('⚠️ retire la décimale au-delà de cent mille', () => {
    // « 450 k€ » se lit mieux que « 450,3 k€ », et la précision perdue est du
    // bruit à cette échelle.
    expect(lisible(moneyCourt(450300))).toBe('450 k€')
    expect(lisible(moneyCourt(19047500))).toBe('19 048 k€')
  })

  it('le signe survit à l’abréviation', () => {
    // Un écart négatif abrégé en positif dirait exactement le contraire.
    expect(moneyCourt(-12750)).toBe('-12,8 k€')
    expect(lisible(moneyCourt(-450300))).toBe('-450 k€')
  })

  it('un zéro négatif reste un zéro', () => {
    expect(moneyCourt(-0)).toBe('0,00 €')
    expect(moneyCourt(Number.NaN)).toBe('0,00 €')
  })
})

/**
 * Le séparateur de milliers (3 septembre 2026, demande de Julien :
 * « 1000 > 1 000, plus facile à lire »).
 *
 * ⚠️ Ce n'est pas un ornement : la colonne des quantités d'un inventaire
 * porte des nombres à cinq ou six chiffres, et « 128400 » ressemble à
 * « 12840 » au coup d'œil — à l'endroit précis où l'on cherche un écart.
 */
describe('le séparateur de milliers', () => {
  const lisible = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ')

  it('groupe les quantités', () => {
    expect(lisible(fmtQty(1000))).toBe('1 000')
    expect(lisible(fmtQty(128400))).toBe('128 400')
    expect(lisible(fmtQty(1500.5))).toBe('1 500,5')
  })

  it('groupe les écarts signés, sans perdre le signe', () => {
    expect(lisible(fmtSigned(12840))).toBe('+12 840')
    expect(lisible(fmtSigned(-12840))).toBe('-12 840')
  })

  it('groupe les décomptes énoncés', () => {
    expect(lisible(plural(1200, 'balise'))).toBe('1 200 balises')
    expect(lisible(nb(400000))).toBe('400 000')
  })

  it('⚠️ ne change rien sous mille, ni aux décimales', () => {
    // La règle ne doit pas devenir une refonte du formatage : ce qui se
    // lisait bien se lit pareil.
    expect(fmtQty(4)).toBe('4')
    expect(fmtQty(1.5)).toBe('1,5')
    expect(fmtQty(999)).toBe('999')
    expect(fmtQty(-0)).toBe('0')
  })
})
