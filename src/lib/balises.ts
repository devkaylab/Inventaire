import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

// Préfixe encodé dans chaque QR de balise. Distingue une balise d'un code-barres
// article. Les balises sont un stock d'entreprise réutilisable → le QR ne contient
// que le numéro (indépendant de l'inventaire) : SCB1:<code>.
export const BALISE_PREFIX = 'SCB1'

export type BaliseInfo = { code: string; name?: string | null }

/** Charge utile du QR d'une balise : SCB1:<code>. */
export function balisePayload(code: string): string {
  return `${BALISE_PREFIX}:${code}`
}

/** Analyse un code scanné : est-ce une balise ? Renvoie son numéro, sinon null. */
export function parseBalise(raw: string): { code: string } | null {
  const parts = (raw ?? '').trim().split(':')
  if (parts[0] !== BALISE_PREFIX) return null
  const code = parts.slice(1).join(':').trim()
  return code ? { code } : null
}

// Gabarit de planche d'étiquettes autocollantes (cotes en mm). Défaut : Avery L7160
// (A4, 21 étiquettes 63,5 × 38,1, 3 × 7). Une balise = une étiquette décollable,
// sans bordure ni découpe. Imprimer à 100 % (taille réelle, sans mise à l'échelle).
const MM = 72 / 25.4 // mm → points PDF
const L7160 = {
  pageW: 210, pageH: 297,
  cols: 3, rows: 7,
  labelW: 63.5, labelH: 38.1,
  marginLeft: 7.25, marginTop: 15.15,
  pitchX: 66.0, pitchY: 38.1,
}

// Découpe un texte en lignes tenant dans maxW (max `maxLines`, ellipse si ça déborde).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapText(text: string, font: any, size: number, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  let i = 0
  for (; i < words.length; i++) {
    const test = cur ? cur + ' ' + words[i] : words[i]
    if (!cur || font.widthOfTextAtSize(test, size) <= maxW) {
      cur = test
    } else {
      lines.push(cur)
      cur = words[i]
      if (lines.length === maxLines) { cur = ''; break }
    }
  }
  if (cur && lines.length < maxLines) { lines.push(cur); i = words.length }
  // Mots restants → ellipse sur la dernière ligne, tronquée pour tenir.
  if (i < words.length && lines.length) {
    let last = lines[lines.length - 1]
    while (last.length && font.widthOfTextAtSize(last + '…', size) > maxW) last = last.slice(0, -1)
    lines[lines.length - 1] = last + '…'
  }
  return lines
}

// ── Génération du PDF (QR dessinés depuis leur matrice, calés sur le gabarit) ─
async function buildBaliseSheet(balises: BaliseInfo[]): Promise<string> {
  const t = L7160
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageWpt = t.pageW * MM, pageHpt = t.pageH * MM
  const per = t.cols * t.rows
  const pad = 3 * MM
  const qrSize = (t.labelH - 8) * MM       // QR carré, centré verticalement dans l'étiquette
  const textX0 = (3 + (t.labelH - 8) + 3)  // mm : après le QR

  let page = null as ReturnType<typeof doc.addPage> | null
  balises.forEach((b, idx) => {
    if (idx % per === 0) page = doc.addPage([pageWpt, pageHpt])
    const p = page!
    const cell = idx % per
    const col = cell % t.cols, row = Math.floor(cell / t.cols)

    const labelLeftPt = (t.marginLeft + col * t.pitchX) * MM
    const labelBottomPt = pageHpt - (t.marginTop + row * t.pitchY + t.labelH) * MM
    const labelHpt = t.labelH * MM

    // QR à gauche, centré verticalement
    const qr = QRCode.create(balisePayload(b.code), { errorCorrectionLevel: 'M' })
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

    // Texte à droite : numéro de balise en gros (les balises sont génériques,
    // l'emplacement est affecté plus tard par plage). Nom optionnel au-dessus.
    const tx = labelLeftPt + textX0 * MM
    const maxW = (t.labelW - textX0 - 3) * MM
    const centerY = labelBottomPt + labelHpt / 2
    const name = b.name ? wrapText(b.name, font, 8, maxW, 1)[0] : null
    if (name) p.drawText(name, { x: tx, y: centerY + 12, size: 8, font, color: rgb(0.42, 0.44, 0.52) })
    p.drawText(b.code, { x: tx, y: centerY - (name ? 6 : 9), size: 26, font: fontB, color: rgb(0.1, 0.11, 0.16) })
  })

  return await doc.saveAsBase64()
}

export type PlancheBalises = { uri: string; filename: string }

/**
 * ⚠️ **Dessiner et partager sont deux temps, et ils doivent le rester.**
 *
 * Les deux ne faisaient qu'une fonction, appelée pendant que l'overlay de
 * chargement était à l'écran. Or cet overlay est une `Modal`, donc un
 * `UIViewController` présenté : iOS **refuse** d'afficher la feuille de
 * partage par-dessus (« Attempt to present UIActivityViewController on … which
 * is already presenting »), `shareAsync` ne se résout jamais, et le bouton
 * « Créer et imprimer des balises » tourne **indéfiniment**. Vu au simulateur
 * le 23 août 2026 : rien ne sortait, et rien ne le disait.
 *
 * L'appelant dessine d'abord, **retire l'overlay**, et ne partage qu'une fois
 * l'écran libre (voir `BaliseCreator`).
 */
export async function buildBaliseSheetFile(
  title: string,
  balises: BaliseInfo[]
): Promise<PlancheBalises> {
  // Laisse React peindre l'overlay de chargement avant le dessin (bloquant) du PDF.
  await new Promise((r) => setTimeout(r, 30))
  const b64 = await buildBaliseSheet(balises)
  const safe = title.replace(/[^\w-]+/g, '_')
  const filename = `balises_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`
  const file = new File(Paths.cache, filename)
  if (file.exists) file.delete()
  file.create()
  file.write(b64, { encoding: 'base64' })
  return { uri: file.uri, filename }
}

/** Ouvre le partage iOS (aperçu → Imprimer / Enregistrer). Faux si indisponible. */
export async function shareBaliseSheet(planche: PlancheBalises): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false
  await Sharing.shareAsync(planche.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Planches de balises',
    UTI: 'com.adobe.pdf',
  })
  return true
}
