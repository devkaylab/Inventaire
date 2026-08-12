import { describe, expect, it } from 'vitest'
import { fmtQty, fmtSigned, money, parseDecimal, relativeTime, sinceDuration } from '@/lib/format'

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
