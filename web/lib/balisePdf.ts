// Planche de balises (PDF) générée dans le navigateur.
//
// Même dessin que `src/lib/balises.ts` dans l'app mobile : gabarit Avery L7160
// (A4, 21 étiquettes 63,5 × 38,1 mm), QR à gauche contenant `SCB1:<numéro>`,
// numéro en gros à droite. À imprimer à 100 % (taille réelle). Si l'un des
// deux dessins change, changer l'autre : une balise imprimée depuis le site
// doit être scannée exactement comme une balise imprimée depuis l'app.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

/** Préfixe du QR d'une balise — identique à BALISE_PREFIX dans l'app. */
export const BALISE_PREFIX = 'SCB1'

export function balisePayload(code: string): string {
  return `${BALISE_PREFIX}:${code}`
}

const MM = 72 / 25.4
const L7160 = {
  pageW: 210, pageH: 297,
  cols: 3, rows: 7,
  labelW: 63.5, labelH: 38.1,
  marginLeft: 7.25, marginTop: 15.15,
  pitchX: 66.0, pitchY: 38.1,
}

/** Construit le PDF d'une liste de numéros de balises. Renvoie les octets. */
export async function buildBaliseSheet(codes: string[]): Promise<Uint8Array> {
  const t = L7160
  const doc = await PDFDocument.create()
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWpt = t.pageW * MM, pageHpt = t.pageH * MM
  const per = t.cols * t.rows
  const pad = 3 * MM
  const qrSize = (t.labelH - 8) * MM
  const textX0 = 3 + (t.labelH - 8) + 3

  let page: ReturnType<typeof doc.addPage> | null = null
  codes.forEach((code, idx) => {
    if (idx % per === 0) page = doc.addPage([pageWpt, pageHpt])
    const p = page!
    const cell = idx % per
    const col = cell % t.cols, row = Math.floor(cell / t.cols)

    const labelLeftPt = (t.marginLeft + col * t.pitchX) * MM
    const labelBottomPt = pageHpt - (t.marginTop + row * t.pitchY + t.labelH) * MM
    const labelHpt = t.labelH * MM

    const qr = QRCode.create(balisePayload(code), { errorCorrectionLevel: 'M' })
    const size = qr.modules.size
    const data = qr.modules.data
    const mod = qrSize / size
    const qx = labelLeftPt + pad
    const qy = labelBottomPt + (labelHpt - qrSize) / 2
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r * size + c]) {
          p.drawRectangle({ x: qx + c * mod, y: qy + (size - 1 - r) * mod, width: mod, height: mod, color: rgb(0, 0, 0) })
        }
      }
    }

    const tx = labelLeftPt + textX0 * MM
    const centerY = labelBottomPt + labelHpt / 2
    p.drawText(code, { x: tx, y: centerY - 9, size: 26, font: fontB, color: rgb(0.1, 0.11, 0.16) })
  })

  return await doc.save()
}

/** Nom de fichier de la planche, ex. `balises_1000-1049_2026-08-21.pdf`. */
export function baliseSheetFilename(from: number, to: number, now = new Date()): string {
  return `balises_${from}-${to}_${now.toISOString().slice(0, 10)}.pdf`
}

/** Génère la planche et déclenche son téléchargement dans le navigateur. */
export async function downloadBaliseSheet(codes: string[], from: number, to: number): Promise<string> {
  const bytes = await buildBaliseSheet(codes)
  const filename = baliseSheetFilename(from, to)
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return filename
}
