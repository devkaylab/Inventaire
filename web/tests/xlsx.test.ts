// SheetJS vient de vendor/, pas de npm — et doit continuer d'en venir.
//
// npm ne distribue que xlsx@0.18.5, vulnérable en lecture (CVE-2023-30533,
// CVE-2024-22363) et jamais corrigée depuis le départ de SheetJS. Un simple
// `npm install xlsx` ramènerait cette version en écrasant le `file:` sans rien
// signaler : ces tests sont là pour que ça ne passe pas inaperçu.
//
// L'aller-retour reprend exactement les appels du code — ceux de
// `lib/report.ts` à l'écriture, ceux de `lib/import.ts` à la lecture — pour
// qu'un changement d'API se voie ici et pas en production.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

const MINIMALE = [0, 20, 2] // 0.19.3 corrige la pollution de prototype, 0.20.2 le ReDoS

function auMoins(version: string, minimale: number[]): boolean {
  const a = version.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== minimale[i]) return (a[i] ?? 0) > minimale[i]
  }
  return true
}

const lire = (p: string) => JSON.parse(readFileSync(path.resolve(__dirname, p), 'utf8'))

describe('approvisionnement de SheetJS', () => {
  it('est déclaré en archive locale, jamais depuis npm', () => {
    expect(lire('../package.json').dependencies.xlsx).toMatch(/^file:\.\.\/vendor\/xlsx-/)
  })

  it('installe une version où les deux failles de lecture sont corrigées', () => {
    const version: string = lire('../node_modules/xlsx/package.json').version
    expect(auMoins(version, MINIMALE), `xlsx@${version} est trop ancienne`).toBe(true)
  })
})

describe('aller-retour écriture → lecture', () => {
  it('conserve les zéros de tête des codes forcés en texte', () => {
    // Écriture, comme downloadXlsx : feuille depuis des objets, colonnes de
    // codes repassées en texte cellule par cellule.
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet([
      { SKU: '0012345', EAN: '3701234567890', Désignation: 'Écrou têtu', 'Qté comptée': 42 },
    ])
    const range = XLSX.utils.decode_range(ws['!ref']!)
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      for (const C of [0, 1]) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
        if (cell && cell.v != null && cell.v !== '') {
          cell.t = 's'
          cell.v = String(cell.v)
          cell.z = '@'
          delete cell.w
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Écarts')
    const octets = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    // Relecture, comme xlsxToRawRows : première feuille, valeurs brutes.
    const relu = XLSX.read(new Uint8Array(octets), { type: 'array', cellStyles: false, cellDates: false })
    const lignes = XLSX.utils.sheet_to_json(relu.Sheets[relu.SheetNames[0]], {
      defval: '', raw: true,
    }) as Record<string, unknown>[]

    expect(relu.SheetNames).toEqual(['Écarts'])
    expect(lignes).toHaveLength(1)
    expect(lignes[0].SKU).toBe('0012345')            // le zéro de tête a survécu
    expect(lignes[0].EAN).toBe('3701234567890')      // pas de notation scientifique
    expect(lignes[0]['Qté comptée']).toBe(42)        // un nombre reste un nombre
    expect(lignes[0]['Désignation']).toBe('Écrou têtu')
  })

  it('porte les deux feuilles du rapport', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ SKU: 'A' }]), 'Écarts')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ SKU: 'A', Zone: '01' }]), 'Détail par zone')
    const relu = XLSX.read(
      new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer),
      { type: 'array' },
    )
    expect(relu.SheetNames).toEqual(['Écarts', 'Détail par zone'])
  })
})
