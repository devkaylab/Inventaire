// Charte « Ardoise » (v2, 9 septembre 2026) pour les présentations Quantinvo.
// Elle remplace « Papier » v1.1, qui portait l'indigo, le cube isométrique et
// le filet de scan cyan — trois signes retirés du produit les 6 et 7 septembre.
//
// ⚠️ CE QUI FAIT ARDOISE, ET QU'IL NE FAUT PAS DÉFAIRE :
//   · les gris sont MINÉRAUX (tirés vers le vert-gris, jamais vers le bleu) —
//     le bleu nuit se lit « application », l'ardoise se lit « outil » ;
//   · un titre est en ENCRE, pas en couleur. La hiérarchie vient de la taille
//     et de la graisse, pas de la teinte ;
//   · l'accent — un vert forêt — ne sert QU'À CE QUI ENGAGE : une pastille
//     numérotée, un grand chiffre, un bouton dessiné. Trois usages par deck au
//     plus. C'est la règle qui fait la moitié du travail ;
//   · les coins sont NETS (0,04 pouce, soit rien), et un bloc n'a NI OMBRE NI
//     CONTOUR : il se détache parce que son fond diffère de celui de la page.
//     Le contour sur chaque bloc est l'un des trois signes du « fait par IA » ;
//   · le filet de scan cyan A DISPARU. Il était le faisceau du cube ; le cube
//     n'existe plus. Sous l'en-tête, un filet d'encre.
//
// Le fond reste BLANC : tout document qu'on imprime, signe ou projette est sur
// du blanc. Le gris papier (#F2F3F1) ne sert qu'aux blocs en retrait.
//
// Les six générateurs partagent ce module (voir LISEZMOI.md).
// Parti pris de mise en page : des pages de document, pas des grilles de
// cartes. Une colonne de titre à gauche, du texte courant à droite, des
// filets, des captures réelles du produit. Pas d'icône décorative.

const pptxgen = require('pptxgenjs')
const sharp = require('sharp')
const path = require('path')

// ── Palette Ardoise ─────────────────────────────────────────
// Les valeurs sont celles du thème CLAIR du produit
// (web/app/globals.css, :root[data-theme="light"]) — un document se lit sur
// du papier. Toute correction se fait là-bas d'abord, ici ensuite.
const P = {
  PAPER: 'FFFFFF',
  INK: '14181A',        // titres et texte fort
  INK2: '3A423F',       // texte courant
  SLATE: '575F5C',      // texte secondaire, légendes
  DEEP: '14181A',       // sous-titres : de l'encre, jamais une couleur
  ACCENT: '1E4D3B',     // vert forêt — pastilles, grands chiffres, boutons
  TINT: 'E7EDE9',       // fond mis en avant (accent très clair)
  MIST: 'F2F3F1',       // fond de bloc — le papier d'Ardoise
  HAIR: 'E2E5E1',       // filets
  CYAN: '0A6F8A',       // conservé pour compatibilité ; plus aucun filet
  OK: '15704F',         // vert : fait
  WARN: 'A06A12',       // ambre : attention
  BAD: '96291D',        // rouge sombre : refus, manque
}

// FONT_MODE=brand → Archivo/Public Sans (les polices du produit, installées
// dans ~/Library/Fonts) ; sinon Arial, qui s'affiche partout à l'identique.
// ⚠️ Inter et Sora sont parties le 6 septembre 2026 : ce sont les deux valeurs
// par défaut de l'époque, et c'est ce qui donnait au produit son air de
// gabarit. Archivo est un grotesque de signalétique, un peu étroit — un titre
// y tient sur une ligne là où une grotesque large déborde.
const BRAND = process.env.FONT_MODE === 'brand'
const FONT = BRAND ? 'Public Sans' : 'Arial'
const FONTD = BRAND ? 'Archivo' : 'Arial'
const SUFFIX = BRAND ? '-marque' : ''

// Rayon des blocs : 0,04 pouce, soit l'équivalent des 4 px du produit à
// l'échelle de la diapositive. Autant dire des coins nets — c'est voulu.
const RAD = 0.04

const W = 13.33, H = 7.5
const M = 0.8          // marge latérale
const COL = 4.6        // largeur de la colonne de titre, à gauche
const RX = M + COL + 0.5 // début de la colonne de droite
const RW = W - M - RX    // sa largeur

const CAPTURES = path.resolve(__dirname, '../../../web/screenshots')
const MOBILE = path.resolve(__dirname, 'captures')

// ── La marque Quantinvo — « la zone » ───────────────────────
// Un plan de magasin réduit au minimum : le cadre, trois allées, et celle
// qu'on est en train de compter, pleine. C'est le différenciateur du produit
// — une zone par semaine, pas un grand week-end par an — et c'est la seule
// chose que le symbole raconte.
//
// ⚠️ ELLE EST MONOCHROME, et la géométrie est celle de web/components/Logo.tsx
// AU DIXIÈME PRÈS. Le bloc plein (x 3→11) et la première allée (11→14) se
// TOUCHENT : ils se lisent comme une seule forme. Ne pas « corriger » cet
// écart, c'est un choix de Julien.
async function logoPng(px = 640, couleur = '#14181A') {
  const svg = `<svg width="${px}" height="${px}" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="1.5" width="33" height="33" fill="none" stroke="${couleur}" stroke-width="3"/>
    <rect x="11" y="3" width="3" height="30" fill="${couleur}"/>
    <rect x="22" y="3" width="3" height="30" fill="${couleur}"/>
    <rect x="3" y="3" width="8" height="30" fill="${couleur}"/>
  </svg>`
  const buf = await sharp(Buffer.from(svg)).png().toBuffer()
  return 'image/png;base64,' + buf.toString('base64')
}

/**
 * Recadre une capture de `web/screenshots/` (coordonnées en pixels du fichier
 * d'origine). Le recadrage retire l'en-tête et le nom du magasin d'essai.
 */
async function capture(fichier, { left, top, width, height }) {
  const buf = await sharp(path.join(CAPTURES, fichier)).extract({ left, top, width, height }).png().toBuffer()
  return { data: 'image/png;base64,' + buf.toString('base64'), ratio: width / height }
}

/**
 * Encadre une capture d'écran d'iPhone dans un téléphone dessiné : bezel
 * encre, coins arrondis, et le bas **coupé** pour que le téléphone sorte de
 * sa carte au lieu d'y flotter — c'est ce débord qui donne la profondeur.
 *
 * On donne la place disponible (`w` × `h`, en pouces de diapo) plutôt qu'une
 * fraction à couper : la coupe s'en déduit. C'est ce qui évite d'ajuster
 * vingt valeurs à la main dès qu'une carte change de hauteur — et le
 * chevauchement du texte que ça produisait.
 *
 * Les captures vivent dans `captures/`, préparées par `preparer-captures.js`.
 */
async function cadrer(fichier, { w, h }) {
  // Un nom simple désigne une capture de l'application, dans `captures/`. Un
  // chemin (avec un séparateur) est résolu depuis ce fichier : c'est ce qui
  // permet d'encadrer aussi une capture web prise en format téléphone, comme
  // le hub de téléchargement du dossier DSI.
  const chemin = fichier.includes('/') ? path.resolve(__dirname, fichier) : path.join(MOBILE, fichier)
  const meta = await sharp(chemin).metadata()
  const PW = meta.width, PH = meta.height
  // Rayon et bezel proportionnels à la largeur : même géométrie que l'écran
  // réel, quelle que soit la résolution de la capture.
  const R = Math.round(PW * 0.124), B = Math.round(PW * 0.028)
  const OW = PW + 2 * B, OH = PH + 2 * B, OR = R + B
  const masque = Buffer.from(`<svg width="${PW}" height="${PH}"><rect width="${PW}" height="${PH}" rx="${R}" ry="${R}" fill="#fff"/></svg>`)
  const ecran = await sharp(chemin).composite([{ input: masque, blend: 'dest-in' }]).png().toBuffer()
  const bezel = Buffer.from(`<svg width="${OW}" height="${OH}">
    <rect x="0" y="0" width="${OW}" height="${OH}" rx="${OR}" ry="${OR}" fill="#14181A"/>
    <rect x="${B * 0.4}" y="${B * 0.4}" width="${OW - B * 0.8}" height="${OH - B * 0.8}" rx="${OR - B * 0.4}" ry="${OR - B * 0.4}" fill="none" stroke="#3A413E" stroke-width="${Math.max(1, B * 0.12)}"/>
  </svg>`)
  let buf = await sharp(bezel).composite([{ input: ecran, left: B, top: B }]).png().toBuffer()
  // Hauteur visible voulue, en pixels de la capture : la largeur commande.
  const voulue = Math.round(OW * (h / w))
  if (voulue < OH) buf = await sharp(buf).extract({ left: 0, top: 0, width: OW, height: voulue }).png().toBuffer()
  const hauteur = Math.min(voulue, OH)
  return { data: 'image/png;base64,' + buf.toString('base64'), ratio: OW / hauteur, complet: voulue >= OH }
}

const FINE = '\u202F'   // espace fine insécable

/** Applique la typographie française à une chaîne, ou à un tableau de runs. */
function typo(t) {
  if (Array.isArray(t)) return t.map((r) => (r && typeof r.text === 'string' ? { ...r, text: typo(r.text) } : r))
  if (typeof t !== 'string') return t
  return t
    .replace(/ ([»;:!?])/g, FINE + '$1')
    .replace(/« /g, '«' + FINE)
}

async function preparer({ titre }) {
  const pres = new pptxgen()
  pres.layout = 'LAYOUT_WIDE'
  pres.author = 'Devkaylab'
  pres.company = 'Devkaylab'
  pres.title = titre
  // Deux corrections appliquées à tout texte de tous les decks, plutôt qu'à
  // chaque appel — c'est le seul endroit où l'on est sûr de n'en oublier
  // aucun.
  //
  // 1. Le texte se cale en haut de sa boîte par défaut : un paragraphe centré
  //    verticalement dans un bloc flotte à mi-hauteur dès qu'il est court.
  // 2. L'espace avant `» ; : ! ?` et après `«` devient une espace fine
  //    insécable. Sans elle, un guillemet fermant se retrouve seul en début
  //    de ligne — vu sur « Textile femme, 1 à 12 ».
  const addSlide = pres.addSlide.bind(pres)
  pres.addSlide = (...a) => {
    const s = addSlide(...a)
    const addText = s.addText.bind(s)
    s.addText = (t, o = {}) => addText(typo(t), { valign: 'top', ...o })
    return s
  }
  const logo = await logoPng()

  const d = {
    pres, logo,

    /** En-tête : logo + mot-symbole, un filet en dessous.
     * ⚠️ Le filet était CYAN jusqu'au 8 septembre 2026 — c'était le faisceau
     * du cube isométrique. Le cube est parti, le faisceau avec lui. */
    entete(s, mention) {
      s.background = { color: P.PAPER }
      s.addImage({ data: logo, x: M, y: 0.42, w: 0.36, h: 0.36 })
      s.addText('Quantinvo', {
        x: M + 0.48, y: 0.38, w: 3, h: 0.44, fontFace: FONTD, fontSize: 16, bold: true,
        color: P.INK, margin: 0, valign: 'middle',
      })
      if (mention) {
        s.addText(mention, {
          x: W - M - 6, y: 0.38, w: 6, h: 0.44, fontFace: FONT, fontSize: 10,
          color: P.SLATE, align: 'right', margin: 0, valign: 'middle',
        })
      }
      s.addShape('rect', { x: M, y: 0.96, w: W - 2 * M, h: 0.012, fill: { color: P.HAIR }, line: { color: P.HAIR, width: 0 } })
    },

    /** Titre en colonne de gauche : une phrase, deux ou trois lignes. */
    titre(s, text, { x = M, y = 1.45, w = COL, size = 26, h = 2.2 } = {}) {
      s.addText(text, {
        x, y, w, h, fontFace: FONTD, fontSize: size, bold: true, color: P.DEEP,
        margin: 0, lineSpacingMultiple: 1.05,
      })
    },

    /** Titre sur toute la largeur, pour les pages qui n'ont pas de colonne. */
    titreLarge(s, text, { y = 1.4, size = 26 } = {}) {
      s.addText(text, {
        x: M, y, w: W - 2 * M, h: 0.9, fontFace: FONTD, fontSize: size, bold: true, color: P.DEEP,
        margin: 0, lineSpacingMultiple: 1.05,
      })
    },

    /** Texte courant. `text` : chaîne ou tableau de runs pptxgenjs. */
    para(s, text, { x = RX, y = 1.5, w = RW, h = 1, size = 12.5, color = P.INK2, italic = false, bold = false, align = 'left' } = {}) {
      s.addText(text, { x, y, w, h, fontFace: FONT, fontSize: size, color, italic, bold, align, margin: 0, lineSpacingMultiple: 1.18 })
    },

    /**
     * Alinéas à attaque en gras : [['Le grand inventaire.', 'Il se prépare…'], …].
     * Un seul bloc de texte, donc un seul rythme vertical.
     */
    alineas(s, items, { x = RX, y = 1.5, w = RW, h = 4.5, size = 12.5, gap = 10 } = {}) {
      const runs = []
      items.forEach(([lead, text], i) => {
        const last = i === items.length - 1
        if (lead) runs.push({ text: lead + ' ', options: { bold: true, color: P.INK, paraSpaceAfter: gap } })
        runs.push({ text, options: { color: P.INK2, breakLine: !last, paraSpaceAfter: gap } })
      })
      s.addText(runs, { x, y, w, h, fontFace: FONT, fontSize: size, margin: 0, lineSpacingMultiple: 1.18 })
    },

    /** Liste simple, tiret cadratin, sans puce graphique. */
    liste(s, items, { x = RX, y = 1.5, w = RW, h = 4, size = 12.5, gap = 7, color = P.INK2 } = {}) {
      const runs = items.map((t, i) => ({
        text: t, options: { bullet: { code: '2013', indent: 16 }, breakLine: i < items.length - 1, paraSpaceAfter: gap },
      }))
      s.addText(runs, { x, y, w, h, fontFace: FONT, fontSize: size, color, margin: 0, lineSpacingMultiple: 1.15 })
    },

    /** Filet horizontal. */
    filet(s, x, y, w, color = P.HAIR) {
      s.addShape('line', { x, y, w, h: 0, line: { color, width: 0.75 } })
    },

    /** Grande citation, en italique indigo profond. */
    citation(s, text, { x = M, y = 1.5, w = COL, h = 3, size = 22 } = {}) {
      s.addText('« ' + text + ' »', {
        x, y, w, h, fontFace: FONTD, fontSize: size, italic: true, color: P.DEEP, margin: 0, lineSpacingMultiple: 1.15,
      })
    },

    /** Encadré « sur le terrain » : fond brume, petit libellé, texte en italique. */
    encadre(s, libelle, text, { x = RX, y = 5.3, w = RW, h = 1.1, size = 11.5, fill = P.MIST } = {}) {
      s.addShape('roundRect', { x, y, w, h, rectRadius: RAD, fill: { color: fill }, line: { color: fill, width: 0 } })
      s.addText(libelle, { x: x + 0.3, y: y + 0.18, w: w - 0.6, h: 0.25, fontFace: FONT, fontSize: 9.5, bold: true, color: P.SLATE, margin: 0 })
      s.addText(text, { x: x + 0.3, y: y + 0.46, w: w - 0.6, h: h - 0.6, fontFace: FONT, fontSize: size, italic: true, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
    },

    /** Grand chiffre et sa légende, dans la colonne de gauche.
     * Le chiffre est le point de la page : c'est l'un des trois endroits où
     * l'accent a le droit d'apparaître. */
    chiffre(s, n, legende, { x = M, y = 4.0, w = COL, size = 54 } = {}) {
      s.addText(n, { x, y, w, h: 0.95, fontFace: FONTD, fontSize: size, bold: true, color: P.ACCENT, margin: 0 })
      s.addText(legende, { x, y: y + 1.0, w, h: 0.8, fontFace: FONT, fontSize: 12, color: P.SLATE, margin: 0, lineSpacingMultiple: 1.15 })
    },

    /** Pastille numérotée. */
    numero(s, n, x, y, size = 0.42, fill = P.ACCENT) {
      s.addText(String(n), {
        shape: 'ellipse', x, y, w: size, h: size, fill: { color: fill }, line: { color: fill, width: 0 },
        fontFace: FONTD, fontSize: size >= 0.4 ? 12 : 10, bold: true, color: P.PAPER,
        align: 'center', valign: 'middle', margin: 0,
      })
    },

    /** Capture du produit, dans un cadre à filet. `cap` vient de capture(). */
    cadre(s, cap, { x, y, w, h }) {
      // On respecte le ratio : la largeur commande, la hauteur suit, ou l'inverse.
      let cw = w, ch = w / cap.ratio
      if (h && ch > h) { ch = h; cw = h * cap.ratio }
      s.addShape('roundRect', { x: x - 0.06, y: y - 0.06, w: cw + 0.12, h: ch + 0.12, rectRadius: RAD, fill: { color: P.PAPER }, line: { color: P.HAIR, width: 1 } })
      s.addImage({ data: cap.data, x, y, w: cw, h: ch })
      return { w: cw, h: ch }
    },

    /** Légende sous une capture. */
    legende(s, text, { x, y, w }) {
      s.addText(text, { x, y, w, h: 0.4, fontFace: FONT, fontSize: 10, italic: true, color: P.SLATE, margin: 0 })
    },

    /**
     * Bloc « un écran expliqué » : un titre, une phrase, puis le téléphone
     * dans une carte qu'il déborde par le bas.
     *
     * Le texte est **au-dessus de la carte**, jamais dedans : un téléphone
     * assez grand pour être lisible recouvrait le texte quand les deux
     * partageaient le même rectangle.
     */
    ecran(s, { x, y, w, titre, texte, tel, bas = H - 0.72, fill = P.MIST, marge = 0.34 }) {
      let cy = y
      if (titre) {
        s.addText(titre, {
          x, y: cy, w, h: 0.4, fontFace: FONTD, fontSize: 13.5, bold: true,
          color: P.DEEP, margin: 0, lineSpacingMultiple: 1.0,
        })
        cy += 0.42
      }
      if (texte) {
        // Deux lignes, pas trois : au-delà, la carte se réduit et le
        // téléphone n'en montre plus qu'une bande. Les textes sont écrits
        // pour tenir (≈ 105 signes sur une colonne de trois).
        s.addText(texte, {
          x, y: cy, w, h: 0.64, fontFace: FONT, fontSize: 11, color: P.INK2,
          margin: 0, lineSpacingMultiple: 1.15,
        })
        cy += 0.68
      }
      const hc = bas - cy
      s.addShape('roundRect', { x, y: cy, w, h: hc, rectRadius: RAD, fill: { color: fill }, line: { color: fill, width: 0 } })
      const tw = w - 2 * marge, th = tw / tel.ratio
      // Un téléphone entièrement visible se pose au fond de la carte ; un
      // téléphone coupé la déborde, et c'est le cas voulu.
      s.addImage({ data: tel.data, x: x + marge, y: cy + hc - th, w: tw, h: th })
    },

    /**
     * Téléphone **entier**, sans carte : pour un écran dont l'essentiel est en
     * bas (une feuille qui monte, une alerte). Un téléphone qui déborde n'en
     * montrerait que l'en-tête. Il est plus étroit — c'est la contrepartie :
     * à hauteur donnée, on ne gagne en hauteur d'écran qu'en largeur perdue.
     */
    ecranEntier(s, { x, y, h, tel, legende }) {
      const w = h * tel.ratio
      // ⚠️ Pas d'ombre : le bezel encre du téléphone le détache déjà, et
      // Ardoise retire l'ombre de tout ce qui ne flotte pas réellement.
      s.addImage({ data: tel.data, x, y, w, h })
      if (legende) {
        s.addText(legende, {
          x: x - 0.5, y: y + h + 0.14, w: w + 1, h: 0.36, fontFace: FONT, fontSize: 10,
          italic: true, color: P.SLATE, align: 'center', margin: 0,
        })
      }
      return { w }
    },

    /** Pied : mention à gauche, numéro à droite. */
    pied(s, n, mention) {
      s.addText(mention, { x: M, y: H - 0.5, w: 7, h: 0.3, fontFace: FONT, fontSize: 9, color: P.SLATE, margin: 0 })
      s.addText(String(n), { x: W - M - 0.5, y: H - 0.5, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 9, color: P.SLATE, align: 'right', margin: 0 })
    },

    /** Couverture, composée à gauche. */
    couverture(s, { sur, titre, sousTitre, bas }) {
      s.background = { color: P.PAPER }
      s.addImage({ data: logo, x: M, y: 0.75, w: 0.62, h: 0.62 })
      s.addText('Quantinvo', { x: M + 0.78, y: 0.72, w: 5, h: 0.68, fontFace: FONTD, fontSize: 24, bold: true, color: P.INK, margin: 0, valign: 'middle' })
      s.addShape('rect', { x: M, y: 1.62, w: 2.2, h: 0.022, fill: { color: P.INK }, line: { color: P.INK, width: 0 } })
      if (sur) s.addText(sur, { x: M, y: 2.55, w: 9, h: 0.4, fontFace: FONT, fontSize: 13, color: P.SLATE, margin: 0 })
      s.addText(titre, { x: M, y: 3.0, w: 9.5, h: 1.9, fontFace: FONTD, fontSize: 40, bold: true, color: P.DEEP, margin: 0, lineSpacingMultiple: 1.05 })
      if (sousTitre) s.addText(sousTitre, { x: M, y: 5.0, w: 8.2, h: 0.9, fontFace: FONT, fontSize: 15, color: P.INK2, margin: 0, lineSpacingMultiple: 1.2 })
      s.addText(bas, { x: M, y: 6.65, w: 10, h: 0.35, fontFace: FONT, fontSize: 10.5, color: P.SLATE, margin: 0 })
    },

    /** Dernière page, composée à gauche elle aussi. */
    finale(s, { titre, texte, contact, bas }) {
      s.background = { color: P.PAPER }
      s.addImage({ data: logo, x: M, y: 0.75, w: 0.62, h: 0.62 })
      s.addText('Quantinvo', { x: M + 0.78, y: 0.72, w: 5, h: 0.68, fontFace: FONTD, fontSize: 24, bold: true, color: P.INK, margin: 0, valign: 'middle' })
      s.addShape('rect', { x: M, y: 1.62, w: 2.2, h: 0.022, fill: { color: P.INK }, line: { color: P.INK, width: 0 } })
      s.addText(titre, { x: M, y: 2.6, w: 9.5, h: 1.3, fontFace: FONTD, fontSize: 36, bold: true, color: P.DEEP, margin: 0, lineSpacingMultiple: 1.05 })
      s.addText(texte, { x: M, y: 4.0, w: 8, h: 1.3, fontFace: FONT, fontSize: 14.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.2 })
      s.addText(contact, { x: M, y: 5.5, w: 9, h: 0.45, fontFace: FONTD, fontSize: 15, bold: true, color: P.DEEP, margin: 0 })
      s.addText(bas, { x: M, y: 6.65, w: 10, h: 0.35, fontFace: FONT, fontSize: 10.5, color: P.SLATE, margin: 0 })
    },

    /**
     * Téléphone schématique : un cadre, un titre d'écran, des rangées.
     * `rangs` : [{ t: 'texte', style: 'bouton'|'bouton2'|'ligne'|'champ'|'titre' }].
     */
    telephone(s, x, y, w, rangs, { titre } = {}) {
      const h = w * 2.05
      s.addShape('roundRect', { x, y, w, h, rectRadius: 0.28, fill: { color: P.PAPER }, line: { color: P.INK, width: 1.5 } })
      s.addShape('roundRect', { x: x + w / 2 - 0.35, y: y + 0.16, w: 0.7, h: 0.1, rectRadius: 0.05, fill: { color: P.INK }, line: { color: P.INK, width: 0 } })
      const pad = 0.22
      let cy = y + 0.5
      if (titre) {
        s.addText(titre, { x: x + pad, y: cy, w: w - 2 * pad, h: 0.4, fontFace: FONTD, fontSize: 12, bold: true, color: P.INK, margin: 0 })
        cy += 0.5
      }
      for (const r of rangs) {
        const iw = w - 2 * pad
        if (r.style === 'bouton' || r.style === 'bouton2') {
          const fill = r.style === 'bouton' ? P.ACCENT : P.MIST
          s.addShape('roundRect', { x: x + pad, y: cy, w: iw, h: 0.44, rectRadius: 0.1, fill: { color: fill }, line: { color: fill, width: 0 } })
          s.addText(r.t, { x: x + pad, y: cy, w: iw, h: 0.44, fontFace: FONT, fontSize: 10.5, bold: true, color: r.style === 'bouton' ? P.PAPER : P.INK, align: 'center', valign: 'middle', margin: 0 })
          cy += 0.56
        } else if (r.style === 'champ') {
          s.addShape('roundRect', { x: x + pad, y: cy, w: iw, h: 0.4, rectRadius: RAD, fill: { color: P.PAPER }, line: { color: P.HAIR, width: 1 } })
          s.addText(r.t, { x: x + pad + 0.12, y: cy, w: iw - 0.24, h: 0.4, fontFace: FONT, fontSize: 10, color: P.SLATE, valign: 'middle', margin: 0 })
          cy += 0.5
        } else if (r.style === 'titre') {
          s.addText(r.t, { x: x + pad, y: cy, w: iw, h: 0.28, fontFace: FONT, fontSize: 9, bold: true, color: P.SLATE, margin: 0 })
          cy += 0.32
        } else if (r.style === 'espace') {
          cy += r.h || 0.25
        } else {
          s.addText(r.t, { x: x + pad, y: cy, w: iw, h: 0.5, fontFace: FONT, fontSize: 10.5, color: r.color || P.INK, margin: 0, lineSpacingMultiple: 1.12 })
          cy += r.h || 0.5
        }
      }
      return { h }
    },
  }
  return d
}

async function ecrire(pres, base) {
  const fichier = path.join(__dirname, base + SUFFIX + '.pptx')
  await pres.writeFile({ fileName: fichier })
  console.log('OK', fichier)
}

module.exports = { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer, logoPng }
