import { describe, expect, it } from 'vitest'
import {
  classify, computeDiscrepancies, groupDiscrepancies, resolvedLines, summarize,
} from '@/lib/discrepancies'
import type { ArticleAudit, ArticleLabel } from '@/lib/inventory'

function audit(p: Partial<ArticleAudit> & { sku: string }): ArticleAudit {
  return {
    id: `id-${p.sku}-${p.zone ?? ''}`,
    session_id: 's',
    zone: '',
    qty_pass1: null,
    qty_pass2: null,
    qty_pass3: null,
    final_qty: null,
    status: 'pending',
    resolved_by: null,
    updated_at: '2026-08-12T10:00:00Z',
    ...p,
  }
}

const labels: Record<string, ArticleLabel> = {
  A: { label: 'Article A', brand: 'Nike', ean: '1', price: 10 },
}

describe('classify', () => {
  it('distingue les trois natures d’écart', () => {
    expect(classify(4, 1)).toBe('quantity')
    expect(classify(4, 0)).toBe('missing-audit')
    expect(classify(0, 1)).toBe('missing-count')
  })
})

describe('computeDiscrepancies — la règle de comparaison', () => {
  it('calcule l’écart du point de vue de l’auditeur', () => {
    const rows = computeDiscrepancies(
      [audit({ sku: 'A', zone: '5371', qty_pass1: 4, qty_pass2: 1 })],
      labels, new Set(['5371']),
    )
    expect(rows).toHaveLength(1)
    // Auditeur (1) − compteur (4) = −3 : il en manque trois par rapport au comptage.
    expect(rows[0].ecart).toBe(-3)
    expect(rows[0].ecartValue).toBe(-30)
    expect(rows[0].kind).toBe('quantity')
  })

  it('ne compare que dans une balise dont l’audit est terminé', () => {
    // Sinon chaque article que l'auditeur n'a pas encore repassé ressortirait
    // à « −compté » : le tableau se remplirait de faux écarts pendant l'audit.
    const line = [audit({ sku: 'A', zone: '5371', qty_pass1: 4, qty_pass2: null })]
    expect(computeDiscrepancies(line, labels, new Set())).toHaveLength(0)
    expect(computeDiscrepancies(line, labels, new Set(['5371']))).toHaveLength(1)
  })

  it('en mode classique, compare dès qu’une quantité d’audit existe', () => {
    expect(computeDiscrepancies(
      [audit({ sku: 'A', zone: '', qty_pass1: 4, qty_pass2: 1 })], labels, new Set(),
    )).toHaveLength(1)

    expect(computeDiscrepancies(
      [audit({ sku: 'A', zone: '', qty_pass1: 4, qty_pass2: null })], labels, new Set(),
    )).toHaveLength(0)
  })

  it('fait remonter un article trouvé à l’audit et jamais compté', () => {
    // C'est le cas que get_session_detail perdait avant la migration
    // 20260812000001, et le plus parlant pour un superviseur.
    const rows = computeDiscrepancies(
      [audit({ sku: 'A', zone: '5372', qty_pass1: null, qty_pass2: 1 })],
      labels, new Set(['5372']),
    )
    expect(rows[0].kind).toBe('missing-count')
    expect(rows[0].ecart).toBe(1)
  })

  it('écarte les lignes concordantes et les lignes déjà arbitrées', () => {
    expect(computeDiscrepancies(
      [audit({ sku: 'A', zone: '5371', qty_pass1: 3, qty_pass2: 3 })], labels, new Set(['5371']),
    )).toHaveLength(0)

    expect(computeDiscrepancies(
      [audit({ sku: 'A', zone: '5371', qty_pass1: 4, qty_pass2: 1, status: 'resolved', final_qty: 4 })],
      labels, new Set(['5371']),
    )).toHaveLength(0)
  })

  it('vaut 0 en valeur quand aucun prix d’achat n’a été importé', () => {
    const rows = computeDiscrepancies(
      [audit({ sku: 'INCONNU', zone: '5371', qty_pass1: 4, qty_pass2: 1 })], {}, new Set(['5371']),
    )
    expect(rows[0].ecartValue).toBe(0)
  })

  it('donne une clé distincte au même article dans deux balises', () => {
    const rows = computeDiscrepancies([
      audit({ sku: 'A', zone: '5371', qty_pass1: 4, qty_pass2: 1 }),
      audit({ sku: 'A', zone: '5372', qty_pass1: 2, qty_pass2: 1 }),
    ], labels, new Set(['5371', '5372']))
    expect(new Set(rows.map(r => r.key)).size).toBe(2)
  })
})

describe('groupDiscrepancies', () => {
  it('regroupe par balise et trie numériquement', () => {
    const rows = computeDiscrepancies([
      audit({ sku: 'A', zone: '10', qty_pass1: 2, qty_pass2: 1 }),
      audit({ sku: 'B', zone: '2', qty_pass1: 2, qty_pass2: 1 }),
    ], labels, new Set(['10', '2']))

    const groups = groupDiscrepancies(rows, { '2': 'Réserve', '10': 'Surface' })
    expect(groups.map(g => g.zone)).toEqual(['2', '10'])
    expect(groups[0].name).toBe('Réserve')
  })
})

describe('summarize', () => {
  it('totalise écarts, unités, valeur et natures', () => {
    const rows = computeDiscrepancies([
      audit({ sku: 'A', zone: '1', qty_pass1: 4, qty_pass2: 1 }),
      audit({ sku: 'A', zone: '2', qty_pass1: null, qty_pass2: 2 }),
    ], labels, new Set(['1', '2']))

    const s = summarize(rows)
    expect(s.total).toBe(2)
    expect(s.units).toBe(-1)     // -3 puis +2
    expect(s.value).toBe(-10)
    expect(s.byKind.quantity).toBe(1)
    expect(s.byKind['missing-count']).toBe(1)
  })
})

describe('resolvedLines', () => {
  it('liste les arbitrages, du plus récent au plus ancien', () => {
    const rows = resolvedLines([
      audit({ sku: 'A', status: 'resolved', updated_at: '2026-08-10T10:00:00Z' }),
      audit({ sku: 'B', status: 'resolved', updated_at: '2026-08-12T10:00:00Z' }),
      audit({ sku: 'C', status: 'failed' }),
    ])
    expect(rows.map(r => r.sku)).toEqual(['B', 'A'])
  })
})
