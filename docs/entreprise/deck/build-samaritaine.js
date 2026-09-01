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
//
// ⚠️ RESSERRÉ LE 1er SEPTEMBRE 2026, de 15 pages à 11. Constat de Julien :
// « beaucoup de répétition ». Quatre pages disaient le même avant / après —
// « Aujourd'hui », « Le constat » (les quatre casquettes), « La même journée
// conduite par le floor » et le tableau « Sans / avec ». Elles sont devenues
// DEUX : leur journée telle qu'elle est, puis un seul tableau qui la remet
// en regard, dont la dernière ligne porte les quatre casquettes et le pivot
// de la proposition. Ne pas réintroduire de page miroir : un déroulement
// raconté deux fois de suite se lit comme un remplissage.
//
// Les faits ne se répètent plus qu'à bon escient : « aucune flotte » se dit
// dans le tableau puis dans la comparaison SmartCount (deux registres), la
// règle d'audit dans leur journée puis sur la page d'audit, le rapport croisé
// dans le tableau puis sur la page qui le montre. Tout le reste a été retiré
// de ses autres emplacements — c'est la moitié du travail de cette révision.

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

  // ════ 1. Ouverture : l'application, avant qu'on en parle ════
  //
  // ⚠️ La capture est l'écran de LANCEMENT, et il ne s'obtient qu'en Release
  // (voir LISEZMOI.md) : en Debug, le bandeau LogBox de React Native s'affiche
  // par-dessus et partirait chez le client. Ne pas la remplacer par une
  // capture prise au vol.
  //
  // Le téléphone est ENTIER ici, pas débordant : c'est le sujet de la page.
  // On lui donne une hauteur généreuse à `cadrer`, qui ne coupe que si la
  // place manque.
  {
    const s = pres.addSlide()
    s.background = { color: P.PAPER }
    const tel = await cadrer('lancement.png', { w: 3, h: 7 })
    d.ecranEntier(s, { x: W - M - 5.1 * tel.ratio, y: (H - 5.1) / 2, h: 5.1, tel })
    s.addImage({ data: d.logo, x: M, y: 1.55, w: 0.62, h: 0.62 })
    s.addText('Quantinvo', { x: M + 0.78, y: 1.52, w: 5, h: 0.68, fontFace: FONTD, fontSize: 24, bold: true, color: P.INK, margin: 0, valign: 'middle' })
    s.addShape('rect', { x: M, y: 2.42, w: 2.6, h: 0.028, fill: { color: P.CYAN }, line: { color: P.CYAN, width: 0 } })
    d.citation(s, "J'ai dessiné Quantinvo pendant des inventaires, pas dans une salle de réunion.", { x: M, y: 3.05, w: 7.0, h: 2.0, size: 25 })
    // La signature suit la citation d'assez près pour lui appartenir, et laisse
    // la place d'une troisième ligne : en Sora (variante `-marque`) elle en
    // prend une de plus qu'en Arial.
    d.para(s, 'Julien Thiong-kay, Devkaylab', { x: M, y: 4.6, w: 7.0, h: 0.4, size: 12.5, color: P.SLATE })
    d.para(s, "L'outil d'inventaire pour le commerce.", { x: M, y: 6.05, w: 7.0, h: 0.35, size: 10.5, color: P.SLATE })
    s.addNotes("Poser le téléphone sur la table en même temps que la page s'affiche. Ne rien vendre encore : on montre l'objet, on dit d'où il vient, et on enchaîne.")
  }

  // ════ 2. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Proposition pour La Samaritaine',
      titre: "L'inventaire tournant, rendu aux équipes de vente.",
      sousTitre: "Le balisage, le comptage et la conduite de chaque inventaire passent au floor : les chefs d'équipe supervisent, les vendeurs comptent. L'Inventory Control reçoit le rapport, valide et ajuste.",
      bas: 'Devkaylab  ·  septembre 2026  ·  www.quantinvo.com',
    })
    s.addNotes("Ouvrir sur l'idée, pas sur le produit : l'inventaire cesse d'être une opération de l'Inventory Control pour devenir un geste des équipes de vente. Le deck suit leur propre document de déroulement.")
  }

  // ════ 3. Aujourd'hui : leur journée, d'après leur document ════
  //
  // ⚠️ Page volontairement SANS capture. C'est leur document, mot pour mot :
  // une capture de notre produit y mettrait notre réponse avant leur constat.
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
    ], { y: 1.5, h: 5.2, size: 13, gap: 16 })
    d.pied(s, 3, PIED)
    s.addNotes("Ne rien commenter : lire, et laisser la page faire son effet. C'est leur document, ils s'y reconnaissent. La question qui vient toute seule : pourquoi tout cela passe-t-il par l'Inventory Control ?")
  }

  // ════ 4. Le même déroulement, conduit par le floor ════
  //
  // ⚠️ Cette page en remplace TROIS (les quatre casquettes, la journée miroir,
  // l'ancien tableau sans / avec). La dernière ligne porte à la fois le compte
  // des casquettes et le pivot de la proposition : c'est elle qu'on lit à voix
  // haute, pas les cinq.
  {
    const s = pres.addSlide()
    d.entete(s, 'Ce qui change')
    d.titreLarge(s, "Le déroulement ne change pas. Ce qui change, c'est qui le porte.", { y: 1.25, size: 25 })
    d.para(s, "Votre journée, ligne à ligne, et la même conduite par les équipes de vente.", { x: M, y: 2.0, w: W - 2 * M, h: 0.4, size: 12, italic: true, color: P.SLATE })

    // ⚠️ `wc` et `x2` se déduisent de la marge : à 5,75 la colonne de droite
    // dépassait le filet de deux dixièmes de pouce, et « tranche » touchait le
    // bord de la page.
    const wc = (W - 2 * M - 0.6) / 2
    const x1 = M, x2 = M + wc + 0.6
    let y = 2.55
    s.addText("Aujourd'hui", { x: x1, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.SLATE, margin: 0 })
    s.addText('Avec Quantinvo', { x: x2, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.DEEP, margin: 0 })
    y += 0.38
    d.filet(s, M, y, W - 2 * M)
    // [attaque, aujourd'hui, avec Quantinvo] — l'attaque en gras tient les deux
    // colonnes alignées sur la même étape de la journée.
    const rangs = [
      ['La veille.', "Balisage par l'Inventory Control, stickers posés avec une personne du floor ou du relay.", "Le chef d'équipe imprime ses balises — une planche d'étiquettes numérotées, en PDF — et les pose avec son équipe."],
      ['Le matin.', "Stock théorique à télécharger, session à ouvrir, terminaux à connecter et vérifier un par un, briefing sur le matériel.", "Il importe le stock théorique tel quel, colonnes reconnues, et ouvre l'inventaire. Chaque vendeur le rejoint depuis son téléphone."],
      ['Pendant.', "Quelqu'un reste posté sur la plateforme pour guetter les failed audits et faire recompter les zones.", "Le chef d'équipe suit l'avancement, audite selon votre règle et tranche les désaccords au rayon, en direct."],
      ['Après.', "Le SKU Variance à extraire, puis à consolider à la main avec le stock théorique.", "Le rapport arrive déjà croisé avec l'attendu, prêt pour la validation."],
      ['Au total.', "Quatre casquettes pour l'Inventory Control : préparer, surveiller, réconcilier, corriger.", "Une seule vous reste : valider l'écart, ajuster le stock."],
    ]
    // ⚠️ L'attaque en gras n'est portée QUE par la colonne de gauche. Écrite
    // des deux côtés, « La veille. » se lisait deux fois sur la même ligne —
    // la répétition que cette page est justement chargée de supprimer. Les
    // deux cellules sont sur la même rangée : l'alignement suffit à dire de
    // quelle étape on parle.
    for (const t of rangs) {
      y += 0.14
      const opts = { w: wc, h: 0.6, fontFace: FONT, fontSize: 11.5, margin: 0, lineSpacingMultiple: 1.15 }
      s.addText([
        { text: t[0] + ' ', options: { bold: true, color: P.INK } },
        { text: t[1], options: { color: P.INK2 } },
      ], { ...opts, x: x1, y })
      s.addText(t[2], { ...opts, x: x2, y, color: P.INK })
      y += 0.62
      d.filet(s, M, y, W - 2 * M)
    }
    d.pied(s, 4, PIED)
    s.addNotes("Ne pas lire les cinq lignes : lire « La veille », puis descendre directement sur « Au total ». Chaque ligne de gauche est portée par l'Inventory Control, chaque ligne de droite par le floor — sauf la dernière, la seule qui vous reste. C'est le pivot de toute la proposition : on ne propose pas d'alléger votre charge, on propose de la transférer.")
  }

  // ════ 5. Qui fait quoi — les écrans ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Qui fait quoi')
    d.titreLarge(s, "L'inventaire appartient au floor. Voici leurs écrans.", { y: 1.25, size: 24 })
    d.para(s, "Une application sur l'iPhone des compteurs, un tableau de bord pour celui qui pilote, un rapport à la fin. Rien d'autre à installer, rien à acheter.", { x: M, y: 1.9, w: W - 2 * M, h: 0.4, size: 12, color: P.SLATE })
    await troisEcrans(s, [
      { ecran: 'balises', titre: "Le chef d'équipe prépare", texte: "Il choisit la numérotation et imprime sa planche d'étiquettes.", fill: P.MIST },
      { ecran: 'comptage', titre: 'Les vendeurs comptent', texte: "Ils scannent la balise du rayon, puis les articles. Le geste qu'ils connaissent.", fill: P.TINT },
      { ecran: 'audit', titre: "Le chef d'équipe repasse", texte: "Il audite la zone selon votre règle, pendant que le comptage continue ailleurs.", fill: P.MIST },
    ], { y: 2.45 })
    d.pied(s, 5, PIED)
    s.addNotes("Les écrans sont de vraies captures de l'application, celles du guide de prise en main. Et l'Inventory Control ? Il n'a pas d'écran sur cette page — c'est le message. Le sien arrive deux pages plus loin : le rapport.")
  }

  // ════ 6. Pendant le comptage : le suivi et l'arbitrage ════
  //
  // Fusion des deux anciennes pages « surveillance » et « audit » : elles
  // disaient toutes deux « le chef d'équipe voit et tranche en direct ». Les
  // deux captures, elles, montrent bien deux choses différentes — c'est ce
  // qui justifiait de garder les deux images, pas les deux pages.
  {
    const s = pres.addSlide()
    d.entete(s, 'Pendant le comptage')
    d.titreLarge(s, "Vous fixez la règle d'audit. Le floor l'applique.", { y: 1.25, size: 25 })
    d.para(s, "100 % de la W&J, 30 % au moins ailleurs : la règle reste la vôtre. Un failed audit ne s'attend plus dans un rapport — les deux comptages s'affichent côte à côte, l'écart en pièces et en valeur d'achat, et il se tranche pendant que le compteur est encore au rayon. L'Inventory Control ouvre la même vue sur n'importe quel inventaire en cours, sans en conduire aucun.", { x: M, y: 1.95, w: W - 2 * M, h: 0.85, size: 12.5 })

    const cw = (W - 2 * M - 0.5) / 2
    const yc = 3.55
    const etiquette = (t, x) => s.addText(t, { x, y: yc - 0.34, w: cw, h: 0.3, fontFace: FONTD, fontSize: 12.5, bold: true, color: P.INK, margin: 0 })
    etiquette("L'avancement, zone par zone", M)
    etiquette("L'écart, tranché au rayon", M + cw + 0.5)
    const g1 = d.cadre(s, capSuivi, { x: M, y: yc, w: cw })
    const g2 = d.cadre(s, capEcarts, { x: M + cw + 0.5, y: yc, w: cw })
    // Les deux recadrages n'ont pas exactement le même rapport : sans ce
    // `max`, les légendes se posaient à deux hauteurs différentes.
    const yLeg = yc + Math.max(g1.h, g2.h) + 0.14
    d.legende(s, "Onglet Suivi, données d'essai.", { x: M, y: yLeg, w: cw })
    d.legende(s, "Onglet Écarts d'audit, données d'essai.", { x: M + cw + 0.5, y: yLeg, w: cw })
    d.pied(s, 6, PIED)
    s.addNotes("Le poste de surveillance n'est pas supprimé, il est distribué : chaque chef d'équipe voit son rayon, et vous voyez tout sans rien opérer. Le recomptage ne disparaît pas non plus — il se décide à chaud plutôt que d'être découvert sur la plateforme. Le suivi est agrégé, personne n'est suivi nominativement en direct : cela parle aux RH et au CSE d'une maison de cette taille.")
  }

  // ════ 7. Ce qui vous revient : le rapport ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Après le comptage')
    d.titre(s, 'Ce qui vous revient : un rapport déjà consolidé.', { size: 24, h: 1.5 })
    d.para(s, "Le rapport part du stock théorique, pas seulement de ce qui a été scanné. Un article attendu et jamais trouvé y figure, avec son manque : la démarque que l'inventaire est censé révéler est déjà dans le fichier.", { x: M, y: 3.15, w: COL, h: 1.6, size: 12.5 })
    d.para(s, "Export Excel en un clic. Il ne reste que la validation — Inventory Control, PSM ou AGM selon la valeur de l'écart — et l'ajustement du stock.", { x: M, y: 4.7, w: COL, h: 1.2, size: 12.5 })
    const g = d.cadre(s, capRapport, { x: RX, y: 1.5, w: RW, h: 5.0 })
    d.legende(s, "Onglet Rapport, données d'essai.", { x: RX, y: 1.5 + g.h + 0.15, w: RW })
    d.pied(s, 7, PIED)
    s.addNotes("C'est la page de l'Inventory Control : son travail commence ici, sur un fichier déjà croisé avec le théorique. Le circuit de validation ne change pas — il s'exerce sur un fichier mieux rangé, et plus tôt dans la journée.")
  }

  // ════ 8. L'inventaire aléatoire ════
  {
    const s = pres.addSlide()
    d.entete(s, "L'inventaire aléatoire")
    d.titreLarge(s, "Votre projet d'inventaire aléatoire, prêt à fonctionner.", { y: 1.25, size: 25 })
    d.para(s, "Vous en avez posé les objectifs : identifier les vols, tester la rigueur des procédures, garantir que chaque responsable maîtrise son stock. Confier le comptage au floor, c'est exactement cela.", { x: M, y: 1.95, w: W - 2 * M - 2.6, h: 0.6, size: 12, italic: true, color: P.SLATE })

    const tel = await cadrer('nouvel-inventaire.png', { w: 3, h: 7 })
    const hTel = 4.0
    const wTel = hTel * tel.ratio
    d.ecranEntier(s, { x: W - M - wTel, y: 2.6, h: hTel, tel, legende: "Créer un inventaire ciblé, dans l'application." })
    d.alineas(s, [
      ['La sélection.', "Elle reste chez vous : variances négatives répétées, articles sensibles, slow movers. Les rapports des inventaires précédents donnent les chiffres d'où cette sélection se tire."],
      ['Le déclenchement.', "Un inventaire ciblé se crée en quelques minutes — une marque, un rayon, une liste d'articles — le jour même s'il le faut. Les équipes concernées sont invitées depuis l'outil."],
      ['Le comptage.', "Rien à sortir, rien à monter : c'est ce qui rend l'aléatoire réellement aléatoire, et non un rendez-vous annoncé par la préparation qu'il demande."],
      ['Le contrôle.', "L'écart se lit en direct. S'il dépasse votre seuil, l'Inventory Control reprend la main, et le rapport nourrit l'enquête."],
    ], { x: M, y: 2.75, w: W - 2 * M - wTel - 0.6, h: 3.9, size: 13, gap: 14 })
    d.pied(s, 8, PIED)
    s.addNotes("Leur document dit « en cours d'élaboration » : la page montre que l'outil le rend possible sans rien construire. La répartition est la même que pour le tournant — vous choisissez quoi et quand, le floor compte, vous contrôlez l'écart.")
  }

  // ════ 9. Pour être clair : la comparaison, et les limites ════
  //
  // ⚠️ JAMAIS de prix Zebra, ni sur la page ni en réponse à une question :
  // l'ancre SmartCount est confidentielle. L'encadré honnête reste, il fait
  // la moitié de la crédibilité de la page.
  {
    const s = pres.addSlide()
    d.entete(s, 'Pour être clair')
    d.titreLarge(s, "Pourquoi nous — et ce que nous ne promettons pas.", { y: 1.25, size: 25 })
    const cw = (W - 2 * M - 0.7) / 2
    const x2 = M + cw + 0.7
    s.addText('Plutôt que SmartCount', { x: M, y: 1.95, w: cw, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.DEEP, margin: 0 })
    s.addText("Ce qu'on ne vous promet pas", { x: x2, y: 1.95, w: cw, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.SLATE, margin: 0 })
    d.filet(s, M, 2.3, W - 2 * M)
    d.alineas(s, [
      ['Le matériel.', "SmartCount repose sur une flotte de terminaux dédiés : à charger, configurer, vérifier avant chaque session — le métier qu'on cherche justement à ne plus faire. Quantinvo tourne sur les iPhone que vos équipes ont déjà, et une douchette Bluetooth s'y branche pour les gros volumes."],
      ['La réconciliation.', "SmartCount rend un rapport de variance, à consolider ensuite avec le stock théorique. Quantinvo rend ce croisement déjà fait : l'attendu, le compté, le non-compté, l'écart en valeur."],
      ["L'éditeur.", "SmartCount est un module au catalogue d'un géant du matériel. Quantinvo ne fait qu'une chose — l'inventaire — et la personne qui l'a dessiné répond elle-même à vos questions."],
    ], { x: M, y: 2.5, w: cw, h: 2.9, size: 11.5, gap: 10 })
    // ⚠️ Sept alinéas et un encadré sur une page : le quatrième de droite
    // passait SOUS le bloc gris, vu au rendu. Les textes sont taillés pour
    // trois lignes chacun — les rallonger rouvre le défaut.
    d.alineas(s, [
      ["L'inventaire fiscal certifié.", "Si votre commissaire aux comptes exige un comptage par un tiers, ce comptage reste. Quantinvo fait tout le reste de l'année, et il le prépare."],
      ['Une connexion à votre ERP.', "Quantinvo importe vos fichiers et rend un Excel. L'ajustement du stock reste un geste dans votre système — le seul qui doive le rester."],
      ['La connexion par votre annuaire.', "Les comptes sont nominatifs, créés par invitation. Pas de SAML ni d'Entra ID ; dites-nous si c'est une exigence."],
      ['Android sur les boutiques.', "L'application tourne sur Android et sur iPhone. Sa mise en ligne sur Google Play est en cours ; d'ici là, elle passe par votre catalogue d'entreprise."],
    ], { x: x2, y: 2.5, w: cw, h: 2.9, size: 11.5, gap: 10 })
    d.encadre(s, 'Pour être honnête', "Un terminal durci encaisse mieux les chocs qu'un téléphone, et si votre flotte est déjà amortie, l'argument du matériel pèse moins. Ce qui ne bouge pas : un outil que le floor prend en main sans briefing, et une réconciliation qui n'existe plus.", { x: M, y: 5.65, w: W - 2 * M, h: 1.15 })
    d.pied(s, 9, PIED)
    s.addNotes("Deux pages en une : la comparaison et les limites. Ne pas la sauter — un prospect qui découvre une limite après coup perd confiance, un prospect averti la comprend. L'argument décisif de la colonne de gauche : un outil expert suppose un service expert pour le servir, ce qui est incompatible avec le transfert au floor. Un dossier technique séparé existe pour la DSI : le proposer ici.")
  }

  // ════ 10. L'offre ════
  //
  // ⚠️ Aucun montant n'est écrit ici : `grilleOffres` lit la grille du site
  // (`web/lib/offres.ts`). Un prix recopié à la main a déjà été présenté
  // périmé pendant une semaine — voir LISEZMOI.md.
  {
    const s = pres.addSlide()
    d.entete(s, "L'offre")
    d.titreLarge(s, 'Une licence par magasin, inventaires illimités', { y: 1.3, size: 26 })
    d.para(s, "Le prix suit le nombre d'appareils qui comptent en même temps dans le magasin — la seule chose que vous puissiez vérifier vous-même. Ni le volume de votre stock, ni le nombre de comptes, ni le nombre d'inventaires dans l'année.", { x: M, y: 1.95, w: W - 2 * M, h: 0.5, size: 11.5, color: P.SLATE })
    grilleOffres(d, s, { x: M, y: 2.55, w: W - 2 * M, h: 3.0, rythme: 'mois', points: false })
    d.alineas(s, [
      ["Ce que ça change pour l'inventaire tournant.", "À l'intérieur d'un palier, compter davantage ne coûte rien : un chef d'équipe qui décide de compter son rayon un mardi matin n'a aucun budget à demander. C'est ce qui rend le transfert au floor tenable dans la durée. L'application, le tableau de bord, les rapports et les mises à jour sont compris."],
    ], { x: M, y: 5.75, w: W - 2 * M, h: 1.0, size: 12, gap: 9 })
    d.pied(s, 10, PIED)
    s.addNotes("Le palier se choisit sur le nombre de personnes qui comptent EN MÊME TEMPS, pas sur l'effectif : un floor de cent vendeurs dont vingt comptent le mardi matin relève d'Advanced. Le dépassement ne bloque jamais un comptage, il se règle au renouvellement. Au-delà de cent appareils sur un même magasin, ou pour plusieurs magasins, on établit un devis.")
  }

  // ════ 11. Pour finir ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Essayons sur un rayon.',
      texte: "Une démonstration avec un chef d'équipe et deux vendeurs, sur votre propre stock théorique : il l'importe, ils balisent leur rayon, ils comptent, et vous recevez le rapport. Un mardi matin avant l'ouverture suffit.",
      contact: 'contact@quantinvo.com   ·   www.quantinvo.com',
      bas: "Quantinvo, par Devkaylab. L'outil d'inventaire pour le commerce.",
    })
    s.addNotes("Clore sur l'essai qui prouve l'idée : ce n'est pas nous qui faisons la démonstration, c'est un chef d'équipe et ses vendeurs. Si eux y arrivent un mardi matin, le transfert est démontré.")
  }

  await ecrire(pres, 'Quantinvo-Samaritaine')
}

main().catch((e) => { console.error(e); process.exit(1) })
