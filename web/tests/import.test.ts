import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cellToCode, EAN_KEYS, mapCatalogRows, mapStockRows, normalizeHeader } from '@/lib/import'
import { MODELE_REFERENCEMENT, MODELE_STOCK } from '@/lib/modeles'

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
    const { articles, errors, notes } = mapCatalogRows([
      { sku: 'A', libelle: 'ancien' }, { sku: 'A', libelle: 'nouveau' },
    ], S)
    expect(articles).toHaveLength(1)
    expect(articles[0].label).toBe('nouveau')
    // ⚠️ Une NOTE, pas une erreur : aucune référence n'est perdue.
    expect(errors).toHaveLength(0)
    expect(notes.join(' ')).toMatch(/répètent une référence déjà vue/i)
  })

  it('reconnaît « Code Ean » — le fichier du 25 août 2026', () => {
    // Inventaire « Fwee », fichier client : la colonne s'appelait « Code
    // Ean », inconnue ici. Tous les EAN sortaient nuls, et — conséquence en
    // chaîne — les lignes au même SKU s'écrasaient au lieu d'être gardées
    // chacune sous son EAN.
    expect(EAN_KEYS).toContain('codeean')
    expect(EAN_KEYS).toContain('codeean13')

    const rows = [
      { sku: 'A', [normalizeHeader('Code Ean')]: '3701234567891' },
      { sku: 'A', [normalizeHeader('Code Ean')]: '3701234567907' },
    ]
    const { articles } = mapCatalogRows(rows, S)
    expect(articles).toHaveLength(2)
    expect(articles.map(a => a.ean).sort()).toEqual(['3701234567891', '3701234567907'])
  })

  it('l’application mobile reconnaît les mêmes en-têtes', () => {
    // Les deux `lib/import.ts` sont dupliqués (l'app et le site ne compilent
    // pas ensemble) : une variante ajoutée d'un seul côté ferait diverger le
    // même fichier importé du téléphone et de l'ordinateur.
    const mobile = readFileSync(join(__dirname, '../../src/lib/import.ts'), 'utf8')
    const liste = mobile.match(/const EAN_KEYS = \[([^\]]+)\]/)?.[1] ?? ''
    for (const cle of EAN_KEYS) expect(liste).toContain(`'${cle}'`)
  })

  it('un même SKU avec des EAN différents garde chaque EAN scannable', () => {
    // Référentiel bijouterie/horlogerie : une ligne par pièce, le SKU (modèle)
    // se répète, l'EAN identifie la pièce. Écraser perdait tous les EAN sauf
    // le dernier — et chaque pièce écrasée sortait « article inconnu » au scan.
    const { articles, errors, notes } = mapCatalogRows([
      { sku: 'A', ean: '7624709024384', libelle: 'Montre' },
      { sku: 'A', ean: '7624709024391', libelle: 'Montre' },
    ], S)
    expect(articles).toHaveLength(2)
    const bySku = new Map(articles.map(a => [a.sku, a]))
    expect(bySku.get('A')!.ean).toBe('7624709024384')
    expect(bySku.get('7624709024391')!.ean).toBe('7624709024391')
    expect(errors).toHaveLength(0)
    expect(notes.join(' ')).toMatch(/EAN différent/i)
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

describe('un constat ne s’affiche pas comme une erreur', () => {
  // Constat de Julien, 3 septembre 2026, devant « 7318 SKU en double dans le
  // fichier » affiché en rouge : « pourquoi j'ai cette alerte si on peut
  // utiliser les doublons sans problème ? » Un référentiel liste couramment la
  // même référence une fois par emplacement — rien n'était perdu.
  const lire = (p: string) => readFileSync(join(__dirname, p), 'utf8')
  const sansCommentaires = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')

  it('ce qui est regroupé va dans notes, ce qui est perdu dans errors', () => {
    // Perte réelle : la ligne n'a ni SKU ni EAN, elle n'est pas importée.
    const perte = mapCatalogRows([{ libelle: 'sans code' }], S)
    expect(perte.errors.join(' ')).toMatch(/ignorée/i)
    expect(perte.notes).toHaveLength(0)

    // Regroupement : la référence existe, elle est simplement répétée.
    const constat = mapCatalogRows([{ sku: 'A' }, { sku: 'A' }], S)
    expect(constat.errors).toHaveLength(0)
    expect(constat.notes).toHaveLength(1)
  })

  it('l’agrégation multi-emplacements du stock est une note', () => {
    const { errors, notes } = mapStockRows(
      [{ sku: 'A', qte: '2' }, { sku: 'A', qte: '3' }], S,
    )
    expect(errors).toHaveLength(0)
    expect(notes.join(' ')).toMatch(/agrégée/i)
  })

  it('le message ne dit plus « doublon » tout court', () => {
    // Le mot seul laissait croire à un défaut du fichier ; le texte dit
    // maintenant ce qui s'est passé et ce qui fait foi.
    const { notes } = mapCatalogRows([{ sku: 'A' }, { sku: 'A' }], S)
    expect(notes[0]).not.toMatch(/en double/i)
    expect(notes[0]).toMatch(/la dernière ligne fait foi/i)
  })

  it('⚠️ les notes ne se rendent JAMAIS dans la boîte rouge', () => {
    const setup = sansCommentaires(lire('../components/dashboard/tabs/SetupTab.tsx'))
    expect(setup).toMatch(/state\.notes\.map/)
    // La boîte des notes est neutre, celle des erreurs reste `import-errors`.
    expect(setup).toContain('className="import-notes"')
    expect(setup.match(/import-errors/g) ?? []).toHaveLength(2) // échec fatal + lignes non importées

    const css = lire('../app/globals.css')
    const bloc = css.slice(css.indexOf('.import-notes {'), css.indexOf('.import-notes strong'))
    expect(bloc).not.toMatch(/danger/)

    // Et l'application suit la même règle.
    const mobile = sansCommentaires(lire('../../src/app/(supervisor)/[sessionId]/import.tsx'))
    expect(mobile).toMatch(/state\.notes\.map/)
    expect(mobile).toMatch(/noteBox:[^,]*backgroundColor: t\.surface/)
  })
})

describe('mapStockRows', () => {
  it('additionne les quantités d’un même SKU sur plusieurs emplacements', () => {
    const { rows, errors, notes } = mapStockRows([
      { sku: 'A', quantite: '3' },
      { sku: 'A', quantite: '2' },
      { sku: 'B', qte: '5' },
    ], S)

    expect(rows).toHaveLength(2)
    expect(rows.find(r => r.sku === 'A')!.theoretical_qty).toBe(5)
    expect(rows.find(r => r.sku === 'B')!.theoretical_qty).toBe(5)
    // ⚠️ Une NOTE : sommer plusieurs emplacements est le comportement attendu.
    expect(errors).toHaveLength(0)
    expect(notes.join(' ')).toMatch(/multi-emplacements/i)
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

describe('les modèles de la boîte à outils', () => {
  // Demande de Julien, 25 août 2026 : deux gabarits à télécharger depuis la
  // boîte à outils. L'invariant qui compte : **chaque modèle doit traverser
  // son propre import sans rien perdre** — un gabarit dont une colonne ne
  // serait pas relue serait pire que pas de gabarit.
  const versLignes = (m: typeof MODELE_REFERENCEMENT) => {
    const [entetes, ...corps] = m.lignes
    return corps.map(l => Object.fromEntries(l.map((v, i) => [normalizeHeader(entetes[i]), v])))
  }

  it('le modèle Référencement traverse l’import sans perte', () => {
    const { articles, skipped } = mapCatalogRows(versLignes(MODELE_REFERENCEMENT), S)
    expect(skipped).toBe(0)
    // Trois lignes, dont deux au même SKU avec chacune son EAN : le modèle
    // montre précisément le cas des doublons voulus, et aucune ne se perd.
    expect(articles).toHaveLength(MODELE_REFERENCEMENT.lignes.length - 1)
    expect(articles.every(a => a.ean && a.brand && a.label)).toBe(true)
    expect(articles.every(a => a.unit_purchase_price > 0)).toBe(true)
  })

  it('le modèle Stock théorique traverse l’import sans perte', () => {
    const { rows, skipped } = mapStockRows(versLignes(MODELE_STOCK), S)
    expect(skipped).toBe(0)
    expect(rows).toHaveLength(MODELE_STOCK.lignes.length - 1)
    expect(rows.every(r => r.theoretical_qty > 0)).toBe(true)
  })

  it('les cellules des modèles sont toutes des chaînes', () => {
    // C'est ce qui type les colonnes en Texte dans Excel : un code « 0123 »
    // garde ses zéros de tête. Une cellule numérique retyperait la colonne.
    for (const m of [MODELE_REFERENCEMENT, MODELE_STOCK]) {
      for (const ligne of m.lignes) for (const c of ligne) expect(typeof c).toBe('string')
    }
  })

  it('la boîte à outils les propose', () => {
    const page = readFileSync(join(__dirname, '../app/outils/page.tsx'), 'utf8')
    expect(page).toContain('<ModelesPanel />')
    const panneau = readFileSync(join(__dirname, '../components/ModelesPanel.tsx'), 'utf8')
    expect(panneau).toContain('MODELE_REFERENCEMENT')
    expect(panneau).toContain('MODELE_STOCK')
    expect(panneau).toContain('telechargerModele')
  })
})
