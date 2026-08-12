import { describe, expect, it } from 'vitest'
import { cellToCode, mapCatalogRows, mapStockRows, normalizeHeader } from '@/lib/import'

const S = 'session-1'

describe('normalizeHeader', () => {
  it('ignore casse, accents et ponctuation', () => {
    // Les exports clients n'écrivent jamais deux fois le même en-tête de la
    // même façon : c'est ce qui rend l'import tolérant.
    for (const h of ["Prix d'achat", 'PRIX D ACHAT', 'prix-d_achat', 'Prix  d’achat']) {
      expect(normalizeHeader(h)).toBe('prixdachat')
    }
  })

  it('normalise les variantes de code-barres', () => {
    for (const h of ['Code-barres', 'Code barres', 'code_barres', 'CODE BARRES']) {
      expect(normalizeHeader(h)).toBe('codebarres')
    }
  })
})

describe('cellToCode', () => {
  it('évite la notation scientifique des cellules numériques', () => {
    expect(cellToCode(3701234567890)).toBe('3701234567890')
  })

  it('n’ajoute pas de « .0 » aux entiers', () => {
    expect(cellToCode(123)).toBe('123')
  })

  it('conserve les décimales non entières et nettoie les chaînes', () => {
    expect(cellToCode(1.5)).toBe('1.5')
    expect(cellToCode('  ABC1234 ')).toBe('ABC1234')
    expect(cellToCode(null)).toBe('')
  })
})

describe('mapCatalogRows', () => {
  it('accepte les variantes d’en-têtes documentées', () => {
    const { articles } = mapCatalogRows([{
      codearticle: 'ABC1', gencod: '3701', fournisseur: 'Nike', designation: 'T-shirt', pa: '12,50',
    }], S)

    expect(articles).toHaveLength(1)
    expect(articles[0]).toMatchObject({
      session_id: S, sku: 'ABC1', ean: '3701', brand: 'Nike',
      label: 'T-shirt', unit_purchase_price: 12.5,
    })
  })

  it('lit un prix écrit à la française', () => {
    const { articles } = mapCatalogRows([{ sku: 'A', prixdachat: '9,99' }], S)
    expect(articles[0].unit_purchase_price).toBe(9.99)
  })

  it('ignore les lignes sans SKU et le signale', () => {
    const { articles, errors, skipped } = mapCatalogRows([
      { sku: 'A' }, { label: 'sans code' }, { sku: 'B' },
    ], S)
    expect(articles.map(a => a.sku)).toEqual(['A', 'B'])
    expect(skipped).toBe(1)
    // Ligne 3 du fichier : index 1 + en-tête + base 1.
    expect(errors[0]).toContain('Ligne 3')
  })

  it('sur doublon de SKU, la dernière ligne l’emporte', () => {
    const { articles, errors } = mapCatalogRows([
      { sku: 'A', libelle: 'ancien' }, { sku: 'A', libelle: 'nouveau' },
    ], S)
    expect(articles).toHaveLength(1)
    expect(articles[0].label).toBe('nouveau')
    expect(errors.join(' ')).toMatch(/double/i)
  })

  it('met un EAN absent à null plutôt qu’à une chaîne vide', () => {
    const { articles } = mapCatalogRows([{ sku: 'A' }], S)
    expect(articles[0].ean).toBeNull()
    expect(articles[0].unit_purchase_price).toBe(0)
  })
})

describe('mapStockRows', () => {
  it('additionne les quantités d’un même SKU sur plusieurs emplacements', () => {
    const { rows, errors } = mapStockRows([
      { sku: 'A', quantite: '3' },
      { sku: 'A', quantite: '2' },
      { sku: 'B', qte: '5' },
    ], S)

    expect(rows).toHaveLength(2)
    expect(rows.find(r => r.sku === 'A')!.theoretical_qty).toBe(5)
    expect(rows.find(r => r.sku === 'B')!.theoretical_qty).toBe(5)
    expect(errors.join(' ')).toMatch(/multi-emplacements/i)
  })

  it('accepte les variantes de colonne quantité', () => {
    for (const key of ['theoreticalqty', 'qtetheorique', 'quantitetheorique', 'quantite', 'qty', 'qte', 'stock', 'quantity']) {
      const { rows } = mapStockRows([{ sku: 'A', [key]: '7' }], S)
      expect(rows[0].theoretical_qty).toBe(7)
    }
  })

  it('traite une quantité absente comme zéro, sans planter', () => {
    const { rows } = mapStockRows([{ sku: 'A' }], S)
    expect(rows[0].theoretical_qty).toBe(0)
  })
})
