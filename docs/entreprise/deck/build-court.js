// Deck court Quantinvo — « pourquoi nous, et pas Zebra ». Charte « Papier ».
// node build-court.js                 → Quantinvo-essentiel.pptx
// FONT_MODE=brand node build-court.js → Quantinvo-essentiel-marque.pptx
//
// Dix pages, à présenter en vingt minutes. C'est le deck qu'on sort quand le
// prospect a déjà SmartCount, ou vient de le faire chiffrer.
//
// ⚠️ AUCUN PRIX ZEBRA, ici ni à l'oral, même en réponse à une question.
// L'ancre de marché (le tarif annuel de SmartCount) vient du métier de Julien,
// elle n'est pas publiée : elle sert à caler notre prix, elle ne se cite pas.
// La comparaison porte sur ce qui est public et vérifiable — le matériel, le
// mode de déploiement, la réconciliation, la taille de l'éditeur.
//
// ⚠️ La page « Pour être honnête » ne se retire pas. C'est elle qui rend le
// reste crédible face à quelqu'un qui connaît déjà le concurrent.

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer } = require('./charte')
const { GRILLE, grilleOffres, euros } = require('./blocs')

async function main() {
  const d = await preparer({ titre: 'Quantinvo — l’essentiel' })
  const { pres } = d
  const PIED = 'Quantinvo · l’essentiel'

  const capSuivi = await capture('light-desktop-suivi.png', { left: 104, top: 155, width: 1330, height: 505 })
  const capRapport = await capture('light-desktop-rapport.png', { left: 448, top: 160, width: 964, height: 660 })

  const BAS = H - 0.72
  const MARGE = 0.34
  async function troisEcrans(s, cartes, { y = 2.2 } = {}) {
    const gap = 0.3
    const cw = (W - 2 * M - gap * (cartes.length - 1)) / cartes.length
    const hCarte = BAS - (y + 0.42 + 0.68)
    for (const [i, c] of cartes.entries()) {
      const tel = await cadrer(c.fichier, { w: cw - 2 * MARGE, h: hCarte })
      d.ecran(s, { x: M + i * (cw + gap), y, w: cw, titre: c.titre, texte: c.texte, tel, fill: c.fill, marge: MARGE, bas: BAS })
    }
  }

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: "L'essentiel en dix pages",
      titre: 'Le même inventaire, sans la flotte de terminaux.',
      sousTitre: "Vos équipes comptent avec le téléphone qu'elles ont déjà. Vous suivez depuis le bureau. Le rapport sort croisé avec votre stock théorique. Rien d'autre à acheter.",
      bas: 'Devkaylab  ·  août 2026  ·  www.quantinvo.com',
    })
    s.addNotes("Vingt minutes, dix pages. Ce deck s'adresse à quelqu'un qui a déjà une solution d'inventaire, ou qui vient d'en faire chiffrer une. Ouvrir sur ce qui disparaît — la flotte — pas sur nos fonctionnalités.")
  }

  // ════ 2. La vraie question ════
  {
    const s = pres.addSlide()
    d.entete(s, 'La vraie question')
    d.titre(s, 'La licence n’est pas ce que vous payez.', { h: 1.6 })
    d.chiffre(s, '0', 'terminal à acheter, à louer, à charger, à configurer ou à remplacer.', { y: 3.6 })
    d.alineas(s, [
      ['Le matériel.', "Une flotte de terminaux durcis s'achète ou se loue, se recharge, se configure, se répare et se remplace. Sur trois ans, elle pèse souvent plus lourd que la licence qu'elle sert."],
      ['Les heures.', "Connecter et vérifier les terminaux un par un avant chaque session, briefer les compteurs sur leur maniement, rester posté sur la plateforme pendant le comptage : c'est un poste à temps partiel que personne ne budgète."],
      ['La réconciliation.', "Un rapport de variance à rapprocher à la main du stock théorique, après chaque inventaire. C'est long, et c'est là que les erreurs se glissent."],
      ['Le plafond invisible.', "Quand compter coûte du matériel et du temps de préparation, on compte moins souvent. Le stock dérive entre deux passages, et personne n'a décidé que ce serait ainsi."],
    ], { y: 1.5, h: 5.0, size: 13, gap: 13 })
    d.pied(s, 2, PIED)
    s.addNotes("Ne jamais citer un prix concurrent, même si le prospect en donne un : on parle de postes de coût, pas de montants. Si on nous donne un chiffre, on écoute et on n'y ajoute rien.")
  }

  // ════ 3. Ce que c'est ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Ce que c’est')
    d.titreLarge(s, 'Un outil d’inventaire complet, sur le téléphone qu’ils ont déjà', { y: 1.3, size: 25 })
    await troisEcrans(s, [
      { titre: 'On imprime les balises', texte: "Une planche d'étiquettes numérotées, en PDF, imprimée depuis l'outil. Aucun matériel à réserver.", fichier: 'creer-balises.png', fill: P.MIST },
      { titre: 'On scanne la zone, puis les articles', texte: "La caméra du téléphone lit les codes-barres. Une douchette Bluetooth s'y branche pour les gros volumes.", fichier: 'comptage.png', fill: P.TINT },
      { titre: 'On audite et on tranche', texte: "Un second passage sur les zones qui le méritent. L'écart s'affiche, le superviseur décide au rayon.", fichier: 'audit.png', fill: P.MIST },
    ], { y: 2.05 })
    d.pied(s, 3, PIED)
    s.addNotes("De vraies captures, prises sur un compte d'essai. Ne pas les commenter une par une : dire « c'est tout », et laisser regarder.")
  }

  // ════ 4. Face à face ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Face à face')
    d.titreLarge(s, 'Ce qui change, poste par poste')
    const x1 = M, x2 = M + 5.6, wc = 5.3
    let y = 2.28
    s.addText('Une solution à terminaux dédiés', { x: x1, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.SLATE, margin: 0 })
    s.addText('Quantinvo', { x: x2, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.DEEP, margin: 0 })
    y += 0.38
    d.filet(s, M, y, W - 2 * M)
    const rows = [
      ['Une flotte à acheter ou louer, charger, configurer, réparer.', 'Les téléphones de vos équipes. Déjà là, déjà payés.'],
      ['Des terminaux à connecter et vérifier un par un avant chaque session.', 'Chacun rejoint l’inventaire depuis son téléphone, en quelques secondes.'],
      ['Un briefing sur le maniement du matériel à chaque inventaire.', 'Le geste qu’ils connaissent déjà : ouvrir, scanner, scanner.'],
      ['Un rapport de variance, à consolider ensuite avec le stock théorique.', 'Le croisement est déjà fait : l’attendu, le compté, le non-compté, l’écart en valeur.'],
      ['Un prix sur devis, renégocié chaque année.', 'Un prix affiché, le même pour tout le monde, souscrit en ligne.'],
      ['Un module au catalogue d’un géant du matériel.', 'Un outil qui ne fait qu’une chose, et son auteur répond lui-même.'],
    ]
    for (const [a, b] of rows) {
      y += 0.1
      s.addText(a, { x: x1, y, w: wc, h: 0.56, fontFace: FONT, fontSize: 11.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.13 })
      s.addText(b, { x: x2, y, w: wc, h: 0.56, fontFace: FONT, fontSize: 11.5, color: P.INK, margin: 0, lineSpacingMultiple: 1.13 })
      y += 0.58
      d.filet(s, M, y, W - 2 * M)
    }
    d.pied(s, 4, PIED)
    s.addNotes("Lire trois lignes, pas les six. La quatrième — la réconciliation — est celle qui parle le plus à quelqu'un qui fait le travail lui-même.")
  }

  // ════ 5. Le pilotage ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pendant le comptage')
    d.titreLarge(s, 'Personne n’est posté devant un écran pour surveiller.')
    d.para(s, "L'avancement zone par zone, les appareils en comptage et en audit, les derniers scans : le superviseur ouvre la page quand il veut, depuis le bureau ou depuis le rayon. Ce qu'on ne voit pas, et c'est voulu : qui fait quoi. Le suivi est agrégé — on pilote le travail, pas les personnes.", { x: M, y: 2.25, w: W - 2 * M, h: 0.8, size: 12.5 })
    const cw = 3.3 * capSuivi.ratio, cx = (W - cw) / 2
    const g = d.cadre(s, capSuivi, { x: cx, y: 3.1, w: cw })
    d.legende(s, 'Onglet Suivi, données d’essai.', { x: cx, y: 3.1 + g.h + 0.14, w: RW })
    d.pied(s, 5, PIED)
    s.addNotes("L'argument du suivi agrégé parle aux RH et au CSE. Le placer ici évite qu'il revienne en objection à la fin.")
  }

  // ════ 6. Le rapport ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Après le comptage')
    d.titre(s, 'Le rapport arrive déjà croisé avec votre stock théorique.', { size: 23, h: 2.0 })
    d.alineas(s, [
      [null, "Il part de l'attendu, pas seulement de ce qui a été scanné : un article attendu et jamais trouvé y figure, avec son manque. C'est la démarque que l'inventaire est censé révéler."],
      [null, "Export Excel en un clic, prêt pour la correction du stock. Il ne reste que la validation et l'ajustement."],
    ], { x: M, y: 3.6, w: COL, h: 2.6, size: 12.5, gap: 12 })
    const g = d.cadre(s, capRapport, { x: RX, y: 1.5, w: RW, h: 4.9 })
    d.legende(s, 'Onglet Rapport, données d’essai.', { x: RX, y: 1.5 + g.h + 0.14, w: RW })
    d.pied(s, 6, PIED)
    s.addNotes("La consolidation manuelle est le poste le plus détesté du métier, et le plus invisible dans un devis. C'est notre meilleur argument devant quelqu'un qui la fait lui-même.")
  }

  // ════ 7. Le prix ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le prix')
    d.titreLarge(s, 'Affiché, par magasin, sans déclaration de stock', { y: 1.3, size: 25 })
    d.para(s, "Le prix suit le nombre d'appareils qui comptent en même temps — la seule chose que vous puissiez vérifier vous-même. Ni le volume de votre stock, ni le nombre de comptes, ni le nombre d'inventaires dans l'année.", { x: M, y: 1.95, w: W - 2 * M, h: 0.5, size: 11.5, color: P.SLATE })
    grilleOffres(d, s, { x: M, y: 2.55, w: W - 2 * M, h: 3.0, rythme: 'mois', points: false })
    d.encadre(s, 'Ce qui n’est pas dans ce prix, parce que ça n’existe pas', "Aucun terminal, aucune installation, aucun serveur, aucun coût de mise en service. Vous souscrivez en ligne et vous comptez le jour même.", { x: M, y: 5.75, w: W - 2 * M, h: 0.95 })
    d.pied(s, 7, PIED)
    s.addNotes(`Annoncer le mensuel. L'annuel économise ${euros(300)} sur Advanced. Et surtout : comparer au budget d'inventaire complet — prestataire, matériel, heures — jamais à un abonnement logiciel.`)
  }

  // ════ 8. Pour être honnête ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pour être honnête')
    d.titre(s, 'Ce qu’un terminal durci fait mieux qu’un téléphone.')
    d.para(s, "Si on ne le dit pas nous-mêmes, quelqu'un le dira à notre place — et moins bien.", { x: M, y: 3.9, w: COL, h: 0.9, size: 12.5, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['Il encaisse les chocs.', "Une chute de deux mètres sur un sol de réserve, un écran gelé à −20 °C : un terminal durci est fait pour ça, un téléphone non. Dans une chambre froide ou sur un quai, l'argument est réel."],
      ['La batterie tient la journée entière.', "Un comptage de huit heures caméra allumée vide un téléphone. On compte par sessions, ou on prévoit des batteries externes — ce n'est pas gratuit, c'est juste beaucoup moins cher qu'une flotte."],
      ['Une flotte déjà amortie ne coûte plus rien.', "Si vos terminaux sont payés et fonctionnent, l'économie de matériel ne joue pas. Les autres arguments restent : la prise en main sans briefing, les comptages illimités, la réconciliation qui disparaît."],
    ], { y: 1.5, h: 4.4, size: 13, gap: 14 })
    d.encadre(s, 'Ce qui ne bouge pas', "Un outil expert suppose un service expert pour le servir. C'est ce qui empêche de confier l'inventaire aux équipes de vente — et c'est précisément ce que nous rendons possible.", { x: RX, y: 5.6, w: RW, h: 1.1, fill: P.TINT })
    d.pied(s, 8, PIED)
    s.addNotes("Page décisive devant quelqu'un qui connaît déjà le concurrent. Dire les trois limites franchement fait gagner plus de crédit que n'importe quel argument de vente.")
  }

  // ════ 9. Ce qu'on ne promet pas ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pour être clair')
    d.titre(s, 'Ce qu’on ne vous promet pas.')
    d.para(s, 'Autant le dire avant la démonstration qu’après.', { x: M, y: 3.6, w: COL, h: 0.6, size: 12.5, italic: true, color: P.SLATE })
    d.alineas(s, [
      ["L'inventaire fiscal certifié.", "Si votre commissaire aux comptes exige un comptage par un tiers, ce comptage reste. Quantinvo fait tout le reste de l'année, et il le prépare."],
      ['Une connexion à votre ERP.', "Pas encore. Quantinvo importe vos fichiers et rend un Excel. C'est ce qui permet de démarrer en une journée, sans projet informatique."],
      ['Android sur les boutiques.', "L'application tourne sur Android, et elle est disponible sur iPhone. La mise en ligne sur Google Play est en cours ; d'ici là, l'installation passe par votre catalogue d'entreprise."],
      ['La connexion par votre annuaire.', "Les comptes sont nominatifs, créés par invitation. Pas de SAML ni d'Entra ID pour l'instant ; dites-nous si c'est une exigence."],
    ], { y: 1.5, h: 4.8, size: 13, gap: 13 })
    d.pied(s, 9, PIED)
    s.addNotes("Ne pas sauter cette page pour gagner deux minutes : un prospect qui découvre une limite après coup perd confiance, un prospect averti la comprend.")
  }

  // ════ 10. Pour finir ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Un rayon, un mardi matin.',
      texte: "Venez avec votre stock théorique : vous l'importez, deux personnes de votre équipe balisent un rayon et le comptent, et vous repartez avec le rapport. Trente minutes, sur vos données, sans rien installer.",
      contact: 'contact@quantinvo.com   ·   www.quantinvo.com',
      bas: 'Quantinvo, par Devkaylab. L’outil d’inventaire pour le commerce.',
    })
    s.addNotes("Clore sur un essai que le prospect peut accepter sans engager personne. Ce n'est pas nous qui comptons pendant la démonstration : ce sont ses équipes. S'ils y arrivent, la démonstration est faite.")
  }

  await ecrire(pres, 'Quantinvo-essentiel')
}

main().catch((e) => { console.error(e); process.exit(1) })
