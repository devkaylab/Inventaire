// Deck « D'où l'on vient » — la ligne du temps de Quantinvo, du premier commit
// à aujourd'hui. Charte « Ardoise » v2, comme les six autres.
//
//   node build-histoire.js                 → Quantinvo-histoire.pptx
//   FONT_MODE=brand node build-histoire.js → Quantinvo-histoire-marque.pptx
//
// ⚠️ CE DECK NE SE VEND À PERSONNE. Demande de Julien, le 13 septembre 2026 :
// « un genre de timeline où on voit tout les changements que nous avons fait
// […] je veux garder ce souvenir ». C'est le seul des sept qui s'adresse à
// nous, et c'est ce qui autorise ce qu'aucun autre ne s'autorise — montrer un
// écran laid, nommer une fausse piste, dater un abandon.
//
// ⚠️ TOUT CE QU'IL MONTRE VIENT DE L'HISTORIQUE GIT, jamais d'une
// reconstitution. Les images vivent dans `histoire/`, extraites une fois par
// `git show <commit>:<chemin>` et réduites — le commit de chacune est en
// commentaire à côté de son nom, plus bas. Un écran « refait pour
// l'illustration » ferait de ce deck une histoire racontée au lieu d'une
// trace, et c'est précisément ce qu'il existe pour éviter.
//
// ⚠️ LES CHIFFRES SE REMESURENT, ils ne se recopient pas (voir `CHIFFRES`).

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, cadrer } = require('./charte')

// Mesurés le 13 septembre 2026. `git rev-list --count HEAD`,
// `ls supabase/migrations/*.sql | wc -l`, et les deux `npx vitest run`.
const CHIFFRES = {
  jours: 90,
  commits: 627,
  migrations: 175,
  edge: 19,
  testsSite: 1432,
  testsApp: 521,
  fichiersTest: 74,
}

// Les images de `histoire/`, avec le commit d'où chacune sort. Refaire une
// extraction : `git show <commit>:<chemin> > histoire/<nom>.png`.
//
//   icone-2026-06-15   47f83cc  assets/images/icon.png           (gabarit Expo)
//   icone-2026-06-19   8e627da  assets/images/icon.png           (le cube)
//   icone-2026-09-06   3cd9e3a  assets/images/icon.png           (la zone)
//   croquis-logo-…     « Logo d'application Inventaire-handoff.zip », 19 juin
//   app-2026-06-15-*   47f83cc  assets/help/…                    (le tutoriel retiré)
//   app-2026-09-02-*   95797e1~1 docs/…/captures-ios-69/…        (fiche d'avant Ardoise)
//   site-2026-09-01    web/screenshots/light-desktop-accueil.png (harnais e2e)
//   site-2026-09-13    tiré du site en ligne, Playwright, 1480 × 1000
//   og-2026-09-02      f318e97  web/public/og.png
//   og-2026-09-13      95797e1  web/public/og.png

// ⚠️ Espace insécable ORDINAIRE, jamais l'insécable étroite de `fr-FR` :
// à la taille d'un grand chiffre, l'étroite ne se voit pas — c'est le constat
// de Julien du 4 septembre 2026, et il vaut aussi sur une diapositive.
const nb = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')

const PIED = 'Quantinvo · d’où l’on vient'

async function main() {
  const d = await preparer({ titre: 'Quantinvo — d’où l’on vient' })
  const { pres } = d

  const BAS = H - 0.72
  const MARGE = 0.34

  /** Trois téléphones de front, chacun daté : c'est la figure du deck. */
  async function troisEtats(s, cartes, { y = 2.3 } = {}) {
    const gap = 0.3
    const cw = (W - 2 * M - gap * (cartes.length - 1)) / cartes.length
    const hCarte = BAS - (y + 0.42 + 0.68)
    for (const [i, c] of cartes.entries()) {
      const tel = await cadrer(c.fichier, { w: cw - 2 * MARGE, h: hCarte })
      d.ecran(s, {
        x: M + i * (cw + gap), y, w: cw, titre: c.titre, texte: c.texte,
        tel, fill: c.fill || P.MIST, marge: MARGE, bas: BAS,
      })
    }
  }

  /** Pastille de couleur et son code. Sert aux deux palettes. */
  function nuance(s, x, y, hex, nom, { w = 1.02, h = 1.02 } = {}) {
    s.addShape('roundRect', {
      x, y, w, h, rectRadius: 0.04,
      fill: { color: hex.replace('#', '') },
      line: { color: P.HAIR, width: 0.75 },
    })
    s.addText(nom, { x, y: y + h + 0.1, w, h: 0.24, fontFace: FONT, fontSize: 9, bold: true, color: P.INK, margin: 0 })
    s.addText(hex, { x, y: y + h + 0.32, w, h: 0.22, fontFace: FONT, fontSize: 8.5, color: P.SLATE, margin: 0 })
  }

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: '15 juin → 13 septembre 2026',
      titre: 'D’où l’on vient.',
      sousTitre:
        'Quatre-vingt-dix jours, trois marques, deux refontes d’identité. Tout ce que montre ce document a été retrouvé dans l’historique du dépôt : ce sont les écrans qui ont réellement existé, pas des reconstitutions.',
      bas: 'Devkaylab  ·  septembre 2026  ·  document interne',
    })
    s.addNotes('Ce deck ne se vend à personne. Il sert à garder la trace — et à se souvenir, dans six mois, de ce à quoi l’outil ressemblait au départ.')
  }

  // ════ 2. La ligne du temps ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Quatre-vingt-dix jours')
    d.titre(s, 'Six dates, et ce\nqu’elles ont changé.', { y: 1.4, h: 1.6 })
    d.para(s, [
      { text: 'Le reste — les 627 commits — tient entre ces six-là. ' },
      { text: 'Aucune de ces dates n’était prévue', options: { bold: true, color: P.INK } },
      { text: ' : chacune est née d’un constat, en regardant l’outil tourner.' },
    ], { x: M, y: 3.2, w: COL, h: 1.4, size: 12 })

    const jalons = [
      ['15 juin', 'Le premier commit', 'Une application Expo sortie du gabarit : thème clair, icône bleue, un écran « Sessions ».'],
      ['19 juin', 'La première marque', 'Le cube isométrique et son faisceau. Elle tiendra deux mois et demi.'],
      ['4 août', 'Le site', 'Next.js. La vitrine, la connexion, puis le tableau de bord du superviseur le 12.'],
      ['22 août', 'L’argent', 'Devis automatique, acceptation en ligne, Stripe. Le produit devient vendable.'],
      ['6 septembre', 'Ardoise et Registre', 'La refonte : gris minéraux, vert forêt, la marque devient un plan de magasin.'],
      ['13 septembre', 'Les boutiques', 'Les deux fiches déposées, build 4 chez Apple. L’outil attend l’immatriculation.'],
    ]
    let y = 1.42
    for (const [date, titre, texte] of jalons) {
      d.filet(s, RX, y - 0.1, RW)
      s.addText(date, { x: RX, y, w: 1.35, h: 0.3, fontFace: FONTD, fontSize: 11.5, bold: true, color: P.ACCENT, margin: 0 })
      s.addText(titre, { x: RX + 1.45, y, w: 2.1, h: 0.3, fontFace: FONTD, fontSize: 11.5, bold: true, color: P.INK, margin: 0 })
      s.addText(texte, { x: RX + 3.6, y: y - 0.03, w: RW - 3.6, h: 0.62, fontFace: FONT, fontSize: 10, color: P.INK2, margin: 0, lineSpacingMultiple: 1.12 })
      y += 0.88
    }
    d.pied(s, 2, PIED)
  }

  // ════ 3. Le premier jour ════
  {
    const s = pres.addSlide()
    d.entete(s, '15 juin 2026')
    // ⚠️ Le titre tient dans la colonne de GAUCHE, pas sur toute la largeur :
    // les trois téléphones commencent à 6,5 pouces, et un titre large leur
    // passait dessous.
    d.titre(s, 'Le premier jour,\nl’outil ressemblait\nà ça.', { y: 1.4, w: 5.4, h: 2.0 })
    d.para(s, 'Un gabarit Expo à peine habillé : le thème clair, du bleu partout, un bouton d’aide en haut à droite, et le mot « Session » là où on dit aujourd’hui « inventaire ». Le compte de test s’appelait Hermès.', {
      x: M, y: 3.5, w: 5.4, h: 1.5, size: 12,
    })
    d.encadre(s, 'Ce qui a disparu depuis', 'Le tutoriel intégré — ces captures en sont les pages — a été retiré en entier. Il décrivait déjà des écrans qui n’existaient plus.', {
      x: M, y: 5.0, w: 5.4, h: 1.25,
    })

    const gap = 0.28
    const cw = 2.0
    const ecrans = [
      ['app-2026-06-15-liste.png', 'Les inventaires'],
      ['app-2026-06-15-import.png', 'L’import'],
      ['app-2026-06-15-rapport.png', 'Le rapport'],
    ]
    for (const [i, [fichier, leg]] of ecrans.entries()) {
      const tel = await cadrer('histoire/' + fichier, { w: cw, h: 4.2 })
      const x = 6.5 + i * (cw + gap)
      s.addImage({ data: tel.data, x, y: 1.5, w: cw, h: cw / tel.ratio })
      s.addText(leg, { x, y: 1.5 + cw / tel.ratio + 0.12, w: cw, h: 0.3, fontFace: FONT, fontSize: 9.5, italic: true, color: P.SLATE, align: 'center', margin: 0 })
    }
    d.pied(s, 3, PIED)
    s.addNotes('Ces trois captures viennent du tutoriel du premier commit — c’est la seule trace qui reste de l’application de juin.')
  }

  // ════ 4. La marque, trois générations ════
  {
    const s = pres.addSlide()
    d.entete(s, 'La marque')
    d.titreLarge(s, 'Trois icônes, trois façons de dire ce qu’on fait.')

    const gens = [
      ['icone-2026-06-15.png', '15 juin', 'Le gabarit', 'L’icône d’Expo, jamais remplacée pendant quatre jours. Elle ne disait rien du produit — c’était son seul défaut, et il était complet.'],
      ['icone-2026-06-19.png', '19 juin', 'Le cube', 'Un volume en perspective traversé d’un faisceau : l’objet scanné, et le geste. Elle a tenu jusqu’au 6 septembre.'],
      ['icone-2026-09-06.png', '6 septembre', 'La zone', 'Un plan de magasin vu du dessus : le cadre, trois allées, et celle qu’on est en train de compter, pleine.'],
    ]
    const tw = 2.55, gap = 0.75
    const x0 = (W - (tw * 3 + gap * 2)) / 2
    for (const [i, [f, date, nom, texte]] of gens.entries()) {
      const x = x0 + i * (tw + gap)
      s.addImage({ path: __dirname + '/histoire/' + f, x, y: 2.35, w: tw, h: tw })
      s.addText(date, { x, y: tw + 2.5, w: tw, h: 0.3, fontFace: FONT, fontSize: 10, color: P.ACCENT, bold: true, margin: 0 })
      s.addText(nom, { x, y: tw + 2.78, w: tw, h: 0.34, fontFace: FONTD, fontSize: 14, bold: true, color: P.INK, margin: 0 })
      s.addText(texte, { x, y: tw + 3.14, w: tw, h: 1.2, fontFace: FONT, fontSize: 10, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
    }
    d.pied(s, 4, PIED)
  }

  // ════ 5. Les croquis ════
  {
    const s = pres.addSlide()
    d.entete(s, '19 juin 2026')
    d.titre(s, 'Le cube avait\nété dessiné.', { y: 1.4, h: 1.3 })
    d.alineas(s, [
      ['La planche de juin.', 'Elle sortait d’un outil de dessin, livrée en archive avec son projet et ses déclinaisons — l’icône, les tuiles, les tailles. C’est le seul croquis qui ait survécu : le reste des décisions visuelles s’est prise à l’écran, en regardant le produit tourner.'],
      ['Ce qu’elle montre.', 'Un volume violet, un faisceau cyan, et le mot-symbole en capitales espacées. Trois signes qu’on retrouvera partout — l’icône, le bandeau des e-mails, le filet sous les en-têtes du site — et qu’il faudra retirer un par un le 6 septembre.'],
      ['Pourquoi il est tombé.', 'Un cube en perspective dit « objet », pas « magasin ». Et le violet plus le cyan sur fond bleu nuit est la palette que produit une machine quand on ne lui demande rien de précis.'],
    ], { x: RX, y: 1.45, w: RW, h: 3.4, size: 11.5 })

    // La hauteur de l'image se DÉDUIT du ratio de la planche (320 × 194), et
    // la légende se pose en dessous : une position écrite en dur tombait
    // dessus.
    const iw5 = COL - 0.8, ih5 = iw5 * 194 / 320
    s.addShape('roundRect', { x: M - 0.06, y: 3.15, w: COL + 0.12, h: ih5 + 1.05, rectRadius: 0.04, fill: { color: P.MIST }, line: { color: P.MIST, width: 0 } })
    s.addImage({ path: __dirname + '/histoire/croquis-logo-2026-06-19.png', x: M + 0.4, y: 3.4, w: iw5, h: ih5 })
    d.legende(s, 'La planche livrée avec l’archive du logo', { x: M + 0.4, y: 3.4 + ih5 + 0.12, w: COL })
    d.pied(s, 5, PIED)
  }

  // ════ 6. La palette ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le thème')
    d.titreLarge(s, 'La palette a changé de famille, pas de ton.')
    d.para(s, 'À gauche le site du 4 août : bleu nuit, indigo, cyan. À droite Ardoise, depuis le 6 septembre : des gris minéraux et un vert forêt qui ne sert qu’à ce qui engage — un bouton, un chiffre, une alerte. Les deux sont sombres ; c’est le seul point commun.', {
      x: M, y: 2.2, w: W - 2 * M, h: 0.8, size: 12,
    })

    const av = [['#0B0F19', 'Fond'], ['#151A27', 'Surface'], ['#6366F1', 'Accent'], ['#38C9FF', 'Filet de scan'], ['#F3F5F9', 'Texte']]
    const ap = [['#141716', 'Fond'], ['#1B1F1E', 'Surface'], ['#5FA88A', 'Accent'], ['#8FC9B0', 'Accent clair'], ['#ECEFEC', 'Texte']]
    const bloc = (titre, sous, nuances, x) => {
      s.addText(titre, { x, y: 3.25, w: 5.4, h: 0.34, fontFace: FONTD, fontSize: 15, bold: true, color: P.INK, margin: 0 })
      s.addText(sous, { x, y: 3.6, w: 5.4, h: 0.3, fontFace: FONT, fontSize: 10, color: P.SLATE, margin: 0 })
      nuances.forEach(([hex, nom], i) => nuance(s, x + i * 1.12, 4.1, hex, nom))
    }
    bloc('Avant — 4 août', 'Sora + Inter', av, M)
    bloc('Ardoise — 6 septembre', 'Archivo + Public Sans', ap, W - M - 5.4)
    s.addShape('rect', { x: W / 2 - 0.006, y: 3.25, w: 0.012, h: 2.4, fill: { color: P.HAIR }, line: { color: P.HAIR, width: 0 } })
    d.pied(s, 6, PIED)
    s.addNotes('Le cyan n’a pas été remplacé : il a été supprimé. C’était le faisceau du cube, il n’avait plus d’objet une fois le cube parti.')
  }

  // ════ 7. L'application : la liste ════
  {
    const s = pres.addSlide()
    d.entete(s, 'L’application · l’accueil')
    d.titreLarge(s, 'Le même écran, à trois moments.')
    await troisEtats(s, [
      { fichier: 'histoire/app-2026-06-15-liste.png', titre: '15 juin — « Sessions »', texte: 'Thème clair, bouton bleu, un bouton d’aide. Le mot « session » vient de la base, pas du métier.' },
      { fichier: 'histoire/app-2026-09-02-liste.png', titre: '2 septembre — « Inventaires »', texte: 'Le vocabulaire a suivi le terrain. Le thème sombre est arrivé, l’indigo tient encore.' },
      { fichier: 'accueil-superviseur.png', titre: 'Aujourd’hui — Ardoise', texte: 'Gris minéraux, vert forêt, coins nets, plus une ombre sous les cartes.', fill: P.TINT },
    ])
    d.pied(s, 7, PIED)
  }

  // ════ 8. L'application : le rapport ════
  {
    const s = pres.addSlide()
    d.entete(s, 'L’application · le rapport')
    d.titreLarge(s, 'Le rapport a fini par ressembler à un document.')
    await troisEtats(s, [
      { fichier: 'histoire/app-2026-06-15-rapport.png', titre: '15 juin', texte: 'Une synthèse à zéro et un bouton d’export. Rien à lire tant que rien n’est compté.' },
      { fichier: 'histoire/app-2026-09-02-rapport.png', titre: '2 septembre', texte: 'Les chiffres sont là, dans des cartes arrondies — le même habillage que le reste de l’app.' },
      { fichier: 'rapport.png', titre: 'Aujourd’hui — Registre', texte: 'Filets d’encre, titre en serif, chiffres en chasse fixe : ce qui fait foi se lit autrement.', fill: P.TINT },
    ])
    d.pied(s, 8, PIED)
    s.addNotes('Registre n’habille que ce qui fait foi : le rapport, les écarts, le devis. Le reste de l’app reste en Ardoise — c’est la frontière, et une garde la tient.')
  }

  // ════ 9. L'application : les écarts ════
  {
    const s = pres.addSlide()
    d.entete(s, 'L’application · les écarts')
    d.titreLarge(s, 'L’arbitrage est passé d’un tableau à un geste.')
    await troisEtats(s, [
      { fichier: 'histoire/app-2026-06-15-ecarts.png', titre: '15 juin', texte: 'Trois compteurs à zéro et une explication de passes. On lisait la mécanique, pas le travail.' },
      { fichier: 'histoire/app-2026-09-02-ecarts.png', titre: '2 septembre', texte: 'Deux boutons tranchent en un appui — le compte du compteur, celui de l’auditeur.' },
      { fichier: 'audit.png', titre: 'Aujourd’hui', texte: 'Les deux couleurs de passe sont restées : elles disent qui a compté quoi.', fill: P.TINT },
    ])
    d.pied(s, 9, PIED)
  }

  // ════ 10. Le site ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le site')
    d.titreLarge(s, 'La vitrine a cessé de ressembler à toutes les autres.')
    d.para(s, 'À gauche le 1ᵉʳ septembre, à droite aujourd’hui. Ce qui est parti tient en quatre tics : la pastille de surtitre, le dégradé sur un demi-titre, les cubes flottants, et tout au centre. Ce qui les a remplacés est une photographie.', {
      x: M, y: 2.2, w: W - 2 * M, h: 0.7, size: 12,
    })
    // ⚠️ C'est la HAUTEUR disponible qui commande, pas la largeur : réglée sur
    // la largeur, la paire dépassait le bas de la diapositive et sa légende
    // se posait sur le pied de page.
    const ih = 3.3, iw = ih * 1480 / 1000
    const x10 = (W - (2 * iw + 0.4)) / 2, y10 = 2.95
    for (const [i, [f, leg]] of [
      ['site-2026-09-01-accueil.png', '1ᵉʳ septembre 2026'],
      ['site-2026-09-13-accueil.png', '13 septembre 2026'],
    ].entries()) {
      const x = x10 + i * (iw + 0.4)
      s.addShape('roundRect', { x: x - 0.05, y: y10 - 0.05, w: iw + 0.1, h: ih + 0.1, rectRadius: 0.04, fill: { color: P.PAPER }, line: { color: P.HAIR, width: 1 } })
      s.addImage({ path: __dirname + '/histoire/' + f, x, y: y10, w: iw, h: ih })
      d.legende(s, leg, { x, y: y10 + ih + 0.12, w: iw })
    }
    d.pied(s, 10, PIED)
  }

  // ════ 11. L'image de partage ════
  {
    const s = pres.addSlide()
    d.entete(s, 'L’image de partage')
    d.titreLarge(s, 'Celle qu’on oublie, et qui part partout.')
    d.para(s, [
      { text: 'Elle s’affiche chaque fois qu’un lien du site est collé dans un message, dans Slack ou sur LinkedIn. ' },
      { text: 'Elle est restée à l’ancienne identité dix jours', options: { bold: true, color: P.INK } },
      { text: ' après le reste du produit — parce qu’elle vit dans un dossier de documents, hors de ce que les tests balaient. Corrigée le 13 septembre, et une garde refuse désormais toute couleur de l’ancienne palette.' },
    ], { x: M, y: 2.2, w: W - 2 * M, h: 0.8, size: 12 })

    // Côte à côte, comme la page du site : empilées, la seconde sortait par
    // le bas de la diapositive.
    const iwOg = (W - 2 * M - 0.4) / 2, ihOg = iwOg * 630 / 1200
    for (const [i, [f, leg]] of [
      ['og-2026-09-02.png', '2 septembre — le cube, l’indigo, le filet cyan'],
      ['og-2026-09-13.png', '13 septembre — Ardoise'],
    ].entries()) {
      const x = M + i * (iwOg + 0.4)
      s.addShape('roundRect', { x: x - 0.05, y: 3.35 - 0.05, w: iwOg + 0.1, h: ihOg + 0.1, rectRadius: 0.04, fill: { color: P.PAPER }, line: { color: P.HAIR, width: 1 } })
      s.addImage({ path: __dirname + '/histoire/' + f, x, y: 3.35, w: iwOg, h: ihOg })
      d.legende(s, leg, { x, y: 3.35 + ihOg + 0.12, w: iwOg })
    }
    d.pied(s, 11, PIED)
  }

  // ════ 12. Ce que ça pèse ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Ce que ça pèse')
    d.titre(s, 'Quatre-vingt-dix\njours, en chiffres.', { y: 1.4, h: 1.6 })
    d.para(s, 'Ils ne disent pas si l’outil est bon — seulement ce qu’il a fallu de travail pour arriver là où il est. Ils se remesurent, ils ne se recopient pas.', {
      x: M, y: 3.2, w: COL, h: 1.2, size: 11.5,
    })

    const cases = [
      [String(CHIFFRES.commits), 'commits'],
      [String(CHIFFRES.migrations), 'migrations de base'],
      [String(CHIFFRES.edge), 'fonctions serveur'],
      [nb(CHIFFRES.testsSite + CHIFFRES.testsApp), 'tests de garde'],
      [String(CHIFFRES.fichiersTest), 'fichiers de test'],
      [String(CHIFFRES.jours), 'jours'],
    ]
    const cw = (RW - 0.3) / 3, ch = 1.55
    cases.forEach(([n, leg], i) => {
      const x = RX + (i % 3) * (cw + 0.15)
      const y = 1.5 + Math.floor(i / 3) * (ch + 0.25)
      s.addShape('roundRect', { x, y, w: cw, h: ch, rectRadius: 0.04, fill: { color: P.MIST }, line: { color: P.MIST, width: 0 } })
      s.addText(n, { x: x + 0.22, y: y + 0.2, w: cw - 0.44, h: 0.75, fontFace: FONTD, fontSize: 32, bold: true, color: P.ACCENT, margin: 0 })
      s.addText(leg, { x: x + 0.22, y: y + 0.98, w: cw - 0.44, h: 0.4, fontFace: FONT, fontSize: 10.5, color: P.SLATE, margin: 0 })
    })
    d.encadre(s, 'Les tests de garde', 'Ils ne vérifient pas que le produit marche : ils refusent qu’une décision déjà prise soit défaite sans qu’on s’en aperçoive.', {
      x: RX, y: 5.05, w: RW, h: 1.1,
    })
    d.pied(s, 12, PIED)
  }

  // ════ 13. Ce qui n'a pas changé ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Ce qui n’a pas bougé')
    d.titre(s, 'Trois décisions\nont tenu les\nquatre-vingt-dix\njours.', { y: 1.4, h: 2.3 })
    d.alineas(s, [
      ['Le téléphone qu’on a déjà.', 'Pas de douchette à louer, pas de terminal à déployer. C’était le pari du premier jour, et c’est resté la seule raison pour laquelle un magasin nous regarde.'],
      ['Un comptage ne s’efface pas.', 'La table des comptages n’a jamais accepté de modification : une correction est une ligne négative. Cette décision de juin a survécu à trois revues de sécurité, et c’est elle qui rend l’audit possible.'],
      ['On ne coupe jamais un comptage en cours.', 'Ni un dépassement de licence, ni un impayé, ni une expiration de session ne peuvent arrêter quelqu’un qui compte dans un rayon. Tout le reste s’est négocié ; cette règle, jamais.'],
    ], { x: RX, y: 1.45, w: RW, h: 3.4, size: 12 })
    d.encadre(s, 'Et une quatrième, plus tard', 'Ne jamais retoucher un livrable à la main : decks, visuels de boutique, documents. On modifie le script, on régénère. Ce document en est un.', {
      x: RX, y: 5.0, w: RW, h: 1.15,
    })
    d.pied(s, 13, PIED)
    s.addNotes('Trois décisions sur des centaines. C’est peu — et c’est normal : une décision qui tient trois mois sans être rediscutée est rare.')
  }

  // ════ 14. Finale ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Et ce n’est pas fini.',
      texte: 'Il reste l’immatriculation, la publication sur les deux boutiques, et le premier client. Ce document s’arrête au 13 septembre 2026 — il se régénère.',
      contact: 'node build-histoire.js',
      bas: 'Devkaylab  ·  document interne  ·  www.quantinvo.com',
    })
  }

  await ecrire(pres, 'Quantinvo-histoire')
}

main().catch((e) => { console.error(e); process.exit(1) })
