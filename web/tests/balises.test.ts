import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { BALISE_FORMATS, planBaliseSeries } from '@/lib/baliseSeries'
import { BALISE_PREFIX, balisePayload, buildBaliseSheet, baliseSheetFilename } from '@/lib/balisePdf'
import { COTES, GABARIT, PAR_PLANCHE } from '@/lib/baliseDessin'

// Création de balises depuis le site : mêmes séries, même QR et MÊME DESSIN
// que l'app, sinon une planche imprimée depuis le site ne se scannerait pas
// comme une planche imprimée depuis le téléphone.

const here = path.dirname(fileURLToPath(import.meta.url))
const libWeb = path.join(here, '../lib')
const libApp = path.join(here, '../../src/lib')

/**
 * ⚠️ **LA GARDE DÉDUIT SA LISTE, ELLE NE LA CITE PAS.** Un module recopié des
 * deux côtés porte cette marque dans son en-tête ; celui qui en ajoutera un
 * quatrième demain sera couvert sans toucher à ce fichier. Citer trois noms en
 * dur, c'est une garde qui ne protège que le passé.
 */
const MARQUE = 'CE FICHIER EXISTE EN DEUX EXEMPLAIRES IDENTIQUES'
const marques = (dossier: string) =>
  readdirSync(dossier)
    .filter(f => f.endsWith('.ts'))
    .filter(f => readFileSync(path.join(dossier, f), 'utf8').includes(MARQUE))

const jumeaux = [...new Set([...marques(libWeb), ...marques(libApp)])].sort()

const appBalises = readdirSync(libApp)
  .filter(f => f.endsWith('.ts'))
  .map(f => readFileSync(path.join(libApp, f), 'utf8'))
  .join('\n')

describe('les modules jumeaux — site et app', () => {
  it('il y en a, et la marque n’a pas disparu des en-têtes', () => {
    expect(jumeaux.length, 'plus aucun module ne se déclare jumeau : la marque a été perdue')
      .toBeGreaterThanOrEqual(3)
  })

  it.each(jumeaux)('%s est le même texte des deux côtés', (nom) => {
    const web = readFileSync(path.join(libWeb, nom), 'utf8')
    const app = readFileSync(path.join(libApp, nom), 'utf8')
    expect(web, `web/lib/${nom} et src/lib/${nom} ont divergé`).toBe(app)
  })

  it('le QR porte le même préfixe que l’app', () => {
    const declarations = appBalises.match(/export const BALISE_PREFIX = '[^']*'/g) ?? []
    // Une seule définition côté app : deux divergeraient au premier changement.
    expect(declarations).toEqual([`export const BALISE_PREFIX = '${BALISE_PREFIX}'`])
    expect(balisePayload('12')).toBe('SCB1:12')
  })
})

describe('séries de balises', () => {
  it('propose les trois numérotations', () => {
    expect(BALISE_FORMATS.map(f => f.label)).toEqual(['Numéros simples', '4 chiffres', '5 chiffres'])
  })

  it('calcule 1000 à 1049', () => {
    const r = planBaliseSeries('four', '1000', '50')
    expect(r.ok && r.series.to).toBe(1049)
  })
})

describe('le gabarit de planche', () => {
  const g = GABARIT

  /**
   * ⚠️ **CE GABARIT N'APPARTIENT À AUCUNE MARQUE.** 35,6 × 16,9, 80 par
   * feuille : Avery le vend en L4732REV, Herma en 4336, et une douzaine de
   * fabricants sans nom. Tous tiennent parce que la grille est CENTRÉE sur la
   * feuille — c'est ce qu'on vérifie, pas une référence de catalogue.
   */
  it('la grille est centrée sur l’A4, dans les deux sens', () => {
    expect((g.cols - 1) * g.pitchX + g.labelW + 2 * g.marginLeft).toBeCloseTo(g.pageW, 6)
    expect((g.rows - 1) * g.pitchY + g.labelH + 2 * g.marginTop).toBeCloseTo(g.pageH, 6)
  })

  it('80 étiquettes par planche', () => {
    expect(PAR_PLANCHE).toBe(80)
  })

  /**
   * ⚠️ **SOUS 0,40 MM DE MODULE, UN TÉLÉPHONE DÉCROCHE.** C'est physique, pas
   * une préférence — et ça ne se voit pas à l'écran, seulement à l'impression.
   * Le test prend le PLUS GRAND numéro que chaque format peut produire : un
   * numéro plus long fait grossir le QR d'une version, donc rétrécir chaque
   * module. Il déduit la liste de `BALISE_FORMATS`, il ne l'écrit pas.
   */
  it.each(BALISE_FORMATS.map(f => String(f.max)))(
    'le module du QR reste scannable pour le numéro %s', (code) => {
      const taille = QRCode.create(balisePayload(code), { errorCorrectionLevel: 'M' }).modules.size
      const carre = COTES.qr / (taille + 8)
      expect(carre, `QR de ${taille} modules : chaque carré ne fait que ${carre.toFixed(3)} mm`)
        .toBeGreaterThanOrEqual(0.40)
    })

  it('le QR ne touche jamais la bande de marque', () => {
    expect(COTES.marge + COTES.qr).toBeLessThan(g.labelH - COTES.bande)
  })

  it('la colonne et l’adresse dressée tiennent dans l’étiquette', () => {
    const colonneX = COTES.marge + COTES.qr + COTES.ecart
    const colonneW = g.labelW - colonneX - COTES.gouttiere - COTES.marge - 0.9
    expect(colonneW, 'la colonne de texte n’a plus de place').toBeGreaterThan(8)
    expect(colonneX + colonneW + COTES.gouttiere + COTES.marge).toBeLessThanOrEqual(g.labelW)
  })
})

describe('planche PDF', () => {
  it('génère un PDF d’une page pour 80 balises et de deux pages pour 81', async () => {
    const codes = (n: number) => Array.from({ length: n }, (_, i) => String(1000 + i))
    const one = await buildBaliseSheet(codes(PAR_PLANCHE))
    const two = await buildBaliseSheet(codes(PAR_PLANCHE + 1))
    const head = (b: Uint8Array) => String.fromCharCode(...b.slice(0, 5))
    expect(head(one)).toBe('%PDF-')
    expect((await PDFDocument.load(one)).getPageCount()).toBe(1)
    expect((await PDFDocument.load(two)).getPageCount()).toBe(2)
  }, 30_000)

  it('nomme le fichier par la plage et la date', () => {
    expect(baliseSheetFilename(1000, 1049, new Date('2026-08-21T10:00:00Z'))).toBe('balises_1000-1049_2026-08-21.pdf')
  })
})
