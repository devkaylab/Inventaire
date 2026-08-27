// Deck Quantinvo pour La Samaritaine — fond blanc, charte « Papier » v1.1.
// node build-samaritaine.js                 → Quantinvo-Samaritaine.pptx        (Arial)
// FONT_MODE=brand node build-samaritaine.js → Quantinvo-Samaritaine-marque.pptx (Sora/Inter)
//
// Le fil du deck suit le document « Déroulement inventaire tournant » remis
// par La Samaritaine : chaque étape citée sur la page « Aujourd'hui » vient
// de ce document, pas de notre imagination. L'angle de vente : réduire la
// part de planification, de supervision et de réconciliation que chaque
// inventaire fait porter à l'Inventory Control.

const { P, FONT, FONTD, W, M, COL, RX, RW, preparer, ecrire, capture } = require('./charte')

async function main() {
  const d = await preparer({ titre: 'Quantinvo — proposition pour La Samaritaine' })
  const { pres } = d
  const PIED = 'Quantinvo · proposition pour La Samaritaine'

  // Captures du tableau de bord (données d'essai), mêmes recadrages que le
  // deck commercial : hors en-tête et hors nom du magasin d'essai.
  const capSuivi = await capture('light-desktop-suivi.png', { left: 104, top: 254, width: 1232, height: 446 })
  const capEcarts = await capture('light-desktop-ecarts.png', { left: 444, top: 440, width: 892, height: 340 })
  const capRapport = await capture('light-desktop-rapport.png', { left: 444, top: 250, width: 892, height: 600 })

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Proposition pour La Samaritaine',
      titre: "L'inventaire tournant, sans la charge qui l'entoure.",
      sousTitre: "Vos équipes comptent déjà. Quantinvo retire à l'Inventory Control la préparation, la surveillance et la consolidation qui entourent chaque comptage.",
      bas: 'Devkaylab  ·  août 2026  ·  www.quantinvo.com',
    })
    s.addNotes("Ouvrir sur leur situation, pas sur le produit : le comptage n'est pas leur problème, c'est tout ce qui l'entoure. Le deck suit leur propre document de déroulement.")
  }

  // ════ 2. Aujourd'hui : leur journée, d'après leur document ════
  {
    const s = pres.addSlide()
    d.entete(s, "Aujourd'hui")
    d.titre(s, "Votre journée d'inventaire, telle qu'elle se déroule.", { h: 1.7 })
    d.para(s, "Reprise de votre déroulement d'inventaire tournant, étape par étape. Chaque ligne est tirée de votre document.", { x: M, y: 3.2, w: COL, h: 0.9, size: 12, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['La veille.', "Balisage des zones à inventorier, stickers posés avec une personne du floor ou du relay."],
      ['Le matin.', "Télécharger le stock théorique du jour, ouvrir la session SmartCount, connecter les terminaux Zebra un par un — en vérifiant la date et la localisation de chacun (101 floor / BOH, 902 relay). Puis briefer les compteurs sur le maniement des terminaux et la procédure."],
      ['Pendant.', "Déclencher l'audit des zones comptées — 100 % pour la W&J, 30 % au moins ailleurs —, guetter les failed audits sur SmartCount, faire recompter les zones en désaccord."],
      ['Après.', "Extraire le rapport SKU Variance, le consolider à la main avec le stock théorique, faire valider les résultats selon la valeur de l'écart (Inventory Control, PSM ou AGM), puis ajuster le stock."],
    ], { y: 1.5, h: 5.2, size: 12.5, gap: 13 })
    d.pied(s, 2, PIED)
    s.addNotes("Ne rien commenter : lire, et laisser la page faire son effet. C'est leur document, ils s'y reconnaissent. La question qui vient toute seule : qui fait tout ça ?")
  }

  // ════ 3. Le constat ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le constat')
    d.titre(s, 'Le comptage est fait par les équipes. Tout le reste est fait par vous.', { h: 2.0 })
    d.chiffre(s, '4', "casquettes portées par l'Inventory Control à chaque inventaire : préparer, surveiller, réconcilier, corriger.", { y: 3.7 })
    d.alineas(s, [
      ['La préparation.', "Le stock du jour, la session, les terminaux, le briefing : une part de chaque inventaire qui ne compte aucun article."],
      ['La surveillance.', "Pendant tout le comptage, quelqu'un reste posté sur la plateforme pour suivre les audits et guetter les failed audits. Ce quelqu'un, c'est vous."],
      ['La réconciliation.', "Deux fichiers à rapprocher à la main après chaque inventaire — le stock théorique et le SKU Variance. C'est long, et c'est là que les erreurs se glissent."],
      ['La correction.', "L'ajustement du stock, après validation. La seule de ces quatre étapes qui doive vraiment rester entre vos mains."],
    ], { y: 1.5, h: 4.6, size: 13, gap: 13 })
    d.encadre(s, 'Et ça se multiplie', "Un inventaire tournant, par construction, se répète. Chaque comptage rejoue la même préparation, la même surveillance, la même consolidation — c'est cette charge fixe qui limite le nombre d'inventaires.", { x: RX, y: 5.7, w: RW, h: 1.2 })
    d.pied(s, 3, PIED)
    s.addNotes("Le point clé est dans l'encadré : leur stratégie tournant + aléatoire multiplie les comptages, donc multiplie la charge fixe. C'est l'argument économique de tout le deck.")
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
      ["Pensé pour l'inventaire tournant.", "Des comptages toute l'année — un rayon, une marque, une liste d'articles — plutôt qu'une nuit par an. C'est le cœur de l'outil, pas une option."],
      ["Le même geste qu'aujourd'hui.", "Scanner la balise de la zone, scanner les articles, clôturer, passer à la suivante. Vos équipes ne changent pas de procédure : elles changent d'outil."],
    ], { y: 1.5, h: 5.0, size: 13, gap: 13 })
    d.pied(s, 4, PIED)
    s.addNotes("Dire d'où on parle : le rayon, la réserve, la nuit d'inventaire. C'est ce qui distingue d'un éditeur généraliste — et ce qui explique que le déroulement de la page 2 nous soit familier.")
  }

  // ════ 5. La même journée, avec Quantinvo ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Avec Quantinvo')
    d.titre(s, 'La même journée, avec Quantinvo.', { h: 1.4 })
    d.para(s, "Le déroulement ne change pas. Ce qui change, c'est ce qu'il reste à faire autour.", { x: M, y: 2.9, w: COL, h: 0.9, size: 12, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['La veille.', "Le balisage reste — c'est le seul geste physique. Les balises sortent de l'outil : une planche d'étiquettes numérotées, en PDF, à imprimer sur place."],
      ['Le matin.', "Le stock théorique s'importe tel quel, colonnes reconnues. Pas de flotte à préparer : chaque compteur ouvre l'inventaire sur son téléphone. La date et le périmètre sont dans l'inventaire, pas dans l'appareil."],
      ['Pendant.', "Le comptage se déroule comme aujourd'hui, zone par zone. L'audit est un mode de l'outil : un désaccord entre deux comptages s'affiche en direct et se tranche pendant que le compteur est encore au rayon."],
      ['Après.', "Le rapport croise déjà l'attendu et le compté — y compris ce qui n'a jamais été compté. Il sort en Excel et part tel quel à la validation, puis à l'ajustement."],
    ], { y: 1.5, h: 5.2, size: 12.5, gap: 13 })
    d.pied(s, 5, PIED)
    s.addNotes("Page miroir de la page 2, même structure veille / matin / pendant / après. Insister sur « la date et le périmètre sont dans l'inventaire, pas dans l'appareil » : c'est toute la vérification 101/902 qui disparaît.")
  }

  // ════ 6. Sans / avec ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Sans, avec')
    d.titreLarge(s, "Ce que l'Inventory Control cesse de faire")
    const x1 = M, x2 = M + 5.6, wc = 5.3
    let y = 2.45
    s.addText('Sans Quantinvo', { x: x1, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.SLATE, margin: 0 })
    s.addText('Avec Quantinvo', { x: x2, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.DEEP, margin: 0 })
    y += 0.4
    d.filet(s, M, y, W - 2 * M)
    const rows = [
      ['Des terminaux à connecter et vérifier un par un avant chaque session.', 'Aucune flotte à préparer. Chaque compteur rejoint l’inventaire depuis son téléphone.'],
      ['Un briefing sur le maniement des terminaux à chaque inventaire.', 'Le geste qu’ils connaissent : scanner la balise, scanner les articles. Dix minutes.'],
      ['Quelqu’un posté sur la plateforme pour guetter les failed audits.', 'Le tableau de bord montre tout, du bureau. Un écart se tranche sur place.'],
      ['Le SKU Variance à consolider à la main avec le stock théorique.', 'Le rapport croise déjà l’attendu et le compté, écarts en valeur d’achat.'],
      ['L’Inventory Control présent du début à la fin de chaque comptage.', 'Le responsable de floor conduit son inventaire ; vous lisez le rapport.'],
    ]
    for (const [a, b] of rows) {
      y += 0.16
      s.addText(a, { x: x1, y, w: wc, h: 0.6, fontFace: FONT, fontSize: 12.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
      s.addText(b, { x: x2, y, w: wc, h: 0.6, fontFace: FONT, fontSize: 12.5, color: P.INK, margin: 0, lineSpacingMultiple: 1.15 })
      y += 0.66
      d.filet(s, M, y, W - 2 * M)
    }
    d.pied(s, 6, PIED)
    s.addNotes("Lire deux ou trois lignes, pas les cinq. La dernière est la promesse du deck : l'Inventory Control passe d'opérateur de chaque inventaire à lecteur de leurs résultats.")
  }

  // ════ 7. La surveillance devient un tableau de bord ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pendant le comptage')
    d.titreLarge(s, "Surveiller sans être posté derrière l'écran.")
    d.para(s, "L'avancement zone par zone, les appareils en comptage et en audit, les derniers scans : tout se lit du bureau, en direct. Le responsable du floor voit la même chose et conduit son inventaire ; vous gardez la vue d'ensemble. Le suivi est agrégé — on pilote le travail, pas les personnes.", { x: M, y: 2.3, w: W - 2 * M, h: 0.8, size: 12.5 })
    const cw = 3.35 * capSuivi.ratio, cx = (W - cw) / 2
    const g = d.cadre(s, capSuivi, { x: cx, y: 3.15, w: cw })
    d.legende(s, "Onglet Suivi, données d'essai.", { x: cx, y: 3.15 + g.h + 0.15, w: RW })
    d.pied(s, 7, PIED)
    s.addNotes("Montrer, ne pas commenter ligne à ligne. Le suivi agrégé (personne n'est fliqué nominativement en direct) parle aux RH et au CSE d'une maison de cette taille : le dire ici évite l'objection plus tard.")
  }

  // ════ 8. L'audit garde vos règles ════
  {
    const s = pres.addSlide()
    d.entete(s, "L'audit")
    d.titreLarge(s, 'Vos règles d’audit restent. Les désaccords se règlent sur place.')
    d.para(s, "Vous choisissez les zones à auditer — 100 % de la W&J, 30 % au moins ailleurs : la règle reste la vôtre. Un failed audit ne s'attend plus dans un rapport : les deux comptages s'affichent côte à côte, l'écart en pièces et en valeur d'achat, et le superviseur tranche pendant que le compteur est encore au rayon.", { x: M, y: 2.3, w: W - 2 * M, h: 0.8, size: 12.5 })
    const g = d.cadre(s, capEcarts, { x: M + 1.6, y: 3.2, w: W - 2 * M - 3.2 })
    d.legende(s, "Onglet Écarts d'audit, données d'essai.", { x: M + 1.6, y: 3.2 + g.h + 0.15, w: RW })
    d.pied(s, 8, PIED)
    s.addNotes("Le recomptage ne disparaît pas : il se décide à chaud, avec le compteur encore dans le rayon, au lieu d'être découvert en surveillant la plateforme.")
  }

  // ════ 9. La réconciliation n'existe plus ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Après le comptage')
    d.titre(s, "La consolidation d'après-inventaire n'existe plus.", { size: 24 })
    d.para(s, "Le rapport part du stock théorique, pas seulement de ce qui a été scanné. Un article attendu et jamais trouvé y figure, avec son manque : la démarque que l'inventaire est censé révéler est déjà dans le fichier.", { x: M, y: 3.3, w: COL, h: 1.6, size: 12.5 })
    d.para(s, "Export Excel en un clic. Il ne reste que la validation et l'ajustement — les deux gestes qui doivent rester chez vous.", { x: M, y: 4.9, w: COL, h: 1.0, size: 12.5 })
    const g = d.cadre(s, capRapport, { x: RX, y: 1.5, w: RW, h: 5.0 })
    d.legende(s, "Onglet Rapport, données d'essai.", { x: RX, y: 1.5 + g.h + 0.15, w: RW })
    d.pied(s, 9, PIED)
    s.addNotes("C'est la page qui rend l'après-midi de consolidation : le croisement stock théorique / compté est déjà fait, article par article. La validation PSM / AGM garde le même fichier qu'aujourd'hui, en mieux rangé.")
  }

  // ════ 10. L'inventaire aléatoire ════
  {
    const s = pres.addSlide()
    d.entete(s, "L'inventaire aléatoire")
    d.titre(s, 'Votre projet d’inventaire aléatoire, prêt à fonctionner.', { h: 1.9 })
    d.para(s, "Vous en avez posé les objectifs : identifier les vols, tester la rigueur des procédures, garantir que chaque responsable maîtrise son stock. L'obstacle n'est pas l'intention — c'est la logistique de chaque comptage.", { x: M, y: 3.4, w: COL, h: 1.7, size: 12, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['La sélection.', "Vos critères restent les vôtres : variances négatives répétées, articles sensibles, slow movers. Les rapports des inventaires précédents donnent les chiffres d'où cette sélection se tire."],
      ['Le déclenchement.', "Un inventaire ciblé se crée en quelques minutes — une marque, un rayon, une liste d'articles — le jour même s'il le faut. Les équipes concernées sont invitées depuis l'outil."],
      ['Le comptage.', "Les équipes de vente comptent avec le téléphone qu'elles ont en poche. Pas de matériel à sortir, pas de session à monter : c'est ce qui rend l'aléatoire réellement aléatoire."],
      ['Le contrôle.', "L'écart se lit en direct. S'il dépasse votre seuil, l'Inventory Control reprend la main, et le rapport nourrit l'enquête."],
    ], { y: 1.5, h: 5.2, size: 12.5, gap: 13 })
    d.pied(s, 10, PIED)
    s.addNotes("Leur document dit « en cours d'élaboration » : la page montre que l'outil le rend possible sans rien construire. Un aléatoire qui demande une journée de préparation n'est plus aléatoire — c'est l'argument du troisième alinéa.")
  }

  // ════ 11. Pourquoi Quantinvo et pas Zebra ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pourquoi pas Zebra')
    d.titreLarge(s, 'Pourquoi Quantinvo, et pas Zebra ?')
    const cw = (W - 2 * M - 0.6) / 2
    d.alineas(s, [
      ['Le matériel.', "SmartCount repose sur une flotte de terminaux dédiés : à charger, configurer, vérifier avant chaque session — et leur nombre plafonne celui des compteurs. Quantinvo tourne sur les iPhone que vos équipes ont déjà, et une douchette Bluetooth s'y branche pour les gros volumes."],
      ['Le coût.', "Une licence par magasin, à l'année, comptages et compteurs illimités. Pas de coût par terminal, pas d'abonnement par appareil. Ajouter dix compteurs un matin d'inventaire ne coûte rien."],
    ], { x: M, y: 2.5, w: cw, h: 3.2, size: 12.5, gap: 12 })
    d.alineas(s, [
      ['La réconciliation.', "SmartCount rend un rapport de variance, à consolider ensuite avec le stock théorique. Quantinvo rend ce croisement déjà fait : l'attendu, le compté, le non-compté, l'écart en valeur."],
      ["La taille de l'éditeur.", "SmartCount est un module au catalogue d'un géant du matériel. Quantinvo ne fait qu'une chose — l'inventaire — et la personne qui l'a dessiné répond elle-même à vos questions."],
    ], { x: M + cw + 0.6, y: 2.5, w: cw, h: 3.2, size: 12.5, gap: 12 })
    d.encadre(s, 'Pour être honnête', "Un terminal durci encaisse mieux les chocs qu'un téléphone, et si votre flotte est déjà amortie, l'argument du matériel pèse moins. Les nôtres ne bougent pas : rien à reconfigurer avant chaque inventaire, aucun plafond au nombre de compteurs, et une réconciliation qui n'existe plus.", { x: M, y: 5.75, w: W - 2 * M, h: 1.15 })
    d.pied(s, 11, PIED)
    s.addNotes("Ne jamais citer de prix Zebra — on n'en parle pas, même en réponse à une question. Rester factuel sur le déroulement : tout ce que la colonne de gauche décrit vient de leur propre document.")
  }

  // ════ 12. Ce qu'on ne promet pas ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pour être clair')
    d.titre(s, "Ce qu'on ne vous promet pas.")
    d.para(s, 'Autant le dire avant la démonstration qu’après.', { x: M, y: 3.7, w: COL, h: 0.6, size: 12.5, italic: true, color: P.SLATE })
    d.alineas(s, [
      ["L'inventaire fiscal certifié.", "Si votre commissaire aux comptes exige un comptage par un tiers, ce comptage reste. Quantinvo fait tout le reste de l'année, et il le prépare."],
      ['Une connexion à votre ERP.', "Quantinvo importe vos fichiers et rend un Excel. L'ajustement du stock reste un geste dans votre système — c'est d'ailleurs le seul qui doive le rester."],
      ['Android.', "L'application est sur iPhone aujourd'hui. La version Android est en cours."],
      ['La connexion par votre annuaire.', "Les comptes sont nominatifs, créés par invitation. Pas de SAML ni d'Entra ID pour l'instant ; dites-nous si c'est une exigence."],
    ], { y: 1.5, h: 4.8, size: 14, gap: 14 })
    d.pied(s, 12, PIED)
    s.addNotes("Cette page désarme les objections. Ne pas la sauter : un prospect qui découvre une limite après coup perd confiance, un prospect averti la comprend. Un dossier technique séparé existe pour la DSI — le proposer ici.")
  }

  // ════ 13. L'offre ════
  {
    const s = pres.addSlide()
    d.entete(s, "L'offre")
    d.titre(s, 'Une licence par magasin, à l’année, comptages illimités.', { size: 24, h: 1.8 })
    d.chiffre(s, '0', 'terminal à acheter, à louer ou à configurer.', { y: 4.1 })
    d.alineas(s, [
      ["Le prix suit le stock, pas l'usage.", "La licence se calcule sur le volume de stock du magasin, en unités. Elle ne dépend ni du nombre de compteurs, ni du nombre d'inventaires — tournants, aléatoires ou complets — dans l'année. Multiplier les comptages ne coûte rien de plus : c'est fait pour."],
      ['Tout est compris.', "L'application, le tableau de bord, les rapports, les mises à jour. Le chiffrage précis se fait au devis, sur votre volume de stock déclaré."],
      ['Un déploiement en jours, pas en mois.', "Pas de projet informatique : les comptes se créent par invitation, l'application s'installe — y compris par votre catalogue d'entreprise —, et le premier inventaire peut se faire la semaine de la signature."],
    ], { y: 1.5, h: 4.8, size: 13.5, gap: 14 })
    d.pied(s, 13, PIED)
    s.addNotes("Parler en budget d'inventaire annuel, jamais en prix d'application. La grille au volume est dans le deck commercial et se confirme au devis ; ici, l'argument est que le modèle encourage précisément leur stratégie : compter plus souvent.")
  }

  // ════ 14. Pour finir ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Essayons sur un rayon.',
      texte: "Une démonstration sur votre propre stock théorique : vous l'importez tel quel, on balise un rayon, on compte, et vous repartez avec le rapport. Un mardi matin avant l'ouverture suffit.",
      contact: 'contact@quantinvo.com   ·   www.quantinvo.com',
      bas: 'Quantinvo, par Devkaylab. L’outil d’inventaire pour le commerce.',
    })
    s.addNotes("Clore sur l'essai concret, à leur échelle : un rayon, un mardi matin. C'est l'engagement qu'on prend et celui qu'on leur demande.")
  }

  await ecrire(pres, 'Quantinvo-Samaritaine')
}

main().catch((e) => { console.error(e); process.exit(1) })
