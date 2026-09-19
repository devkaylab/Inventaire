// Guide de prise en main Quantinvo — 28 pages, dans l'ordre d'un premier
// inventaire : l'accès et les magasins, l'équipe, les balises, la préparation,
// le comptage, le suivi, l'audit, l'arbitrage, le rapport et la clôture.
//   node build-prise-en-main.js                 → Quantinvo-prise-en-main.pptx        (Arial)
//   FONT_MODE=brand node build-prise-en-main.js → Quantinvo-prise-en-main-marque.pptx (Archivo/Public Sans)
// Contrôle : node verifier-typo.js Quantinvo-prise-en-main.pptx Quantinvo-prise-en-main-marque.pptx
//
// Réécrit le 19 septembre 2026, à la demande de Julien : les anciens decks
// étaient périmés. Chaque phrase a été vérifiée dans le code (src/, web/,
// supabase/) ou dans docs/notes/, puis relue par deux relecteurs (faits,
// style). Trois points relevés par la relecture des faits, qui ne se voient
// pas à la lecture du produit :
//   · dans l'APPLICATION, « Commencer l'inventaire » ne change pas le statut :
//     il fait comme « Plus tard » (src/lib/tunnel.ts). Seul le site passe
//     l'inventaire en « En cours » (web/lib/inventory.ts, startSession).
//     C'est un défaut du produit, signalé à Julien. La page 14 le dit en
//     consigne (« Toujours depuis le site »), pas en aveu ;
//   · le « Premier numéro » d'une planche de balises repart toujours de sa
//     valeur par défaut : rien ne retient la dernière balise imprimée ;
//   · l'e-mail « Bienvenue sur Quantinvo » ne part que pour une entreprise
//     créée sur devis (stripe-webhook, kind 'company').
//
// ⚠️ AUCUN CHIFFRE INVENTÉ, AUCUN CLIENT INVENTÉ, AUCUN PRIX. Les écrans sont
// ceux du compte de démonstration (Maison Oberlin) : l'application au
// simulateur (captures/), le site le 19 septembre 2026 (captures-site/).
// Ne JAMAIS montrer web/screenshots/ : c'est un faux compte de test.
//
// ⚠️ L'ACCENT VERT SERT UNE SEULE FOIS : le grand chiffre de la page 26. Les
// pastilles de la page 3 sont en encre, les lieux des rôles (page 2) en gris.
//
// ⚠️ Les applications ne sont pas encore sur les boutiques
// (web/lib/appStores.ts, PUBLIEE) : le guide dit « installe l'application »,
// jamais « disponible sur l'App Store ».

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer, typo } = require('./charte')

const PIED = 'Quantinvo · prise en main · septembre 2026'
const SITE = '../captures-site/2026-09-19-rayon-textile/brut/'
const BAS = H - 0.72   // ligne où s'arrêtent les cartes, au-dessus du pied
const INSEC = '\u00A0'   // espace insécable
const FINE = '\u202F'    // espace fine insécable

/**
 * ⚠️ PAS DE MOT SEUL EN DERNIÈRE LIGNE (relecture du 19 septembre 2026 :
 * « est généré / automatiquement. », « sans / retour. »… seize en Arial).
 * La dernière espace de chaque paragraphe devient insécable : les deux
 * derniers mots passent à la ligne ensemble. Un paragraphe finit au bout
 * d'une chaîne, à un « \n », ou sur un run qui porte `breakLine`.
 * La typographie de charte.js passe d'abord (elle ne touche qu'aux espaces
 * ordinaires, elle est donc sans effet la seconde fois).
 */
const lierFin = (t) => t.replace(/ (?=[^ ]*$)/, INSEC)
function lier(t) {
  if (typeof t === 'string') return t.split('\n').map(lierFin).join('\n')
  if (!Array.isArray(t)) return t
  return t.map((r, i) => {
    if (!r || typeof r.text !== 'string') return r
    const fin = i === t.length - 1 || (r.options && r.options.breakLine)
    return fin ? { ...r, text: r.text.split('\n').map(lierFin).join('\n') } : r
  })
}

async function main() {
  const d = await preparer({ titre: 'Quantinvo — prise en main' })
  const { pres } = d
  {
    const addSlide = pres.addSlide.bind(pres)
    pres.addSlide = (...a) => {
      const s = addSlide(...a)
      const addText = s.addText.bind(s)
      s.addText = (t, o) => addText(lier(typo(t)), o)
      return s
    }
  }

  // ── Gabarits de page ──────────────────────────────────────

  /**
   * Les alinéas de d.alineas(), avec un alignement vertical au choix : une
   * colonne courte se centre sur la hauteur du téléphone au lieu de laisser
   * vide le bas de la page.
   */
  function alineasV(s, items, { x, y, w, h, size, gap, valign = 'top' }) {
    const runs = []
    items.forEach(([lead, text], i) => {
      const last = i === items.length - 1
      if (lead) runs.push({ text: lead + ' ', options: { bold: true, color: P.INK, paraSpaceAfter: gap } })
      runs.push({ text, options: { color: P.INK2, breakLine: !last, paraSpaceAfter: gap } })
    })
    s.addText(runs, { x, y, w, h, fontFace: FONT, fontSize: size, margin: 0, lineSpacingMultiple: 1.18, valign })
  }

  /**
   * Capture encadrée dont le FILET s'arrête exactement sur les bords donnés :
   * d.cadre() trace son filet 0,06 pouce autour de l'image, qui dépassait
   * donc la marge de droite. `x` et `w` sont ceux du filet.
   */
  function cadreJuste(s, cap, { x, y, w, h }) {
    const g = d.cadre(s, cap, { x: x + 0.06, y, w: w - 0.12, h: h === undefined ? undefined : h })
    return { w: g.w + 0.12, h: g.h }
  }

  /**
   * Téléphone coupé, dans sa carte, à droite de la page. `N` est la ligne de
   * la capture (en pixels, sur 1311) où le téléphone sort de sa carte : la
   * hauteur visible s'en déduit, et la carte monte d'autant.
   */
  async function telCoupe(s, fichier, N, { w = 3.5, marge = 0.34 } = {}) {
    const x = W - M - w
    const tw = w - 2 * marge
    // Capture de 603 px, bezel de 17 px de chaque côté : 637 px de large.
    const th = tw * (N + 17) / 637
    const tel = await cadrer(fichier, { w: tw, h: th })
    d.ecran(s, { x, y: BAS - th - marge, w, tel, bas: BAS, marge })
  }

  /**
   * Téléphone entier, sans carte : l'essentiel de l'écran est en bas. Il se
   * cale sur la marge de droite, et sa légende tient dans sa largeur : celle
   * de d.ecranEntier() déborde d'un demi-pouce de chaque côté, donc au-delà
   * de la marge. Les légendes sont coupées À LA MAIN (\n) : laissées à la
   * composition, elles finissaient sur un mot seul (« rayon. »).
   */
  async function telEntier(s, fichier, legende, { y = 1.45, h = 4.9 } = {}) {
    const tel = await cadrer(fichier, { w: 1, h: 99 })   // pas de coupe
    const w = h * tel.ratio
    const x = W - M - w
    d.ecranEntier(s, { x, y, h, tel })
    if (legende) {
      s.addText(legende, {
        x: x - 0.2, y: y + h + 0.12, w: w + 0.4, h: 0.55, fontFace: FONT, fontSize: 10,
        italic: true, color: P.SLATE, align: 'center', margin: 0, lineSpacingMultiple: 1.1,
      })
    }
    return { x, w }
  }

  // Le titre des pages à capture est une ligne large, en haut ; le contenu
  // commence dessous. ⚠️ Un titre sur deux lignes est coupé À LA MAIN (\n) :
  // laissé à la composition, il finissait sur un mot seul (« pièce. »,
  // « paiement. »), en Arial comme en Archivo.
  const TITRE_Y = 1.45
  const sousTitre = (lignes) => TITRE_Y + lignes * 0.42 + 0.55

  /** Page « téléphone » : titre et alinéas à gauche, l'écran à droite. */
  async function pageTel(n, { entete, titre, alineas, ecran, w = 7.3 }) {
    // ⚠️ Quatre alinéas ou moins : la colonne, calée en haut, s'arrêtait à
    // mi-page à côté d'un téléphone pleine hauteur (relecture du 19 septembre
    // 2026, pages 15, 16, 18, 20, 23, 27). Elle passe à 15 pt, sur une mesure
    // plus courte (6,3 pouces, une soixantaine de signes), et se CENTRE sur
    // la hauteur disponible.
    const court = alineas.length <= 4
    const size = court ? 15 : 13.5
    const gap = court ? 20 : 12
    const s = pres.addSlide()
    d.entete(s, entete)
    const lignes = titre.split('\n').length
    d.titre(s, titre, { x: M, y: TITRE_Y, w, size: 24, h: 1.0 })
    const y = sousTitre(lignes)
    if (court) alineasV(s, alineas, { x: M, y, w: 6.3, h: BAS - 0.3 - y, size, gap, valign: 'middle' })
    else d.alineas(s, alineas, { x: M, y, w, h: BAS - y, size, gap })
    if (ecran.coupe) await telCoupe(s, ecran.fichier, ecran.coupe)
    else await telEntier(s, ecran.fichier, ecran.legende, ecran.h ? { h: ecran.h } : {})
    d.pied(s, n, PIED)
    return s
  }

  /**
   * Page « site » : titre sur la largeur, puis les alinéas à gauche et la
   * capture à droite, alignés en haut. La capture garde son ratio et se cale
   * sur la marge de droite.
   */
  function pageSite(n, { entete, titre, alineas, cap, legende, size = 13, gap = 11, col = COL }) {
    const s = pres.addSlide()
    d.entete(s, entete)
    d.titre(s, titre, { x: M, y: TITRE_Y, w: W - 2 * M, size: 24, h: 0.6 })
    const y = sousTitre(1)
    d.alineas(s, alineas, { x: M, y, w: col, h: BAS - y, size, gap })
    const hMax = BAS - 0.5 - y
    // Largeur du FILET : il s'arrête sur la marge de droite, comme le filet
    // d'en-tête et le numéro de page. Une colonne de texte plus étroite
    // (`col`) laisse la capture s'élargir.
    const fw = Math.min(W - M - (M + col + 0.5), hMax * cap.ratio + 0.12)
    const g = cadreJuste(s, cap, { x: W - M - fw, y, w: fw })
    if (legende) d.legende(s, legende, { x: W - M - fw + 0.06, y: y + g.h + 0.16, w: fw - 0.12 })
    d.pied(s, n, PIED)
    return s
  }

  /**
   * Page « site » pleine largeur : le titre, la capture sur toute la mesure,
   * puis les alinéas en colonnes dessous. Pour un volet du site large et
   * bas : réduit à la colonne de droite, son texte tombait à 5 pt et le bas
   * de la page restait vide (relecture du 19 septembre 2026, pages 11 et 14).
   * `colonnes` : [[alinéas de la 1re colonne], [alinéas de la 2e], …].
   */
  function pageLarge(n, { entete, titre, colonnes, cap, legende, size = 13, gap = 10 }) {
    const s = pres.addSlide()
    d.entete(s, entete)
    d.titre(s, titre, { x: M, y: TITRE_Y, w: W - 2 * M, size: 24, h: 0.6 })
    const y = 2.12
    const g = cadreJuste(s, cap, { x: M, y, w: W - 2 * M })
    let ya = y + g.h + 0.06 + 0.34
    if (legende) {
      d.legende(s, legende, { x: M + 0.06, y: y + g.h + 0.16, w: W - 2 * M - 0.12 })
      ya += 0.26
    }
    const ecart = 0.45
    const cw = (W - 2 * M - (colonnes.length - 1) * ecart) / colonnes.length
    colonnes.forEach((items, i) => {
      d.alineas(s, items, { x: M + i * (cw + ecart), y: ya, w: cw, h: BAS + 0.1 - ya, size, gap })
    })
    d.pied(s, n, PIED)
    return s
  }

  // ── Captures du site (compte de démonstration, 19 septembre 2026) ──
  // Recadrages vérifiés à l'image : ni bouton de langue flottant, ni adresse.
  // ⚠️ Une capture du site se lit à sa LARGEUR : un volet de 2 450 px réduit
  // à la colonne de droite (6,5 pouces) tombe à 5 pt. D'où des recadrages
  // serrés sur ce que la page décrit, ou la pleine largeur (pages 11 et 14).
  // Zone de comptage : de « Une seule balise » à la ligne « Réserve ». On
  // s'arrête à y = 1430, avant le bouton de langue (x ≥ 3290, y ≥ 1445).
  const capZones = await capture(SITE + 'setup-deplie-1.png', { left: 906, top: 846, width: 2439, height: 584 })
  // Données d'inventaire : l'en-tête du volet, les deux compteurs et les
  // colonnes du référentiel, sans la zone « Déposez un fichier », qui prend
  // de la hauteur pour rien. Coupée à droite dans le blanc du volet (le
  // badge « PRÊT » reste hors cadre) : c'est ce qui la rend lisible.
  const capFichiers = await capture(SITE + 'setup-deplie-2.png', { left: 918, top: 99, width: 1595, height: 906 })
  const capEquipe = await capture(SITE + 'equipe-1.png', { left: 872, top: 308, width: 2488, height: 1171 })
  // Set up, inventaire commencé : les trois volets seulement, sans les onglets.
  const capSetup = await capture(SITE + 'setup-1.png', { left: 882, top: 410, width: 2487, height: 656 })
  // Suivi : la colonne de droite seule (onglets, compteurs, avancement par
  // zone, trois derniers scans). Le panneau de gauche (Progression,
  // Informations) élargissait la capture et rapetissait tout le reste. On
  // s'arrête à y = 1466, avant le bouton de langue (x ≥ 3285, y ≥ 1545).
  const capSuivi = await capture(SITE + 'suivi-1.png', { left: 882, top: 291, width: 2487, height: 1175 })
  const capEcarts = await capture(SITE + 'ecarts-2.png', { left: 872, top: 68, width: 2488, height: 1471 })
  const capRapport = await capture(SITE + 'rapport-1.png', { left: 872, top: 428, width: 2488, height: 1112 })
  // Photo de terrain : une étiquette QR sur un rayon, une main, un téléphone.
  // Ni visage ni enseigne. Ce n'est pas une balise Quantinvo (elle n'a pas de
  // numéro) : aucune légende ne la présente comme telle, et le titre de la
  // page ne parle pas de numéro.
  const photo = await capture('Photos-inventaire/IMG_4746.JPG', { left: 0, top: 0, width: 1264, height: 848 })

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Guide de prise en main',
      titre: 'Votre premier inventaire avec Quantinvo, étape par étape.',
      sousTitre: 'Pour l’administrateur d’entreprise, les superviseurs et les compteurs.\nSur le site et dans l’application.',
      bas: 'Devkaylab · septembre 2026 · contact@quantinvo.com',
    })
  }

  // ════ 2. Trois rôles ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Avant de commencer')
    // Coupé à la main : en Archivo, « ce » restait en bout de ligne.
    d.titre(s, 'Trois rôles. Chacun voit\nce qui le concerne.')
    d.para(s, 'Le rôle se choisit à l’invitation. L’administrateur peut le changer ensuite.', {
      x: M, y: 2.95, w: COL - 0.4, h: 1.0, size: 12.5, italic: true, color: P.SLATE,
    })
    const roles = [
      ['Administrateur d’entreprise', 'Site et application',
        'Il ajoute les magasins et invite les superviseurs. Il voit toute l’entreprise : les personnes et les inventaires.'],
      ['Superviseur', 'Site et application',
        'Il prépare les inventaires de ses magasins et invite ses compteurs. Il suit le comptage, arbitre les écarts et télécharge le rapport.'],
      ['Compteur', 'Application',
        'Il scanne la balise d’un rayon, puis ses articles. Sur le site, il ne trouve que « Mon compte ».'],
    ]
    let y = 1.55
    roles.forEach(([nom, lieu, texte], i) => {
      s.addText(nom, { x: RX, y, w: 4.4, h: 0.34, fontFace: FONTD, fontSize: 14, bold: true, color: P.INK, margin: 0 })
      s.addText(lieu, { x: RX + 4.4, y: y + 0.04, w: RW - 4.4, h: 0.3, fontFace: FONT, fontSize: 10.5, color: P.SLATE, align: 'right', margin: 0 })
      s.addText(texte, { x: RX, y: y + 0.46, w: RW, h: 1.0, fontFace: FONT, fontSize: 13.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.18 })
      y += 1.75
      if (i < roles.length - 1) d.filet(s, RX, y - 0.22, RW)
    })
    d.pied(s, 2, PIED)
  }

  // ════ 3. Le déroulé ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Avant de commencer')
    d.titreLarge(s, 'Le déroulé, de l’accès à la clôture.')
    d.para(s, 'Sauf mention contraire, le superviseur travaille au choix sur le site ou dans l’application.', {
      x: M, y: 2.2, w: W - 2 * M, h: 0.4, size: 12, color: P.SLATE,
    })
    const etapes = [
      ['Ouvrir l’accès, ajouter les magasins', 'Administrateur · site'],
      ['Inviter l’équipe', 'Administrateur et superviseurs'],
      ['Imprimer et coller les balises', 'Superviseur'],
      ['Créer l’inventaire, affecter les balises', 'Superviseur'],
      ['Importer les fichiers', 'Superviseur'],
      ['Faire entrer l’équipe, puis commencer', 'Superviseur · « Commencer l’inventaire » sur le site'],
      ['Compter', 'Compteurs · application'],
      ['Suivre en direct', 'Superviseur · site'],
      ['Auditer, puis arbitrer les écarts', 'Compteurs, puis superviseur'],
      ['Télécharger le rapport, clôturer', 'Superviseur'],
    ]
    const y0 = 2.9, pas = 0.76, cw = (W - 2 * M) / 2 - 0.3
    etapes.forEach(([etape, qui], i) => {
      const col = i < 5 ? 0 : 1
      const x = col ? W / 2 + 0.2 : M
      const y = y0 + (i % 5) * pas
      d.numero(s, i + 1, x, y + 0.02, 0.36, P.INK)
      s.addText(etape, { x: x + 0.56, y, w: cw - 0.56, h: 0.3, fontFace: FONT, fontSize: 13, bold: true, color: P.INK, margin: 0 })
      s.addText(qui, { x: x + 0.56, y: y + 0.32, w: cw - 0.56, h: 0.26, fontFace: FONT, fontSize: 10.5, color: P.SLATE, margin: 0 })
      if (i % 5 < 4) d.filet(s, x, y + pas - 0.1, cw)
    })
    d.pied(s, 3, PIED)
  }

  // ════ 4. L'accès de l'administrateur ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Administrateur d’entreprise · site')
    d.titre(s, 'L’accès s’ouvre\nau paiement.')
    d.encadre(s, 'Son espace, sur le site',
      'Cinq onglets : Tableau de bord, Magasins, Équipe, Inventaires et Journal. Ce dernier garde la trace des invitations de superviseurs, des changements de rôle, des retraits et des suppressions.',
      { x: M, y: 4.55, w: COL, h: 1.75 })
    d.alineas(s, [
      ['Sur devis.', 'L’entreprise et ses magasins sont créés dès le règlement. L’administrateur reçoit l’e-mail « Bienvenue sur Quantinvo ».'],
      ['Un lien personnel.', 'Il ne sert qu’une fois. L’accès se crée comme pour toute personne invitée.'],
      ['Protéger le compte.', 'La double authentification s’active dans « Mon compte ». Le site la conseille à l’administrateur.'],
      ['Pour l’équipe.', 'Personne ne s’inscrit seul : chacun entre sur invitation.'],
    ], { x: RX, y: 1.55, w: RW, h: 4.9, size: 14, gap: 20 })
    d.pied(s, 4, PIED)
  }

  // ════ 5. Ajouter un magasin ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Administrateur d’entreprise · site')
    d.titre(s, 'Ajouter un magasin, puis nommer qui le supervise.')
    // L'encadré à gauche sous le titre, comme en page 4 : à droite sous les
    // alinéas, il laissait vide toute la moitié gauche de la page.
    d.encadre(s, 'Ce que couvre l’offre',
      'Les comptes et les inventaires sont illimités. L’offre fixe le nombre d’appareils qui comptent en même temps dans le magasin.',
      { x: M, y: 4.55, w: COL, h: 1.45 })
    d.alineas(s, [
      ['Onglet Magasins.', '« Ajouter un magasin » demande un nom, une adresse et le nombre d’appareils.'],
      ['Le règlement.', '« Créer le magasin » ouvre le paiement, au mois ou à l’année. Le magasin n’existe qu’une fois réglé.'],
      ['Un superviseur, tout de suite.', 'Une fenêtre propose d’en nommer un. C’est lui qui préparera les inventaires du magasin.'],
      ['Changer d’offre.', 'Depuis la fiche du magasin.'],
    ], { x: RX, y: 1.55, w: RW, h: 4.9, size: 14, gap: 20 })
    d.pied(s, 5, PIED)
  }

  // ════ 6. Inviter l'équipe ════
  await pageTel(6, {
    entete: 'Administrateur et superviseur',
    titre: 'Inviter l’équipe.',
    alineas: [
      ['L’administrateur.', 'Dans Équipe, « + Ajouter une personne ». Il choisit compteur ou superviseur, puis les magasins.'],
      ['Le superviseur.', 'Il ajoute ses compteurs depuis « Mon équipe ».'],
      ['Le statut « Mot de passe à créer ».', 'La personne a reçu son lien, mais n’a pas encore choisi son mot de passe.'],
      ['Retirer d’un magasin.', 'Elle perd l’accès aux inventaires de ce magasin, mais garde son compte.'],
    ],
    ecran: { fichier: 'ajouter-membre.png', coupe: 960 },
  })

  // ════ 7. La première connexion ════
  await pageTel(7, {
    entete: 'Chaque personne invitée',
    titre: 'La première connexion part de l’e-mail reçu.',
    alineas: [
      ['Le lien.', 'Il ouvre « Finaliser mon compte ». On y vérifie son prénom et son nom.'],
      ['Le mot de passe.', 'Douze caractères au moins, avec une minuscule, une majuscule, un chiffre et un symbole.'],
      ['Le superviseur.', 'Il se connecte sur www.quantinvo.com ou dans l’application.'],
      ['Le compteur.', 'Il installe l’application Quantinvo et s’y connecte avec l’adresse qui a reçu le lien.'],
      ['Le premier écran.', 'À la première ouverture, l’application salue par le prénom et résume le rôle en trois lignes.'],
    ],
    ecran: { fichier: 'bienvenue-compteur.png', coupe: 820 },
  })

  // ════ 8. Créer les balises ════
  await pageTel(8, {
    entete: 'Superviseur · une fois pour toutes',
    titre: 'Créer et imprimer les balises.',
    alineas: [
      ['Une balise.', 'Une étiquette QR numérotée, collée dans le magasin. Le compteur la scanne pour dire où il est.'],
      ['Où la créer.', 'Dans la Boîte à outils.'],
      ['Les réglages.', 'La numérotation, le premier numéro et le nombre de balises.'],
      ['L’impression.', 'Un PDF pour planches Avery L7160, 21 étiquettes par planche. Imprimer à 100 %, sans « Ajuster à la page ».'],
      ['La suite.', 'Pour d’autres balises, on indique comme premier numéro celui qui suit la dernière imprimée.'],
    ],
    ecran: { fichier: 'creer-balises.png', coupe: 990 },
  })

  // ════ 9. Coller les balises ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · une fois pour toutes')
    d.titre(s, 'Coller les balises,\nune par rayon.')
    d.alineas(s, [
      ['Dans l’ordre des numéros.', 'Une suite par emplacement. Par exemple, 1000 à 1049 en surface de vente.'],
      ['Seulement un numéro.', 'Le code QR ne porte ni date ni inventaire. Les balises peuvent donc rester en place.'],
    ], { x: M, y: 2.95, w: COL - 0.3, h: 3.0, size: 14, gap: 18 })
    cadreJuste(s, photo, { x: RX, y: 1.5, w: RW, h: 4.9 })
    d.pied(s, 9, PIED)
  }

  // ════ 10. Créer l'inventaire ════
  await pageTel(10, {
    entete: 'Superviseur · à chaque inventaire',
    titre: 'Créer l’inventaire et son code d’accès.',
    alineas: [
      ['« + Nouvel inventaire ».', 'Sur le tableau de bord du site ou l’accueil de l’application.'],
      ['Le nom.', 'Il sert à retrouver l’inventaire. Le N° d’inventaire est généré automatiquement.'],
      // Le site dit « Code d'accès », l'application « Code inventaire » : le
      // lien se fait ici, une fois pour toutes (pages 13 et 15).
      ['Le code d’accès.', '« Code inventaire » dans l’application. Quatre caractères au moins. « Générer » en propose un.'],
      ['Avec ou sans balises.', 'Avec, plusieurs personnes comptent en parallèle. L’avancement se lit par rayon. Sans, on scanne directement les articles.'],
      ['À la création seulement.', 'Ce choix ne se change plus ensuite.'],
    ],
    ecran: { fichier: 'nouvel-inventaire.png', legende: 'Nouvel inventaire,\ndans l’application.' },
  })

  // ════ 11. Affecter les balises ════
  // Pleine largeur, sans légende : l'alinéa du milieu dit déjà où l'on est.
  // ⚠️ Sous la capture, les alinéas n'ont qu'un pouce : une légende ou un
  // alinéa de plus les pousse sur le pied (vu en page 14).
  pageLarge(11, {
    entete: 'Superviseur · à chaque inventaire',
    titre: 'Affecter les balises aux emplacements.',
    colonnes: [
      [['Une plage.', 'Elle relie une suite de balises à un emplacement : 1050 à 1069, la réserve.']],
      [['Onglet Set up, « Zone de comptage ».', 'Une question d’abord : « Avez-vous vos balises ? » Si non, le volet propose d’en imprimer une planche.']],
      [['Affecter une plage.', 'Un emplacement, une balise de début, une balise de fin. « Une seule balise » rattache une étiquette isolée.']],
    ],
    cap: capZones,
  })

  // ════ 12. Importer les fichiers ════
  pageSite(12, {
    entete: 'Superviseur · à chaque inventaire',
    titre: 'Importer le référentiel articles et le stock théorique.',
    alineas: [
      ['Le référentiel articles, requis.', 'Il relie chaque code à un libellé. Sans lui, tout scan ressort en « article inconnu ».'],
      ['Le stock théorique, optionnel.', 'Il donne les quantités attendues. Lui seul fait apparaître l’écart entre compté et attendu.'],
      ['CSV ou Excel, sans retouche.', 'Les en-têtes courants sont reconnus : SKU ou Code article, Code-barres ou EAN, Libellé ou Désignation, Quantité ou Qté.'],
      ['Des modèles.', 'La Boîte à outils du site fournit les deux fichiers, colonnes nommées et codes au format Texte.'],
    ],
    cap: capFichiers,
    legende: 'Onglet Set up, « Données d’inventaire » : les deux fichiers chargés, puis les colonnes du référentiel.',
  })

  // ════ 13. Faire entrer l'équipe ════
  pageSite(13, {
    entete: 'Superviseur · à chaque inventaire',
    titre: 'Faire entrer l’équipe dans l’inventaire.',
    alineas: [
      ['« Ajouter quelqu’un à cet inventaire ».', 'Dans l’onglet Équipe, parmi les personnes du magasin. Elle entre comme compteur ou co-superviseur.'],
      ['Un e-mail la prévient.', 'Son téléphone aussi, si les notifications sont activées.'],
      ['Sans l’ajouter.', 'Le N° d’inventaire et le code d’accès suffisent pour rejoindre l’inventaire depuis l’application.'],
      ['Depuis le téléphone.', 'Fiche de l’inventaire, « Partager les identifiants ».'],
    ],
    cap: capEquipe,
    legende: 'Onglet Équipe : les identifiants à communiquer, puis les membres.',
  })

  // ════ 14. Commencer l'inventaire ════
  // ⚠️ Le bouton du même nom, dans l'application, ne change PAS le statut
  // (src/lib/tunnel.ts : il fait comme « Plus tard »). Défaut du produit
  // signalé à Julien. La page le dit en CONSIGNE (« Toujours depuis le
  // site ») : écrit « le bouton de l'application ne change pas le statut »,
  // un client y lisait l'aveu d'un bouton qui ne sert à rien. Le jour où il
  // est corrigé, « Toujours » tombe.
  // Le démarrage emmène sur Suivi (SetupTab.tsx, Demarrage) ; la capture
  // montre Set up pour qui y revient, d'où « Suivre l'avancement ».
  pageLarge(14, {
    entete: 'Superviseur · à chaque inventaire',
    titre: '« Commencer l’inventaire » termine la préparation.',
    colonnes: [
      [
        ['Toujours depuis le site.', 'Dans l’onglet Set up, le bouton s’active dès que le référentiel articles est chargé.'],
        ['Ce qu’il signale.', 'L’équipe peut compter. Le statut passe de « Ouverte » à « En cours ».'],
      ],
      [
        ['Ensuite.', 'Le site ouvre l’onglet Suivi. Depuis Set up, « Suivre l’avancement » y ramène.'],
        ['Rien n’est figé.', 'En cours de comptage, un fichier se remplace et une plage de balises se réaffecte.'],
      ],
    ],
    // Sans légende, comme la page 11 : la capture dit déjà « L'inventaire
    // est en cours » et « PRÊT », et la légende poussait les alinéas sur le
    // pied de page.
    cap: capSetup,
  })

  // ════ 15. Retrouver son inventaire ════
  await pageTel(15, {
    entete: 'Compteur · application',
    titre: 'Retrouver ou rejoindre son inventaire.',
    alineas: [
      ['On l’a ajouté.', 'L’inventaire est dans « Mes inventaires ». Il suffit de le toucher.'],
      ['On lui a donné les identifiants.', 'Il les saisit sous « Rejoindre un autre inventaire ».'],
      ['La liste est vide.', 'Il sera prévenu dès que le superviseur l’ajoutera.'],
      ['Quitter.', 'L’inventaire sort de sa liste. Ce qu’il a compté reste enregistré.'],
    ],
    ecran: { fichier: 'accueil-compteur.png', coupe: 1000 },
  })

  // ════ 16. La balise d'abord ════
  await pageTel(16, {
    entete: 'Compteur · application',
    titre: 'D’abord, la balise du rayon.',
    alineas: [
      ['Scanner l’étiquette.', 'Le code QR se lit à la caméra. On peut aussi saisir le numéro, puis toucher « Ouvrir ».'],
      ['La zone s’ouvre.', 'Un bandeau l’indique, avec l’emplacement et le numéro. Les articles scannés ensuite y sont comptés.'],
      ['Aucune photo.', 'La caméra lit les codes. Elle n’enregistre aucune image.'],
      ['Trop sombre ?', 'La lampe s’allume depuis l’écran.'],
    ],
    ecran: { fichier: 'scanner-balise.png', coupe: 770 },
  })

  // ════ 17. Les articles ════
  await pageTel(17, {
    entete: 'Compteur · application',
    titre: 'Puis les articles :\nchaque lecture ajoute une pièce.',
    alineas: [
      ['Le mode de scan.', 'La caméra, la saisie manuelle ou une douchette Bluetooth appairée au téléphone.'],
      ['Le choix, en haut de l’écran.', 'Il reste le même pour tout le comptage. La douchette va bien plus vite sur un gros rayon.'],
      // Un seul alinéa pour + et − : deux disaient la même chose.
      ['Corriger une quantité.', 'Dans la liste des articles scannés, + ajoute une pièce, − en retire une. Rien n’est effacé : chaque correction est une ligne de plus.'],
    ],
    ecran: { fichier: 'comptage.png', legende: 'L’écran de comptage,\nbalise 1000 ouverte.' },
  })

  // ════ 18. Clôturer la balise ════
  await pageTel(18, {
    entete: 'Compteur · application',
    titre: 'Le rayon est fini : clôturer la balise.',
    alineas: [
      ['Le bouton rouge.', '« Clôturer la balise », sous la liste des articles scannés.'],
      ['Rien à envoyer.', 'Avec du réseau, le superviseur voit déjà les pièces.'],
      ['Un bilan, la première fois.', 'Les pièces et les références de la balise s’affichent.'],
      ['Au rayon suivant.', 'Toucher « Balise suivante », puis scanner son étiquette.'],
    ],
    ecran: { fichier: 'balise-terminee.png', legende: 'Première balise terminée :\nle bilan du rayon.' },
  })

  // ════ 19. Revenir sur une balise ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Compteur · application')
    d.titre(s, 'Revenir sur une balise\ndéjà comptée.')
    // L'encadré à gauche sous le titre (comme pages 4 et 5), et c'est LUI qui
    // dit l'effet de « Recompter à zéro » : l'alinéa le répétait.
    d.encadre(s, 'Annuler ou recompter',
      '« Annuler le comptage » défait seulement ce qu’a scanné ce téléphone. « Recompter à zéro » vide la balise pour toute l’équipe.',
      { x: M, y: 4.55, w: COL, h: 1.45 })
    d.alineas(s, [
      ['Rouvrir.', 'La liste « Revenir sur une balise » reprend les balises terminées. Scanner à nouveau l’étiquette a le même effet.'],
      ['L’écran fait le point.', 'Il affiche les pièces enregistrées, puis propose deux choix.'],
      ['Compléter le comptage.', 'Les pièces restent et les nouvelles s’ajoutent. La liste des articles déjà comptés s’ouvre, pour ne rien scanner deux fois.'],
      ['Recompter à zéro.', 'Une seconde confirmation est demandée.'],
      // Pas de « peut-être » : la ligne se coupait à son trait d'union, et
      // Public Sans n'a pas de trait d'union insécable (U+2011).
      ['Une balise non clôturée.', 'L’écran prévient : quelqu’un pourrait encore être dessus.'],
    ], { x: RX, y: 1.55, w: RW, h: 4.9, size: 14, gap: 16 })
    d.pied(s, 19, PIED)
  }

  // ════ 20. Les imprévus ════
  await pageTel(20, {
    entete: 'Compteur · application',
    titre: 'Ce que l’écran propose en cas d’imprévu.',
    alineas: [
      ['« Balise hors plage ».', 'Son numéro n’est dans aucune plage de l’inventaire. « Ajouter » permet de compter aussitôt. Le superviseur lui donnera un emplacement.'],
      ['« Article inconnu ».', 'Le code n’est pas dans le référentiel articles. On l’ajoute, avec un prix d’achat à 0 €.'],
      ['Tous les appareils sont pris.', 'Le comptage attend. L’écran se débloque seul dès qu’une place se libère.'],
    ],
    // Légende sur deux lignes : le téléphone raccourcit pour lui laisser la place.
    ecran: { fichier: 'balise-hors-plage.png', h: 4.6, legende: '« Balise hors plage » :\n« Ajouter » pour compter\ntout de suite.' },
  })

  // ════ 21. Sans réseau ════
  await pageTel(21, {
    entete: 'Compteur · application',
    titre: 'Compter sans réseau.',
    alineas: [
      // Le libellé du bandeau, tel qu'à l'écran (OfflineTopBanner.tsx), sans
      // point. ⚠️ Espaces FINES autour du tiret : en Public Sans, le tiret
      // est court et large d'approches, et l'espace insécable ordinaire
      // faisait une incise trouée.
      ['Un bandeau prévient.', `« Hors ligne${FINE}—${FINE}le comptage continue ». Les scans attendent sur le téléphone.`],
      ['L’envoi est automatique.', 'Tout part dès que la connexion revient.'],
      ['« Balises comptées » et « En attente ».', 'La première liste vient du serveur : ce travail est enregistré. La seconde est encore sur le téléphone.'],
      ['Avant de quitter le magasin.', 'Retrouver du réseau, puis vérifier que « En attente » est vide.'],
      ['Ce qui demande le réseau.', 'Annuler un comptage et recompter à zéro. Une balise hors plage ne se signale qu’en ligne.'],
    ],
    // ⚠️ La capture ne montre que « Balises comptées », pas le bandeau hors
    // ligne ni « En attente » : le téléphone entier et sa légende disent ce
    // qu'on voit. Le jour où une capture en mode avion existe, elle la
    // remplace.
    ecran: { fichier: 'balises-comptees-detail.png', legende: '« Balises comptées » :\nce qui est déjà sur le serveur.' },
  })

  // ════ 22. Le suivi ════
  pageSite(22, {
    entete: 'Superviseur · pendant le comptage',
    titre: 'Le suivi en direct, sur le site.',
    alineas: [
      ['La progression.', 'La part des balises comptées, puis auditées, et ce qui reste à compter.'],
      ['L’avancement par zone.', 'Une ligne par emplacement. Un clic montre ses balises, un second leur contenu.'],
      ['Les derniers scans.', 'Chaque lecture s’affiche aussitôt, marquée comptage ou audit.'],
      ['Des appareils, pas des personnes.', 'Le suivi affiche le nombre d’appareils connectés. Aucun nom n’apparaît.'],
      ['Une balise laissée ouverte.', 'Le site permet de la marquer comptée, sans passer par le téléphone.'],
    ],
    // Le volet fait toute la largeur de l'écran : la colonne de texte se
    // resserre pour que la capture gagne un pouce et se lise.
    col: 3.8,
    size: 12.5,
    cap: capSuivi,
    legende: 'Onglet Suivi : appareils connectés, pièces comptées, avancement par zone, derniers scans.',
  })

  // ════ 23. L'audit ════
  await pageTel(23, {
    entete: 'Compteur · application',
    titre: 'L’audit : un second comptage, pour vérifier.',
    alineas: [
      ['Sur demande.', 'On recompte un rayon déjà compté. Le superviseur dit quand.'],
      ['« Auditer des articles ».', 'L’en-tête passe au jaune. Puis les mêmes gestes : la balise, les articles, la clôture.'],
      // Ce que dit BaliseDetail.tsx sur le site (« pas encore vu » / « pas
      // trouvé »), traduit pour un compteur, qui ne voit pas cet écran.
      ['Après la clôture de l’audit.', 'L’écart de la balise se calcule à ce moment-là. Avant, un article pas encore audité passerait pour manquant.'],
    ],
    ecran: { fichier: 'inventaire-compteur.png', legende: '« Ma progression » :\ncompter ou auditer.' },
  })

  // ════ 24. Arbitrer ════
  pageSite(24, {
    entete: 'Superviseur · après l’audit',
    titre: 'Arbitrer les écarts entre comptage et audit.',
    alineas: [
      ['Onglet Écarts d’audit.', 'Chaque article dont les deux quantités diffèrent, rangé par balise.'],
      ['Le calcul.', 'Quantité de l’auditeur moins celle du compteur.'],
      ['Pour chaque ligne.', 'Un clic retient la quantité du compteur ou de l’auditeur. Une autre quantité se saisit, puis « Retenir ».'],
      ['Une décision qui tient.', 'Un nouveau comptage n’écrase pas un arbitrage. « Annuler l’arbitrage » la remet en écart.'],
    ],
    cap: capEcarts,
    legende: 'Onglet Écarts d’audit : trois écarts à traiter.',
  })

  // ════ 25. Le rapport ════
  pageSite(25, {
    entete: 'Superviseur · pour finir',
    titre: 'Le rapport, puis le fichier Excel.',
    alineas: [
      ['Quatre totaux.', 'Stock théorique, stock compté, écart en unités, écart en valeur d’achat.'],
      ['Une ligne par article.', 'Théorique, compté, écart, valeur et statut. La recherche prend un libellé, un SKU ou un EAN.'],
      ['« Non compté ».', 'Un article attendu que personne n’a scanné. Ce statut n’existe qu’avec le stock théorique.'],
      ['La quantité retenue.', 'L’arbitrage, sinon l’auditeur, sinon le compteur.'],
      ['« Télécharger ».', 'Un fichier Excel à deux feuilles : « Écarts » et « Détail par zone ». L’application exporte le même fichier.'],
    ],
    cap: capRapport,
    legende: 'Onglet Rapport : les totaux, puis le détail par article.',
  })

  // ════ 26. Clôturer ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · pour finir')
    d.titre(s, 'Clôturer : l’inventaire\npasse en lecture seule.')
    // Le seul usage de l'accent du deck.
    d.chiffre(s, '12 mois', 'après la clôture, l’inventaire est archivé. Le détail des scans s’efface ; le rapport et les écarts restent.', { x: M, y: 3.55, w: COL - 0.4 })
    // Quatre alinéas, pas cinq : à 11,5 pt la colonne détonnait, et « Eux
    // seuls », « Les mêmes » renvoyaient trois lignes plus haut.
    d.alineas(s, [
      ['Qui clôture.', 'Le créateur de l’inventaire ou l’administrateur d’entreprise. Eux seuls le voient ensuite.'],
      ['Ce qui change.', 'Plus aucun scan n’est accepté, même d’un téléphone resté ouvert.'],
      ['Avant de confirmer.', 'L’application dit combien de balises n’ont pas été comptées. Elles vaudront zéro dans le rapport.'],
      ['Rouvrir ou supprimer.', 'Ils peuvent le rouvrir tant qu’il n’est pas archivé. La suppression efface tout, sans retour.'],
    ], { x: RX - 0.3, y: 1.55, w: 4.4, h: 5.1, size: 12.5, gap: 12 })
    await telEntier(s, 'inventaire-superviseur.png', 'La fiche de l’inventaire,\ncôté superviseur.')
    d.pied(s, 26, PIED)
  }

  // ════ 27. Mon compte ════
  // ⚠️ La capture mon-compte.png date du 9 septembre : la ligne « Langue »
  // (ajoutée le 11) n'y figure pas. Le texte n'en parle donc pas ; le jour où
  // la capture est reprise, l'alinéa peut revenir.
  await pageTel(27, {
    entete: 'Pour tous',
    titre: 'Ce que contient « Mon compte ».',
    alineas: [
      ['Mon profil.', 'Le nom, le mot de passe, la double authentification.'],
      ['Télécharger mes données.', 'Profil, inventaires, invitations et demandes, dans un fichier lisible.'],
      ['Revoir les repères.', 'Les explications du premier passage reviennent une fois, sur ce téléphone.'],
      // La suppression est DANS « Mon profil » (src/app/(compte)/profile.tsx),
      // pas une entrée de « Mon compte » : la capture en montre quatre.
      ['Supprimer mon compte.', 'Dans « Mon profil ». Une demande part. Après traitement, le compte est supprimé. Ses comptages restent, anonymisés.'],
    ],
    ecran: { fichier: 'mon-compte.png', coupe: 1000 },
  })

  // ════ 28. Finale ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'À vérifier la veille de l’inventaire.',
      texte: 'Les balises sont collées et affectées. Les fichiers sont importés. Chaque compteur s’est connecté une fois. Il ne reste qu’à commencer.',
      contact: 'Une question : contact@quantinvo.com',
      bas: 'Les écrans de l’application se revoient sur le site : Boîte à outils, « Prise en main de l’application ».',
    })
  }

  await ecrire(pres, 'Quantinvo-prise-en-main')
}

main().catch((e) => { console.error(e); process.exit(1) })
