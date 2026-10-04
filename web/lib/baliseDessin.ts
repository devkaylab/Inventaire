/**
 * Le dessin d'une planche de balises — et rien d'autre.
 *
 * ⚠️⚠️ **CE FICHIER EXISTE EN DEUX EXEMPLAIRES IDENTIQUES**, `src/lib/` pour
 * l'app et `web/lib/` pour le site. Une balise imprimée depuis le site doit se
 * scanner exactement comme une balise imprimée depuis l'app : le dessin ne peut
 * donc pas diverger d'un millimètre. `web/tests/balises.test.ts` compare les
 * deux textes caractère par caractère. **Toucher l'un = recopier l'autre.**
 *
 * Il ne connaît ni le navigateur ni Expo : il rend un `PDFDocument`, et chaque
 * côté le sauve comme il veut (octets pour le téléchargement, base64 pour le
 * fichier de cache). C'est ce qui le rend copiable — et testable.
 *
 * ⚠️ **LA GÉOMÉTRIE A ÉTÉ IMPRIMÉE ET SCANNÉE AVANT D'ÊTRE ÉCRITE**, le
 * 24 septembre 2026, sur quatre planches d'essai. Le QR de 12,7 mm (module
 * 0,44) passe de loin. Ne pas le réduire « pour gagner de la place » : sous
 * 0,40 mm de module, un téléphone décroche, et ça ne se voit pas à l'écran.
 */
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { balisePayload } from '@/lib/baliseCode'

const MM = 72 / 25.4
const pt = (mm: number) => mm * MM

/**
 * Gabarit A4 de 80 étiquettes 35,6 × 16,9 mm, 5 colonnes sur 16 rangées.
 *
 * ⚠️ **CE N'EST PAS UN FORMAT PROPRE À UNE MARQUE.** Avery le vend sous
 * L4732REV, Herma sous 4336 et 10701, et une douzaine de fabricants sous
 * « 80 étiquettes par planche ». Tous partagent la même grille : la grille
 * est simplement CENTRÉE sur la feuille, ce que le test vérifie. Ne pas
 * écrire « Avery » dans l'interface — n'importe quel équivalent convient.
 */
export const GABARIT = {
  pageW: 210, pageH: 297,
  cols: 5, rows: 16,
  labelW: 35.6, labelH: 16.9,
  pitchX: 38.1, pitchY: 16.9,
  marginLeft: 11.0,   // (210 − (4 × 38,1 + 35,6)) / 2
  marginTop: 13.3,    // (297 − 16 × 16,9) / 2
}

export const PAR_PLANCHE = GABARIT.cols * GABARIT.rows

/**
 * Les cotes du dessin, en millimètres depuis le coin haut gauche de
 * l'étiquette. Tout part de là — aucune mesure n'est écrite ailleurs.
 */
export const COTES = {
  marge: 0.8,      // le blanc tout autour
  qr: 12.7,        // côté du QR, zone de silence comprise
  ecart: 1.3,      // entre le QR et la colonne de texte
  numero: 4.4,     // corps du numéro (réduit tout seul s'il déborde)
  filet: 0.25,     // le trait vert sous le numéro
  boite: 2.4,      // côté d'une case à cocher
  mot: 1.85,       // corps de COMPTÉ / AUDITÉ
  site: 1.45,      // corps de l'adresse, dressée à droite
  marque: 1.6,     // corps de « Quantinvo », dans la bande
  bande: 2.6,      // la bande de marque, en pied, pleine largeur
  gouttiere: 1.9,  // la colonne que l'adresse dressée occupe
}

// Les couleurs sont celles de la marque : `src/constants/ink.ts` ↔
// `web/app/globals.css`. Elles sont recopiées en dur parce qu'un PDF ne lit
// pas de feuille de style, et qu'aucun des deux fichiers de jetons n'est
// importable des deux côtés.
const ENCRE = rgb(0x14 / 255, 0x18 / 255, 0x1a / 255)   // textPrimary
const GRIS = rgb(0x57 / 255, 0x5f / 255, 0x5c / 255)    // textMuted
const ACCENT = rgb(0x1e / 255, 0x4d / 255, 0x3b / 255)  // accent
const OCRE = rgb(0xa0 / 255, 0x6a / 255, 0x12 / 255)    // warning
const BLANC = rgb(1, 1, 1)

// Hauteur de capitale et profondeur de jambage d'Helvetica, en cadratins.
// Servent à centrer un texte sur une case ou sur la bande : sans elles, tout
// paraît posé trop haut.
const CAPITALE = 0.717
const JAMBAGE = 0.21

// ⚠️ Deux carrés voisins d'un QR laissent un cheveu blanc à l'impression —
// l'imprimante n'aligne pas les bords au point près. Ce recouvrement d'un
// vingtième de point les soude. Vu sur la planche d'essai.
const RECOUVREMENT = 0.08
const TRAIT = 0.45

/**
 * Dessine la planche. Un `PDFDocument` : à l'appelant de le sauver.
 *
 * Les balises sont génériques — le QR ne porte que le numéro, l'emplacement
 * est affecté plus tard par plage. Rien d'autre n'a donc à être imprimé.
 */
export async function dessinerPlanche(codes: string[]): Promise<PDFDocument> {
  const g = GABARIT
  const c = COTES
  const doc = await PDFDocument.create()
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  const pageHpt = pt(g.pageH)
  const colonneX = c.marge + c.qr + c.ecart
  const colonneW = g.labelW - colonneX - c.gouttiere - c.marge - 0.9

  const adresse = 'quantinvo.com'
  const corpsSite = pt(c.site)
  const longueurSite = normal.widthOfTextAtSize(adresse, corpsSite) / MM

  let page: ReturnType<typeof doc.addPage> | null = null
  codes.forEach((code, idx) => {
    if (idx % PAR_PLANCHE === 0) page = doc.addPage([pt(g.pageW), pageHpt])
    const p = page!
    const cellule = idx % PAR_PLANCHE
    const gauche = g.marginLeft + (cellule % g.cols) * g.pitchX
    const haut = g.marginTop + Math.floor(cellule / g.cols) * g.pitchY

    // Repère local à l'étiquette : millimètres depuis son coin HAUT gauche.
    // Le PDF compte depuis le bas ; faire la conversion ici une bonne fois
    // évite de la refaire de travers à chaque élément.
    const X = (mm: number) => pt(gauche + mm)
    const Y = (mm: number) => pageHpt - pt(haut + mm)

    // ── Le QR, en haut à gauche ───────────────────────────────────────────
    const qr = QRCode.create(balisePayload(code), { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    // ⚠️ `module` est un nom que Next refuse (`no-assign-module-variable`).
    const carre = c.qr / (n + 8)           // 4 modules de silence de chaque côté
    for (let r = 0; r < n; r++) {
      for (let k = 0; k < n; k++) {
        if (!qr.modules.data[r * n + k]) continue
        p.drawRectangle({
          x: X(c.marge + carre * (4 + k)),
          y: Y(c.marge + carre * (5 + r)),
          width: pt(carre) + RECOUVREMENT,
          height: pt(carre) + RECOUVREMENT,
          color: ENCRE,
        })
      }
    }

    // ── La colonne : le numéro, un filet, les deux états ──────────────────
    // Le numéro rétrécit s'il est long : cinq chiffres tiennent large, mais
    // rien n'interdit une série à sept. Mieux vaut petit que débordant.
    let corps = pt(c.numero)
    const large = gras.widthOfTextAtSize(code, corps)
    if (large > pt(colonneW)) corps = (corps * pt(colonneW)) / large

    const hauteurNumero = (corps / MM) * CAPITALE
    const bloc = hauteurNumero + 0.75 + c.filet + 0.75 + c.boite + 0.7 + c.boite
    let y = c.marge + (c.qr - bloc) / 2

    p.drawText(code, { x: X(colonneX), y: Y(y + hauteurNumero), size: corps, font: gras, color: ENCRE })
    y += hauteurNumero + 0.75
    p.drawRectangle({ x: X(colonneX), y: Y(y + c.filet), width: pt(7), height: pt(c.filet), color: ACCENT })
    y += c.filet + 0.75

    // ⚠️ AU FÉMININ : le sujet est LA BALISE. Le masculin « Compté » est
    // réservé aux quantités (colonne `counted_qty` du rapport). Partout où
    // le produit parle de balises, il dit « Comptées » et « Auditées ».
    for (const [mot, teinte] of [['COMPTÉE', ACCENT], ['AUDITÉE', OCRE]] as const) {
      p.drawRectangle({
        x: X(colonneX), y: Y(y + c.boite),
        width: pt(c.boite), height: pt(c.boite),
        borderColor: teinte, borderWidth: TRAIT,
      })
      p.drawText(mot, {
        x: X(colonneX + c.boite + 0.7),
        y: Y(y + c.boite / 2 + (c.mot * CAPITALE) / 2),
        size: pt(c.mot), font: gras, color: teinte,
      })
      y += c.boite + 0.7
    }

    // ── L'adresse, dressée dans la gouttière de droite ────────────────────
    // Tournée d'un quart de tour, elle se lit du bas vers le haut. L'ancre
    // est le DÉBUT du texte, donc son pied ; les jambages partent vers la
    // droite, d'où le retrait sur le bord.
    p.drawText(adresse, {
      x: X(g.labelW - c.marge - c.site * JAMBAGE),
      y: Y(c.marge + (c.qr + longueurSite) / 2),
      size: corpsSite, font: normal, color: GRIS, rotate: degrees(90),
    })

    // ── La bande de marque, en pied ───────────────────────────────────────
    p.drawRectangle({ x: X(0), y: Y(g.labelH), width: pt(g.labelW), height: pt(c.bande), color: ACCENT })
    p.drawText('Quantinvo', {
      x: X(c.marge),
      y: Y(g.labelH - c.bande / 2 + (c.marque * CAPITALE) / 2),
      size: pt(c.marque), font: gras, color: BLANC,
    })
  })

  return doc
}
