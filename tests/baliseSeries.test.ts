import { describe, expect, it } from 'vitest'
import { BALISE_FORMATS, MAX_BALISES_PER_SHEET, planBaliseSeries } from '@/lib/baliseSeries'

describe('planBaliseSeries', () => {
  it('propose trois formats : simples, 4 chiffres, 5 chiffres', () => {
    expect(BALISE_FORMATS.map((f) => f.id)).toEqual(['simple', 'four', 'five'])
    expect(BALISE_FORMATS.map((f) => f.defaultStart)).toEqual([1, 1000, 10000])
  })

  it('calcule la série 1 à 10', () => {
    const r = planBaliseSeries('simple', '1', '10')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.series.from).toBe(1)
      expect(r.series.to).toBe(10)
      expect(r.series.codes).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    }
  })

  it('calcule une série à 4 chiffres en partant de 1000', () => {
    const r = planBaliseSeries('four', '1000', '3')
    expect(r).toEqual({ ok: true, series: { from: 1000, to: 1002, codes: ['1000', '1001', '1002'] } })
  })

  it('accepte un départ libre dans le format (reprise d’une série)', () => {
    const r = planBaliseSeries('five', '10500', '2')
    expect(r.ok && r.series.codes).toEqual(['10500', '10501'])
  })

  it('refuse un départ hors du format', () => {
    expect(planBaliseSeries('four', '999', '1')).toMatchObject({ ok: false })
    expect(planBaliseSeries('four', '10000', '1')).toMatchObject({ ok: false })
    expect(planBaliseSeries('simple', '0', '1')).toMatchObject({ ok: false })
  })

  it('refuse une série qui déborderait du format, en disant ce qui reste possible', () => {
    const r = planBaliseSeries('four', '9990', '20')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('10 balises')
  })

  it('refuse les saisies vides ou non numériques', () => {
    expect(planBaliseSeries('simple', '', '10')).toMatchObject({ ok: false })
    expect(planBaliseSeries('simple', 'abc', '10')).toMatchObject({ ok: false })
    expect(planBaliseSeries('simple', '1', '')).toMatchObject({ ok: false })
    expect(planBaliseSeries('simple', '1', '0')).toMatchObject({ ok: false })
    expect(planBaliseSeries('simple', '1', '2.5')).toMatchObject({ ok: false })
  })

  it('plafonne le nombre par planche', () => {
    expect(planBaliseSeries('five', '10000', String(MAX_BALISES_PER_SHEET))).toMatchObject({ ok: true })
    expect(planBaliseSeries('five', '10000', String(MAX_BALISES_PER_SHEET + 1))).toMatchObject({ ok: false })
  })
})
