import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { BALISE_FORMATS, planBaliseSeries } from '@/lib/baliseSeries'
import { BALISE_PREFIX, balisePayload, buildBaliseSheet, baliseSheetFilename } from '@/lib/balisePdf'

// Création de balises depuis le site : mêmes séries et même QR que l'app,
// sinon une planche imprimée depuis le site ne se scannerait pas pareil.

const here = path.dirname(fileURLToPath(import.meta.url))
const web = readFileSync(path.join(here, '../lib/baliseSeries.ts'), 'utf8')
const app = readFileSync(path.join(here, '../../src/lib/baliseSeries.ts'), 'utf8')
/**
 * ⚠️ Le préfixe se CHERCHE dans `src/lib/`, il ne se lit pas dans un fichier
 * nommé en dur.
 *
 * Cette garde citait `balises.ts`, et elle est tombée le jour où le format du
 * QR en est sorti (7 septembre 2026) pour rejoindre un module sans dépendance
 * native — donc testable. Elle n'avait rien détecté de faux : elle décrivait
 * seulement où le code habitait la veille. Ce qu'elle défend, c'est que le
 * site et l'app encodent **le même préfixe** ; ça ne dépend pas du fichier.
 */
const appLib = path.join(here, '../../src/lib')
const appBalises = readdirSync(appLib)
  .filter(f => f.endsWith('.ts'))
  .map(f => readFileSync(path.join(appLib, f), 'utf8'))
  .join('\n')

const stripHeader = (s: string) => s.slice(s.indexOf('export type BaliseFormat'))

describe('séries de balises — site et app', () => {
  it('le module du site est la copie exacte de celui de l’app (hors en-tête)', () => {
    expect(stripHeader(web)).toBe(stripHeader(app))
  })

  it('propose les trois numérotations', () => {
    expect(BALISE_FORMATS.map(f => f.label)).toEqual(['Numéros simples', '4 chiffres', '5 chiffres'])
  })

  it('calcule 1000 à 1049', () => {
    const r = planBaliseSeries('four', '1000', '50')
    expect(r.ok && r.series.to).toBe(1049)
  })

  it('le QR porte le même préfixe que l’app', () => {
    const declarations = appBalises.match(/export const BALISE_PREFIX = '[^']*'/g) ?? []
    // Une seule définition côté app : deux divergeraient au premier changement.
    expect(declarations).toEqual([`export const BALISE_PREFIX = '${BALISE_PREFIX}'`])
    expect(balisePayload('12')).toBe('SCB1:12')
  })
})

describe('planche PDF', () => {
  it('génère un PDF d’une page pour 21 balises et de deux pages pour 22', async () => {
    const one = await buildBaliseSheet(Array.from({ length: 21 }, (_, i) => String(i + 1)))
    const two = await buildBaliseSheet(Array.from({ length: 22 }, (_, i) => String(i + 1)))
    const head = (b: Uint8Array) => String.fromCharCode(...b.slice(0, 5))
    expect(head(one)).toBe('%PDF-')
    expect((await PDFDocument.load(one)).getPageCount()).toBe(1)
    expect((await PDFDocument.load(two)).getPageCount()).toBe(2)
  }, 20_000)

  it('nomme le fichier par la plage et la date', () => {
    expect(baliseSheetFilename(1000, 1049, new Date('2026-08-21T10:00:00Z'))).toBe('balises_1000-1049_2026-08-21.pdf')
  })
})
