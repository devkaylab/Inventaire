// Document d'interface SAP ↔ Quantinvo, pour la DSI du premier client.
//
//   npm install
//   node build-interface.js      → Quantinvo-interface-SAP.docx
//   soffice --headless --convert-to pdf Quantinvo-interface-SAP.docx
//
// Demande de Julien, 19 septembre 2026 : le premier client est sous SAP
// (bientôt S/4HANA), fait un inventaire fiscal par les documents d'inventaire
// SAP, pas d'inventaire tournant, et laisse la main à sa DSI. Il faut un
// document qu'une DSI lit avant de s'engager : les flux, les champs, le
// format, la sécurité, qui fait quoi.
//
// ⚠️ C'EST UNE PROPOSITION, ET LE DOCUMENT LE DIT. L'interface n'existe pas
// encore. Chaque section distingue ce que Quantinvo fait AUJOURD'HUI (l'import
// manuel CSV/Excel, le rapport Excel) de ce qui reste À CONSTRUIRE. Une DSI
// qui découvre après coup qu'un flux « décrit » n'existe pas ne lit plus le
// reste.
//
// ⚠️ LES NOMS DE CHAMPS SAP SONT PROPOSÉS, PAS IMPOSÉS : la DSI connaît son
// paramétrage (unités, valorisation, EAN multiples). Ils servent de langue
// commune ; la section « À décider ensemble » liste ce qui reste ouvert.
//
// ⚠️ GÉNÉRÉ, JAMAIS RETOUCHÉ À LA MAIN — comme les decks et la fiche produit.
// La typographie française (espaces insécables avant ; : ! ? », après un
// nombre) vient de `typo()` de ../deck/charte.js, la palette aussi.

const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, ShadingType, Footer, PageNumber, TabStopType,
} = require('docx')
const { P, typo } = require('../deck/charte')

const FONT = 'Arial'
const DATE = '19 septembre 2026'
const VERSION = 'Version 0.1 — proposition'
// A4 (11 906 dxa) moins deux marges de 1 247 : la largeur du texte.
const LARGEUR_UTILE = 11906 - 2 * 1247

// ── Petits gabarits ──────────────────────────────────────────
const t = (text, o = {}) => new TextRun({ text: typo(text), font: FONT, size: 20, color: P.INK2, ...o })
const gras = (text, o = {}) => t(text, { bold: true, color: P.INK, ...o })

function para(runs, o = {}) {
  const enfants = (Array.isArray(runs) ? runs : [runs]).map((r) => (typeof r === 'string' ? t(r) : r))
  return new Paragraph({ children: enfants, spacing: { after: 100, line: 276 }, ...o })
}

function titre1(text) {
  return new Paragraph({
    children: [new TextRun({ text: typo(text), font: FONT, size: 30, bold: true, color: P.INK })],
    spacing: { before: 320, after: 140 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.HAIR, space: 4 } },
  })
}

function titre2(text) {
  return new Paragraph({
    children: [new TextRun({ text: typo(text), font: FONT, size: 23, bold: true, color: P.INK })],
    spacing: { before: 240, after: 100 },
    keepNext: true,
  })
}

/** Alinéa à attaque en gras : « Le lien. Il ouvre… » */
function alinea(lead, text) {
  return para([gras(lead + ' '), t(text)])
}

function puce(text) {
  const runs = Array.isArray(text) ? text.map((r) => (typeof r === 'string' ? t(r) : r)) : [t(text)]
  return new Paragraph({ children: [t('–\t'), ...runs], spacing: { after: 80, line: 280 }, indent: { left: 360, hanging: 360 }, tabStops: [{ type: TabStopType.LEFT, position: 360 }] })
}

function etape(n, lead, text) {
  return new Paragraph({
    children: [t(`${n}.\t`, { bold: true, color: P.ACCENT }), gras(lead + ' '), t(text)],
    spacing: { after: 100, line: 280 },
    indent: { left: 400, hanging: 400 },
    tabStops: [{ type: TabStopType.LEFT, position: 400 }],
  })
}

/** Encadré sur fond brume : ce qui n'existe pas encore, ou un point à retenir. */
function encadre(libelle, text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: aucunBord(),
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: P.MIST },
      margins: { top: 140, bottom: 140, left: 200, right: 200 },
      borders: aucunBord(),
      children: [
        new Paragraph({ children: [t(libelle, { bold: true, size: 17, color: P.SLATE })], spacing: { after: 60 } }),
        new Paragraph({ children: [t(text)], spacing: { line: 280 } }),
      ],
    })] })],
  })
}

function aucunBord() {
  const n = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return { top: n, bottom: n, left: n, right: n, insideHorizontal: n, insideVertical: n }
}

/** Tableau à filets : une ligne d'en-tête grise, des filets fins entre les lignes. */
function tableau(entetes, lignes, largeurs) {
  // ⚠️ EN DXA, PAS EN POURCENTAGE : LibreOffice ignore les largeurs de
  // cellule en pourcentage et répartit les colonnes à parts égales — la
  // colonne « Remarque » finissait deux fois trop étroite.
  const dxa = largeurs.map((l) => Math.round((LARGEUR_UTILE * l) / 100))
  const filet = { style: BorderStyle.SINGLE, size: 4, color: P.HAIR }
  const n = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const cellule = (text, tete, i) => new TableCell({
    width: { size: dxa[i], type: WidthType.DXA },
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    shading: tete ? { type: ShadingType.CLEAR, color: 'auto', fill: P.MIST } : undefined,
    borders: { top: n, left: n, right: n, bottom: filet },
    children: [new Paragraph({
      children: [tete ? t(text, { bold: true, size: 17, color: P.SLATE }) : (i === 0 ? gras(text, { size: 19 }) : t(text, { size: 19 }))],
      spacing: { line: 260 },
    })],
  })
  return new Table({
    width: { size: LARGEUR_UTILE, type: WidthType.DXA },
    columnWidths: dxa,
    borders: aucunBord(),
    rows: [
      new TableRow({ tableHeader: true, children: entetes.map((e, i) => cellule(e, true, i)) }),
      ...lignes.map((l) => new TableRow({ cantSplit: true, children: l.map((c, i) => cellule(c, false, i)) })),
    ],
  })
}

const espace = () => new Paragraph({ children: [], spacing: { after: 120 } })

// ── Le contenu ───────────────────────────────────────────────
const contenu = [
  // Page de titre, composée à gauche comme les decks.
  new Paragraph({ children: [t('Quantinvo', { bold: true, size: 32, color: P.INK })], spacing: { after: 60 } }),
  new Paragraph({ children: [t('Document d’interface pour la direction informatique', { size: 20, color: P.SLATE })], spacing: { after: 480 } }),
  new Paragraph({ children: [t('Échanges entre SAP et Quantinvo', { bold: true, size: 44, color: P.INK })], spacing: { after: 160 } }),
  new Paragraph({ children: [t('Référentiel articles, stock théorique et résultats de comptage pour l’inventaire fiscal.', { size: 24, color: P.INK2 })], spacing: { after: 240 } }),
  para([t(`${VERSION} · ${DATE} · Devkaylab`, { size: 18, color: P.SLATE })]),

  encadre('Statut de ce document',
    'Cette interface n’existe pas encore. Le document propose les formats et le fonctionnement avant de la construire. Aujourd’hui, Quantinvo importe et exporte les mêmes données par fichiers CSV ou Excel, à la main. Les points marqués « à construire » sont ceux que Quantinvo développera après votre accord.'),

  titre1('1. Le principe'),
  para('Deux flux automatiques relient SAP et Quantinvo, pour chaque inventaire.'),
  alinea('De SAP vers Quantinvo.', 'Le référentiel articles et le stock théorique figé par le document d’inventaire SAP.'),
  alinea('De Quantinvo vers SAP.', 'Les quantités comptées, poste par poste, rattachées au même document d’inventaire.'),
  alinea('Toujours à l’initiative de votre SI.', 'Votre système appelle Quantinvo en HTTPS sortant, pour déposer et pour récupérer. Aucune ouverture de port n’est demandée chez vous.'),
  alinea('En deux temps.', 'D’abord par fichiers, compatibles avec votre SAP actuel. Puis par les API de S/4HANA, une fois la migration faite, avec les mêmes données.'),

  titre1('2. Le déroulé d’un inventaire fiscal'),
  etape(1, 'Création du document d’inventaire dans SAP.', 'Par exemple par MI01 ou MI31, selon votre pratique. Le stock théorique est figé à ce moment.'),
  etape(2, 'Export automatique.', 'Votre SI dépose chez Quantinvo le référentiel et le stock théorique du document.'),
  etape(3, 'Préparation dans Quantinvo.', 'L’inventaire est créé pour le magasin, avec ses articles et ses quantités attendues.'),
  etape(4, 'Comptage.', 'Les équipes comptent avec leur téléphone. Le superviseur suit l’avancement et arbitre les écarts.'),
  etape(5, 'Clôture.', 'Le superviseur clôture l’inventaire dans Quantinvo. Les quantités sont alors définitives.'),
  etape(6, 'Récupération des résultats.', 'Votre SI récupère le fichier des quantités comptées.'),
  etape(7, 'Saisie et comptabilisation dans SAP.', 'Votre SI saisit le comptage sur le document (par exemple MI04), puis vos équipes comptabilisent les écarts (MI07). Cette dernière étape reste dans SAP, sous votre contrôle.'),

  titre1('3. Flux 1 — Le référentiel articles'),
  para('Un fichier par magasin. Une ligne par code-barres : un article qui a plusieurs EAN a plusieurs lignes, avec le même code article.', { keepNext: true }),
  tableau(
    ['Donnée Quantinvo', 'Champ SAP proposé', 'Obligatoire', 'Remarque'],
    [
      ['SKU', 'MATNR', 'Oui', 'En texte, zéros de tête conservés.'],
      ['EAN', 'EAN11', 'Oui', 'C’est ce que lit le téléphone.'],
      ['Libellé', 'MAKTX', 'Oui', 'Affiché au comptage et au rapport.'],
      ['Marque', 'À définir', 'Non', 'Aide à reconnaître l’article.'],
      ['Prix d’achat', 'Valorisation (MBEW)', 'Non', 'Sans lui, l’écart en valeur vaut zéro.'],
      ['Unité', 'MEINS', 'Non', 'Voir la section 7.'],
    ],
    [18, 22, 13, 47],
  ),
  espace(),
  alinea('Aujourd’hui.', 'Quantinvo importe déjà ce fichier à la main, en CSV ou Excel. Il reconnaît les noms de colonnes courants : SKU ou Code article, EAN ou Gencod, Libellé ou Désignation, Marque, Prix d’achat.'),
  alinea('À construire.', 'Le dépôt automatique, et la reconnaissance des noms de champs SAP.'),

  titre1('4. Flux 2 — Le stock théorique figé'),
  para('Un fichier par document d’inventaire SAP. Une ligne par poste du document.', { keepNext: true }),
  tableau(
    ['Donnée', 'Champ SAP proposé', 'Obligatoire', 'Remarque'],
    [
      ['Document d’inventaire', 'IBLNR', 'Oui', 'Repris tel quel dans le retour.'],
      ['Exercice', 'GJAHR', 'Oui', 'Idem.'],
      ['Poste', 'ZEILI', 'Oui', 'Idem.'],
      ['Magasin', 'WERKS', 'Oui', 'Relie le document à un magasin Quantinvo.'],
      ['Emplacement de stockage', 'LGORT', 'Oui', 'Repris dans le retour.'],
      ['SKU', 'MATNR', 'Oui', 'Doit exister dans le référentiel.'],
      ['Quantité théorique', 'BUCHM', 'Oui', 'Le stock figé à la création du document.'],
      ['Unité', 'MEINS', 'Non', 'Voir la section 7.'],
    ],
    [26, 20, 13, 41],
  ),
  espace(),
  alinea('Aujourd’hui.', 'Quantinvo importe le stock théorique à la main, avec deux colonnes : SKU et quantité.'),
  alinea('À construire.', 'Le dépôt automatique, la conservation des références SAP (document, exercice, poste, emplacement de stockage) et la création automatique de l’inventaire.'),

  titre1('5. Flux 3 — Les résultats de comptage'),
  para('Un fichier par document d’inventaire, disponible dès la clôture dans Quantinvo. Une ligne par poste du document.', { keepNext: true }),
  tableau(
    ['Donnée', 'Champ SAP proposé', 'Remarque'],
    [
      ['Document, exercice, poste', 'IBLNR, GJAHR, ZEILI', 'Ceux reçus au flux 2.'],
      ['Magasin, emplacement', 'WERKS, LGORT', 'Idem.'],
      ['SKU', 'MATNR', 'Idem.'],
      ['Quantité comptée', 'ERFMG', 'La quantité retenue par Quantinvo.'],
      ['Unité', 'ERFME', 'Celle reçue au flux 2.'],
      ['Compté à zéro', 'XNULL', '« X » quand la quantité comptée vaut zéro.'],
    ],
    [30, 28, 42],
  ),
  espace(),
  alinea('La quantité retenue.', 'C’est l’arbitrage du superviseur s’il existe, sinon la quantité de l’auditeur, sinon celle du compteur. C’est la même règle que dans le rapport Quantinvo.'),
  alinea('Un article attendu que personne n’a trouvé.', 'Il revient avec une quantité de zéro et l’indicateur « X ».'),
  alinea('Un article trouvé hors du document.', 'Il revient dans un second fichier, avec son code article ou son EAN et sa quantité. Il ne peut pas être saisi sur un poste qui n’existe pas : votre équipe décide de son traitement dans SAP.'),
  alinea('Aucun nom de personne.', 'Les fichiers de retour ne contiennent que des articles et des quantités.'),
  alinea('Aujourd’hui.', 'Quantinvo produit un rapport Excel à deux feuilles, « Écarts » et « Détail par zone », téléchargé à la main.'),
  alinea('À construire.', 'Le fichier de retour au format ci-dessus, et sa mise à disposition automatique.'),

  titre1('6. Format, transport et sécurité'),
  titre2('Format des fichiers'),
  puce('CSV en UTF-8, séparateur point-virgule, première ligne pour les en-têtes. Excel (.xlsx) également accepté à l’import.'),
  puce('Codes en texte : les zéros de tête des numéros d’article sont conservés.'),
  puce('Décimales avec un point ou une virgule.'),
  puce('Jusqu’à 100 000 références par inventaire.'),
  puce('Nom de fichier proposé : QTV_<WERKS>_<IBLNR>_<GJAHR>_<type>.csv, où <type> vaut ARTICLES, STOCK ou COMPTAGE.'),
  titre2('Transport'),
  puce('HTTPS uniquement, toujours à l’initiative de votre SI : dépôt des fichiers, puis récupération des résultats.'),
  puce('Un accusé de réception pour chaque dépôt : nombre de lignes lues, lignes refusées et motif.'),
  puce('Un fichier aux en-têtes invalides est refusé en entier, jamais importé à moitié.'),
  puce('Un journal des dépôts et des récupérations, consultable par l’administrateur d’entreprise.'),
  titre2('Sécurité'),
  puce('Une clé technique propre à votre entreprise, révocable à tout moment, sans accès à un autre client.'),
  puce('En option, la limitation des appels aux adresses IP de votre SI.'),
  puce('Les données sont hébergées dans l’Union européenne, en Irlande, comme le reste de Quantinvo. Le dossier technique Quantinvo détaille l’hébergement, les accès et la conservation.'),
  espace(),
  encadre('À construire', 'Les adresses d’appel, la clé technique, l’accusé de réception et le journal. Ils seront décrits précisément dans la version suivante de ce document, après vos retours.'),

  titre1('7. À décider ensemble'),
  alinea('Les unités.', 'Quantinvo compte des pièces : chaque lecture ajoute une unité. Les articles gérés au poids ou au mètre demandent une règle à définir.'),
  alinea('Les EAN multiples.', 'Confirmer que l’export peut sortir tous les EAN d’un article, une ligne par EAN.'),
  alinea('La valorisation.', 'Choisir le prix qui donne l’écart en valeur : prix moyen pondéré, prix standard, ou aucun.'),
  alinea('Les emplacements de stockage.', 'Un document peut couvrir plusieurs emplacements. Faut-il un inventaire Quantinvo par emplacement, ou un seul par magasin ?'),
  alinea('Les lots et numéros de série.', 'Quantinvo ne les gère pas aujourd’hui. Les articles concernés sont-ils dans le périmètre ?'),
  alinea('Le calendrier S/4HANA.', 'La date de migration fixe le moment où les fichiers pourront laisser la place aux API.'),
  alinea('Les contacts.', 'Un interlocuteur technique de chaque côté, et un magasin pilote.'),

  titre1('8. Après la migration vers S/4HANA'),
  para('S/4HANA publie des API standard pour les documents d’inventaire, comme le service API_PHYSICAL_INVENTORY_DOC_SRV. Elles permettent de lire les postes d’un document et d’y saisir les comptages.'),
  para('Les données échangées restent celles des sections 3 à 5. Seul le transport change : un appel d’API remplace le dépôt de fichier.'),
  para('Si SAP reste installé chez vous, cet accès passe par vos outils d’intégration, que votre DSI choisit. Le branchement exact est à valider avec elle, le moment venu.'),

  titre1('9. Qui fait quoi'),
  tableau(
    ['Tâche', 'Votre DSI', 'Quantinvo'],
    [
      ['Export du référentiel et du stock', 'Programme l’export SAP et le dépôt', 'Reçoit, contrôle, prépare l’inventaire'],
      ['Retour des comptages', 'Récupère le fichier et le saisit dans SAP', 'Produit le fichier à la clôture'],
      ['Sécurité', 'Conserve la clé technique', 'Crée la clé et journalise les échanges'],
      ['Échantillons', 'Fournit un document réel anonymisé', 'Valide les formats sur cet échantillon'],
      ['Recette', 'Un magasin pilote', 'Accompagne le premier inventaire'],
    ],
    [30, 35, 35],
  ),
  titre2('Prochaine étape'),
  para('Vos retours sur la section 7, et un échantillon de fichier extrait de SAP. Nous en tirons la version 0.2, avec les adresses d’appel et un planning.'),
  para([gras('Contact : '), t('contact@quantinvo.com')]),
]

const doc = new Document({
  creator: 'Devkaylab',
  title: 'Quantinvo — interface SAP',
  styles: { default: { document: { run: { font: FONT } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1247, right: 1247 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({
        children: [
          t(`Quantinvo · interface SAP · ${VERSION}`, { size: 16, color: P.SLATE }),
          t('\t', { size: 16 }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: P.SLATE }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: 9400 }],
      })] }),
    },
    children: contenu,
  }],
})

Packer.toBuffer(doc).then((buf) => {
  const f = path.join(__dirname, 'Quantinvo-interface-SAP.docx')
  fs.writeFileSync(f, buf)
  console.log('OK', f)
})
