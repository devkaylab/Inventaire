// Deck Quantinvo pour La Samaritaine — fond blanc, charte « Papier » v1.1.
// node build-samaritaine.js                 → Quantinvo-Samaritaine.pptx        (Arial)
// FONT_MODE=brand node build-samaritaine.js → Quantinvo-Samaritaine-marque.pptx (Sora/Inter)
//
// L'angle de vente, fixé par Julien le 27 août 2026 : l'inventaire est RENDU
// aux équipes de vente — balisage compris —, chefs d'équipe en superviseurs et
// vendeurs en compteurs. L'Inventory Control fixe la règle, reçoit le rapport,
// valide et ajuste. Ne pas ramollir en « alléger la charge ».
//
// ⚠️ TROIS TEMPS, ET DANS CET ORDRE (1er septembre 2026, demande de Julien) :
// « aujourd'hui ça se passe comme ça » → « voici ce que ça demande » → « voici
// ce que Quantinvo change ». Les pages de réponse suivent l'ordre des
// irritants, et le problème est posé EN ENTIER avant qu'on parle du produit.
//
// ⚠️ LE DOCUMENT DE LA SAMARITAINE INSPIRE, IL NE SERT PLUS DE SQUELETTE.
// Deux versions successives ont été bâties dessus : une page qui le citait
// étape par étape, puis un tableau qui le rejouait ligne à ligne. Constat de
// Julien : « je voulais que tu t'en inspires, pas que tu fasses ton ppt
// autour que de ça ». La page « Aujourd'hui » décrit donc un inventaire
// tournant de grand magasin en général, et ne garde de leur procédure que
// des TOUCHES (la règle d'audit, le rapport d'inventaire), sans leur
// vocabulaire interne — « horlogerie et joaillerie », pas leur sigle. Ne pas
// réintroduire de citation étape par étape, ni de tableau miroir.
//
// ⚠️ NE PAS EXAGÉRER LES IRRITANTS. Les quatre retenus sont ceux que Julien a
// confirmés : le service mobilisé du début à la fin, la flotte de terminaux,
// le briefing avant chaque comptage, le balisage de la veille. Le
// rapprochement avec le stock théorique N'EN FAIT PAS PARTIE — une version
// précédente en avait fait la douleur principale, ce qui était faux : « c'est
// pas le truc le plus long et dur à faire ». Il se cite en demi-phrase, sans
// rang ni adjectif, et se montre côté Quantinvo comme un gain, platement.

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
  //
  // ⚠️ AUCUNE PHRASE SUR CETTE PAGE, et c'est une décision (Julien,
  // 1er septembre 2026). Elle a d'abord porté une citation signée, puis des
  // variantes centrées sur l'application : aucune ne tenait. Une page
  // d'entrée n'a rien à démontrer — la marque, l'écran, et le titre arrive
  // en page 2. Ne pas y remettre de baseline, de citation ni de signature :
  // ce qui n'est pas dit ne peut pas sonner faux.
  //
  // Le bloc de marque est centré en hauteur sur le téléphone : son milieu
  // optique tombe à H/2, comme celui de l'écran en face.
  {
    const s = pres.addSlide()
    s.background = { color: P.PAPER }
    const HT = 5.5
    const tel = await cadrer('lancement.png', { w: 3, h: 7 })
    d.ecranEntier(s, { x: W - M - HT * tel.ratio, y: (H - HT) / 2, h: HT, tel })
    const yb = 3.30
    s.addImage({ data: d.logo, x: M, y: yb, w: 0.62, h: 0.62 })
    s.addText('Quantinvo', { x: M + 0.78, y: yb - 0.03, w: 5, h: 0.68, fontFace: FONTD, fontSize: 24, bold: true, color: P.INK, margin: 0, valign: 'middle' })
    s.addShape('rect', { x: M, y: yb + 0.87, w: 2.6, h: 0.028, fill: { color: P.CYAN }, line: { color: P.CYAN, width: 0 } })
    s.addNotes("Laisser la page respirer deux secondes, sans commenter. On montre l'objet ; le titre et l'objet de la proposition arrivent à la page suivante.")
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

  // ════ 3. Aujourd'hui : le déroulement, en général ════
  //
  // ⚠️ Écrite pour un grand magasin en inventaire tournant, PAS comme une
  // citation de leur procédure. Leurs spécificités ne sont que des touches —
  // la règle d'audit, le rapport d'inventaire — et leur vocabulaire interne
  // n'y figure pas : « horlogerie et joaillerie », pas leur sigle maison.
  // Deux pages de mise en situation sur onze, et pas une de plus : le sujet
  // du deck est Quantinvo.
  {
    const s = pres.addSlide()
    d.entete(s, "Aujourd'hui")
    d.titre(s, 'Un inventaire tournant, aujourd’hui.', { h: 1.6 })
    d.para(s, "Le déroulement est le même partout, quel que soit l'outil de comptage.", { x: M, y: 3.1, w: COL, h: 1.0, size: 12, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['La veille.', "On balise les zones à inventorier : quelqu'un passe dans le magasin poser les étiquettes, rayon par rayon."],
      ['Le matin.', "On télécharge le stock théorique du jour, on ouvre la session, on prépare les terminaux un par un — charge, date, localisation — puis on briefe les compteurs sur le maniement du matériel et sur la procédure."],
      ['Pendant.', "Les équipes comptent. On déclenche l'audit selon la règle du magasin — 100 % sur l'horlogerie et la joaillerie, 30 % au moins ailleurs — et on fait recompter les zones en désaccord."],
      ['Après.', "On sort le rapport d'inventaire, on le recoupe avec le stock théorique, on fait valider selon la valeur de l'écart, puis on ajuste le stock."],
    ], { y: 1.5, h: 5.2, size: 13, gap: 16 })
    d.pied(s, 3, PIED)
    s.addNotes("Poser le décor, sans commenter : c'est leur journée, ils s'y reconnaissent. Ne pas s'attarder — cette page n'est pas le sujet, elle prépare la suivante.")
  }

  // ════ 4. Ce que cette journée demande ════
  //
  // ⚠️ Les quatre irritants confirmés par Julien, le service mobilisé en tête
  // et les trois autres comme ses causes. Le rapprochement avec le stock
  // théorique n'a PAS de rang ici : il tient dans la fin du premier alinéa,
  // sans adjectif. En faire la douleur principale serait faux.
  {
    const s = pres.addSlide()
    d.entete(s, 'Ce que ça demande')
    d.titreLarge(s, "Le comptage est fait par les équipes. Tout ce qui l’entoure est fait par vous.", { y: 1.25, size: 24 })
    d.alineas(s, [
      ['Un service mobilisé du début à la fin.', "Quelqu'un de l'Inventory Control prépare l'inventaire, reste disponible pendant le comptage, puis reprend le fichier pour le recouper avec le théorique."],
      ['Une flotte à préparer.', "Les terminaux se chargent, se connectent et se vérifient un par un avant chaque session — date, localisation. C'est un travail en soi, et il ne compte aucun article."],
      ['Un briefing à chaque fois.', "Le maniement du matériel s'explique à chaque équipe et à chaque inventaire. Les compteurs changent, la procédure se réapprend."],
      ['Un balisage la veille.', "Il faut mobiliser quelqu'un du magasin pour poser les étiquettes, avant même que le comptage ait commencé."],
    // Le titre prend deux lignes : les alinéas descendent d'autant, sinon le
    // premier vient toucher le « vous. » de la seconde.
    ], { x: M, y: 2.5, w: W - 2 * M, h: 3.0, size: 13, gap: 14 })
    d.encadre(s, 'Ce que ça coûte vraiment', "Ce n'est pas le comptage qui pèse — il est fait par les équipes de vente, et il se fait bien. C'est tout ce qu'il faut monter autour, à chaque fois, et qui interdit de compter souvent.", { x: M, y: 5.6, w: W - 2 * M, h: 1.15 })
    d.pied(s, 4, PIED)
    s.addNotes("La page du problème. Lire l'encadré à voix haute : c'est lui qui articule tout le deck — un inventaire tournant suppose de compter souvent, et ce qu'on vient d'énumérer est précisément ce qui l'en empêche. Ne pas en rajouter : ces quatre points suffisent, et ils sont vrais.")
  }

  // ════ 5. Transition ════
  //
  // ⚠️ Elle ANNONCE SANS LISTER (demande de Julien, 1er septembre 2026 :
  // « une transition qui annonce un peu la suite sans la répétition »).
  // Reprendre ici les quatre irritants, ou nommer les quatre réponses,
  // ferait de la page suivante une redite — le défaut que tout ce deck a
  // été récrit pour supprimer. Elle dit donc la MÉTHODE, pas le contenu :
  // le produit retire au lieu d'ajouter, et les pages qui suivent le
  // montrent dans le même ordre.
  //
  // Le vide fait le travail : ni capture, ni alinéas, ni encadré. C'est la
  // seule page du deck qui ne démontre rien, et c'est ce qui la rend
  // lisible comme une respiration entre le problème et la réponse.
  {
    const s = pres.addSlide()
    d.entete(s, 'Avec Quantinvo')
    s.addText("Quantinvo n’ajoute pas un outil de plus.\nIl retire ce qu’il faut monter autour d’un comptage.", {
      x: M, y: 2.75, w: W - 2 * M, h: 1.9, fontFace: FONTD, fontSize: 30, bold: true,
      color: P.DEEP, margin: 0, lineSpacingMultiple: 1.12,
    })
    d.para(s, "Les pages qui suivent le montrent, dans l'ordre où ces contraintes se présentent aujourd'hui.", { x: M, y: 4.75, w: W - 2 * M, h: 0.4, size: 13, color: P.SLATE })
    d.pied(s, 5, PIED)
    s.addNotes("La respiration du deck. Une phrase, un silence, on tourne. Ne rien ajouter à l'oral : si on se met à énumérer ce qui vient, la page suivante n'a plus rien à apprendre. La seconde ligne suffit à dire que les réponses arrivent dans l'ordre des contraintes.")
  }

  // ════ 6. La réponse, dans l'ordre des irritants ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Avec Quantinvo')
    d.titreLarge(s, 'Le chef d’équipe conduit. Ses vendeurs comptent.', { y: 1.25, size: 25 })
    d.para(s, "Une application sur les iPhone que vos équipes ont déjà, un tableau de bord pour celui qui pilote, un rapport à la fin. Rien à charger la veille, rien à briefer, aucune flotte à préparer.", { x: M, y: 1.95, w: W - 2 * M, h: 0.4, size: 12, color: P.SLATE })
    await troisEcrans(s, [
      { ecran: 'balises', titre: 'Il imprime ses balises', texte: "Une planche d'étiquettes numérotées, en PDF. Personne d'autre à mobiliser la veille.", fill: P.MIST },
      { ecran: 'comptage', titre: 'Ils comptent au rayon', texte: "Scanner l'étiquette, puis les articles. Le geste ne demande pas de briefing.", fill: P.TINT },
      { ecran: 'audit', titre: 'Il audite selon votre règle', texte: "La deuxième passe se lance du même téléphone, pendant que le comptage continue.", fill: P.MIST },
    ], { y: 2.5 })
    d.pied(s, 6, PIED)
    s.addNotes("Les trois cartes répondent aux irritants dans leur ordre d'apparition : le balisage, le briefing, puis la conduite. La flotte est réglée par la phrase du haut. Les écrans sont de vraies captures. Et l'Inventory Control ? Il n'a pas d'écran sur cette page — c'est le message ; le sien arrive deux pages plus loin.")
  }

  // ════ 7. Pendant le comptage : le suivi et l'arbitrage ════
  //
  // Fusion des deux anciennes pages « surveillance » et « audit » : elles
  // disaient toutes deux « le chef d'équipe voit et tranche en direct ». Les
  // deux captures, elles, montrent bien deux choses différentes — c'est ce
  // qui justifiait de garder les deux images, pas les deux pages.
  {
    const s = pres.addSlide()
    d.entete(s, 'Pendant le comptage')
    d.titreLarge(s, "Vous fixez la règle d'audit. Le floor l'applique.", { y: 1.25, size: 25 })
    d.para(s, "La règle d'audit reste la vôtre — 100 % sur l'horlogerie et la joaillerie, 30 % au moins ailleurs. Le désaccord entre les deux comptages ne s'attend plus dans un fichier : ils s'affichent côte à côte, l'écart en pièces et en valeur d'achat, et il se tranche pendant que le compteur est encore devant l'article. L'Inventory Control ouvre la même vue sur n'importe quel inventaire en cours, sans avoir à s'y tenir.", { x: M, y: 1.95, w: W - 2 * M, h: 0.85, size: 12.5 })

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
    d.pied(s, 7, PIED)
    s.addNotes("La réponse au premier irritant : le poste de surveillance n'est pas supprimé, il est distribué. Chaque chef d'équipe voit son rayon ; vous voyez tout sans avoir à rester dessus. Le recomptage ne disparaît pas — il se décide à chaud. Le suivi est agrégé, personne n'est suivi nominativement en direct : cela parle aux RH et au CSE d'une maison de cette taille.")
  }

  // ════ 8. Ce qui vous revient : le rapport ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Après le comptage')
    d.titre(s, 'Le rapport arrive déjà croisé.', { size: 26, h: 1.2 })
    d.para(s, "Il part du stock théorique, pas seulement de ce qui a été scanné : un article attendu et jamais trouvé y figure, avec son manque. Le recoupement n'est plus à faire.", { x: M, y: 2.85, w: COL, h: 1.5, size: 12.5 })
    d.para(s, "Export Excel en un clic. Restent la validation, selon la valeur de l'écart, et l'ajustement du stock.", { x: M, y: 4.35, w: COL, h: 1.2, size: 12.5 })
    const g = d.cadre(s, capRapport, { x: RX, y: 1.5, w: RW, h: 5.0 })
    d.legende(s, "Onglet Rapport, données d'essai.", { x: RX, y: 1.5 + g.h + 0.15, w: RW })
    d.pied(s, 8, PIED)
    s.addNotes("La page de l'Inventory Control : son travail commence ici. Ne pas survendre — le recoupement n'était pas le plus dur de la journée, c'est simplement une chose de moins à faire, et le circuit de validation ne change pas.")
  }

  // ════ 9. L'inventaire aléatoire ════
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
      ['Le comptage.', "Rien à sortir, rien à monter la veille : c'est ce qui permet à un inventaire ciblé de rester discret, au lieu d'être annoncé par sa préparation."],
      ['Le contrôle.', "L'écart se lit en direct. S'il dépasse votre seuil, l'Inventory Control reprend la main, et le rapport nourrit l'enquête."],
    ], { x: M, y: 2.75, w: W - 2 * M - wTel - 0.6, h: 3.9, size: 13, gap: 14 })
    d.pied(s, 9, PIED)
    s.addNotes("Leur document dit « en cours d'élaboration » : la page montre que l'outil le rend possible sans rien construire. La répartition est la même que pour le tournant — vous choisissez quoi et quand, le floor compte, vous contrôlez l'écart.")
  }

  // ════ 10. Pourquoi nous, plutôt que SmartCount ════
  //
  // ⚠️ JAMAIS de prix Zebra, ni sur la page ni en réponse à une question :
  // l'ancre SmartCount est confidentielle. L'encadré honnête reste — il fait
  // la moitié de la crédibilité de la page.
  //
  // ⚠️ La colonne « Ce qu'on ne vous promet pas » a été RETIRÉE le
  // 1er septembre 2026 (décision de Julien). Elle listait l'inventaire fiscal
  // certifié, la connexion à l'ERP, l'annuaire d'entreprise et Google Play.
  // Ces limites ne disparaissent pas du corpus : `build-dsi.js` les porte
  // pour l'audience qui les demande. Ne pas les réintroduire ici.
  {
    const s = pres.addSlide()
    d.entete(s, 'Pourquoi nous')
    d.titreLarge(s, 'Pourquoi Quantinvo, et pas SmartCount ?', { y: 1.25, size: 26 })
    d.alineas(s, [
      ['Le matériel.', "SmartCount repose sur une flotte de terminaux dédiés : à charger, configurer, vérifier avant chaque session — le travail qu'on cherche justement à ne plus faire. Quantinvo tourne sur les iPhone que vos équipes ont déjà, et une douchette Bluetooth s'y branche pour les gros volumes."],
      ['Le fichier.', "SmartCount rend un rapport de variance, à recouper ensuite avec le stock théorique. Quantinvo rend ce croisement déjà fait : l'attendu, le compté, le non-compté, l'écart en valeur."],
      ["L'éditeur.", "SmartCount est un module au catalogue d'un géant du matériel. Quantinvo ne fait qu'une chose — l'inventaire — et la personne qui l'a dessiné répond elle-même à vos questions."],
    ], { x: M, y: 2.2, w: W - 2 * M, h: 2.6, size: 13, gap: 16 })
    d.encadre(s, 'Pour être honnête', "Un terminal durci encaisse mieux les chocs qu'un téléphone, et si votre flotte est déjà amortie, l'argument du matériel pèse moins. Ce qui ne bouge pas : un outil que le floor prend en main sans briefing, et un fichier qui arrive déjà croisé.", { x: M, y: 4.9, w: W - 2 * M, h: 1.15 })
    d.pied(s, 10, PIED)
    s.addNotes("L'argument décisif est le premier : un outil expert suppose un service expert pour le servir, ce qui est incompatible avec le transfert au floor. Ne jamais citer de prix Zebra, même en réponse à une question. Et lire l'encadré : c'est lui qui rend le reste crédible. Un dossier technique séparé existe pour la DSI — le proposer ici, il porte les limites du produit.")
  }

  // ════ 11. L'offre ════
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
    d.pied(s, 11, PIED)
    s.addNotes("Le palier se choisit sur le nombre de personnes qui comptent EN MÊME TEMPS, pas sur l'effectif : un floor de cent vendeurs dont vingt comptent le mardi matin relève d'Advanced. Le dépassement ne bloque jamais un comptage, il se règle au renouvellement. Au-delà de cent appareils sur un même magasin, ou pour plusieurs magasins, on établit un devis.")
  }

  // ════ 12. Pour finir ════
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
