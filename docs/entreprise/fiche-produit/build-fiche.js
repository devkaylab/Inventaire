// Fiche produit A4 — une page, l'application mobile Quantinvo.
//
//   npm install docx        (pptxgenjs et sharp viennent avec les decks)
//   node build-fiche.js     → Quantinvo-fiche-produit.docx
//   soffice --headless --convert-to pdf Quantinvo-fiche-produit.docx
//
// Elle sert deux usages à la fois : la fiche qu'on remet à un client, et le
// mémo de ce qu'App Store Connect et la Play Console demandent à la
// publication — nom, identifiant, version, catégorie, classification, éditeur,
// confidentialité, assistance, compatibilité.
//
// ⚠️ **Elle est GÉNÉRÉE, jamais retouchée à la main** — comme les decks. Une
// correction faite dans Word serait écrasée à la prochaine génération : on
// modifie ce script.
//
// ⚠️ **La palette et le logo viennent de `../deck/charte.js`.** Deux dessins du
// même cube divergeraient au premier ajustement, et la fiche cesserait de
// ressembler aux présentations qui l'accompagnent. C'est la règle déjà posée
// pour `encadrer.js`.
//
// ⚠️ **Arial, pas les polices de la charte.** C'est le document qu'on envoie :
// il doit s'ouvrir à l'identique sur le poste du client, qui n'a ni Sora ni
// Inter installées. Même arbitrage que la version sans suffixe des decks.
//
// ⚠️ **Les téléphones viennent de `../deck/encadrees/`**, sauf `accueil-superviseur.png`
// qui est local : il a été repris le 2 septembre 2026, alors que le jeu du deck
// date du 27 août. À la prochaine passe de captures, il rejoindra les autres et
// cette exception disparaîtra — voir « Ce qu'il reste à faire » dans
// `../deck/LISEZMOI.md`.
//
// ⚠️ **Trois des cinq écrans viennent du jeu du 27 août**, et ce sont ceux qui
// n'ont PAS changé depuis. Les deux autres — écarts d'audit et rapport — ont
// été repris le 2 septembre 2026 : l'écran des écarts avait été récrit le
// 29 août (les deux boutons Compteur / Auditeur), sa vieille capture montrait
// une interface disparue.
//
// L'écran de comptage reste absent pour la même raison, et lui n'a pas pu être
// repris : sa capture montre une liste de scans que l'application affiche
// désormais derrière un bouton. Il entrera à la prochaine passe de captures.

const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, VerticalAlign, convertMillimetersToTwip,
} = require('docx')

const { P, logoPng } = require('../deck/charte')

const F = 'Arial'
const mm = convertMillimetersToTwip
const ENCADREES = path.join(__dirname, '..', 'deck', 'encadrees')

/** Un téléphone encadré : celui du deck, ou l'exception locale. */
const img = (f) => {
  const local = path.join(__dirname, f)
  return fs.readFileSync(fs.existsSync(local) ? local : path.join(ENCADREES, f))
}

const AUCUN = { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }

const txt = (t, o = {}) => new TextRun({ text: t, font: F, size: o.size ?? 17, color: o.color ?? P.INK2, bold: o.bold, italics: o.italics })
const par = (runs, o = {}) => new Paragraph({
  children: Array.isArray(runs) ? runs : [runs],
  spacing: { before: o.before ?? 0, after: o.after ?? 60, line: o.line ?? 250 },
  alignment: o.align,
  ...(o.border ? { border: o.border } : {}),
})

/** Titre de section : petites capitales indigo, filet dessous. */
const section = (t) => new Paragraph({
  children: [new TextRun({ text: t.toUpperCase(), font: F, size: 15, bold: true, color: P.DEEP, characterSpacing: 24 })],
  spacing: { before: 160, after: 80 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.HAIR, space: 4 } },
})

/** Puce dessinée à la main : un tiret cadratin indigo, pas une liste Word —
 *  une seule ligne de rendu à tenir, et aucun retrait à corriger. */
const puce = (t) => new Paragraph({
  children: [new TextRun({ text: '— ', font: F, size: 17, color: P.ACCENT, bold: true }), txt(t)],
  spacing: { after: 70, line: 250 },
  indent: { left: mm(0), hanging: mm(3.6) },
})

/** Ligne « libellé : valeur » des blocs de faits. */
const fait = (k, v) => new Paragraph({
  children: [
    new TextRun({ text: k + '  ', font: F, size: 16, bold: true, color: P.INK }),
    new TextRun({ text: v, font: F, size: 16, color: P.INK2 }),
  ],
  spacing: { after: 55, line: 240 },
})

const cell = (children, w, o = {}) => new TableCell({
  children, width: { size: w, type: WidthType.DXA },
  margins: { top: o.pad ?? 0, bottom: o.pad ?? 0, left: o.padL ?? 0, right: o.padR ?? 0 },
  verticalAlign: o.valign,
  ...(o.shade ? { shading: { type: ShadingType.CLEAR, fill: o.shade, color: 'auto' } } : {}),
})

const tableau = (rows, widths) => new Table({
  rows, columnWidths: widths, borders: AUCUN,
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
})

// ── Largeurs ────────────────────────────────────────────────────────────────
// A4 = 210 mm, marges 15 mm → 180 mm utiles.
const COL = mm(87)   // une colonne sur deux
const GOUT = mm(6)   // la gouttière entre elles

// Cinq téléphones en bandeau : 31 mm de large, rapport 637/1345. À cinq, la
// largeur utile (180 mm) fixe la taille — on ne choisit que les légendes.
const TEL = 31
const TELH = Math.round((TEL * 1345 / 637) * 10) / 10
const PX = 2.8346 // mm → points

const tel = (fichier, legende) => cell([
  new Paragraph({
    children: [new ImageRun({ type: 'png', data: img(fichier), transformation: { width: TEL * PX, height: TELH * PX } })],
    spacing: { after: 70 }, alignment: AlignmentType.CENTER,
  }),
  new Paragraph({
    children: [new TextRun({ text: legende, font: F, size: 14, color: P.SLATE })],
    alignment: AlignmentType.CENTER, spacing: { after: 0 },
  }),
], mm(36), { valign: VerticalAlign.TOP })

const doc = (LOGO) => new Document({
  creator: 'Devkaylab', title: 'Quantinvo — fiche produit', description: "Application d'inventaire pour le commerce de détail",
  sections: [{
    properties: { page: { margin: { top: mm(12), bottom: mm(10), left: mm(15), right: mm(15) } } },
    children: [

      // ── En-tête : la tuile, le mot-symbole, la nature du document ────────
      tableau([
        new TableRow({
          children: [
            cell([new Paragraph({
              children: [new ImageRun({ type: 'png', data: LOGO, transformation: { width: 34, height: 34 } })],
              spacing: { after: 0 },
            })], mm(11), { valign: VerticalAlign.CENTER }),
            cell([new Paragraph({
              children: [new TextRun({ text: 'Quantinvo', font: F, size: 30, bold: true, color: P.INK })],
              spacing: { after: 0 },
            })], mm(60), { valign: VerticalAlign.CENTER, padL: mm(2.5) }),
            cell([new Paragraph({
              children: [new TextRun({ text: 'Fiche produit · application mobile', font: F, size: 16, color: P.SLATE })],
              alignment: AlignmentType.RIGHT, spacing: { after: 0 },
            })], mm(109), { valign: VerticalAlign.CENTER }),
          ],
        }),
      ], [mm(11), mm(60), mm(109)]),

      // La ligne de scan cyan — le seul endroit où le cyan a droit de cité.
      new Paragraph({
        children: [new TextRun({ text: '', font: F, size: 2 })],
        spacing: { before: 90, after: 260 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: P.CYAN, space: 1 } },
      }),

      // ── Ce que c'est ─────────────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: 'L’inventaire compté au téléphone', font: F, size: 30, bold: true, color: P.DEEP })],
        spacing: { after: 150, line: 280 },
      }),
      tableau([
        new TableRow({
          children: [
            cell([
              par(txt('Quantinvo est un outil d’inventaire pour le commerce de détail. Le site prépare et pilote la session — fichiers, emplacements, équipe, rapport. L’application fait le travail de terrain : elle compte, en rayon, avec le téléphone que chacun a déjà en poche.', { size: 18 }), { after: 0, line: 280 }),
            ], mm(116), { padR: mm(6) }),
            // L'encart tient la promesse commerciale à l'écart du texte : deux
            // lignes qu'on lit même en survolant la page.
            cell([
              par(txt('Une licence par magasin.', { size: 17, bold: true, color: P.DEEP }), { after: 50 }),
              par(txt('Une équipe illimitée, aucun matériel à louer : chacun compte avec le téléphone qu’il a déjà.', { size: 16 }), { after: 0 }),
            ], mm(64), { pad: mm(2.4), padL: mm(3.4), padR: mm(3.4), shade: P.TINT }),
          ],
        }),
      ], [mm(116), mm(64)]),

      // ── Ce qu'elle fait, en deux colonnes ────────────────────────────────
      section('Ce que fait l’application'),
      tableau([
        new TableRow({
          children: [
            cell([
              puce('Lit les codes-barres à la caméra, au clavier, ou avec une douchette Bluetooth.'),
              puce('Découpe le magasin en zones par des balises QR imprimées depuis l’application : plusieurs personnes comptent en même temps, chacune son rayon, sans se gêner.'),
              puce('Second passage d’audit, écarts calculés en unités et en valeur, arbitrage à l’écran.'),
            ], COL, { padR: mm(3) }),
            cell([], GOUT),
            cell([
              puce('Continue sans réseau : les comptages faits en réserve sont mis en file et repartent seuls dès le retour du signal.'),
              puce('Le superviseur suit l’avancement en direct, rayon par rayon, depuis son écran.'),
              puce('Rapport d’inventaire et export tableur à la clôture.'),
            ], COL),
          ],
        }),
      ], [COL, GOUT, COL]),

      // ── Le bandeau des écrans ────────────────────────────────────────────
      new Paragraph({ children: [txt('')], spacing: { after: 120 } }),
      tableau([
        new TableRow({
          children: [
            tel('accueil-superviseur.png', 'Les inventaires'),
            tel('inventaire-superviseur.png', 'Le suivi'),
            tel('zones.png', 'Zones et balises'),
            tel('ecarts-audit.png', 'Écarts d’audit'),
            tel('rapport.png', 'Rapport et écarts'),
          ],
        }),
      ], [mm(36), mm(36), mm(36), mm(36), mm(36)]),
      // Les légendes touchaient le titre de la section suivante.
      new Paragraph({ children: [txt('')], spacing: { after: 90 } }),

      // ── Sécurité : ce qu'une DSI demande en premier ──────────────────────
      section('Sécurité et confidentialité'),
      tableau([
        new TableRow({
          children: [
            cell([
              puce('Double authentification (TOTP) sur l’application comme sur le site, activable par chaque compte.'),
              puce('Chaque compte ne voit que son entreprise, et un compteur que ses propres comptages : le cloisonnement est appliqué en base, pas seulement à l’écran.'),
              puce('Personne ne s’inscrit seul. Les accès sont ouverts par l’administrateur de l’entreprise.'),
            ], COL, { padR: mm(3) }),
            cell([], GOUT),
            cell([
              puce('Mot de passe de 12 caractères au minimum, et refus de ceux qui figurent dans les fuites connues.'),
              puce('Le jeton de session vit dans le trousseau du téléphone, chiffré par le système. Une session inutilisée expire au bout de 30 jours.'),
              puce('Données hébergées dans l’Union européenne. Aucun traceur, aucune mesure d’audience.'),
            ], COL),
          ],
        }),
      ], [COL, GOUT, COL]),

      // ── Deux blocs de faits, côte à côte ─────────────────────────────────
      new Paragraph({ children: [txt('')], spacing: { after: 100 } }),
      tableau([
        new TableRow({
          children: [
            cell([
              section('Compatibilité'),
              fait('iPhone', 'iOS 16.4 ou plus récent. iPad pris en charge.'),
              fait('Android', '7.0 (API 24) ou plus récent.'),
              fait('Langue', 'français. Portrait, thèmes clair et sombre.'),
              fait('Douchettes', 'lecteurs Bluetooth en mode clavier (HID).'),
              fait('Accès demandé', 'la caméra, pour lire les codes-barres. Aucune photo n’est enregistrée.'),
            ], COL, { pad: mm(2), padL: mm(3), padR: mm(3), shade: P.MIST }),
            cell([], GOUT),
            cell([
              section('Publication'),
              fait('Nom', 'Quantinvo'),
              fait('Identifiant', 'com.quantinvo.app'),
              fait('Version', '1.0.0'),
              fait('Catégorie', 'Professionnel (Business)'),
              fait('Classification', '4+ — aucun contenu sensible.'),
              fait('Éditeur', 'Devkaylab'),
              fait('Confidentialité', 'devkaylab.github.io/Inventaire/privacy.html'),
              fait('Assistance', 'contact@quantinvo.com · www.quantinvo.com'),
            ], COL, { pad: mm(2), padL: mm(3), padR: mm(3), shade: P.MIST }),
          ],
        }),
      ], [COL, GOUT, COL]),

      // ── Où la télécharger ────────────────────────────────────────────────
      section('Où la télécharger'),
      tableau([
        new TableRow({
          children: [
            cell([
              par(txt('App Store', { size: 17, bold: true, color: P.INK }), { after: 40 }),
              par(txt('apps.apple.com/fr/search?term=Quantinvo', { size: 15, color: P.ACCENT }), { after: 0 }),
            ], COL, { padR: mm(3) }),
            cell([], GOUT),
            cell([
              par(txt('Google Play', { size: 17, bold: true, color: P.INK }), { after: 40 }),
              par(txt('play.google.com/store/search?q=Quantinvo&c=apps', { size: 15, color: P.ACCENT }), { after: 0 }),
            ], COL),
          ],
        }),
      ], [COL, GOUT, COL]),
      new Paragraph({
        children: [new TextRun({ text: 'L’application n’est pas encore publiée. Ces deux adresses mènent aujourd’hui à la recherche de chaque boutique, et afficheront la fiche le jour de la mise en ligne.', font: F, size: 15, color: P.SLATE, italics: true })],
        spacing: { before: 80, after: 0 },
      }),

      // ── Pied ─────────────────────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: 'Devkaylab · contact@quantinvo.com · www.quantinvo.com — fiche établie le 2 septembre 2026, application version 1.0.0.', font: F, size: 14, color: P.SLATE })],
        spacing: { before: 130, after: 0 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: P.HAIR, space: 5 } },
      }),
    ],
  }],
})

async function main() {
  // `logoPng` rend une donnée « image/png;base64,… » — la forme qu'attend
  // pptxgenjs. Ici il faut les octets.
  const LOGO = Buffer.from((await logoPng(640)).split(',')[1], 'base64')
  const b = await Packer.toBuffer(doc(LOGO))
  fs.writeFileSync(path.join(__dirname, 'Quantinvo-fiche-produit.docx'), b)
  console.log('OK Quantinvo-fiche-produit.docx')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
