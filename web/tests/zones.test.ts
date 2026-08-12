import { describe, expect, it } from 'vitest'
import {
  codeRange, groupByName, missingByZone, sortCodes, UNNAMED, validateRange,
  type ZoneDashboardRow,
} from '@/lib/zones'

function zone(partial: Partial<ZoneDashboardRow> & { code: string }): ZoneDashboardRow {
  return {
    id: `id-${partial.code}`,
    name: null,
    count_status: 'pending',
    audit_status: 'pending',
    count_units: 0,
    count_lines: 0,
    audit_units: 0,
    audit_lines: 0,
    ...partial,
  }
}

describe('sortCodes', () => {
  it('trie numériquement, pas alphabétiquement', () => {
    // Un tri alphabétique placerait « 10 » avant « 2 » : sur une liste de
    // balises à retrouver en magasin, c'est illisible.
    expect(sortCodes(['10', '2', '1'])).toEqual(['1', '2', '10'])
  })

  it('range les codes non numériques après, par ordre alphabétique', () => {
    expect(sortCodes(['B', '3', 'A', '1'])).toEqual(['1', '3', 'A', 'B'])
  })
})

describe('codeRange', () => {
  it('résume une plage contiguë', () => {
    expect(codeRange(['1', '2', '3'])).toBe('1 → 3')
  })

  it('signale les trous plutôt que de faire croire à une plage pleine', () => {
    expect(codeRange(['1', '2', '9'])).toBe('1 → 9 (3)')
  })

  it('gère un code unique et la liste vide', () => {
    expect(codeRange(['7'])).toBe('7')
    expect(codeRange([])).toBe('—')
  })
})

describe('groupByName', () => {
  const rows = [
    zone({ code: '1', name: 'Réserve', count_status: 'done', audit_status: 'done' }),
    zone({ code: '2', name: 'Réserve', count_status: 'done' }),
    zone({ code: '3', name: 'Réserve' }),
    zone({ code: '10', name: 'Surface de vente', count_status: 'done' }),
    zone({ code: '4' }),
  ]

  it('regroupe les balises par emplacement et compte les deux cycles', () => {
    const groups = groupByName(rows)
    const reserve = groups.find(g => g.name === 'Réserve')!
    expect(reserve.total).toBe(3)
    expect(reserve.counted).toBe(2)
    expect(reserve.audited).toBe(1)
    expect(reserve.codes).toEqual(['1', '2', '3'])
  })

  it('rassemble les balises sans emplacement sous un libellé identifiable', () => {
    const groups = groupByName(rows)
    const orphans = groups.find(g => g.name === UNNAMED)!
    expect(orphans.total).toBe(1)
    expect(orphans.unnamed).toBe(true)
  })

  it('trie les emplacements par nom', () => {
    expect(groupByName(rows).map(g => g.name))
      .toEqual([UNNAMED, 'Réserve', 'Surface de vente'])
  })
})

describe('missingByZone', () => {
  it('ne retient que les balises dont le comptage n’est pas terminé', () => {
    const missing = missingByZone([
      zone({ code: '1', name: 'Réserve', count_status: 'done' }),
      zone({ code: '2', name: 'Réserve', count_status: 'open' }),
      zone({ code: '3', name: 'Réserve' }),
    ])
    expect(missing).toEqual([{ name: 'Réserve', codes: ['2', '3'] }])
  })

  it('considère « en cours » comme non terminé', () => {
    // Une balise ouverte puis abandonnée resterait « open » indéfiniment :
    // elle doit continuer d'apparaître dans le reste à faire.
    const missing = missingByZone([zone({ code: '5', name: 'Caisse', count_status: 'open' })])
    expect(missing[0].codes).toEqual(['5'])
  })
})

describe('validateRange', () => {
  it('accepte une plage valide', () => {
    expect(validateRange('Réserve', '1', '10')).toBeNull()
  })

  it('exige un nom d’emplacement', () => {
    expect(validateRange('  ', '1', '10')).toMatch(/nom de l/i)
  })

  it('refuse une plage inversée', () => {
    expect(validateRange('Réserve', '10', '1')).toMatch(/inférieure/i)
  })

  it('refuse les bornes vides ou non entières', () => {
    expect(validateRange('Réserve', '', '10')).toMatch(/première et la dernière/i)
    expect(validateRange('Réserve', '1,5', '10')).toMatch(/première et la dernière/i)
  })

  it('applique la même limite que le serveur', () => {
    expect(validateRange('Réserve', '1', '2000')).toBeNull()
    expect(validateRange('Réserve', '1', '2001')).toMatch(/trop grande/i)
  })
})
