// Blocs partagés par plusieurs decks. Un bloc arrive ici dès qu'il est dessiné
// dans deux présentations : la grille des offres l'était dans quatre, et c'est
// exactement le genre de chose qui finit par diverger d'un fichier à l'autre.

const { P, FONT, FONTD } = require('./charte')
const { lire, euros, economie } = require('./offres')

const GRILLE = lire()

/**
 * Les trois offres en colonnes, telles que la page publique les présente.
 *
 * `rythme` vaut 'mois' ou 'an' : c'est le prix mis en avant, l'autre étant
 * rappelé en dessous. La page affiche le mensuel par défaut — un acheteur
 * compare en mois — et les decks font pareil.
 *
 * `phare` reçoit le fond teinté et la mention « le plus courant » : Advanced,
 * comme sur le site (OFFRE_PHARE).
 */
function grilleOffres(d, s, { x, y, w, h = 3.9, rythme = 'mois', phare = 'advanced', points = true }) {
  const gap = 0.28
  const cw = (w - gap * 2) / 3
  GRILLE.offres.forEach((o, i) => {
    const cx = x + i * (cw + gap)
    const vedette = o.cle === phare
    s.addShape('roundRect', {
      x: cx, y, w: cw, h, rectRadius: 0.12,
      fill: { color: vedette ? P.TINT : P.PAPER },
      line: { color: vedette ? P.ACCENT : P.HAIR, width: vedette ? 1.5 : 1 },
    })
    let cy = y + 0.28
    // ⚠️ La ligne du surtitre est réservée sur les trois colonnes, même quand
    // elle est vide : ne la poser que sur la vedette décalait son contenu de
    // 0,26 pouce et désalignait les trois listes du bas.
    if (vedette) {
      s.addText('LE PLUS COURANT', {
        x: cx + 0.28, y: cy - 0.06, w: cw - 0.56, h: 0.24, fontFace: FONT, fontSize: 8,
        bold: true, color: P.ACCENT, charSpacing: 0.6, margin: 0,
      })
    }
    cy += 0.26
    s.addText(o.nom, { x: cx + 0.28, y: cy, w: cw - 0.56, h: 0.38, fontFace: FONTD, fontSize: 18, bold: true, color: P.INK, margin: 0 })
    cy += 0.44
    s.addText(o.plage, { x: cx + 0.28, y: cy, w: cw - 0.56, h: 0.28, fontFace: FONT, fontSize: 11, color: P.ACCENT, bold: true, margin: 0 })
    cy += 0.34
    s.addText(o.pour, { x: cx + 0.28, y: cy, w: cw - 0.56, h: 0.5, fontFace: FONT, fontSize: 10, color: P.SLATE, margin: 0, lineSpacingMultiple: 1.12 })
    cy += 0.56
    // Le prix : le rythme demandé en grand, l'autre en rappel. Les deux
    // figurent toujours — c'est la comparaison qui fait vendre l'annuel.
    const grand = rythme === 'mois' ? o.mois : o.an
    s.addText([
      { text: euros(grand), options: { fontSize: 26, bold: true, color: P.DEEP, fontFace: FONTD } },
      { text: rythme === 'mois' ? '  HT / mois' : '  HT / an', options: { fontSize: 10.5, color: P.SLATE, fontFace: FONT } },
    ], { x: cx + 0.28, y: cy, w: cw - 0.56, h: 0.5, margin: 0, valign: 'bottom' })
    cy += 0.5
    s.addText(
      rythme === 'mois' ? `ou ${euros(o.an)} à l’année — ${euros(economie(o))} de moins` : `ou ${euros(o.mois)} par mois`,
      { x: cx + 0.28, y: cy, w: cw - 0.56, h: 0.3, fontFace: FONT, fontSize: 9.5, color: P.OK, margin: 0 },
    )
    cy += 0.34
    if (points) {
      d.filet(s, cx + 0.28, cy, cw - 0.56)
      cy += 0.14
      s.addText(
        o.points.map((p, j) => ({ text: p, options: { bullet: { code: '2013', indent: 12 }, breakLine: j < o.points.length - 1, paraSpaceAfter: 4 } })),
        { x: cx + 0.28, y: cy, w: cw - 0.56, h: h - (cy - y) - 0.2, fontFace: FONT, fontSize: 9.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.08 },
      )
    }
  })
}

/** La ligne qui suit toujours la grille : ce qu'il y a au-delà du plafond. */
function auDela() {
  const { supplement: s, plafond } = GRILLE
  return `Plus de ${plafond} appareils dans un même magasin ? ${euros(s.mois)} par mois, ou ${euros(s.an)} à l’année, par tranche de ${s.par} appareils supplémentaires.`
}

module.exports = { GRILLE, grilleOffres, auDela, euros, economie }
