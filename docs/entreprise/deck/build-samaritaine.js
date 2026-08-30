// Deck Quantinvo pour La Samaritaine — fond blanc, charte « Papier » v1.1.
// node build-samaritaine.js                 → Quantinvo-Samaritaine.pptx        (Arial)
// FONT_MODE=brand node build-samaritaine.js → Quantinvo-Samaritaine-marque.pptx (Sora/Inter)
//
// Le fil du deck suit le document « Déroulement inventaire tournant » remis
// par La Samaritaine : chaque étape citée sur la page « Aujourd'hui » vient
// de ce document, pas de notre imagination. L'angle de vente, précisé par
// Julien : l'inventaire est RENDU aux équipes de vente — balisage compris —
// avec les chefs d'équipe en superviseurs et les vendeurs en compteurs.
// L'Inventory Control ne garde que le rapport, la validation et l'ajustement.

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer } = require('./charte')
const { GRILLE, grilleOffres, euros } = require('./blocs')

async function main() {
  const d = await preparer({ titre: 'Quantinvo — proposition pour La Samaritaine' })
  const { pres } = d
  const PIED = 'Quantinvo · proposition pour La Samaritaine'

  // Captures du tableau de bord (données d'essai), mêmes recadrages que le
  // deck commercial : hors en-tête et hors nom du magasin d'essai.
  const capSuivi = await capture('light-desktop-suivi.png', { left: 104, top: 155, width: 1330, height: 505 })
  const capEcarts = await capture('light-desktop-ecarts.png', { left: 448, top: 375, width: 964, height: 370 })
  const capRapport = await capture('light-desktop-rapport.png', { left: 448, top: 160, width: 964, height: 660 })

  // Captures de l'application (celles du guide de prise en main), dans un
  // téléphone dessiné. Même mécanique que build-prise-en-main.js : le
  // recadrage se calcule sur la place réellement disponible.
  const F = {
    balises: 'creer-balises.png',
    comptage: 'comptage.png',
    audit: 'audit.png',
  }
  const BAS = H - 0.72
  const MARGE = 0.34

  /** Trois écrans expliqués côte à côte (repris du guide de prise en main). */
  async function troisEcrans(s, cartes, { y = 2.2 } = {}) {
    const gap = 0.3
    const cw = (W - 2 * M - gap * (cartes.length - 1)) / cartes.length
    const hCarte = BAS - (y + 0.42 + 0.68)
    for (const [i, c] of cartes.entries()) {
      const tel = await cadrer(F[c.ecran], { w: cw - 2 * MARGE, h: hCarte })
      d.ecran(s, { x: M + i * (cw + gap), y, w: cw, titre: c.titre, texte: c.texte, tel, fill: c.fill, marge: MARGE, bas: BAS })
    }
  }

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Proposition pour La Samaritaine',
      titre: "L'inventaire tournant, rendu aux équipes de vente.",
      sousTitre: "Le balisage, le comptage et la conduite de chaque inventaire passent au floor : les chefs d'équipe supervisent, les vendeurs comptent. L'Inventory Control reçoit le rapport, valide et ajuste.",
      bas: 'Devkaylab  ·  août 2026  ·  www.quantinvo.com',
    })
    s.addNotes("Ouvrir sur l'idée, pas sur le produit : l'inventaire cesse d'être une opération de l'Inventory Control pour devenir un geste des équipes de vente. Le deck suit leur propre document de déroulement.")
  }

  // ════ 2. Aujourd'hui : leur journée, d'après leur document ════
  {
    const s = pres.addSlide()
    d.entete(s, "Aujourd'hui")
    d.titre(s, "Votre journée d'inventaire, telle qu'elle se déroule.", { h: 1.7 })
    d.para(s, "Reprise de votre déroulement d'inventaire tournant, étape par étape. Chaque ligne est tirée de votre document — et chaque ligne est portée par l'Inventory Control.", { x: M, y: 3.2, w: COL, h: 1.2, size: 12, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['La veille.', "Balisage des zones à inventorier, stickers posés avec une personne du floor ou du relay."],
      ['Le matin.', "Télécharger le stock théorique du jour, ouvrir la session SmartCount, connecter les terminaux Zebra un par un — en vérifiant la date et la localisation de chacun (101 floor / BOH, 902 relay). Puis briefer les compteurs sur le maniement des terminaux et la procédure."],
      ['Pendant.', "Déclencher l'audit des zones comptées — 100 % pour la W&J, 30 % au moins ailleurs —, guetter les failed audits sur SmartCount, faire recompter les zones en désaccord."],
      ['Après.', "Extraire le rapport SKU Variance, le consolider à la main avec le stock théorique, faire valider les résultats selon la valeur de l'écart (Inventory Control, PSM ou AGM), puis ajuster le stock."],
    ], { y: 1.5, h: 5.2, size: 12.5, gap: 13 })
    d.pied(s, 2, PIED)
    s.addNotes("Ne rien commenter : lire, et laisser la page faire son effet. C'est leur document, ils s'y reconnaissent. La question qui vient toute seule : pourquoi tout cela passe-t-il par l'Inventory Control ?")
  }

  // ════ 3. Le constat, et l'idée ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le constat')
    d.titre(s, 'Le comptage est fait par les équipes. Tout le reste est fait par vous.', { h: 2.0 })
    d.chiffre(s, '4', "casquettes portées par l'Inventory Control à chaque inventaire : préparer, surveiller, réconcilier, corriger.", { y: 3.7 })
    d.alineas(s, [
      ['La préparation.', "Le balisage, le stock du jour, la session, les terminaux, le briefing : la moitié de chaque inventaire ne compte aucun article."],
      ['La surveillance.', "Pendant tout le comptage, quelqu'un reste posté sur la plateforme pour suivre les audits et guetter les failed audits. Ce quelqu'un, c'est vous."],
      ['La réconciliation.', "Deux fichiers à rapprocher à la main après chaque inventaire — le stock théorique et le SKU Variance. C'est long, et c'est là que les erreurs se glissent."],
      ['La correction.', "L'ajustement du stock, après validation. Avec le programme des inventaires, la seule chose qui doive vraiment rester entre vos mains."],
    ], { y: 1.5, h: 4.6, size: 13, gap: 13 })
    d.encadre(s, "L'idée de cette proposition", "Rendre l'inventaire aux équipes de vente, du balisage au dernier scan : le chef d'équipe supervise, ses vendeurs comptent. L'Inventory Control fixe les règles, reçoit le rapport, valide et ajuste — il ne conduit plus rien.", { x: RX, y: 5.7, w: RW, h: 1.2 })
    d.pied(s, 3, PIED)
    s.addNotes("Le pivot du deck est dans l'encadré : on ne propose pas d'alléger la charge de l'Inventory Control, on propose de la transférer au floor. Chaque responsable maîtrise son stock — c'est l'objectif écrit dans leur propre projet d'inventaire aléatoire.")
  }

  // ════ 4. Qu'est-ce que Quantinvo ════
  {
    const s = pres.addSlide()
    d.entete(s, "Qu'est-ce que Quantinvo")
    d.citation(s, "J'ai dessiné Quantinvo pendant des inventaires, pas dans une salle de réunion.", { y: 1.5, h: 2.4, size: 22 })
    d.para(s, 'Julien Thiong-kay, Devkaylab', { x: M, y: 3.45, w: COL, h: 0.4, size: 12, color: P.SLATE })
    d.alineas(s, [
      [null, "Quantinvo est un outil d'inventaire complet : une application sur l'iPhone des compteurs, un tableau de bord web pour celui qui pilote, un rapport à la fin. Rien d'autre à installer, rien à acheter."],
      ['Né du terrain.', "Je fais du contrôle des stocks en magasin. La balise qu'on ne retrouve pas, la réserve sans réseau, la consolidation qui prend l'après-midi : Quantinvo est la réponse à ces irritants, et rien de plus."],
      ["Assez simple pour le floor.", "Prise en main en dix minutes, sans briefing matériel : c'est ce qui permet de confier l'inventaire aux équipes de vente plutôt qu'à un service spécialisé."],
      ["Pensé pour l'inventaire tournant.", "Des comptages toute l'année — un rayon, une marque, une liste d'articles — plutôt qu'une nuit par an. C'est le cœur de l'outil, pas une option."],
    ], { y: 1.5, h: 5.0, size: 13, gap: 13 })
    d.pied(s, 4, PIED)
    s.addNotes("Dire d'où on parle : le rayon, la réserve, la nuit d'inventaire. La simplicité n'est pas un confort, c'est la condition du transfert au floor — un outil qui demande un expert recrée l'Inventory Control.")
  }

  // ════ 5. Qui fait quoi — les écrans ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Qui fait quoi')
    d.titreLarge(s, "L'inventaire appartient au floor. Voici leurs écrans.", { y: 1.35, size: 24 })
    await troisEcrans(s, [
      { ecran: 'balises', titre: "Le chef d'équipe prépare", texte: "Il imprime ses balises depuis l'outil et les pose avec son équipe. Aucun matériel à réserver.", fill: P.MIST },
      { ecran: 'comptage', titre: 'Les vendeurs comptent', texte: "Scanner la balise du rayon, puis les articles, avec le téléphone qu'ils ont en poche.", fill: P.TINT },
      { ecran: 'audit', titre: "Le chef d'équipe tranche", texte: "Il audite selon votre règle et règle les désaccords au rayon, pendant que ça compte.", fill: P.MIST },
    ], { y: 2.15 })
    d.pied(s, 5, PIED)
    s.addNotes("Les écrans sont de vraies captures de l'application, celles du guide de prise en main. Et l'Inventory Control ? Il n'a pas d'écran sur cette page — c'est le message. Le sien arrive plus loin : le rapport.")
  }

  // ════ 6. La même journée, conduite par le floor ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Avec Quantinvo')
    d.titre(s, 'La même journée, conduite par le floor.', { h: 1.4 })
    d.para(s, "Le déroulement ne change pas. Ce qui change, c'est qui le porte : vous n'apparaissez qu'à la dernière ligne.", { x: M, y: 2.9, w: COL, h: 1.0, size: 12, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['La veille.', "Le chef d'équipe imprime ses balises — une planche d'étiquettes numérotées, en PDF — et les pose avec son équipe. Personne d'autre à mobiliser."],
      ['Le matin.', "Il importe le stock théorique tel quel, colonnes reconnues, et ouvre l'inventaire. Pas de flotte à préparer : chaque vendeur le rejoint depuis son téléphone."],
      ['Pendant.', "Les vendeurs comptent, zone par zone. Le chef d'équipe suit l'avancement, audite selon votre règle — 100 % W&J, 30 % au moins ailleurs — et tranche les désaccords au rayon, en direct."],
      ['Après.', "Le rapport croise déjà l'attendu et le compté. L'Inventory Control le reçoit, le fait valider selon la valeur de l'écart, et ajuste le stock. C'est sa première apparition de la journée."],
    ], { y: 1.5, h: 5.2, size: 12.5, gap: 13 })
    d.pied(s, 6, PIED)
    s.addNotes("Page miroir de la page 2, même structure veille / matin / pendant / après — mais le sujet des phrases a changé : c'est le chef d'équipe qui agit. Insister sur la dernière ligne.")
  }

  // ════ 7. Sans / avec ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Sans, avec')
    d.titreLarge(s, "Ce qui change de mains")
    const x1 = M, x2 = M + 5.6, wc = 5.3
    let y = 2.45
    s.addText('Sans Quantinvo', { x: x1, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.SLATE, margin: 0 })
    s.addText('Avec Quantinvo', { x: x2, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.DEEP, margin: 0 })
    y += 0.4
    d.filet(s, M, y, W - 2 * M)
    const rows = [
      ['Le balisage la veille, par l’Inventory Control avec une personne du floor.', 'Le chef d’équipe imprime ses balises et les pose avec son équipe.'],
      ['Des terminaux à connecter et vérifier un par un avant chaque session.', 'Aucune flotte : chaque vendeur rejoint l’inventaire depuis son téléphone.'],
      ['Un briefing sur le maniement des terminaux à chaque inventaire.', 'Le geste qu’ils connaissent : scanner la balise, scanner les articles.'],
      ['Quelqu’un posté sur la plateforme pour guetter les failed audits.', 'Le chef d’équipe voit tout et tranche les écarts au rayon.'],
      ['Le SKU Variance à consolider, l’Inventory Control présent du début à la fin.', 'Un rapport déjà croisé avec le théorique. Vous validez, vous ajustez.'],
    ]
    for (const [a, b] of rows) {
      y += 0.16
      s.addText(a, { x: x1, y, w: wc, h: 0.6, fontFace: FONT, fontSize: 12.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
      s.addText(b, { x: x2, y, w: wc, h: 0.6, fontFace: FONT, fontSize: 12.5, color: P.INK, margin: 0, lineSpacingMultiple: 1.15 })
      y += 0.66
      d.filet(s, M, y, W - 2 * M)
    }
    d.pied(s, 7, PIED)
    s.addNotes("Lire deux ou trois lignes, pas les cinq. Chaque ligne de gauche est portée par l'Inventory Control ; chaque ligne de droite par le floor — sauf la dernière, la seule qui vous reste.")
  }

  // ════ 8. La surveillance devient un tableau de bord ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pendant le comptage')
    d.titreLarge(s, 'Chacun suit son inventaire. Vous gardez la vue d’ensemble.')
    d.para(s, "Le chef d'équipe suit son rayon en direct : l'avancement zone par zone, les appareils en comptage et en audit, les derniers scans. L'Inventory Control, s'il le souhaite, ouvre la même vue sur n'importe quel inventaire en cours — sans en conduire aucun. Le suivi est agrégé : on pilote le travail, pas les personnes.", { x: M, y: 2.3, w: W - 2 * M, h: 0.8, size: 12.5 })
    const cw = 3.35 * capSuivi.ratio, cx = (W - cw) / 2
    const g = d.cadre(s, capSuivi, { x: cx, y: 3.15, w: cw })
    d.legende(s, "Onglet Suivi, données d'essai.", { x: cx, y: 3.15 + g.h + 0.15, w: RW })
    d.pied(s, 8, PIED)
    s.addNotes("Le poste de surveillance n'est pas supprimé, il est distribué : chaque chef d'équipe voit son inventaire, et vous voyez tout sans rien opérer. Le suivi agrégé (personne n'est suivi nominativement en direct) parle aux RH et au CSE d'une maison de cette taille.")
  }

  // ════ 9. L'audit garde vos règles ════
  {
    const s = pres.addSlide()
    d.entete(s, "L'audit")
    d.titreLarge(s, 'Vous fixez la règle d’audit. Le floor l’applique.')
    d.para(s, "100 % de la W&J, 30 % au moins ailleurs : la règle reste la vôtre — le chef d'équipe l'exécute. Un failed audit ne s'attend plus dans un rapport : les deux comptages s'affichent côte à côte, l'écart en pièces et en valeur d'achat, et il se tranche pendant que le compteur est encore au rayon.", { x: M, y: 2.3, w: W - 2 * M, h: 0.8, size: 12.5 })
    const g = d.cadre(s, capEcarts, { x: M + 1.6, y: 3.2, w: W - 2 * M - 3.2 })
    d.legende(s, "Onglet Écarts d'audit, données d'essai.", { x: M + 1.6, y: 3.2 + g.h + 0.15, w: RW })
    d.pied(s, 9, PIED)
    s.addNotes("Le recomptage ne disparaît pas : il se décide à chaud, par le chef d'équipe, au lieu d'être découvert par l'Inventory Control en surveillant la plateforme.")
  }

  // ════ 10. Ce qui vous arrive : le rapport ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Après le comptage')
    d.titre(s, 'Ce qui vous arrive : un rapport déjà consolidé.', { size: 24 })
    d.para(s, "Le rapport part du stock théorique, pas seulement de ce qui a été scanné. Un article attendu et jamais trouvé y figure, avec son manque : la démarque que l'inventaire est censé révéler est déjà dans le fichier.", { x: M, y: 3.3, w: COL, h: 1.6, size: 12.5 })
    d.para(s, "Export Excel en un clic. Il ne reste que la validation et l'ajustement — les deux gestes qui doivent rester chez vous.", { x: M, y: 4.9, w: COL, h: 1.0, size: 12.5 })
    const g = d.cadre(s, capRapport, { x: RX, y: 1.5, w: RW, h: 5.0 })
    d.legende(s, "Onglet Rapport, données d'essai.", { x: RX, y: 1.5 + g.h + 0.15, w: RW })
    d.pied(s, 10, PIED)
    s.addNotes("C'est la page de l'Inventory Control : son travail commence ici, sur un fichier déjà croisé avec le théorique. La validation PSM / AGM garde le même circuit qu'aujourd'hui, sur un fichier mieux rangé.")
  }

  // ════ 11. L'inventaire aléatoire ════
  {
    const s = pres.addSlide()
    d.entete(s, "L'inventaire aléatoire")
    d.titre(s, 'Votre projet d’inventaire aléatoire, prêt à fonctionner.', { h: 1.9 })
    d.para(s, "Vous en avez posé les objectifs : identifier les vols, tester la rigueur des procédures, garantir que chaque responsable maîtrise son stock. Confier le comptage au floor, c'est exactement cela.", { x: M, y: 3.4, w: COL, h: 1.7, size: 12, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['La sélection.', "Elle reste chez vous : variances négatives répétées, articles sensibles, slow movers. Les rapports des inventaires précédents donnent les chiffres d'où cette sélection se tire."],
      ['Le déclenchement.', "Un inventaire ciblé se crée en quelques minutes — une marque, un rayon, une liste d'articles — le jour même s'il le faut. Les équipes concernées sont invitées depuis l'outil."],
      ['Le comptage.', "Les équipes de vente comptent avec le téléphone qu'elles ont en poche. Pas de matériel à sortir, pas de session à monter : c'est ce qui rend l'aléatoire réellement aléatoire."],
      ['Le contrôle.', "L'écart se lit en direct. S'il dépasse votre seuil, l'Inventory Control reprend la main, et le rapport nourrit l'enquête."],
    ], { y: 1.5, h: 5.2, size: 12.5, gap: 13 })
    d.pied(s, 11, PIED)
    s.addNotes("Leur document dit « en cours d'élaboration » : la page montre que l'outil le rend possible sans rien construire. La répartition est la même que pour le tournant : vous choisissez quoi et quand, le floor compte, vous contrôlez l'écart.")
  }

  // ════ 12. Pourquoi Quantinvo et pas Zebra ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pourquoi pas Zebra')
    d.titreLarge(s, 'Pourquoi Quantinvo, et pas Zebra ?')
    const cw = (W - 2 * M - 0.6) / 2
    d.alineas(s, [
      ['Le matériel.', "SmartCount repose sur une flotte de terminaux dédiés : à charger, configurer, vérifier avant chaque session — un métier en soi, celui qu'on cherche justement à ne plus faire. Quantinvo tourne sur les iPhone que vos équipes ont déjà, et une douchette Bluetooth s'y branche pour les gros volumes."],
      ['Le coût.', "Une licence par magasin, sans un euro de matériel : ni terminal à acheter, ni flotte à entretenir, ni remplacement à budgéter. Les inventaires sont illimités — compter chaque semaine coûte le même prix que compter une fois par an."],
    ], { x: M, y: 2.5, w: cw, h: 3.2, size: 12.5, gap: 12 })
    d.alineas(s, [
      ['La réconciliation.', "SmartCount rend un rapport de variance, à consolider ensuite avec le stock théorique. Quantinvo rend ce croisement déjà fait : l'attendu, le compté, le non-compté, l'écart en valeur."],
      ["La taille de l'éditeur.", "SmartCount est un module au catalogue d'un géant du matériel. Quantinvo ne fait qu'une chose — l'inventaire — et la personne qui l'a dessiné répond elle-même à vos questions."],
    ], { x: M + cw + 0.6, y: 2.5, w: cw, h: 3.2, size: 12.5, gap: 12 })
    d.encadre(s, 'Pour être honnête', "Un terminal durci encaisse mieux les chocs qu'un téléphone, et si votre flotte est déjà amortie, l'argument du matériel pèse moins. Les nôtres ne bougent pas : un outil que le floor prend en main sans briefing, des comptages illimités toute l'année, et une réconciliation qui n'existe plus.", { x: M, y: 5.7, w: W - 2 * M, h: 1.2 })
    d.pied(s, 12, PIED)
    s.addNotes("Ne jamais citer de prix Zebra — on n'en parle pas, même en réponse à une question. L'argument décisif ici : un outil expert suppose un service expert pour le servir ; c'est incompatible avec le transfert au floor.")
  }

  // ════ 13. Ce qu'on ne promet pas ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pour être clair')
    d.titre(s, "Ce qu'on ne vous promet pas.")
    d.para(s, 'Autant le dire avant la démonstration qu’après.', { x: M, y: 3.7, w: COL, h: 0.6, size: 12.5, italic: true, color: P.SLATE })
    d.alineas(s, [
      ["L'inventaire fiscal certifié.", "Si votre commissaire aux comptes exige un comptage par un tiers, ce comptage reste. Quantinvo fait tout le reste de l'année, et il le prépare."],
      ['Une connexion à votre ERP.', "Quantinvo importe vos fichiers et rend un Excel. L'ajustement du stock reste un geste dans votre système — c'est d'ailleurs le seul qui doive le rester."],
      ['Android sur les boutiques.', "L'application tourne sur Android, et elle est disponible sur iPhone. La mise en ligne sur Google Play est en cours ; d'ici là, l'installation passe par votre catalogue d'entreprise."],
      ['La connexion par votre annuaire.', "Les comptes sont nominatifs, créés par invitation. Pas de SAML ni d'Entra ID pour l'instant ; dites-nous si c'est une exigence."],
    ], { y: 1.5, h: 4.8, size: 14, gap: 14 })
    d.pied(s, 13, PIED)
    s.addNotes("Cette page désarme les objections. Ne pas la sauter : un prospect qui découvre une limite après coup perd confiance, un prospect averti la comprend. Un dossier technique séparé existe pour la DSI — le proposer ici.")
  }

  // ════ 14. L'offre ════
  {
    const s = pres.addSlide()
    d.entete(s, "L'offre")
    d.titreLarge(s, 'Une licence par magasin, inventaires illimités', { y: 1.3, size: 26 })
    d.para(s, "Le prix suit le nombre d'appareils qui comptent en même temps dans le magasin — la seule chose que vous puissiez vérifier vous-même. Ni le volume de votre stock, ni le nombre de comptes, ni le nombre d'inventaires dans l'année.", { x: M, y: 1.95, w: W - 2 * M, h: 0.5, size: 11.5, color: P.SLATE })
    grilleOffres(d, s, { x: M, y: 2.55, w: W - 2 * M, h: 3.0, rythme: 'mois', points: false })
    d.alineas(s, [
      ['Ce que ça change pour l’inventaire tournant.', "À l'intérieur d'un palier, compter davantage ne coûte rien : un chef d'équipe qui décide de compter son rayon un mardi matin n'a aucun budget à demander. C'est ce qui rend le transfert au floor tenable dans la durée."],
      ['Zéro matériel.', "Aucun terminal à acheter, à louer, à configurer ou à remplacer. L'application, le tableau de bord, les rapports et les mises à jour sont compris."],
    ], { x: M, y: 5.7, w: W - 2 * M, h: 1.1, size: 12, gap: 9 })
    d.pied(s, 14, PIED)
    s.addNotes("Le palier se choisit sur le nombre de personnes qui comptent EN MÊME TEMPS, pas sur l'effectif : un floor de cent vendeurs dont vingt comptent le mardi matin relève d'Advanced. Le dépassement ne bloque jamais un comptage, il se règle au renouvellement. Au-delà de cent appareils sur un même magasin, ou pour plusieurs magasins, on établit un devis.")
  }

  // ════ 15. Pour finir ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Essayons sur un rayon.',
      texte: "Une démonstration avec un chef d'équipe et deux vendeurs, sur votre propre stock théorique : il l'importe, ils balisent leur rayon, ils comptent, et vous recevez le rapport. Un mardi matin avant l'ouverture suffit.",
      contact: 'contact@quantinvo.com   ·   www.quantinvo.com',
      bas: 'Quantinvo, par Devkaylab. L’outil d’inventaire pour le commerce.',
    })
    s.addNotes("Clore sur l'essai qui prouve l'idée : ce n'est pas nous qui faisons la démonstration, c'est un chef d'équipe et ses vendeurs. Si eux y arrivent un mardi matin, le transfert est démontré.")
  }

  await ecrire(pres, 'Quantinvo-Samaritaine')
}

main().catch((e) => { console.error(e); process.exit(1) })
