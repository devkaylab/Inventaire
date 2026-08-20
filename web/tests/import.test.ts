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

  it('ignore les lignes sans aucun code (ni SKU ni EAN) et le signale', () => {
    const { articles, errors, skipped } = mapCatalogRows([
      { sku: 'A' }, { label: 'sans code' }, { sku: 'B' },
    ], S)
    expect(articles.map(a => a.sku)).toEqual(['A', 'B'])
    expect(skipped).toBe(1)
    // Ligne 3 du fichier : index 1 + en-tête + base 1.
    expect(errors[0]).toContain('Ligne 3')
  })

  it('importe une ligne sans SKU mais avec EAN, sous son EAN', () => {
    // Une pièce sans référence interne reste scannable : même convention que
    // l'article inconnu créé au scan (sku = ean, masqué dans le rapport).
    const { articles, skipped } = mapCatalogRows([
      { ean: '3701234567890', libelle: 'Pièce sans référence' },
    ], S)
    expect(skipped).toBe(0)
    expect(articles).toHaveLength(1)
    expect(articles[0]).toMatchObject({ sku: '3701234567890', ean: '3701234567890', label: 'Pièce sans référence' })
  })

  it('sur doublon de SKU, la dernière ligne l’emporte', () => {
    const { articles, errors } = mapCatalogRows([
      { sku: 'A', libelle: 'ancien' }, { sku: 'A', libelle: 'nouveau' },
    ], S)
    expect(articles).toHaveLength(1)
    expect(articles[0].label).toBe('nouveau')
    expect(errors.join(' ')).toMatch(/double/i)
  })

  it('un même SKU avec des EAN différents garde chaque EAN scannable', () => {
    // Référentiel bijouterie/horlogerie : une ligne par pièce, le SKU (modèle)
    // se répète, l'EAN identifie la pièce. Écraser perdait tous les EAN sauf
    // le dernier — et chaque pièce écrasée sortait « article inconnu » au scan.
    const { articles, errors } = mapCatalogRows([
      { sku: 'A', ean: '7624709024384', libelle: 'Montre' },
      { sku: 'A', ean: '7624709024391', libelle: 'Montre' },
    ], S)
    expect(articles).toHaveLength(2)
    const bySku = new Map(articles.map(a => [a.sku, a]))
    expect(bySku.get('A')!.ean).toBe('7624709024384')
    expect(bySku.get('7624709024391')!.ean).toBe('7624709024391')
    expect(errors.join(' ')).toMatch(/EAN différent/i)
  })

  it('ne perd pas l’EAN quand une ligne en double n’en porte pas', () => {
    const { articles } = mapCatalogRows([
      { sku: 'A', ean: '3701', libelle: 'ancien' },
      { sku: 'A', libelle: 'nouveau' },
    ], S)
    expect(articles).toHaveLength(1)
    expect(articles[0].label).toBe('nouveau')
    expect(articles[0].ean).toBe('3701')
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
