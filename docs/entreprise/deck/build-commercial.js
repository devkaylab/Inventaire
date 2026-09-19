// Deck commercial Quantinvo — 15 pages, pour un directeur de magasin ou de
// réseau, un contrôleur de gestion ou un acheteur.
//   node build-commercial.js                 → Quantinvo-commercial.pptx        (Arial)
//   FONT_MODE=brand node build-commercial.js → Quantinvo-commercial-marque.pptx (Archivo/Public Sans)
// Contrôle : node verifier-typo.js Quantinvo-commercial.pptx Quantinvo-commercial-marque.pptx
//
// Demande de Julien, 19 septembre 2026, dans cet ordre :
//   1. l'inventaire (page 2), puis la loi (page 3) ;
//   2. les problèmes rencontrés (pages 4 à 6) — la démarque et les anomalies
//      du site, puis ses constats de terrain (son texte du 14 septembre
//      2026, repris de l'ancien build-pourquoi.js, supprimé depuis), sans
//      nom d'employeur ;
//   3. les solutions (pages 7 à 12), dans l'ordre du parcours : fichiers,
//      balises, comptage, suivi, écarts, rapport ;
//   4. pourquoi nous choisir (page 13), puis les offres (page 14) et la
//      page finale.
//
// ⚠️ ÉCRITURE : phrases courtes, aucune répétition d'une page à l'autre, aucun
// terme inventé. Les textes viennent des pages publiques du site
// (web/components/vitrine/) et de l'application ; chaque affirmation a été
// vérifiée dans le code avant d'être écrite.
//
// ⚠️ AUCUN CHIFFRE INVENTÉ, AUCUN CLIENT INVENTÉ. Les seuls chiffres produit
// sont ceux du site. Les prix se LISENT dans web/lib/offres.ts (via blocs.js) :
// aucun montant n'est écrit ici, un test le refuse (web/tests/deck.test.ts).
//
// ⚠️ L'ACCENT VERT SERT DEUX FOIS : le grand chiffre de la page 4 et l'offre
// mise en avant de la page 14.

const fs = require('fs')
const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer } = require('./charte')
const { GRILLE, euros, economie } = require('./blocs')
const { SOURCE } = require('./offres')

// ── Ce que la grille ne porte pas, lu dans web/lib/offres.ts ──────────────
// L'éditeur est en franchise de TVA tant que TVA_APPLICABLE vaut false : il
// n'y a alors ni « HT » ni « TTC », et la mention réglementaire se lit dans la
// source au lieu d'être recopiée. Même règle pour la borne du libre-service.
const OFFRES_TS = fs.readFileSync(SOURCE, 'utf8')
function lireConstante(motif, nom) {
  const m = OFFRES_TS.match(motif)
  if (!m) throw new Error(`${nom} introuvable dans ${SOURCE}`)
  return m[1]
}
const TVA_APPLICABLE = lireConstante(/export const TVA_APPLICABLE = (true|false)/, 'TVA_APPLICABLE') === 'true'
const MENTION_TVA = lireConstante(/export const MENTION_TVA = '([^']+)'/, 'MENTION_TVA')
const PLAFOND_LIBRE_SERVICE = Number(lireConstante(/export const PLAFOND_LIBRE_SERVICE = (\d+)/, 'PLAFOND_LIBRE_SERVICE'))

/**
 * Les points d'une offre, lus dans web/lib/offres.ts.
 *
 * Les promesses de service qui contredisaient les CGV (disponibilité, délai
 * de réponse) et « Aide en ligne » ont été retirées À LA SOURCE le
 * 19 septembre 2026 : le deck et le site affichent les mêmes points.
 */
function pointsVendus(o) {
  return o.points
    // « Un magasin, deux appareils à la fois — comptes illimités » redit la
    // plage de la carte (« Jusqu'à 2 appareils »), sa phrase (« seul ou à
    // deux ») et le chapeau de la page (« Les comptes et les inventaires sont
    // illimités »). Le point est retiré ici seulement : le site le garde.
    .filter((p) => !/^Un magasin\b/.test(p))
}

const PIED = 'Quantinvo · septembre 2026'
const PIED_DEMO = 'Quantinvo · captures d’un compte de démonstration'
const LARGE = W - 2 * M // 11,73 pouces
const SITE = '../captures-site/2026-09-19-rayon-textile/brut/'

async function main() {
  const d = await preparer({ titre: 'Quantinvo — présentation' })
  const { pres } = d

  /** Intertitre de colonne. */
  const intertitre = (s, text, x, y, w) => s.addText(text, {
    x, y, w, h: 0.34, fontFace: FONTD, fontSize: 13.5, bold: true, color: P.INK, margin: 0,
  })

  /** Rangée de document : libellé à gauche, texte à droite (pages 5 et 6). */
  const rangee = (s, y, libelle, texte) => {
    s.addText(libelle, { x: M, y, w: 2.6, h: 0.4, fontFace: FONTD, fontSize: 15, bold: true, color: P.INK, margin: 0 })
    d.para(s, texte, { x: M + 3.0, y: y + 0.02, w: LARGE - 3.0, h: 1.05, size: 12.5 })
  }

  // ── Captures ─────────────────────────────────────────────
  // Captures RÉELLES du compte de démonstration (site, 19 septembre 2026,
  // 3420 px de large). Chaque recadrage laisse dehors le rail, le bouton de
  // langue et la zone de dépôt ; vérifié sur l'image recadrée.
  const capDonnees = await capture(SITE + 'setup-deplie-2.png', { left: 900, top: 95, width: 1600, height: 915 })
  // Le Suivi en DEUX cadres, pris sur la même capture : la carte Progression à
  // gauche, les onglets, les tuiles et l'avancement par zone à droite. D'un
  // seul tenant, le bas coupait la carte « Informations » en deux (elle
  // commence là où finit la zone « Surface de vente »).
  const capSuiviG = await capture(SITE + 'suivi-1.png', { left: 202, top: 294, width: 667, height: 718 })
  const capSuiviD = await capture(SITE + 'suivi-1.png', { left: 879, top: 294, width: 2493, height: 831 })
  const capEcarts = await capture(SITE + 'ecarts-1.png', { left: 870, top: 450, width: 2505, height: 1050 })
  // Le tableau des articles SANS les totaux : l'inventaire de démonstration
  // n'est compté qu'à 26 %, et ses totaux (−415 unités, −19 047,50 €) se
  // liraient comme une perte, pas comme un rapport fiable. Cinq lignes, le
  // bouton Télécharger, aucun bandeau.
  const capRapport = await capture(SITE + 'rapport-2.png', { left: 870, top: 77, width: 2505, height: 891 })
  // Photo du héros de /decouvrir : une main, un téléphone, une étiquette QR.
  // Ni visage ni enseigne. Ce n'est pas une balise Quantinvo (elle n'a pas de
  // numéro) : la légende le dit.
  const photo = await capture('Photos-inventaire/IMG_4746.JPG', { left: 100, top: 0, width: 1164, height: 848 })

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      titre: 'L’inventaire de votre magasin,\nau bout du téléphone.',
      sousTitre: 'Une application pour compter. Un site pour préparer, suivre et exporter.',
      bas: 'Devkaylab · septembre 2026 · www.quantinvo.com',
    })
  }

  // ════ 2. Qu'est-ce qu'un inventaire ? ════
  {
    const s = pres.addSlide()
    d.entete(s, 'L’inventaire')
    d.titreLarge(s, 'Qu’est-ce qu’un inventaire ?', { y: 1.35 })
    d.para(s, 'Compter ce qui est en rayon et en réserve, puis le comparer au stock théorique.', {
      x: M, y: 2.2, w: LARGE, h: 0.45, size: 13.5,
    })

    // La soustraction, dessinée en texte : trois termes et deux signes.
    // ⚠️ COMPTÉ MOINS THÉORIQUE, dans cet ordre : c'est le signe du rapport
    // (un blazer attendu à 39 et compté à 9 y affiche −30). L'ordre inverse
    // donnerait +30, et un contrôleur de gestion le verrait.
    const by = 2.95, bh = 1.65
    s.addShape('roundRect', { x: M, y: by, w: LARGE, h: bh, rectRadius: 0.04, fill: { color: P.MIST }, line: { color: P.MIST, width: 0 } })
    const tw = 3.2
    const slot = (LARGE - 0.8 - 3 * tw) / 2
    const termes = [
      ['Stock compté', 'Ce qui est vraiment là'],
      ['Stock théorique', 'Ce que votre logiciel croit avoir'],
      ['L’écart', 'Chaque différence a une cause'],
    ]
    termes.forEach(([nom, legende], i) => {
      const tx = M + 0.4 + i * (tw + slot)
      s.addText(nom, { x: tx, y: by + 0.4, w: tw, h: 0.45, fontFace: FONTD, fontSize: 20, bold: true, color: P.INK, align: 'center', margin: 0 })
      s.addText(legende, { x: tx, y: by + 0.9, w: tw, h: 0.34, fontFace: FONT, fontSize: 11.5, color: P.SLATE, align: 'center', margin: 0 })
      if (i < 2) {
        s.addText(i === 0 ? '−' : '=', {
          x: tx + tw, y: by, w: slot, h: bh, fontFace: FONTD, fontSize: 30, color: P.INK,
          align: 'center', valign: 'middle', margin: 0,
        })
      }
    })

    d.filet(s, M, 5.0, LARGE)
    intertitre(s, 'À quoi sert un inventaire', M, 5.2, LARGE)
    d.alineas(s, [['Des décisions sur des chiffres justes.', 'Commandes, réassort, promotions : tout repose sur le stock affiché.']], {
      x: M, y: 5.65, w: 5.5, h: 1.0, size: 12.5,
    })
    d.alineas(s, [['Des pertes mises au jour.', 'Le comptage montre ce qui manque.']], {
      x: M + 6.1, y: 5.65, w: 5.5, h: 1.0, size: 12.5,
    })
    d.pied(s, 2, PIED)
  }

  // ════ 3. Une obligation légale ════
  {
    const s = pres.addSlide()
    d.entete(s, 'L’inventaire et la loi')
    d.titre(s, 'Une obligation légale', { size: 26, h: 0.8 })
    d.para(s, 'Tout commerçant doit contrôler\nson stock par inventaire au moins\nune fois tous les douze mois.', {
      x: M, y: 2.3, w: COL, h: 1.3, size: 16, color: P.INK,
    })
    d.para(s, 'Code de commerce, article L123-12', { x: M, y: 3.65, w: COL, h: 0.3, size: 10.5, color: P.SLATE })
    d.filet(s, M, 4.2, COL)
    d.alineas(s, [['Un bilan sincère.', 'Le stock est souvent le premier actif du magasin. Sa valeur doit être juste.']], {
      x: M, y: 4.4, w: COL, h: 1.6, size: 12.5,
    })

    // L'année dessinée : 52 cases par rythme, comme RythmesAnnee sur le site.
    d.para(s, 'La loi fixe un minimum. Le rythme, lui, se choisit.', { x: RX, y: 1.5, w: RW, h: 0.45, size: 15, color: P.INK })
    const toutes = Array.from({ length: 52 }, (_, i) => i)
    const rythmes = [
      ['Annuel', 'Le grand comptage, souvent à la clôture de l’exercice.', [50], '1 semaine sur 52'],
      ['Tournant', 'Une zone chaque semaine, sans fermer le magasin.', toutes, '52 semaines sur 52'],
      ['Ciblé', 'Les rayons sensibles, les meilleures ventes ou une zone tirée au hasard.', [3, 9, 15, 22, 30, 37, 44], '7 semaines sur 52'],
    ]
    const cote = 0.1
    const pas = (RW - 52 * cote) / 51
    rythmes.forEach(([libelle, texte, pleines, legende], i) => {
      const y = 2.2 + i * 1.15
      s.addText(libelle, { x: RX, y, w: RW, h: 0.3, fontFace: FONTD, fontSize: 13.5, bold: true, color: P.INK, margin: 0 })
      s.addText(texte, { x: RX, y: y + 0.33, w: RW, h: 0.26, fontFace: FONT, fontSize: 11, color: P.INK2, margin: 0 })
      const plein = new Set(pleines)
      for (let k = 0; k < 52; k++) {
        const c = plein.has(k) ? P.INK : P.HAIR
        s.addShape('rect', { x: RX + k * (cote + pas), y: y + 0.66, w: cote, h: cote, fill: { color: c }, line: { color: c, width: 0 } })
      }
      s.addText(legende, { x: RX, y: y + 0.82, w: RW, h: 0.22, fontFace: FONT, fontSize: 9.5, color: P.SLATE, margin: 0 })
    })
    d.para(s, 'Les trois se combinent : le tournant et le ciblé toute l’année,\nl’annuel pour la photographie complète.', {
      x: RX, y: 5.75, w: RW, h: 0.5, size: 11.5, color: P.SLATE,
    })
    d.pied(s, 3, PIED)
  }

  // ════ 4. La démarque inconnue ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les problèmes')
    d.titre(s, 'La démarque inconnue', { size: 26, h: 0.9 })
    d.para(s, 'La marchandise qui figure au stock théorique, mais n’est plus en rayon.', {
      x: M, y: 2.35, w: COL, h: 0.9, size: 13,
    })
    d.chiffre(s, '1 à 2 %', 'du chiffre d’affaires du commerce de détail, selon les études du secteur. Souvent plus que la marge nette.', { y: 3.45 })

    intertitre(s, 'Ses quatre causes', RX, 1.5, RW)
    d.alineas(s, [
      ['Vol externe.', 'À l’étalage, dans les rayons.'],
      ['Vol interne.', 'Par le personnel du magasin.'],
      ['Casse et perte.', 'Produits abîmés, périmés, jetés sans être enregistrés.'],
      ['Erreurs administratives.', 'Réceptions mal saisies, erreurs de caisse, retours oubliés.'],
    ], { x: RX, y: 1.95, w: RW, h: 1.7, size: 12, gap: 8 })
    d.filet(s, RX, 3.78, RW)
    intertitre(s, 'Ce que l’écart révèle d’autre', RX, 3.95, RW)
    d.alineas(s, [
      // « Physiquement impossibles » (le site) ne tient pas sur la ligne avec
      // « code-barres » : le mot tombait seul sur la suivante.
      ['Les stocks négatifs.', 'Impossibles, donc une erreur de saisie ou de code-barres.'],
      ['Les références fantômes.', 'Toujours au catalogue, elles gonflent la valeur du stock.'],
      ['Les articles déplacés.', 'Présents mais introuvables, donc réassortis pour rien.'],
      ['Les codes-barres inconnus.', 'Des produits bien réels que votre référentiel ignore.'],
    ], { x: RX, y: 4.38, w: RW, h: 2.2, size: 12, gap: 9 })
    d.pied(s, 4, PIED)
  }

  // ════ 5. Quand l'inventaire passe par un prestataire ════
  // Les constats sont ceux de Julien (texte du 14 septembre 2026), dits comme
  // tels : sans client, un témoignage anonyme se lirait comme une référence.
  {
    const s = pres.addSlide()
    d.entete(s, 'Les problèmes')
    d.titreLarge(s, 'Quand l’inventaire passe par un prestataire', { y: 1.35 })
    // Un seul acteur nommé sur la page : le prestataire. Le texte de Julien
    // (14 septembre 2026, ancien build-pourquoi.js) dit « le magasin ne lance pas un inventaire, il le
    // demande » — à son service d'inventaire, qu'on ne nomme pas ici.
    d.para(s, 'Faute d’outil, beaucoup de magasins externalisent. Le fondateur de Quantinvo, contrôleur des stocks, en a vu les limites.', {
      x: M, y: 2.1, w: LARGE, h: 0.7, size: 12.5, color: P.SLATE,
    })
    rangee(s, 2.95, 'L’autonomie',
      'Le magasin ne lance pas son inventaire : il le demande.\nAjouter un compteur passe par le prestataire, et il faut attendre.')
    d.filet(s, M, 3.95, LARGE)
    rangee(s, 4.1, 'La cadence',
      'Une marque est comptée une fois par an, au mieux. Un gros écart attend l’inventaire annuel pour être recompté. Un seul inventaire à la fois, donc un seul rapport pour tout.')
    d.filet(s, M, 5.1, LARGE)
    rangee(s, 5.25, 'Le matériel',
      'Des terminaux en fin de vie, qui ne servent qu’à l’inventaire. Des balises livrées de l’étranger : le bilan carbone n’est pas neutre. Seuls les appareils du prestataire savent les lire.')
    d.pied(s, 5, PIED)
  }

  // ════ 6. Des données figées, un écart trop tard ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les problèmes')
    d.titreLarge(s, 'Des données figées, un écart trop tard', { y: 1.35 })
    rangee(s, 2.3, 'La donnée',
      'Le référentiel date de plusieurs mois. Le mettre à jour mobilise l’informatique. Un article absent du fichier ne se scanne pas : il se traite à la main, après coup.')
    d.filet(s, M, 3.45, LARGE)
    rangee(s, 3.55, 'La zone',
      'Les zones de comptage se choisissent dans une liste imposée. Il faut noter ailleurs l’emplacement réel de chacune. Une source d’erreur qui n’a aucune raison d’exister.')
    d.filet(s, M, 4.75, LARGE)
    // citation() pose elle-même les guillemets.
    d.citation(s, 'On compte, on clôture, on découvre.', { x: M, y: 5.0, w: LARGE, h: 0.6, size: 22 })
    // Pas de signature : la page 5 dit déjà d'où viennent ces constats.
    d.para(s, 'Quand l’écart tombe, l’équipe est partie et le rayon a déjà bougé.', {
      x: M, y: 5.72, w: LARGE, h: 0.4, size: 13, color: P.INK2,
    })
    d.pied(s, 6, PIED)
  }

  // ════ 7. Vos fichiers, tels quels ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les solutions')
    d.titreLarge(s, 'Vos fichiers, tels quels', { y: 1.35 })
    d.alineas(s, [
      ['CSV ou Excel, jusqu’à 100 000 références par inventaire.', 'Le fichier de votre logiciel, sans le retravailler. Vos noms de colonnes sont reconnus : SKU, EAN, Gencod, Qté…'],
      ['Le stock théorique, si vous l’avez.', 'C’est lui qui fait apparaître l’écart de stock au rapport.'],
      ['Un référentiel à jour.', 'Le superviseur charge ses fichiers à chaque inventaire, sans passer par l’informatique.'],
      ['Un article inconnu ?', 'Il se crée au scan, et le comptage continue.'],
    ], { x: M, y: 2.3, w: 5.4, h: 4.3, size: 12.5, gap: 12 })
    // La colonne de texte s'élargit (5,2 → 5,4) pour que « Un article
    // inconnu ? » tienne sur une ligne ; la capture recule d'autant.
    const cx = 6.7, cy = 2.35
    const dims = d.cadre(s, capDonnees, { x: cx, y: cy, w: W - M - cx })
    d.legende(s, 'Les données d’un inventaire, sur le site.', { x: cx, y: cy + dims.h + 0.16, w: dims.w })
    d.pied(s, 7, PIED_DEMO)
  }

  // ════ 8. Chaque rayon s'ouvre d'un scan ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les solutions')
    d.titre(s, 'Chaque rayon s’ouvre\nd’un scan', { size: 26, h: 1.0 })
    d.para(s, 'Le compteur scanne la balise du rayon,\npuis ses articles.', {
      x: M, y: 2.55, w: COL, h: 0.6, size: 13, color: P.INK,
    })
    d.alineas(s, [
      ['Des balises imprimées au magasin.', 'Une planche d’étiquettes QR, qui sert à tous vos inventaires.'],
      ['Vos emplacements, vos noms.', 'Réserve, surface de vente : chaque plage de balises porte le nom que vous lui donnez.'],
      ['À plusieurs, sans se gêner.', 'L’équipe compte en parallèle.'],
    ], { x: M, y: 3.35, w: COL, h: 3.2, size: 12, gap: 10 })
    // Une photo, pas une capture : posée sans cadre.
    const ph = RW / photo.ratio
    s.addImage({ data: photo.data, x: RX, y: 1.5, w: RW, h: ph })
    d.legende(s, 'Une étiquette QR sur la glissière d’un rayon (illustration).', { x: RX, y: 1.5 + ph + 0.12, w: RW })
    d.pied(s, 8, PIED)
  }

  // ════ 9. Chacun compte avec ce qu'il a ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les solutions')
    d.titre(s, 'Chacun compte\navec ce qu’il a', { size: 26, h: 1.0 })
    d.alineas(s, [
      ['Aucun matériel à acheter.', 'Un téléphone, iPhone ou Android, par personne qui compte.'],
      ['La caméra suffit.', 'Une douchette Bluetooth se connecte pour qui la préfère. La saisie au clavier reste possible.'],
      ['Rejoindre un inventaire.', 'Invité par e-mail, le compteur saisit le numéro d’inventaire et le code fournis par son superviseur. À la première ouverture, l’application lui montre ce qu’il doit faire.'],
      ['Même sans réseau.', 'En réserve, les scans restent sur le téléphone et partent dès le retour de la connexion.'],
    ], { x: M, y: 2.55, w: 5.0, h: 4.1, size: 12, gap: 10 })

    const th = 4.6, ecart = 1.0
    const tel1 = await cadrer('comptage.png', { w: 2.4, h: 6.5 })
    const tel2 = await cadrer('bienvenue-compteur.png', { w: 2.4, h: 6.5 })
    const w1 = th * tel1.ratio, w2 = th * tel2.ratio
    const x1 = RX + (RW - (w1 + ecart + w2)) / 2
    // ⚠️ Le viseur est noir sur toutes les captures du simulateur (pas de
    // caméra) : la légende montre les trois onglets, pas la caméra.
    d.ecranEntier(s, { x: x1, y: 1.55, h: th, tel: tel1, legende: 'Caméra, saisie ou douchette : au choix' })
    d.ecranEntier(s, { x: x1 + w1 + ecart, y: 1.55, h: th, tel: tel2, legende: 'La première ouverture' })
    d.pied(s, 9, PIED_DEMO)
  }

  // ════ 10. L'avancement, en direct ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les solutions')
    d.titreLarge(s, 'L’avancement, en direct', { y: 1.35 })
    d.para(s, 'Le superviseur voit chaque zone progresser, sur le site ou dans l’application. On suit le travail, pas les personnes.', {
      x: M, y: 2.1, w: LARGE, h: 0.6, size: 13,
    })
    // Deux cadres de même hauteur, centrés ensemble. Les tuiles affichent
    // « 0 appareil connecté » (personne ne comptait à la capture) : la légende
    // ne les met donc pas en avant.
    const y = 3.0, entre = 0.3
    // La hauteur qui fait tenir les deux cadres (et leur filet) dans la page.
    const hc = Math.min(3.3, (LARGE - entre - 0.12) / (capSuiviG.ratio + capSuiviD.ratio))
    const wg = hc * capSuiviG.ratio, wd = hc * capSuiviD.ratio
    const x0 = (W - (wg + entre + wd)) / 2
    d.cadre(s, capSuiviG, { x: x0, y, w: wg })
    d.cadre(s, capSuiviD, { x: x0 + wg + entre, y, w: wd })
    d.legende(s, 'Onglet Suivi : progression et état de chaque zone.', {
      x: x0, y: y + hc + 0.16, w: wg + entre + wd,
    })
    d.pied(s, 10, PIED_DEMO)
  }

  // ════ 11. Les écarts se tranchent le jour même ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les solutions')
    d.titreLarge(s, 'Les écarts se tranchent le jour même', { y: 1.35 })
    d.para(s, 'Un auditeur recompte la balise en seconde passe. L’écart entre les deux comptes s’affiche dès la fin de l’audit.\nLe superviseur retient la quantité du compteur, celle de l’auditeur ou une autre.', {
      x: M, y: 2.1, w: LARGE, h: 0.7, size: 13,
    })
    // Centrée sur sa VRAIE largeur : cadre() réduit la largeur pour tenir la
    // hauteur, et un x calculé sur la largeur demandée la poussait à gauche.
    const y = 2.95, hc = 3.35
    const cw = hc * capEcarts.ratio
    d.cadre(s, capEcarts, { x: (W - cw) / 2, y, w: cw })
    d.legende(s, 'Onglet Écarts d’audit, sur le site.', { x: (W - cw) / 2, y: y + hc + 0.14, w: cw })
    d.pied(s, 11, PIED_DEMO)
  }

  // ════ 12. Un rapport qui fait foi ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les solutions')
    d.titreLarge(s, 'Un rapport qui fait foi', { y: 1.35 })
    d.para(s, 'Chaque inventaire a le sien : stock théorique, stock compté, écart en unités et en valeur, article par article.\nIl s’exporte en Excel ou en CSV, pour corriger le stock dans votre logiciel de gestion.\nL’administrateur d’entreprise additionne les inventaires clôturés d’un magasin dans un rapport consolidé.', {
      x: M, y: 2.1, w: LARGE, h: 0.85, size: 13,
    })
    const y = 3.2, hc = 3.25
    const cw = hc * capRapport.ratio
    d.cadre(s, capRapport, { x: (W - cw) / 2, y, w: cw })
    d.legende(s, 'Onglet Rapport, sur le site.', { x: (W - cw) / 2, y: y + hc + 0.14, w: cw })
    d.pied(s, 12, PIED_DEMO)
  }

  // ════ 13. Plus qu'un outil de comptage ════
  // Seules les raisons qu'aucune autre page ne donne : l'autonomie, le
  // réseau, plusieurs inventaires à la fois, la sécurité, les langues.
  // Composée comme les pages 5 et 6 — libellé à gauche, texte à droite, un
  // filet entre deux raisons — dont elle est la réponse. Le titre prend toute
  // la largeur : en colonne, il laissait un grand vide sous lui.
  {
    const s = pres.addSlide()
    d.entete(s, 'Pourquoi nous choisir')
    d.titreLarge(s, 'Plus qu’un outil de comptage', { y: 1.35 })
    const raisons = [
      ['Le magasin décide', ['Le superviseur crée ses inventaires, invite ses compteurs et retire leurs accès.', 'Rien à demander, personne à attendre.']],
      ['Le réseau d’un coup d’œil', ['L’administrateur d’entreprise ajoute les magasins et voit tous leurs inventaires.', 'Chaque magasin garde ses codes d’accès et son équipe.']],
      ['Plusieurs inventaires à la fois', ['Une marque, un rayon, la réserve se comptent à part.', 'Un gros écart se recompte dès la semaine suivante.']],
      // Seules les DONNÉES D'INVENTAIRE sont dans l'Union européenne : le
      // site, les e-mails et les notifications passent par des sous-traitants
      // établis aux États-Unis, déclarés dans les CGV. Le reste reprend la
      // version courte du site (Pourquoi.tsx).
      ['Sérieux jusque dans les coulisses', ['Données d’inventaire hébergées dans l’Union européenne, sans traceur publicitaire.', 'Double authentification pour qui administre.', 'Chacun télécharge ses données ou supprime son compte.']],
      ['En français et en anglais', ['Dans l’application comme sur le site.']],
    ]
    // Une phrase par ligne : aucune ne se coupe, et aucun mot ne reste seul
    // sur la ligne suivante (« attendre. » tombait seul). La rangée prend la
    // hauteur de ses lignes, le libellé en a deux au plus.
    // LIGNE : l'interligne rendu de para() à 12,5 points, mesuré sur la page.
    const LIGNE = 0.245, ENTRE = 0.34
    let y = 2.3
    raisons.forEach(([libelle, phrases], i) => {
      s.addText(libelle, { x: M, y, w: 2.75, h: 0.6, fontFace: FONTD, fontSize: 14, bold: true, color: P.INK, margin: 0, lineSpacingMultiple: 1.05 })
      const h = Math.max(phrases.length * LIGNE, libelle.length > 26 ? 0.5 : 0.25)
      d.para(s, phrases.join('\n'), { x: M + 3.0, y: y + 0.02, w: LARGE - 3.0, h: h + 0.1, size: 12.5 })
      y += h + ENTRE
      // Le filet à mi-chemin entre la dernière ligne et le libellé suivant.
      if (i < raisons.length - 1) d.filet(s, M, y - ENTRE / 2 - 0.02, LARGE)
    })
    d.pied(s, 13, PIED)
  }

  // ════ 14. Un prix par magasin ════
  // La grille est redessinée ici, et non par grilleOffres() : celle-ci écrit
  // « HT », faux tant que l'éditeur est en franchise de TVA. Seuls les comptes
  // et les inventaires sont sans limite ; les appareils sont l'assiette du prix.
  {
    const s = pres.addSlide()
    d.entete(s, 'Les offres')
    d.titreLarge(s, 'Un prix par magasin', { y: 1.3 })
    d.para(s, 'Le tarif suit le nombre d’appareils qui comptent en même temps. Les comptes et les inventaires sont illimités.', {
      x: M, y: 1.95, w: LARGE, h: 0.5, size: 12.5,
    })

    const gy = 2.4, gh = 3.75, gap = 0.28
    const cw = (LARGE - 2 * gap) / 3
    const pad = 0.28
    const iw = cw - 2 * pad
    const phare = /export const OFFRE_PHARE: CleOffre = '(\w+)'/.exec(OFFRES_TS)
    if (!phare) throw new Error(`OFFRE_PHARE introuvable dans ${SOURCE}`)
    GRILLE.offres.forEach((o, i) => {
      const cx = M + i * (cw + gap)
      const vedette = o.cle === phare[1]
      // Une carte se détache par son fond ; seule l'offre mise en avant garde
      // un filet, et c'est le second usage de l'accent.
      s.addShape('roundRect', {
        x: cx, y: gy, w: cw, h: gh, rectRadius: 0.04,
        fill: { color: vedette ? P.TINT : P.MIST },
        line: { color: vedette ? P.ACCENT : P.MIST, width: vedette ? 1.25 : 0 },
      })
      let cy = gy + 0.24
      s.addText(o.nom, { x: cx + pad, y: cy, w: iw, h: 0.38, fontFace: FONTD, fontSize: 18, bold: true, color: P.INK, margin: 0 })
      cy += 0.42
      s.addText(o.plage, { x: cx + pad, y: cy, w: iw, h: 0.28, fontFace: FONT, fontSize: 11, bold: true, color: P.INK, margin: 0 })
      cy += 0.3
      // 9,5 points et une boîte qui mord sur la marge de droite : « La grande
      // surface, qui mobilise une équipe entière. » tient alors sur une ligne
      // dans les deux polices (« entière. » tombait seul en Public Sans).
      s.addText(o.pour, { x: cx + pad, y: cy, w: iw + pad - 0.08, h: 0.4, fontFace: FONT, fontSize: 9.5, color: P.SLATE, margin: 0, lineSpacingMultiple: 1.12 })
      cy += 0.44
      s.addText([
        { text: euros(o.mois), options: { fontSize: 26, bold: true, color: P.INK, fontFace: FONTD } },
        { text: (TVA_APPLICABLE ? ' HT' : '') + ' / mois', options: { fontSize: 10.5, color: P.SLATE, fontFace: FONT } },
      ], { x: cx + pad, y: cy, w: iw, h: 0.5, margin: 0, valign: 'bottom' })
      cy += 0.52
      s.addText(`ou ${euros(o.an)} à l’année, soit ${euros(economie(o))} de moins`, {
        x: cx + pad, y: cy, w: iw, h: 0.26, fontFace: FONT, fontSize: 9.5, color: P.SLATE, margin: 0,
      })
      cy += 0.32
      d.filet(s, cx + pad, cy, iw)
      cy += 0.12
      const points = pointsVendus(o)
      s.addText(
        points.map((p, j) => ({ text: p, options: { bullet: { code: '2013', indent: 12 }, breakLine: j < points.length - 1, paraSpaceAfter: 4 } })),
        { x: cx + pad, y: cy, w: iw, h: gy + gh - cy - 0.14, fontFace: FONT, fontSize: 9.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.08 },
      )
    })

    const sup = GRILLE.supplement
    s.addText(
      `Au-delà de ${GRILLE.plafond} appareils : ${euros(sup.mois)} par mois (${euros(sup.an)} à l’année) par tranche de ${sup.par}, jusqu’à ${PLAFOND_LIBRE_SERVICE}.`,
      { x: M, y: 6.33, w: LARGE, h: 0.24, fontFace: FONT, fontSize: 10, color: P.SLATE, margin: 0 },
    )
    s.addText(
      `${TVA_APPLICABLE ? 'Prix hors taxes' : MENTION_TVA}. Mensuel sans engagement ; annuel dû jusqu’à son terme.`,
      { x: M, y: 6.6, w: LARGE, h: 0.22, fontFace: FONT, fontSize: 9.5, color: P.SLATE, margin: 0 },
    )
    d.pied(s, 14, PIED)
  }

  // ════ 15. Finale ════
  // Aucun bouton : la vente en ligne est fermée (venteOuverte() dans
  // web/lib/legal.ts), la page invite à écrire.
  // La finale de charte.js pose le texte 0,1 pouce sous le titre, puis un
  // grand vide avant l'adresse : elle est recomposée ici, avec le même
  // en-tête, le titre remonté et le texte descendu.
  // Le prix se compte PAR MAGASIN (page 14) : on demande les deux nombres.
  {
    const s = pres.addSlide()
    s.background = { color: P.PAPER }
    s.addImage({ data: d.logo, x: M, y: 0.75, w: 0.62, h: 0.62 })
    s.addText('Quantinvo', { x: M + 0.78, y: 0.72, w: 5, h: 0.68, fontFace: FONTD, fontSize: 24, bold: true, color: P.INK, margin: 0, valign: 'middle' })
    s.addShape('rect', { x: M, y: 1.62, w: 2.2, h: 0.022, fill: { color: P.INK }, line: { color: P.INK, width: 0 } })
    s.addText('Fiabilisez votre stock\navec Quantinvo', { x: M, y: 2.45, w: 9.5, h: 1.3, fontFace: FONTD, fontSize: 36, bold: true, color: P.DEEP, margin: 0, lineSpacingMultiple: 1.05 })
    s.addText('Dites-nous combien de magasins vous avez,\net combien d’appareils comptent en même temps dans chacun.', {
      x: M, y: 4.2, w: 8, h: 0.9, fontFace: FONT, fontSize: 14.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.2,
    })
    s.addText('contact@quantinvo.com', { x: M, y: 5.4, w: 9, h: 0.45, fontFace: FONTD, fontSize: 15, bold: true, color: P.DEEP, margin: 0 })
    s.addText('Devkaylab · Paris · www.quantinvo.com', { x: M, y: 6.65, w: 10, h: 0.35, fontFace: FONT, fontSize: 10.5, color: P.SLATE, margin: 0 })
  }

  await ecrire(pres, 'Quantinvo-commercial')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
