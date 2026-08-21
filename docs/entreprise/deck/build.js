const pptxgen = require('pptxgenjs')
const sharp = require('sharp')
const React = require('react')
const ReactDOMServer = require('react-dom/server')
const {
  FiSmartphone, FiMonitor, FiFileText, FiUploadCloud, FiCheckCircle,
  FiEye, FiCalendar, FiFeather, FiTarget, FiShield, FiLock, FiMapPin,
  FiSlash, FiDownload, FiUsers, FiZap, FiGrid, FiSearch,
} = require('react-icons/fi')

// ── Palette Ink ─────────────────────────────────────────────
const INK = '0B0F19'        // fond
const INK2 = '060910'       // fond profond
const SURFACE = '151A27'    // cartes
const HAIRLINE = '232A39'   // filets
const TEXT = 'F3F5F9'
const TEXT2 = '9BA3B4'
const TEXT3 = '646C7E'
const ACCENT = '6366F1'
const LAVENDER = 'A99CFA'
const CYAN = '38C9FF'
const GOLD = 'FFC349'

// FONT_MODE=brand → vraies polices de la marque (Sora/Inter, à installer sur
// la machine qui présente) ; sinon Arial, sûr partout.
const BRAND = process.env.FONT_MODE === 'brand'
const FONT = BRAND ? 'Inter' : 'Arial'   // corps de texte
const FONTD = BRAND ? 'Sora' : 'Arial'   // titres et grands chiffres
const OUTFILE = BRAND ? 'Quantinvo-presentation-marque.pptx' : 'Quantinvo-presentation.pptx'

// ── Icônes → PNG base64 ─────────────────────────────────────
async function iconPng(Icon, colorHex, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Icon, { color: '#' + colorHex, size, strokeWidth: 1.8 })
  )
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  return 'image/png;base64,' + buf.toString('base64')
}

// ── Logo Quantinvo → PNG base64 ─────────────────────────────
async function logoPng(px = 640) {
  const svg = `<svg width="${px}" height="${px}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="qbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7466F4"/><stop offset="0.52" stop-color="#4636B0"/><stop offset="1" stop-color="#1C153F"/>
    </linearGradient></defs>
    <rect x="6" y="6" width="500" height="500" rx="116" fill="url(#qbg)"/>
    <polygon points="256,146 352,196 256,246 160,196" fill="#A99CFA"/>
    <polygon points="160,196 256,246 256,366 160,316" fill="#6E5DEC"/>
    <polygon points="352,196 352,316 256,366 256,246" fill="#4A3AA8"/>
    <rect x="92" y="282" width="328" height="12" rx="6" fill="#38C9FF"/>
  </svg>`
  const buf = await sharp(Buffer.from(svg)).png().toBuffer()
  return 'image/png;base64,' + buf.toString('base64')
}

async function main() {
  const pres = new pptxgen()
  pres.layout = 'LAYOUT_WIDE'   // 13.33 x 7.5
  const W = 13.33, H = 7.5

  const logo = await logoPng()
  const ic = {}
  const iconDefs = {
    smartphone: [FiSmartphone, LAVENDER],
    monitor: [FiMonitor, LAVENDER],
    file: [FiFileText, LAVENDER],
    upload: [FiUploadCloud, LAVENDER],
    grid: [FiGrid, LAVENDER],
    search: [FiSearch, LAVENDER],
    download: [FiDownload, LAVENDER],
    calendar: [FiCalendar, CYAN],
    feather: [FiFeather, LAVENDER],
    target: [FiTarget, LAVENDER],
    eye: [FiEye, LAVENDER],
    shield: [FiShield, LAVENDER],
    lock: [FiLock, LAVENDER],
    mappin: [FiMapPin, LAVENDER],
    slash: [FiSlash, LAVENDER],
    users: [FiUsers, LAVENDER],
    zap: [FiZap, CYAN],
    check: [FiCheckCircle, '34D399'],
  }
  for (const [k, [I, c]] of Object.entries(iconDefs)) ic[k] = await iconPng(I, c)

  // ── Aides de mise en page ─────────────────────────────────
  function bg(slide, color = INK) {
    slide.background = { color }
  }
  function card(slide, x, y, w, h, opts = {}) {
    slide.addShape('roundRect', {
      x, y, w, h, rectRadius: 0.1,
      fill: { color: opts.fill || SURFACE },
      line: { color: opts.line || HAIRLINE, width: opts.lineW || 1 },
    })
  }
  function iconTile(slide, x, y, dataKey, size = 0.62) {
    slide.addShape('roundRect', {
      x, y, w: size, h: size, rectRadius: 0.09,
      fill: { color: '1E2140' }, line: { color: '31356B', width: 1 },
    })
    const pad = size * 0.22
    slide.addImage({ data: ic[dataKey], x: x + pad, y: y + pad, w: size - 2 * pad, h: size - 2 * pad })
  }
  function eyebrow(slide, text, x = 0.75, y = 0.55) {
    slide.addText(text.toUpperCase(), {
      x, y, w: 8, h: 0.32, fontFace: FONTD, fontSize: 12, bold: true,
      color: LAVENDER, charSpacing: 3, margin: 0,
    })
  }
  function title(slide, text, x = 0.75, y = 0.92, w = 11.8, size = 34) {
    slide.addText(text, {
      x, y, w, h: 0.85, fontFace: FONTD, fontSize: size, bold: true,
      color: TEXT, margin: 0,
    })
  }
  function pageFoot(slide, n) {
    slide.addText('Quantinvo — présentation', {
      x: 0.75, y: H - 0.5, w: 4, h: 0.3, fontFace: FONT, fontSize: 9.5,
      color: TEXT3, margin: 0,
    })
    slide.addText(String(n), {
      x: W - 1.15, y: H - 0.5, w: 0.4, h: 0.3, fontFace: FONT, fontSize: 9.5,
      color: TEXT3, align: 'right', margin: 0,
    })
  }

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    bg(s, INK2)
    s.addImage({ data: logo, x: W / 2 - 0.75, y: 1.05, w: 1.5, h: 1.5 })
    s.addText('Quantinvo', {
      x: 0, y: 2.75, w: W, h: 1.0, align: 'center',
      fontFace: FONTD, fontSize: 54, bold: true, color: TEXT, margin: 0,
    })
    s.addText([
      { text: 'La simplicité ', options: { color: TEXT } },
      { text: 'en main.', options: { color: CYAN } },
    ], {
      x: 0, y: 3.8, w: W, h: 0.6, align: 'center',
      fontFace: FONTD, fontSize: 24, bold: true, margin: 0,
    })
    s.addText("L'outil d'inventaire pour le commerce : vos équipes comptent, vous pilotez, votre stock reste juste toute l'année.", {
      x: 3.16, y: 4.55, w: 7, h: 0.8, align: 'center',
      fontFace: FONT, fontSize: 14, color: TEXT2, margin: 0,
    })
    s.addText('Devkaylab  ·  août 2026  ·  quantinvo.vercel.app', {
      x: 0, y: 6.7, w: W, h: 0.35, align: 'center',
      fontFace: FONT, fontSize: 11, color: TEXT3, margin: 0,
    })
    s.addNotes("Ouvrir sur la promesse : un stock fiable toute l'année, compté par vos propres équipes. Le nom : quantité + inventaire.")
  }

  // ════ 2. Le problème ════
  {
    const s = pres.addSlide()
    bg(s)
    eyebrow(s, 'Le problème')
    title(s, "L'inventaire d'aujourd'hui : une épreuve annuelle")

    // Grand contraste chiffré à gauche
    card(s, 0.75, 2.0, 4.7, 4.5)
    s.addText('1', { x: 1.15, y: 2.5, w: 3.9, h: 1.1, fontFace: FONTD, fontSize: 68, bold: true, color: GOLD, margin: 0 })
    s.addText('comptage par an, dans la plupart des magasins', {
      x: 1.15, y: 3.62, w: 3.9, h: 0.62, fontFace: FONT, fontSize: 14, color: TEXT2, margin: 0,
    })
    s.addText('365', { x: 1.15, y: 4.42, w: 3.9, h: 0.95, fontFace: FONTD, fontSize: 54, bold: true, color: CYAN, margin: 0 })
    s.addText('jours de décisions prises sur ce chiffre — commandes, réassort, démarque', {
      x: 1.15, y: 5.4, w: 3.9, h: 0.85, fontFace: FONT, fontSize: 14, color: TEXT2, margin: 0,
    })

    // Trois douleurs à droite
    const pains = [
      ['calendar', 'Rare et subi', "Le grand inventaire se planifie des mois à l'avance, mobilise tout le monde une nuit entière, puis plus rien pendant un an."],
      ['zap', 'Cher ou approximatif', "Prestataire externalisé : coûteux, à la prestation. Compter seul sur papier ou tableur : lent et source d'erreurs."],
      ['eye', 'Un chiffre déjà périmé', "Le lendemain du comptage, le stock théorique recommence à dériver — et la démarque ne se voit qu'au comptage suivant."],
    ]
    let py = 2.0
    for (const [icon, h4, txt] of pains) {
      card(s, 5.85, py, 6.73, 1.36)
      iconTile(s, 6.13, py + 0.37, icon, 0.62)
      s.addText(h4, { x: 7.0, y: py + 0.18, w: 5.4, h: 0.34, fontFace: FONTD, fontSize: 15, bold: true, color: TEXT, margin: 0 })
      s.addText(txt, { x: 7.0, y: py + 0.52, w: 5.35, h: 0.76, fontFace: FONT, fontSize: 11.5, color: TEXT2, margin: 0 })
      py += 1.57
    }
    pageFoot(s, 2)
    s.addNotes('Le stock est le principal actif du magasin, et on ne le vérifie qu une fois par an. Toutes les décisions du quotidien reposent sur un chiffre incertain.')
  }

  // ════ 3. La solution ════
  {
    const s = pres.addSlide()
    bg(s)
    eyebrow(s, 'La solution')
    title(s, "Comptez quand vous voulez, avec vos équipes")
    s.addText("Inventaire tournant, ciblé ou complet — l'entreprise choisit ses dates, son rythme, son périmètre. Sans prestataire, sans matériel dédié.", {
      x: 0.75, y: 1.72, w: 10.5, h: 0.6, fontFace: FONT, fontSize: 14, color: TEXT2, margin: 0,
    })

    const cols = [
      ['smartphone', "L'app sur le terrain", "Le téléphone devient la douchette : scan caméra, comptage par zones et balises. Un compteur démarre sans formation — un numéro, un code, on scanne.", 'iOS aujourd’hui, Android en cours'],
      ['monitor', 'Le tableau de bord', "Le superviseur suit l'avancement zone par zone, en direct. Écarts repérés, audités et arbitrés pendant que ça compte — pas trois jours après.", 'Sur le web, sans installation'],
      ['file', 'Le rapport', "Export Excel des résultats, des écarts en valeur et du détail par zone. Prêt pour l'analyse et la correction du stock.", 'Vos fichiers importés tels quels'],
    ]
    let cx = 0.75
    for (const [icon, h4, txt, tag] of cols) {
      card(s, cx, 2.55, 3.85, 4.15)
      iconTile(s, cx + 0.32, 2.92, icon, 0.7)
      s.addText(h4, { x: cx + 0.32, y: 3.85, w: 3.2, h: 0.4, fontFace: FONTD, fontSize: 17, bold: true, color: TEXT, margin: 0 })
      s.addText(txt, { x: cx + 0.32, y: 4.3, w: 3.2, h: 1.7, fontFace: FONT, fontSize: 12, color: TEXT2, margin: 0 })
      s.addText(tag, { x: cx + 0.32, y: 6.14, w: 3.2, h: 0.32, fontFace: FONT, fontSize: 10.5, bold: true, color: CYAN, margin: 0 })
      cx += 4.03
    }
    pageFoot(s, 3)
    s.addNotes("Deux visages chez le client : le compteur qui avance (app), le superviseur qui pilote (tableau de bord). Le rapport ferme la boucle.")
  }

  // ════ 4. Comment ça marche ════
  {
    const s = pres.addSlide()
    bg(s)
    eyebrow(s, 'Le parcours')
    title(s, "Quatre étapes, aucune formation")

    const steps = [
      ['upload', '1 — Importez', "Votre référentiel articles et le stock théorique, en CSV ou Excel, tels quels : Quantinvo reconnaît vos noms de colonnes (SKU, EAN, Gencod, Qté…)."],
      ['grid', '2 — Scannez', "Chaque compteur rejoint la session avec un numéro et un code, scanne une balise pour ouvrir sa zone, et compte au fil du rayon."],
      ['search', '3 — Auditez', "Double comptage sur les zones sensibles, écarts mis en évidence, arbitrage par le superviseur — le chiffre validé est un chiffre sûr."],
      ['download', '4 — Corrigez', "L'export Excel sort prêt pour l'analyse et la correction du stock : résultats, écarts en valeur, détail par zone."],
    ]
    let sx = 0.75
    for (const [icon, h4, txt] of steps) {
      card(s, sx, 2.2, 2.86, 4.3)
      iconTile(s, sx + 0.28, 2.56, icon, 0.66)
      s.addText(h4, { x: sx + 0.28, y: 3.44, w: 2.3, h: 0.38, fontFace: FONTD, fontSize: 15.5, bold: true, color: LAVENDER, margin: 0 })
      s.addText(txt, { x: sx + 0.28, y: 3.86, w: 2.32, h: 2.4, fontFace: FONT, fontSize: 11.5, color: TEXT2, margin: 0 })
      sx += 3.055
    }
    // flèches entre les cartes
    for (let i = 0; i < 3; i++) {
      s.addText('→', {
        x: 3.47 + i * 3.055, y: 4.1, w: 0.42, h: 0.5, align: 'center',
        fontFace: FONT, fontSize: 20, bold: true, color: TEXT3, margin: 0,
      })
    }
    s.addText("Plusieurs compteurs en parallèle, plusieurs magasins par entreprise, suivi en direct pendant toute la session.", {
      x: 0.75, y: 6.72, w: 11.8, h: 0.35, fontFace: FONT, fontSize: 12, color: TEXT2, margin: 0,
    })
    pageFoot(s, 4)
    s.addNotes("Insister sur l'import tolérant : « importez vos fichiers tels quels, sans les retravailler ». C'est un vrai différenciateur vécu dès le premier essai.")
  }

  // ════ 5. Le différenciateur : toute l'année ════
  {
    const s = pres.addSlide()
    bg(s, INK2)
    eyebrow(s, 'La différence Quantinvo')
    title(s, "L'inventaire cesse d'être une épreuve, il devient une habitude")

    const pillars = [
      ['feather', 'Simple en main', "Aucune formation : un numéro, un code, on scanne. Le téléphone que l'équipe a déjà en poche suffit."],
      ['target', 'Juste au comptage', "Double comptage, audit, arbitrage des écarts : le stock validé est un chiffre auquel on peut se fier."],
      ['eye', 'Visible en direct', "L'avancement zone par zone sous les yeux du superviseur. L'inventaire se pilote, il ne se subit pas."],
      ['calendar', "Libre toute l'année", "Tournant, ciblé ou complet : comptez en janvier, en juin, un mardi matin. Votre rythme, votre périmètre."],
    ]
    const px = [0.75, 6.79], pyr = [2.05, 4.35]
    let i = 0
    for (const [icon, h4, txt] of pillars) {
      const x = px[i % 2], y = pyr[Math.floor(i / 2)]
      card(s, x, y, 5.79, 2.05)
      iconTile(s, x + 0.3, y + 0.32, icon, 0.64)
      s.addText(h4, { x: x + 1.18, y: y + 0.3, w: 4.3, h: 0.4, fontFace: FONTD, fontSize: 16.5, bold: true, color: TEXT, margin: 0 })
      s.addText(txt, { x: x + 1.18, y: y + 0.74, w: 4.35, h: 1.15, fontFace: FONT, fontSize: 12, color: TEXT2, margin: 0 })
      i++
    }
    s.addText("Plus vous comptez, plus votre stock est fiable — et la licence n'y change rien : elle est forfaitaire.", {
      x: 0.75, y: 6.68, w: 11.8, h: 0.38, fontFace: FONT, fontSize: 12.5, italic: true, color: LAVENDER, margin: 0,
    })
    pageFoot(s, 5)
    s.addNotes("Les quatre piliers de la marque. Le quatrième est la vraie rupture face au prestataire annuel.")
  }

  // ════ 6. Face aux alternatives ════
  {
    const s = pres.addSlide()
    bg(s)
    eyebrow(s, 'Le paysage')
    title(s, 'Trois façons de compter un stock')

    const cols = [
      {
        h: 'Prestataire externalisé', hc: TEXT, line: HAIRLINE, fill: SURFACE,
        rows: ['Facturé à la prestation, chaque année', 'Une date imposée, des équipes externes', "Aucun suivi entre deux passages", "L'équipe du magasin reste spectatrice"],
      },
      {
        h: "Module d'ERP", hc: TEXT, line: HAIRLINE, fill: SURFACE,
        rows: ['Lourd à déployer, pensé pour le siège', 'Terminaux dédiés à acheter et maintenir', 'Formation nécessaire pour chaque saison', 'Générique : le terrain s’adapte à l’outil'],
      },
      {
        h: 'Quantinvo', hc: LAVENDER, line: ACCENT, fill: '171A33',
        rows: ["Licence forfaitaire par magasin, comptages illimités", 'Vos dates, vos équipes, vos téléphones', 'Suivi en direct et rapport à chaque session', "Conçu pour le magasin, prêt en quelques minutes"],
      },
    ]
    let cx = 0.75
    for (const c of cols) {
      card(s, cx, 2.1, 3.85, 4.5, { fill: c.fill, line: c.line, lineW: c.line === ACCENT ? 1.75 : 1 })
      s.addText(c.h, { x: cx + 0.32, y: 2.42, w: 3.2, h: 0.42, fontFace: FONTD, fontSize: 16.5, bold: true, color: c.hc, margin: 0 })
      let ry = 3.05
      for (const r of c.rows) {
        s.addText(r, { x: cx + 0.32, y: ry, w: 3.24, h: 0.82, fontFace: FONT, fontSize: 11.5, color: c.fill === SURFACE ? TEXT2 : TEXT, margin: 0 })
        ry += 0.87
      }
      cx += 4.03
    }
    pageFoot(s, 6)
    s.addNotes("Ne pas dénigrer : le prestataire garde sa place pour l'inventaire fiscal certifié. Quantinvo gagne sur tout le reste de l'année.")
  }

  // ════ 7. Confiance ════
  {
    const s = pres.addSlide()
    bg(s)
    eyebrow(s, 'Confiance')
    title(s, 'Pensé pour l’entreprise, dès le premier jour')

    const items = [
      ['mappin', 'Données hébergées en Europe', "Toutes les données résident dans l'Union européenne. Politique de confidentialité publique, sous-traitants déclarés."],
      ['shield', 'Conforme RGPD', "Droits outillés dans le produit : chaque personne peut exporter ses données ou demander la suppression de son compte."],
      ['lock', 'Accès maîtrisés', "Double authentification, codes de session par magasin, rôles séparés superviseur / compteur : chacun ne voit que son périmètre."],
      ['slash', 'Zéro traceur', "Aucun cookie publicitaire, aucune mesure d'audience, aucune revente de données. L'outil travaille, il n'espionne pas."],
    ]
    const px = [0.75, 6.79], pyr = [2.1, 4.3]
    let i = 0
    for (const [icon, h4, txt] of items) {
      const x = px[i % 2], y = pyr[Math.floor(i / 2)]
      card(s, x, y, 5.79, 1.95)
      iconTile(s, x + 0.3, y + 0.3, icon, 0.62)
      s.addText(h4, { x: x + 1.16, y: y + 0.28, w: 4.35, h: 0.4, fontFace: FONTD, fontSize: 15.5, bold: true, color: TEXT, margin: 0 })
      s.addText(txt, { x: x + 1.16, y: y + 0.7, w: 4.38, h: 1.1, fontFace: FONT, fontSize: 11.5, color: TEXT2, margin: 0 })
      i++
    }
    s.addText("Le suivi d'activité est agrégé, jamais nominatif en direct : on pilote le travail, pas les personnes.", {
      x: 0.75, y: 6.55, w: 11.8, h: 0.38, fontFace: FONT, fontSize: 12, italic: true, color: TEXT2, margin: 0,
    })
    pageFoot(s, 7)
    s.addNotes('Argument fort face aux DSI et aux services RH : conformité RGPD réelle, suivi agrégé, données en Europe.')
  }

  // ════ 8. L'offre ════
  {
    const s = pres.addSlide()
    bg(s, INK2)
    eyebrow(s, "L'offre")
    title(s, 'Une licence par magasin, tout inclus')

    s.addText('Le prix suit la taille de votre stock — à l’année, par magasin, comptages illimités.', {
      x: 0.75, y: 1.72, w: 10.5, h: 0.5, fontFace: FONT, fontSize: 14, color: TEXT2, margin: 0,
    })

    // Grille au volume de stock. Le 2e palier est mis en avant : c'est le
    // magasin type.
    const TIERS = [
      ['Jusqu’à 10 000', 'unités en stock', '1 200 €', false],
      ['10 000 à 50 000', 'unités en stock', '2 400 €', true],
      ['50 000 à 150 000', 'unités en stock', '3 900 €', false],
      ['Plus de 150 000', 'unités en stock', '5 400 €', false],
    ]
    let tx = 0.75
    for (const [range, unit, price, hot] of TIERS) {
      if (hot) {
        card(s, tx, 2.45, 2.86, 3.25, { fill: '171A33', line: ACCENT, lineW: 1.75 })
        s.addText('LE PLUS COURANT', { x: tx + 0.28, y: 2.72, w: 2.3, h: 0.26, fontFace: FONTD, fontSize: 9.5, bold: true, color: CYAN, charSpacing: 2, margin: 0 })
      } else {
        card(s, tx, 2.45, 2.86, 3.25)
      }
      s.addText(String(range), { x: tx + 0.28, y: 3.08, w: 2.32, h: 0.34, fontFace: FONTD, fontSize: 14.5, bold: true, color: TEXT, margin: 0 })
      s.addText(String(unit), { x: tx + 0.28, y: 3.44, w: 2.3, h: 0.3, fontFace: FONT, fontSize: 11.5, color: TEXT3, margin: 0 })
      s.addText(String(price), { x: tx + 0.28, y: 4.05, w: 2.32, h: 0.7, fontFace: FONTD, fontSize: 33, bold: true, color: hot ? LAVENDER : TEXT, margin: 0 })
      s.addText('par an et par magasin', { x: tx + 0.28, y: 4.82, w: 2.3, h: 0.3, fontFace: FONT, fontSize: 11, color: TEXT2, margin: 0 })
      tx += 3.055
    }

    s.addText("Comptez autant de fois que vous voulez : le prix ne bouge pas. Souvent moins qu'un seul passage de prestataire — pour toute l'année.", {
      x: 0.75, y: 5.95, w: 11.8, h: 0.45, fontFace: FONT, fontSize: 12.5, italic: true, color: LAVENDER, margin: 0,
    })
    s.addText([
      { text: 'Tout est compris : ', options: { bold: true, color: TEXT } },
      { text: "application iOS, tableau de bord web, compteurs illimités, mises à jour. Réseau multi-magasins : une licence par magasin, activée à votre rythme.", options: { color: TEXT2 } },
    ], { x: 0.75, y: 6.45, w: 11.8, h: 0.6, fontFace: FONT, fontSize: 12.5, margin: 0 })
    pageFoot(s, 8)
    s.addNotes("Grille au volume de stock : parler en budget d'inventaire annuel, jamais en prix d'application. Le volume se lit dans le fichier de stock du prospect. Tarifs à confirmer au devis.")
  }

  // ════ 9. Appel à l'action ════
  {
    const s = pres.addSlide()
    bg(s, INK2)
    s.addImage({ data: logo, x: W / 2 - 0.55, y: 1.15, w: 1.1, h: 1.1 })
    s.addText('Équipez votre magasin', {
      x: 0, y: 2.55, w: W, h: 0.9, align: 'center',
      fontFace: FONTD, fontSize: 40, bold: true, color: TEXT, margin: 0,
    })
    s.addText("Une démonstration de 30 minutes, sur vos propres fichiers : vous importez votre référentiel, on scanne, et vous repartez avec le rapport.", {
      x: 2.92, y: 3.6, w: 7.5, h: 0.85, align: 'center',
      fontFace: FONT, fontSize: 15, color: TEXT2, margin: 0,
    })
    // bouton
    s.addShape('roundRect', {
      x: W / 2 - 1.7, y: 4.7, w: 3.4, h: 0.62, rectRadius: 0.31,
      fill: { color: ACCENT },
    })
    s.addText('Demander une démonstration', {
      x: W / 2 - 1.7, y: 4.7, w: 3.4, h: 0.62, align: 'center', valign: 'middle',
      fontFace: FONT, fontSize: 13, bold: true, color: 'FFFFFF', margin: 0,
    })
    s.addText('quantinvo.vercel.app   ·   jthiongkay@gmail.com', {
      x: 0, y: 5.75, w: W, h: 0.4, align: 'center',
      fontFace: FONT, fontSize: 13, color: LAVENDER, margin: 0,
    })
    s.addText('Quantinvo, par Devkaylab — l’outil d’inventaire pour le commerce.', {
      x: 0, y: 6.75, w: W, h: 0.35, align: 'center',
      fontFace: FONT, fontSize: 10.5, color: TEXT3, margin: 0,
    })
    s.addNotes('Clore sur la démo concrète : sur les fichiers du prospect, pas sur des données fictives.')
  }

  await pres.writeFile({ fileName: __dirname + '/' + OUTFILE })
  console.log('OK')
}

main().catch((e) => { console.error(e); process.exit(1) })
