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
//
// ⚠️ **TROIS ÉTAPES PAR PAGE, ET LA MISE EN PAGE EST SERRÉE.** Les captures
// sont encadrées dans le téléphone de la charte (`cadrer`) et occupent
// 34 × 71,8 mm : trois tiennent sur une page, la quatrième bascule. Les
// réglages d'espacement de ce fichier ont été mesurés sur le PDF produit, pas
// estimés — un paragraphe vide garde sa hauteur de ligne, d'où les `line: 20`.
// **Après toute retouche, recompter les pages** : huit étapes doivent tenir en
// trois pages, code d'installation et pied compris. Julien, 28 septembre 2026.

const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, VerticalAlign, convertMillimetersToTwip,
} = require('docx')

const { P, logoPng, qrPng, cadrer, typo } = require('../deck/charte')
const { lire } = require('./parcours')

const F = 'Arial'
const mm = convertMillimetersToTwip

/**
 * mm → unité de `ImageRun.transformation`.
 *
 * ⚠️⚠️ **CE N'EST PAS DU POINT, C'EST DU PIXEL À 96 DPI.** `docx` convertit
 * `width`/`height` en EMU à raison de 9525 EMU par unité, soit 96 par pouce —
 * pas 72. La première version divisait par 72 : tout ce que ce guide place en
 * image sortait à **75 % de la taille demandée**, et c'est la vraie raison des
 * captures « trop petites » du 28 septembre 2026. Le téléphone réglé sur 26 mm
 * s'imprimait à 19,5 mm, le code d'installation aussi. Mesuré sur le PDF
 * produit, au pied à coulisse : 69 px à 90 dpi = 19,5 mm.
 */
const PXMM = 96 / 25.4

const ETABLI_LE = '28 septembre 2026'
/** ⚠️ `…/open`, jamais une fiche de boutique : un seul code, les deux plateformes. */
const QR_URL = 'https://www.quantinvo.com/open'

// A4, marges de 15 mm → 180 mm utiles.
/**
 * Largeur du téléphone **bezel compris**. La hauteur n'est pas écrite ici :
 * elle se déduit du cadre que `cadrer()` renvoie, sans quoi un changement de
 * format de capture déformerait l'écran en silence.
 */
const TEL = 34
const COL_TEL = mm(39)
const COL_TXT = mm(141)
/**
 * Hauteur disponible donnée à `cadrer()`. Elle est volontairement hors
 * d'atteinte : `cadrer()` coupe le bas du téléphone quand la place manque —
 * c'est le débord des diapos —, **et un guide ne peut pas se le permettre**.
 * Plusieurs écrans portent leur bouton en bas (« Imprimer » de la planche de
 * balises, « Exporter le rapport Excel »), et le repère cité juste à côté
 * montrerait alors quelque chose que l'image ne contient pas. On vérifie que
 * rien n'a été coupé (`complet`) plutôt que de l'espérer.
 */
const SANS_COUPE = 10_000
/** Côté du code d'installation. 22 mm : la même taille que sur la fiche produit. */
const QR_MM = 22

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

/**
 * Encadre les captures d'un parcours dans le téléphone dessiné de la charte —
 * **le même que les diapos**, bezel encre et coins arrondis (demande de
 * Julien, 28 septembre 2026). On passe par `cadrer()` plutôt que de redessiner
 * un cadre ici : deux dessins du même téléphone finissent par diverger, et
 * celui-là est déjà éprouvé.
 */
async function encadrer(etapes) {
  return Promise.all(etapes.map(async (e) => {
    const { data, ratio, complet } = await cadrer(e.fichier, { w: TEL, h: SANS_COUPE })
    if (!complet) throw new Error(`le téléphone de « ${e.image} » a été coupé : voir SANS_COUPE`)
    return { ...e, png: Buffer.from(data.split(',')[1], 'base64'), hauteur: TEL / ratio }
  }))
}

/** Une étape : le téléphone à gauche, le numéro, le titre, le texte, le repère. */
function etape(e, n) {
  return new TableRow({
    children: [
      cell([
        new Paragraph({
          children: [new ImageRun({ type: 'png', data: e.png, transformation: { width: TEL * PXMM, height: e.hauteur * PXMM } })],
          spacing: { after: 0 },
        }),
      ], COL_TEL, { padR: mm(5) }),
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
      // ⚠️ Centré verticalement : un téléphone fait 80 mm de haut, trois
      // lignes de texte en font 15. Calé en haut, le texte laisse une colonne
      // vide de la hauteur d'une main à côté de chaque écran.
      ], COL_TXT, { valign: VerticalAlign.CENTER }),
    ],
  })
}

/**
 * La respiration entre deux étapes.
 *
 * ⚠️ `line: 20` n'est pas un détail : un paragraphe vide garde sa hauteur de
 * ligne, et ces 4 mm fantômes par intervalle — 28 mm sur huit étapes —
 * repoussaient le code d'installation seul sur une quatrième page.
 */
const espace = (h) => new TableRow({
  children: [cell([new Paragraph({ children: [], spacing: { after: h, line: 20 } })], COL_TEL), cell([], COL_TXT)],
})

function document(p, LOGO, QR, capturesLe) {
  const lignes = []
  p.etapes.forEach((e, i) => {
    lignes.push(etape(e, i + 1))
    if (i < p.etapes.length - 1) lignes.push(espace(130))
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

        par([], { after: 60, line: 20, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: P.INK, space: 6 } } }),

        // ── Titre et intro ───────────────────────────────────────────────
        par(txt(`L’application, écran par écran`, { size: 32, bold: true, color: P.INK }), { before: 110, after: 80 }),
        par(txt(p.intro, { size: 19 }), { after: 60, line: 280 }),
        par(txt(`Chaque étape cite le repère que l’application affiche à ce moment-là. Captures du ${capturesLe}.`, { size: 15, color: P.SLATE, italic: true }), { after: 150 }),

        // ── Les étapes ───────────────────────────────────────────────────
        tableau(lignes, [COL_TEL, COL_TXT]),

        // ── Le code d'installation ───────────────────────────────────────
        par([], { before: 200, after: 100, line: 20, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.HAIR, space: 4 } } }),
        tableau([new TableRow({
          children: [
            cell([new Paragraph({
              children: [new ImageRun({ type: 'png', data: QR, transformation: { width: QR_MM * PXMM, height: QR_MM * PXMM } })],
              spacing: { after: 0 },
            })], mm(31), { padR: mm(5) }),
            cell([
              par(txt('Installer l’application', { size: 20, bold: true, color: P.INK }), { after: 70 }),
              par(txt('Faites scanner ce code par le téléphone. Si l’application est déjà installée, elle s’ouvre ; sinon, la boutique du téléphone lui est proposée — iPhone comme Android.', { size: 17 }), { after: 60, line: 270 }),
              par(txt('www.quantinvo.com/open', { size: 16, color: P.ACCENT }), { after: 0 }),
            ], mm(149)),
          ],
        })], [mm(31), mm(149)]),

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
    const etapes = await encadrer(p.etapes)
    const b = await Packer.toBuffer(document({ ...p, etapes }, LOGO, QR, capturesLe))
    const nom = `Quantinvo-prise-en-main-${p.cle}.docx`
    fs.writeFileSync(path.join(__dirname, nom), b)
    console.log(`OK ${nom} — ${p.etapes.length} étapes, téléphone ${TEL} × ${etapes[0].hauteur.toFixed(1)} mm`)
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
