import { describe, expect, it } from 'vitest'
import { buildDetailRows, buildVarianceRows, reportFilename, toCsv } from '@/lib/report'
import type { SessionDetailRow, SessionResultRow } from '@/lib/inventory'

function result(p: Partial<SessionResultRow> & { sku: string }): SessionResultRow {
  return {
    ean: null, brand: 'Nike', label: 'Article', unit_purchase_price: 10,
    theoretical_qty: 5, counted_qty: 3, status: 'validated',
    variance_units: -2, variance_value: -20,
    ...p,
  }
}

describe('buildVarianceRows', () => {
  it('produit les dix colonnes attendues, dans l’ordre de l’export mobile', () => {
    const [row] = buildVarianceRows([result({ sku: 'A', ean: '3701' })])
    expect(Object.keys(row)).toEqual([
      'SKU', 'EAN', 'Marque', 'Désignation', 'Prix achat unitaire',
      'Qté théorique', 'Qté comptée', 'Écart (unités)', 'Écart (valeur achat)', 'Statut',
    ])
  })

  it('vide la colonne SKU quand le SKU n’est qu’un repli sur l’EAN', () => {
    // Article inconnu saisi au scan : le code ne doit apparaître qu'en EAN.
    const [row] = buildVarianceRows([result({ sku: '3701', ean: '3701' })])
    expect(row.SKU).toBe('')
    expect(row.EAN).toBe('3701')
  })

  it('traduit le statut en français', () => {
    const rows = buildVarianceRows([
      result({ sku: 'A', status: 'failed' }),
      result({ sku: 'B', status: 'resolved' }),
      result({ sku: 'C', status: 'pending' }),
      result({ sku: 'D', status: 'validated' }),
    ])
    expect(rows.slice(0, 4).map(r => r.Statut))
      .toEqual(['Écart de comptage', 'Arbitré', 'En attente', 'Validé'])
  })

  it('ajoute une ligne TOTAL qui somme unités et valeur', () => {
    const rows = buildVarianceRows([
      result({ sku: 'A', variance_units: -2, variance_value: -20 }),
      result({ sku: 'B', variance_units: 5, variance_value: 50 }),
    ])
    const total = rows[rows.length - 1]
    expect(total.SKU).toBe('TOTAL')
    expect(total['Écart (unités)']).toBe(3)
    expect(total['Écart (valeur achat)']).toBe(30)
  })
})

describe('buildDetailRows', () => {
  it('porte l’identité du compteur et de l’auditeur', () => {
    const detail: SessionDetailRow[] = [{
      sku: 'A', ean: '3701', brand: 'Nike', label: 'Article',
      zone: '5372', zone_name: 'Réserve',
      counted_qty: 3, counted_by: 'Marie',
      audited: true, audited_qty: 2, audited_by: 'Paul',
    }]
    const [row] = buildDetailRows(detail)
    expect(row['Compté par']).toBe('Marie')
    expect(row['Audité par']).toBe('Paul')
    expect(row['Audité ?']).toBe('Oui')
    expect(row.Zone).toBe('5372')
    expect(row['Zone assignée à']).toBe('Réserve')
  })

  it('rend lisible une ligne auditée jamais comptée', () => {
    // Cas réintroduit par la migration 20260812000001 : counted_by est NULL.
    const [row] = buildDetailRows([{
      sku: 'A', ean: null, brand: null, label: null,
      zone: '5372', zone_name: null,
      counted_qty: 0, counted_by: null,
      audited: true, audited_qty: 1, audited_by: 'Paul',
    }])
    expect(row['Compté par']).toBe('')
    expect(row['Qté comptée']).toBe(0)
    expect(row['Audité ?']).toBe('Oui')
  })
})

describe('toCsv', () => {
  it('sépare par point-virgule — la variante qu’Excel français ouvre seul', () => {
    const csv = toCsv([{ A: '1', B: '2' }])
    expect(csv.split('\r\n')).toEqual(['A;B', '1;2'])
  })

  it('échappe guillemets, points-virgules et sauts de ligne', () => {
    const csv = toCsv([{ A: 'a;b', B: 'dit "bonjour"', C: 'ligne1\nligne2' }])
    expect(csv).toContain('"a;b"')
    expect(csv).toContain('"dit ""bonjour"""')
    expect(csv).toContain('"ligne1\nligne2"')
  })

  it('renvoie une chaîne vide sans donnée', () => {
    expect(toCsv([])).toBe('')
  })
})

describe('reportFilename', () => {
  it('nomme le fichier comme l’export mobile', () => {
    expect(reportFilename('INV-20260807-C255', 'xlsx', new Date('2026-08-12T09:00:00Z')))
      .toBe('inventaire_INV-20260807-C255_2026-08-12.xlsx')
  })
})

describe('parité CSV / Excel', () => {
  // Le CSV n'exportait que les écarts : le détail par balise disparaissait
  // silencieusement, et avec lui « Compté par » et « Audité par ». Les deux
  // formats doivent porter les mêmes tableaux et les mêmes colonnes.
  const detail: SessionDetailRow[] = [{
    sku: 'A', ean: '3701', brand: 'Nike', label: 'Article',
    zone: '5372', zone_name: 'Réserve',
    counted_qty: 3, counted_by: 'Marie',
    audited: true, audited_qty: 2, audited_by: 'Paul',
  }]

  it('le CSV du détail porte les colonnes d’identité, dans l’ordre de la feuille Excel', () => {
    const [header] = toCsv(buildDetailRows(detail)).split('\r\n')
    expect(header.split(';')).toEqual([
      'SKU', 'EAN', 'Marque', 'Désignation', 'Zone', 'Zone assignée à',
      'Qté comptée', 'Compté par', 'Audité ?', 'Qté auditée', 'Audité par',
    ])
  })

  it('les deux tableaux sérialisés couvrent écarts et détail', () => {
    const variance = toCsv(buildVarianceRows([result({ sku: 'A', ean: '3701' })]))
    const perZone = toCsv(buildDetailRows(detail))
    expect(variance).toContain('Écart (valeur achat)')
    expect(perZone).toContain('Compté par')
    expect(perZone).toContain('Marie')
  })
})
