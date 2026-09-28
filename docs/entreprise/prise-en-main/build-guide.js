// Le guide de prise en main, un PDF par rôle.
//   node build-guide.js
//   → Quantinvo-prise-en-main-compteur.docx / .pdf
//   → Quantinvo-prise-en-main-superviseur.docx / .pdf
//
// ⚠️⚠️ **LE CONTENU N'EST PAS ÉCRIT ICI.** Il est lu dans `web/lib/priseEnMain.ts`
// par `parcours.js` — la même source que la page du site. Deux documents qui
// décrivent les mêmes gestes et qu'on entretient séparément finissent toujours
// par se contredire ; ici, une étape ajoutée sur le site apparaît dans le PDF
// à la génération suivante, et une capture manquante FAIT ÉCHOUER le script au
// lieu de laisser un trou.
//
// ⚠️ **UN DOCUMENT PAR RÔLE, ET C'EST LE POINT.** Sur le site les deux
// parcours vivent derrière un sélecteur ; sur papier il faut pouvoir tendre
// une feuille à une recrue sans qu'elle traverse six écrans de superviseur
// pour trouver les siens. Demande de Julien, 28 septembre 2026.
//
// ⚠️ **LE CODE D'INSTALLATION EST SUR CHAQUE GUIDE.** Un guide papier qui
// montre l'application sans dire où la prendre est un cul-de-sac. Il porte
// `…/open`, jamais une fiche de boutique — voir `qrPng` dans la charte.

const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, VerticalAlign, convertMillimetersToTwip,
} = require('docx')

const { P, logoPng, qrPng, typo } = require('../deck/charte')
const { lire } = require('./parcours')

const F = 'Arial'
const mm = convertMillimetersToTwip
const PX = 2.8346 // mm → points

const ETABLI_LE = '28 septembre 2026'
/** ⚠️ `…/open`, jamais une fiche de boutique : un seul code, les deux plateformes. */
const QR_URL = 'https://www.quantinvo.com/open'

// A4, marges de 15 mm → 180 mm utiles. Le téléphone tient 30 mm, le texte le reste.
const TEL = 26
const TELH = Math.round((TEL * 1311 / 603) * 10) / 10
const COL_TEL = mm(30)
const COL_TXT = mm(150)

const AUCUN = ['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical']
  .reduce((a, k) => ({ ...a, [k]: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }), {})

const txt = (t, o = {}) => new TextRun({ text: typo(t), font: F, size: o.size ?? 18, bold: o.bold, italics: o.italic, color: o.color ?? P.INK2 })
const par = (enfants, o = {}) => new Paragraph({
  children: Array.isArray(enfants) ? enfants : [enfants],
  spacing: { after: o.after ?? 80, before: o.before ?? 0, line: o.line },
  alignment: o.align,
  ...(o.border ? { border: o.border } : {}),
})
const cell = (children, width, o = {}) => new TableCell({
  children: children.length ? children : [new Paragraph('')],
  width: { size: width, type: WidthType.DXA },
  margins: { top: o.pad ?? 0, bottom: o.pad ?? 0, left: o.padL ?? 0, right: o.padR ?? 0 },
  borders: AUCUN,
  verticalAlign: o.valign ?? VerticalAlign.TOP,
  ...(o.shade ? { shading: { type: ShadingType.CLEAR, fill: o.shade, color: 'auto' } } : {}),
})
const tableau = (rows, widths) => new Table({
  rows, columnWidths: widths, borders: AUCUN,
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
})

/** Une étape : le téléphone à gauche, le numéro, le titre, le texte, le repère. */
function etape(e, n) {
  return new TableRow({
    children: [
      cell([
        new Paragraph({
          children: [new ImageRun({ type: 'png', data: fs.readFileSync(e.fichier), transformation: { width: TEL * PX, height: TELH * PX } })],
          spacing: { after: 0 },
        }),
      ], COL_TEL, { padR: mm(4) }),
      cell([
        par([
          new TextRun({ text: `${n}. `, font: F, size: 20, bold: true, color: P.ACCENT }),
          new TextRun({ text: typo(e.titre), font: F, size: 20, bold: true, color: P.INK }),
        ], { after: 70 }),
        par(txt(e.texte, { size: 18 }), { after: 70, line: 280 }),
        // Le repère : ce que l'application affiche à ce moment-là. C'est lui
        // qui relie le papier à l'écran au lieu d'en faire un document
        // parallèle.
        par(txt(e.repere, { size: 16, italic: true, color: P.SLATE }), { after: 0 }),
      ], COL_TXT),
    ],
  })
}

const espace = (h) => new TableRow({
  children: [cell([new Paragraph({ children: [], spacing: { after: h } })], COL_TEL), cell([], COL_TXT)],
})

function document(p, LOGO, QR, capturesLe) {
  const lignes = []
  p.etapes.forEach((e, i) => {
    lignes.push(etape(e, i + 1))
    if (i < p.etapes.length - 1) lignes.push(espace(160))
  })

  return new Document({
    creator: 'Devkaylab', title: `Quantinvo — prise en main · ${p.nom}`,
    styles: { default: { document: { run: { font: F, size: 18, color: P.INK2 } } } },
    sections: [{
      properties: { page: { margin: { top: mm(15), right: mm(15), bottom: mm(15), left: mm(15) } } },
      children: [
        // ── En-tête ──────────────────────────────────────────────────────
        tableau([new TableRow({
          children: [
            cell([new Paragraph({
              children: [new ImageRun({ type: 'png', data: LOGO, transformation: { width: 34, height: 34 } })],
              spacing: { after: 0 },
            })], mm(14), { padR: mm(3) }),
            cell([
              par(txt('Quantinvo', { size: 26, bold: true, color: P.INK }), { after: 0 }),
              par(txt('La fiabilisation du stock au quotidien', { size: 15, color: P.SLATE }), { after: 0 }),
            ], mm(86)),
            cell([
              par(txt(`Prise en main · ${p.nom}`, { size: 15, color: P.SLATE }), { after: 0, align: AlignmentType.RIGHT }),
            ], mm(80)),
          ],
        })], [mm(14), mm(86), mm(80)]),

        par([], { after: 60, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: P.INK, space: 6 } } }),

        // ── Titre et intro ───────────────────────────────────────────────
        par(txt(`L’application, écran par écran`, { size: 32, bold: true, color: P.INK }), { before: 180, after: 90 }),
        par(txt(p.intro, { size: 19 }), { after: 60, line: 280 }),
        par(txt(`Chaque étape cite le repère que l’application affiche à ce moment-là. Captures du ${capturesLe}.`, { size: 15, color: P.SLATE, italic: true }), { after: 220 }),

        // ── Les étapes ───────────────────────────────────────────────────
        tableau(lignes, [COL_TEL, COL_TXT]),

        // ── Le code d'installation ───────────────────────────────────────
        par([], { before: 240, after: 120, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.HAIR, space: 4 } } }),
        tableau([new TableRow({
          children: [
            cell([new Paragraph({
              children: [new ImageRun({ type: 'png', data: QR, transformation: { width: 26 * PX, height: 26 * PX } })],
              spacing: { after: 0 },
            })], mm(30), { padR: mm(4) }),
            cell([
              par(txt('Installer l’application', { size: 20, bold: true, color: P.INK }), { after: 70 }),
              par(txt('Faites scanner ce code par le téléphone. Si l’application est déjà installée, elle s’ouvre ; sinon, la boutique du téléphone lui est proposée — iPhone comme Android.', { size: 17 }), { after: 60, line: 270 }),
              par(txt('www.quantinvo.com/open', { size: 16, color: P.ACCENT }), { after: 0 }),
            ], mm(150)),
          ],
        })], [mm(30), mm(150)]),

        // ── Pied ─────────────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: typo(`Devkaylab · contact@quantinvo.com · www.quantinvo.com — guide établi le ${ETABLI_LE}.`), font: F, size: 14, color: P.SLATE })],
          spacing: { before: 200, after: 0 },
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: P.HAIR, space: 5 } },
        }),
      ],
    }],
  })
}

async function main() {
  const { parcours, capturesLe, capturesARefaire } = lire()
  if (capturesARefaire) {
    // ⚠️ Le site affiche un avertissement dans ce cas ; un PDF qu'on tend à
    // quelqu'un ne peut pas s'excuser. On refuse de le fabriquer.
    throw new Error('CAPTURES_A_REFAIRE est vrai : refaire la passe avant de générer les guides.')
  }
  const LOGO = Buffer.from((await logoPng(640)).split(',')[1], 'base64')
  const QR = await qrPng(QR_URL, 640)

  for (const p of parcours) {
    const b = await Packer.toBuffer(document(p, LOGO, QR, capturesLe))
    const nom = `Quantinvo-prise-en-main-${p.cle}.docx`
    fs.writeFileSync(path.join(__dirname, nom), b)
    console.log(`OK ${nom} — ${p.etapes.length} étapes`)
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
