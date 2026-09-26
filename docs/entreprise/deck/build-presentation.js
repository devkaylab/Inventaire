// Présentation Quantinvo du 2 octobre 2026 — 25 minutes, puis démonstration.
//   node build-presentation.js                 → Quantinvo-presentation.pptx        (Arial)
//   FONT_MODE=brand node build-presentation.js → Quantinvo-presentation-marque.pptx (Archivo/Public Sans)
// Contrôle : node verifier-typo.js Quantinvo-presentation.pptx Quantinvo-presentation-marque.pptx
//
// ⚠️⚠️ **LE TEXTE EST CELUI DE JULIEN, ET RIEN D'AUTRE.** Il l'a écrit et
// hiérarchisé le 26 septembre 2026, avec la consigne : « suis-la à la lettre,
// n'invente rien ». Chaque phrase de ce deck vient de ce texte, découpée pour
// tenir sur une page, jamais complétée. Aucun chiffre, aucun client, aucun
// prix n'a été ajouté — et il n'y en avait aucun dans le texte.
//
// Ce qui a été ajouté, ce sont les IMAGES : « plus le client voit le produit,
// plus il a envie de l'essayer ». Elles viennent du compte de démonstration
// (Maison Oberlin) : l'application au simulateur (captures/), le site le
// 19 septembre 2026 (captures-site/). ⚠️ Ne JAMAIS montrer web/screenshots/,
// c'est un faux compte de test.
//
// ⚠️ **`boite-a-outils.png` EST ÉCARTÉE DE LA PAGE DES BALISES.** Elle date du
// 9 septembre et affiche encore « Avery L7160 », l'ancienne planche ; la page,
// elle, annonce la L4732 comme le texte de Julien. Une capture qui contredit
// sa diapo se voit au premier regard. `creer-balises.png` porte le même
// en-tête « Boîte à outils » et ne montre aucune référence : c'est elle qui
// sert. À refaire à la prochaine passe de captures.
//
// ⚠️ L'accent vert ne sert qu'aux trois pastilles des profils : c'est le seul
// endroit de ce deck où quelque chose engage.

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer, typo } = require('./charte')

const PIED = 'Quantinvo · présentation du 2 octobre 2026'
const SITE = '../captures-site/2026-09-19-rayon-textile/brut/'
const BAS = H - 0.72
const INSEC = ' '

/** Pas de mot seul en dernière ligne — même règle que les autres decks. */
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
  const d = await preparer({ titre: 'Quantinvo — présentation du 2 octobre 2026' })
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

  // ── Les captures, chargées une fois ───────────────────────────────────
  // Les rectangles du site sont ceux, déjà éprouvés, de build-prise-en-main.js :
  // ils retirent la barre de navigation et le nom du magasin de démonstration.
  const capSetup = await capture(SITE + 'setup-1.png', { left: 882, top: 410, width: 2487, height: 656 })
  const capZones = await capture(SITE + 'setup-deplie-1.png', { left: 906, top: 846, width: 2439, height: 584 })
  const capFichiers = await capture(SITE + 'setup-deplie-2.png', { left: 918, top: 99, width: 1595, height: 906 })
  const capEquipe = await capture(SITE + 'equipe-1.png', { left: 872, top: 308, width: 2488, height: 1171 })
  const capSuivi = await capture(SITE + 'suivi-1.png', { left: 882, top: 291, width: 2487, height: 1175 })
  const capEcarts = await capture(SITE + 'ecarts-2.png', { left: 872, top: 68, width: 2488, height: 1471 })
  const capRapport = await capture(SITE + 'rapport-1.png', { left: 872, top: 428, width: 2488, height: 1112 })
  // La planche imprimée, à l'échelle : six balises telles qu'elles sortent du
  // générateur. C'est le seul visuel qui ne soit pas un écran.
  const capPlanche = await capture('./captures/planche-balises.png', { left: 0, top: 0, width: 2718, height: 828 })

  let n = 0

  /** Téléphone entier, calé à droite, avec sa légende. */
  async function telEntier(s, fichier, legende, { x, y = 1.5, h = 4.8 } = {}) {
    const tel = await cadrer(fichier, { w: 1, h: 99 })
    const w = h * tel.ratio
    const px = x === undefined ? W - M - w : x
    d.ecranEntier(s, { x: px, y, h, tel })
    if (legende) {
      s.addText(legende, {
        x: px - 0.35, y: y + h + 0.1, w: w + 0.7, h: 0.5, fontFace: FONT, fontSize: 9.5,
        italic: true, color: P.SLATE, align: 'center', margin: 0, lineSpacingMultiple: 1.1,
      })
    }
    return { x: px, w }
  }

  /**
   * Les alinéas de d.alineas(), avec un alignement vertical au choix : une
   * colonne de deux ou trois, calée en haut, laissait un tiers de page vide
   * à côté d'un téléphone pleine hauteur.
   */
  function alineasV(s, items, { x, y, w, h, size, gap, valign = 'middle' }) {
    const runs = []
    items.forEach(([lead, text], i) => {
      const last = i === items.length - 1
      if (lead) runs.push({ text: lead + ' ', options: { bold: true, color: P.INK, paraSpaceAfter: gap } })
      runs.push({ text, options: { color: P.INK2, breakLine: !last, paraSpaceAfter: gap } })
    })
    s.addText(runs, { x, y, w, h, fontFace: FONT, fontSize: size, margin: 0, lineSpacingMultiple: 1.18, valign })
  }

  /** Page « un téléphone » : titre et texte à gauche, l'écran à droite. */
  async function pageTel({ entete, titre, alineas, ecran, legende, hTel = 4.8 }) {
    const s = pres.addSlide()
    d.entete(s, entete)
    d.titre(s, titre, { w: COL + 0.6 })
    const g = await telEntier(s, ecran, legende, { h: hTel })
    const w = g.x - M - 0.6
    // Peu d'alinéas : on respire davantage, sur une mesure plus courte.
    const court = alineas.length <= 3
    alineasV(s, alineas, {
      x: M, y: 2.9, w, h: BAS - 2.9 - 0.2,
      size: court ? 14 : 12.5, gap: court ? 18 : 11,
    })
    d.pied(s, ++n, PIED)
    return s
  }

  /** Page « un écran de site », large, sous un titre pleine largeur. */
  function pageSite({ entete, titre, texte, cap, legende }) {
    const s = pres.addSlide()
    d.entete(s, entete)
    d.titreLarge(s, titre, { y: 1.3, size: 24 })
    let y = 2.25
    if (texte) {
      d.para(s, texte, { x: M, y: 2.2, w: W - 2 * M, h: 0.7, size: 13 })
      y = 3.0
    }
    const g = d.cadre(s, cap, { x: M + 0.06, y, w: W - 2 * M - 0.12, h: BAS - y - 0.4 })
    if (legende) d.legende(s, legende, { x: M + 0.06, y: y + g.h + 0.14, w: W - 2 * M })
    d.pied(s, ++n, PIED)
    return s
  }

  /** Page « téléphone et site » : les deux surfaces côte à côte. */
  async function pageDuo({ entete, titre, texte, ecran, cap, legendeTel, legendeSite }) {
    const s = pres.addSlide()
    d.entete(s, entete)
    d.titreLarge(s, titre, { y: 1.3, size: 24 })
    if (texte) d.para(s, texte, { x: M, y: 2.2, w: W - 2 * M, h: 0.6, size: 13 })
    // Sans phrase d'accroche, rien ne justifie de laisser la bande vide.
    const y = texte ? 3.0 : 2.3
    const hIm = BAS - y - 0.55
    const g = await telEntier(s, ecran, legendeTel, { x: M, y, h: hIm })
    const x = g.x + g.w + 0.7
    const cg = d.cadre(s, cap, { x, y, w: W - M - x, h: hIm })
    if (legendeSite) d.legende(s, legendeSite, { x, y: y + cg.h + 0.14, w: W - M - x })
    d.pied(s, ++n, PIED)
    return s
  }

  // ── 1. Couverture ─────────────────────────────────────────────────────
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Présentation',
      titre: 'Quantinvo',
      sousTitre: 'Un outil d’inventaire qui accompagne les enseignes,\nqu’importe la taille, dans la fiabilisation de leur stock.',
      bas: '2 octobre 2026 · 25 minutes',
    })
  }

  // ── 2. Les deux surfaces ──────────────────────────────────────────────
  await pageDuo({
    entete: 'Quantinvo',
    titre: 'Une application et un tableau de bord',
    texte: 'Quantinvo met à disposition une application, compatible iOS et Android, ainsi qu’un tableau de bord accessible depuis n’importe quel navigateur web.',
    ecran: 'accueil-superviseur.png',
    cap: capSuivi,
    legendeTel: 'L’application',
    legendeSite: 'Le tableau de bord',
  })

  // ── 3. Intertitre ─────────────────────────────────────────────────────
  {
    const s = pres.addSlide()
    d.entete(s, 'Quantinvo')
    d.titreLarge(s, 'Comment ça marche ?', { y: 3.0, size: 40 })
    d.pied(s, ++n, PIED)
  }

  // ── 4. Créer un inventaire ────────────────────────────────────────────
  await pageDuo({
    entete: 'Créer un inventaire',
    titre: 'Depuis l’application ou depuis l’ordinateur',
    texte: 'Un superviseur qui souhaite faire un inventaire peut en créer un depuis l’application ou depuis son ordinateur via son tableau de bord, chacun ses préférences.',
    ecran: 'nouvel-inventaire.png',
    cap: capSetup,
    legendeTel: 'Depuis l’application',
    legendeSite: 'Depuis le tableau de bord',
  })

  // ── 5. Ce qu'il renseigne ─────────────────────────────────────────────
  await pageTel({
    entete: 'Créer un inventaire',
    titre: 'Ce qu’il\nrenseigne',
    alineas: [
      ['Le nom', 'de son inventaire.'],
      ['Le ou les magasins', 'où l’inventaire aura lieu.'],
      ['Les zones', 'de comptage : il choisit s’il s’agit d’un inventaire avec ou sans zones de comptage identifiées.'],
    ],
    ecran: 'zones.png',
    legende: 'Les zones de comptage',
  })

  // ── 6. Les zones, côté site ───────────────────────────────────────────
  pageSite({
    entete: 'Créer un inventaire',
    titre: 'Les zones de comptage, depuis le tableau de bord',
    cap: capZones,
    legende: 'Compte de démonstration — inventaire « Rayon textile »',
  })

  // ── 7. Les balises ────────────────────────────────────────────────────
  await pageTel({
    entete: 'Les balises',
    titre: 'Un générateur\nde balises',
    alineas: [
      ['S’il n’a pas de balises en sa possession,', 'Quantinvo met à disposition un générateur de balises QR Code imprimable.'],
      ['Avant, ou bien avant.', 'Il a la possibilité de préparer ses balises juste avant un inventaire ou les préparer bien avant depuis sa boîte à outils.'],
    ],
    ecran: 'creer-balises.png',
    legende: 'Le générateur, depuis la boîte à outils',
  })

  // ── 8. La planche ─────────────────────────────────────────────────────
  {
    const s = pres.addSlide()
    d.entete(s, 'Les balises')
    d.titreLarge(s, 'La planche à imprimer', { y: 1.3, size: 24 })
    d.para(s, 'Quantinvo précise également la référence de papier à utiliser.', { x: M, y: 2.15, w: W - 2 * M, h: 0.5, size: 13 })
    const g = d.cadre(s, capPlanche, { x: M + 0.06, y: 2.95, w: W - 2 * M - 0.12 })
    d.legende(s, 'Avery L4732 — 35,6 × 16,9 mm, 80 stickers par planche', { x: M + 0.06, y: 2.95 + g.h + 0.2, w: W - 2 * M })
    d.pied(s, ++n, PIED)
  }

  // ── 9. Importer les données ───────────────────────────────────────────
  await pageTel({
    entete: 'Préparer l’inventaire',
    titre: 'Importer\nles données',
    alineas: [
      ['Le référencement des produits', 'est obligatoire afin de permettre à l’application d’identifier chaque article.'],
      ['Le stock théorique', '— stock attendu — est facultatif.'],
    ],
    ecran: 'importer.png',
    legende: 'L’import, depuis l’application',
  })

  // ── 10. Pourquoi le stock théorique ───────────────────────────────────
  pageSite({
    entete: 'Préparer l’inventaire',
    titre: 'Le stock théorique donne les écarts',
    texte: 'Nous recommandons tout de même de l’utiliser afin d’obtenir les écarts immédiatement avant de clôturer l’inventaire. Seul le superviseur de l’inventaire a accès aux écarts.',
    cap: capEcarts,
    legende: 'Les écarts, depuis le tableau de bord',
  })

  // ── 11. Les modèles de fichiers ───────────────────────────────────────
  pageSite({
    entete: 'Préparer l’inventaire',
    titre: 'Les modèles de fichiers',
    texte: 'Il est également possible de retrouver les modèles de fichiers dans la boîte à outils Quantinvo.',
    cap: capFichiers,
    legende: 'Les données d’inventaire, depuis le tableau de bord',
  })

  // ── 12. Constituer l'équipe ───────────────────────────────────────────
  await pageTel({
    entete: 'L’équipe d’inventaire',
    titre: 'Constituer\nson équipe',
    alineas: [
      ['Le répertoire.', 'Il peut sélectionner les compteurs de son magasin depuis le répertoire, qui se remplit au fur et à mesure que des profils sont créés.'],
      ['Compteur ou co-superviseur.', 'Idéal pour des inventaires de grandes tailles avec une équipe de compteurs importante.'],
    ],
    ecran: 'ajouter-membre.png',
    legende: 'Ajouter un membre, depuis l’application',
  })

  // ── 13. Les règles de l'équipe ────────────────────────────────────────
  {
    const s = pres.addSlide()
    d.entete(s, 'L’équipe d’inventaire')
    d.titre(s, 'Ce qu’il faut\nsavoir', { w: COL + 0.6 })
    const g = await telEntier(s, 'bienvenue-compteur.png', 'L’arrivée d’un compteur', { h: 4.8 })
    const w = g.x - M - 0.6
    alineasV(s, [
      ['Attention,', 'un compteur ne peut pas être choisi comme co-superviseur.'],
      ['Chaque personne ajoutée', 'à un inventaire reçoit instantanément un mail et une notification.'],
      ['Le partage.', 'Le superviseur de l’inventaire peut également partager les identifiants de l’inventaire directement depuis le flux qu’il aura choisi.'],
      ['À noter.', 'Une personne inconnue du magasin ne pourra pas participer à cet inventaire.'],
    ], { x: M, y: 2.5, w, h: BAS - 2.5 - 0.2, size: 12.5, gap: 13 })
    d.pied(s, ++n, PIED)
  }

  // ── 14. L'équipe, côté site ───────────────────────────────────────────
  pageSite({
    entete: 'L’équipe d’inventaire',
    titre: 'L’équipe, depuis le tableau de bord',
    cap: capEquipe,
    legende: 'Compte de démonstration — inventaire « Rayon textile »',
  })

  // ── 15. Rien ne bloque ────────────────────────────────────────────────
  await pageTel({
    entete: 'Préparer l’inventaire',
    titre: 'Aucune étape\nne bloque',
    alineas: [
      ['Aucune de ces étapes ne bloque la création de l’inventaire.', 'En effet, il est possible d’y retourner même après, depuis le menu dédié.'],
    ],
    ecran: 'fiche-inventaire.png',
    legende: 'La fiche d’un inventaire',
  })

  // ── 16. Les trois profils ─────────────────────────────────────────────
  {
    const s = pres.addSlide()
    d.entete(s, 'Les profils')
    d.titreLarge(s, 'Il existe trois profils par entreprise', { y: 1.3, size: 24 })
    const cols = [
      ['Administrateur', 'Gère la création de l’entreprise et des magasins, ainsi que la création des comptes Superviseur. Il a également la charge de gérer les profils de l’entreprise et des différents magasins. Il peut ajouter ou supprimer des comptes, promouvoir un Compteur en Superviseur et inversement. Il gère aussi l’abonnement Quantinvo de son entreprise.'],
      ['Superviseur', 'A la charge de créer et de suivre ses inventaires. Il constitue son équipe en créant le profil de ses compteurs.'],
      ['Compteur', 'Rejoint un inventaire sur invitation, il compte ou audite.'],
    ]
    const cw = (W - 2 * M - 2 * 0.5) / 3
    cols.forEach(([nom, texte], i) => {
      const x = M + i * (cw + 0.5)
      d.numero(s, i + 1, x, 2.4)
      s.addText(nom, {
        x, y: 3.06, w: cw, h: 0.45, fontFace: FONTD, fontSize: 17, bold: true, color: P.DEEP, margin: 0,
      })
      s.addText(texte, {
        x, y: 3.64, w: cw, h: 3.0, fontFace: FONT, fontSize: 13, color: P.INK2, margin: 0, lineSpacingMultiple: 1.25,
      })
    })
    d.pied(s, ++n, PIED)
  }

  // ── 17. Les deux surfaces, une dernière fois ──────────────────────────
  // ⚠️ LE TITRE N'ATTRIBUE RIEN À PERSONNE. Il disait « Le compteur rejoint,
  // compte, audite » au-dessus du rapport — or le texte de Julien précise que
  // seul le superviseur a accès aux écarts. Une page qui montre les deux
  // écrans côte à côte nomme les écrans, pas ceux qui les ouvrent.
  await pageDuo({
    entete: 'Quantinvo',
    titre: 'Le comptage et le rapport',
    // ⚠️ PAS `comptage.png` : au simulateur, le viseur du scanner est un
    // rectangle NOIR — il n'y a pas de caméra. Authentique, mais illisible
    // pour un client, qui y voit un défaut. La liste des balises comptées dit
    // la même chose et se lit.
    ecran: 'balises-comptees-detail.png',
    cap: capRapport,
    legendeTel: 'Les balises comptées',
    legendeSite: 'Le rapport',
  })

  // ── 18. La démonstration ──────────────────────────────────────────────
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Démonstration',
      texte: 'De l’application et du tableau de bord.',
      contact: 'quantinvo.com',
      bas: '2 octobre 2026 · 25 minutes',
    })
  }

  await ecrire(pres, 'Quantinvo-presentation')
}

main().catch((e) => { console.error(e); process.exit(1) })
