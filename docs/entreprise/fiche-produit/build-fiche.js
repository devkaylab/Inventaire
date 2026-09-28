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
// ⚠️ **La palette et le logo viennent de `../deck/charte.js`.** Deux dessins de
// la même marque divergeraient au premier ajustement, et la fiche cesserait de
// ressembler aux présentations qui l'accompagnent. C'est la règle déjà posée
// pour `encadrer.js`. Depuis le 9 septembre 2026 la charte est « Ardoise » :
// encre, gris minéraux, un vert forêt en accent, des coins nets.
//
// ⚠️ **Arial, pas les polices de la charte.** C'est le document qu'on envoie :
// il doit s'ouvrir à l'identique sur le poste du client, qui n'a ni Archivo ni
// Public Sans installées. Même arbitrage que la version sans suffixe des decks.
//
// ⚠️ **Les téléphones viennent TOUS de `../deck/captures/`, encadrés à la
// volée par `cadrer()`** — la fonction des diapos, le même bezel. Ils lisaient
// avant les PNG tout faits de `../deck/encadrees/` ; ceux-là sont le téléphone
// ENTIER, et le bandeau d'ici le veut coupé (voir `TELH`). `encadrees/` n'est
// qu'un cache de `cadrer()` — `encadrer.js` ne fait rien d'autre —, donc rien
// n'est perdu, et il y a un dessin de moins à tenir synchronisé. Le repli
// local d'`img()` a disparu avec : aucun fichier ne l'empruntait depuis la
// passe de captures du 2 septembre 2026.
//
// ⚠️ **L'écran des écarts s'appelle `audit.png`**, pas `ecarts-audit.png` :
// c'est le nom que les decks emploient, et la passe du 2 septembre l'a versé
// sous ce nom dans `captures/`. Le fichier local qui portait l'autre nom a été
// supprimé — ne pas le recréer, il masquerait le jeu partagé.
//
// L'écran de comptage est disponible (`comptage.png`) depuis cette passe. Il
// n'entre pas dans le bandeau : cinq téléphones à 36 mm remplissent déjà la
// largeur utile, et passer à six les rendrait illisibles. Si on veut le
// montrer, c'est un écran à remplacer, pas un de plus.
//
// ⚠️ **LA FICHE TIENT SUR UNE PAGE, ET IL RESTE 2,5 mm.** Ce n'est pas une
// marge de manœuvre : toute ligne ajoutée en pousse une sur une seconde page —
// le pied, en général, qui part seul et ne se voit pas dans le .docx. **Après
// toute retouche, recompter les pages du PDF**, pas du document Word.

const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, VerticalAlign, convertMillimetersToTwip,
} = require('docx')

const { P, logoPng, qrPng, cadrer } = require('../deck/charte')

// ── Ce qui change avec le produit ───────────────────────────────────────────
// ⚠️ **CES QUATRE LIGNES PÉRIMENT, LE RESTE NON.** Elles vivaient dispersées
// dans la mise en page : « build 4 » au milieu d'un tableau, « pas encore
// publiée » sous un autre, la date dans le pied. La fiche du dossier de Julien
// annonçait encore, le 28 septembre, une application non publiée et un build 4
// — trois builds et une publication de retard. Groupées ici, elles se
// vérifient d'un coup d'œil avant chaque génération.
//
// Le numéro de build se lit dans `app.json`, il ne se recopie pas : c'est la
// seule valeur du lot qui existe ailleurs dans le dépôt.
const APP_JSON = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'app.json'), 'utf8'))
const VERSION = `${APP_JSON.expo.version} (build ${APP_JSON.expo.ios.buildNumber})`
const ETABLIE_LE = '28 septembre 2026'
/** ⚠️ Publiée sur l'App Store le 27 septembre 2026 ; Google Play examine encore. */
const APP_STORE = 'apps.apple.com/fr/app/quantinvo/id6807966626'
/** ⚠️ `…/open`, jamais une fiche de boutique : voir `qrPng` dans la charte. */
const QR_URL = 'https://www.quantinvo.com/open'
/** Côté du code d'installation. 22 mm : la même taille que sur le guide. */
const QR_MM = 22

const F = 'Arial'
const mm = convertMillimetersToTwip

/**
 * Les téléphones du bandeau, dessinés par `cadrer()` avant la mise en page.
 *
 * ⚠️ On ne lit plus les PNG tout faits de `../deck/encadrees/` : ceux-là sont
 * le téléphone ENTIER, et le bandeau de cette fiche le veut coupé (voir
 * `TELH`). `encadrees/` n'est de toute façon qu'un `cadrer()` mis en cache —
 * `encadrer.js` ne fait rien d'autre —, donc on appelle la même fonction,
 * avec la place qu'on a. Un dessin de moins à tenir synchronisé.
 */
const CADRES = new Map()

const img = (f) => {
  const cadre = CADRES.get(f)
  if (!cadre) throw new Error(`téléphone « ${f} » non préparé : voir preparerTelephones()`)
  return cadre
}

/** Encadre et coupe les cinq écrans du bandeau. */
async function preparerTelephones(fichiers) {
  for (const f of fichiers) {
    const { data } = await cadrer(path.join('captures', f), { w: TEL, h: TELH })
    CADRES.set(f, Buffer.from(data.split(',')[1], 'base64'))
  }
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

/**
 * mm → unité de `ImageRun.transformation`.
 *
 * ⚠️⚠️ **CE N'EST PAS DU POINT, C'EST DU PIXEL À 96 DPI.** `docx` convertit
 * `width`/`height` en EMU à raison de 9525 EMU par unité, soit 96 par pouce —
 * pas 72. La première version divisait par 72 : **toute image de cette fiche
 * sortait à 75 % de la taille demandée**. Les téléphones annoncés à 31 mm
 * s'imprimaient à 23,3 mm, le code d'installation à 16,5 mm au lieu de 22.
 * Même défaut, même jour, dans le guide de prise en main (28 septembre 2026),
 * où il a été mesuré sur le PDF produit avant d'être corrigé des deux côtés.
 */
const PXMM = 96 / 25.4

// Cinq téléphones en bandeau, 31 mm de large : à cinq, la largeur utile
// (180 mm) fixe la taille.
const TEL = 31
/**
 * ⚠️ **LE BANDEAU EST COUPÉ, ET C'EST VOULU** — 46 mm au lieu des 65,4 mm
 * d'un téléphone entier. La fiche tient sur UNE page et n'avait plus deux
 * millimètres de marge : rendre aux images leur vraie taille demandait de
 * trouver la place quelque part. On la prend sur le bas des écrans, qui ne
 * porte rien ici — les cinq se lisent par le haut (la liste, la tuile 26 %,
 * les zones, les deux quantités opposées, les quatre totaux) — plutôt que sur
 * leur largeur, qui est ce qui les rend lisibles. C'est le débord des diapos,
 * et `cadrer()` le dessine déjà.
 *
 * ⚠️ Ne PAS reprendre ce procédé dans le guide de prise en main : là-bas le
 * repère cité à côté de l'écran désigne parfois un bouton du bas.
 */
const TELH = 42

/**
 * Les cinq écrans du bandeau, dans l'ordre du parcours. La liste est écrite
 * une fois : c'est elle que `preparerTelephones()` encadre, et elle que la
 * mise en page pose — un écran ajouté ici ne peut pas manquer son cadre.
 */
const ECRANS = [
  ['accueil-superviseur.png', 'Les inventaires'],
  ['inventaire-superviseur.png', 'Le suivi'],
  ['zones.png', 'Zones et balises'],
  ['audit.png', 'Écarts d’audit'],
  ['rapport.png', 'Rapport et écarts'],
]

const tel = (fichier, legende) => cell([
  new Paragraph({
    children: [new ImageRun({ type: 'png', data: img(fichier), transformation: { width: TEL * PXMM, height: TELH * PXMM } })],
    spacing: { after: 70 }, alignment: AlignmentType.CENTER,
  }),
  new Paragraph({
    children: [new TextRun({ text: legende, font: F, size: 14, color: P.SLATE })],
    alignment: AlignmentType.CENTER, spacing: { after: 0 },
  }),
], mm(36), { valign: VerticalAlign.TOP })

const doc = (LOGO, QR) => new Document({
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
            cell([
              new Paragraph({
                children: [new TextRun({ text: 'Quantinvo', font: F, size: 30, bold: true, color: P.INK })],
                spacing: { after: 20 },
              }),
              new Paragraph({
                children: [new TextRun({ text: 'La fiabilisation du stock au quotidien', font: F, size: 14, color: P.SLATE })],
                spacing: { after: 0 },
              }),
            ], mm(72), { valign: VerticalAlign.CENTER, padL: mm(2.5) }),
            cell([new Paragraph({
              children: [new TextRun({ text: 'Fiche produit · application mobile', font: F, size: 16, color: P.SLATE })],
              alignment: AlignmentType.RIGHT, spacing: { after: 0 },
            })], mm(97), { valign: VerticalAlign.CENTER }),
          ],
        }),
      ], [mm(11), mm(72), mm(97)]),

      // ⚠️ Un filet d'encre. C'était la ligne de scan CYAN jusqu'au 9 septembre
      // 2026 — le faisceau du cube isométrique, parti avec lui.
      new Paragraph({
        children: [new TextRun({ text: '', font: F, size: 2 })],
        spacing: { before: 90, after: 260 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: P.INK, space: 1 } },
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
            ...ECRANS.map(([f, legende]) => tel(f, legende)),
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
              fait('iPhone', 'iOS 16.4 ou plus récent.'),
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
              fait('Version', VERSION),
              fait('Catégorie', 'Professionnel (Business)'),
              fait('Classification', '4+ — aucun contenu sensible.'),
              fait('Éditeur', 'Devkaylab'),
              fait('Confidentialité', 'www.quantinvo.com/confidentialite'),
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
            // ⚠️ LE CODE D'ABORD, LES ADRESSES ENSUITE. La fiche se lit sur
            // un écran ou sur papier, et dans les deux cas le lecteur a son
            // téléphone en main : un code se scanne, une adresse se retape.
            cell([
              new Paragraph({
                children: [new ImageRun({ type: 'png', data: QR, transformation: { width: QR_MM * PXMM, height: QR_MM * PXMM } })],
                spacing: { after: 0 },
              }),
            ], mm(24), { valign: VerticalAlign.TOP }),
            cell([], mm(4)),
            cell([
              par(txt('Un seul code, pour tous les téléphones', { size: 17, bold: true, color: P.INK }), { after: 40 }),
              par(txt('Il ouvre l’application si elle est installée, propose la boutique sinon.', { size: 15, color: P.INK2 }), { after: 50 }),
              par(txt('www.quantinvo.com/open', { size: 15, color: P.ACCENT }), { after: 0 }),
            ], mm(74), { padR: mm(3) }),
            cell([], GOUT),
            cell([
              par(txt('App Store', { size: 17, bold: true, color: P.INK }), { after: 40 }),
              par(txt(APP_STORE, { size: 15, color: P.ACCENT }), { after: 90 }),
              par(txt('Google Play · en cours d’examen', { size: 17, bold: true, color: P.INK }), { after: 40 }),
              par(txt('play.google.com/store/search?q=Quantinvo&c=apps', { size: 15, color: P.ACCENT }), { after: 0 }),
            ], mm(72)),
          ],
        }),
      ], [mm(24), mm(4), mm(74), GOUT, mm(72)]),

      // ── Pied ─────────────────────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: `Devkaylab · contact@quantinvo.com · www.quantinvo.com — fiche établie le ${ETABLIE_LE}, application version ${VERSION}.`, font: F, size: 14, color: P.SLATE })],
        spacing: { before: 70, after: 0 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: P.HAIR, space: 5 } },
      }),
    ],
  }],
})

async function main() {
  // `logoPng` rend une donnée « image/png;base64,… » — la forme qu'attend
  // pptxgenjs. Ici il faut les octets.
  const LOGO = Buffer.from((await logoPng(640)).split(',')[1], 'base64')
  // 640 px pour 30 mm : largement de quoi imprimer net, et un QR trop maigre
  // à l'impression est un QR qui ne se lit pas.
  const QR = await qrPng(QR_URL, 640)
  await preparerTelephones(ECRANS.map(([f]) => f))
  const b = await Packer.toBuffer(doc(LOGO, QR))
  fs.writeFileSync(path.join(__dirname, 'Quantinvo-fiche-produit.docx'), b)
  console.log('OK Quantinvo-fiche-produit.docx')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
