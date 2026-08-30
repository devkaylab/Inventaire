// Guide de prise en main Quantinvo, superviseurs et compteurs.
// node build-prise-en-main.js                 → Quantinvo-prise-en-main.pptx
// FONT_MODE=brand node build-prise-en-main.js → Quantinvo-prise-en-main-marque.pptx
//
// Les écrans montrés sont de VRAIES captures, prises au simulateur sur un
// compte d'essai (Maison Oberlin / Oberlin Lyon), rangées dans `captures/`.
// Recette et liste dans le LISEZMOI. Les libellés cités dans le texte sont
// ceux du code : si l'un change dans l'application, il change ici.

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer } = require('./charte')

async function main() {
  const d = await preparer({ titre: 'Quantinvo — prise en main' })
  const { pres } = d
  const PIED = 'Quantinvo · prise en main · août 2026'

  // ── Captures du tableau de bord (site), recadrées hors en-tête ──
  // ⚠️ Recadrages calés sur la mise en page AU RAIL (30 août 2026) : ceux
  // d'avant visaient la barre du haut et décalaient les trois captures.
  const capSuivi = await capture('light-desktop-suivi.png', { left: 104, top: 155, width: 1330, height: 505 })
  const capEcarts = await capture('light-desktop-ecarts.png', { left: 448, top: 375, width: 964, height: 370 })
  const capRapport = await capture('light-desktop-rapport.png', { left: 448, top: 160, width: 964, height: 660 })

  // ── Captures de l'application, dans un téléphone dessiné ──
  // ⚠️ Le recadrage se calcule à partir de la place réellement disponible,
  // jamais d'une fraction fixée d'avance : la hauteur d'une carte dépend du
  // texte posé au-dessus, et un téléphone taillé pour une autre hauteur
  // débordait de sa carte et de la diapositive.
  const F = {
    accueilSup: 'accueil-superviseur.png', nouvel: 'nouvel-inventaire.png',
    zones: 'zones.png', importer: 'importer.png', fiche: 'fiche-inventaire.png',
    inventaireSup: 'inventaire-superviseur.png', equipe: 'mon-equipe.png',
    outils: 'boite-a-outils.png', balises: 'creer-balises.png',
    membre: 'ajouter-membre.png', compte: 'mon-compte.png',
    bienvenue: 'bienvenue-compteur.png', accueilCpt: 'accueil-compteur.png',
    inventaireCpt: 'inventaire-compteur.png', scanBalise: 'scanner-balise.png',
    comptage: 'comptage.png', terminee: 'balise-terminee.png', audit: 'audit.png',
    horsPlage: 'balise-hors-plage.png', detail: 'balises-comptees-detail.png',
  }
  const BAS = H - 0.72   // ligne où les cartes s'arrêtent, au-dessus du pied
  const MARGE = 0.34     // retrait du téléphone dans sa carte

  /**
   * Trois écrans expliqués côte à côte : titre, une phrase, puis le téléphone
   * dans une carte qu'il déborde par le bas.
   */
  async function troisEcrans(s, cartes, { y = 2.2 } = {}) {
    const gap = 0.3
    const cw = (W - 2 * M - gap * (cartes.length - 1)) / cartes.length
    // Titre (0,42) + deux lignes de texte (0,68) : la carte prend le reste.
    const hCarte = BAS - (y + 0.42 + 0.68)
    for (const [i, c] of cartes.entries()) {
      const tel = await cadrer(F[c.ecran], { w: cw - 2 * MARGE, h: hCarte })
      d.ecran(s, { x: M + i * (cw + gap), y, w: cw, titre: c.titre, texte: c.texte, tel, fill: c.fill, marge: MARGE, bas: BAS })
    }
  }

  /** Un téléphone à droite dans sa carte, le texte de la page à gauche. */
  async function grandEcran(s, { titre, texte, ecran, fill, y = 1.5, w = 3.5 }) {
    const hTexte = 0.42 + (texte ? 0.68 : 0)
    const tel = await cadrer(F[ecran], { w: w - 2 * MARGE, h: BAS - (y + hTexte) })
    d.ecran(s, { x: W - M - w, y, w, titre, texte, tel, fill, marge: MARGE, bas: BAS })
  }

  /** Téléphone entier, pour un écran dont l'essentiel est en bas. */
  async function ecranEntier(s, { ecran, legende, x = W - M - 2.4, y = 1.45, h = 4.9 }) {
    const tel = await cadrer(F[ecran], { w: 1, h: 99 })   // pas de coupe
    d.ecranEntier(s, { x, y, h, tel, legende })
  }

  /** Intercalaire de partie : une page qui dit à qui la suite s'adresse. */
  function partie(s, n, titre, texte, qui) {
    d.entete(s, qui)
    s.addText(n, { x: M, y: 2.1, w: 3, h: 1.3, fontFace: FONTD, fontSize: 72, bold: true, color: P.TINT, margin: 0 })
    s.addText(titre, { x: M, y: 3.3, w: 8.6, h: 0.9, fontFace: FONTD, fontSize: 34, bold: true, color: P.DEEP, margin: 0 })
    s.addText(texte, { x: M, y: 4.3, w: 8.2, h: 1.5, fontFace: FONT, fontSize: 14, color: P.INK2, margin: 0, lineSpacingMultiple: 1.2 })
  }

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Guide de prise en main',
      titre: 'Compter avec Quantinvo. Une demi-heure de lecture, puis on y va.',
      sousTitre: "Pour les superviseurs, qui préparent et pilotent. Pour les compteurs, qui scannent. Les écrans de ce guide sont ceux de l'application, tels quels.",
      bas: 'Devkaylab  ·  août 2026  ·  contact@quantinvo.com',
    })
    s.addNotes("Ce guide se remet au client après la signature, avec le plan de déploiement. La partie compteur tient en cinq pages : c'est voulu, elle peut être imprimée seule.")
  }

  // ════ 2. Trois rôles ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Avant de commencer')
    d.titre(s, 'Trois rôles. Chacun voit ce qui le concerne, et rien d’autre.')
    d.para(s, "Le rôle est fixé à l'invitation. Un compteur n'a pas accès au site ; un superviseur a les deux.", { x: M, y: 3.8, w: COL, h: 1.0, size: 12, italic: true, color: P.SLATE })
    let y = 1.5
    const roles = [
      ["Administrateur d'entreprise", 'Sur le site', "Il voit tous les magasins, toutes les personnes et tous les inventaires de son entreprise. Il invite les superviseurs, ajoute et retire des comptes, lit le journal. C'est lui qu'on appelle quand quelqu'un arrive ou part."],
      ['Superviseur', "Sur le site et dans l'application", "Il prépare l'inventaire (balises, fichiers, équipe), le suit pendant qu'il se déroule, arbitre les écarts et clôture. Il peut compter lui-même. Ce guide lui consacre sept pages."],
      ['Compteur', "Dans l'application seulement", "Il ouvre l'inventaire sur son téléphone, scanne la balise du rayon, puis les articles. Il peut aussi auditer, c'est-à-dire recompter une zone déjà comptée par quelqu'un d'autre. Cinq pages lui suffisent."],
    ]
    for (const [h4, ou, txt] of roles) {
      s.addText(h4, { x: RX, y, w: 4, h: 0.34, fontFace: FONTD, fontSize: 14, bold: true, color: P.INK, margin: 0 })
      s.addText(ou, { x: RX + 4, y: y + 0.04, w: RW - 4, h: 0.3, fontFace: FONT, fontSize: 10.5, color: P.ACCENT, align: 'right', margin: 0 })
      s.addText(txt, { x: RX, y: y + 0.4, w: RW, h: 1.0, fontFace: FONT, fontSize: 12, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
      y += 1.55
      d.filet(s, RX, y - 0.18, RW)
    }
    d.pied(s, 2, PIED)
    s.addNotes("Un administrateur d'entreprise est aussi superviseur de tous les magasins. Dans une petite structure, c'est la même personne.")
  }

  // ════ 3. Premier accès ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Avant de commencer')
    d.titreLarge(s, 'Votre premier accès. Personne ne s’inscrit : on vous invite.')
    await troisEcrans(s, [
      { titre: '1 — L’e-mail, puis « Bienvenue »', texte: "Le lien est personnel. Vous vérifiez votre nom, puis choisissez un mot de passe de douze caractères.", ecran: 'bienvenue' },
      { titre: '2 — L’application se connecte', texte: "Elle arrive par le catalogue de votre entreprise. Adresse e-mail et mot de passe, rien d'autre.", ecran: 'accueilCpt' },
      { titre: '3 — Si vous le voulez, un second code', texte: "« Mon compte » active la double authentification. Sans code de secours : voyez votre administrateur.", ecran: 'compte' },
    ])
    d.pied(s, 3, PIED)
    s.addNotes("La règle de mot de passe est celle du serveur : inutile de la contourner, la saisie est refusée. Le dépannage d'un second facteur perdu passe par nous, via l'administrateur.")
  }

  // ════ 4. Partie superviseur ════
  {
    const s = pres.addSlide()
    partie(s, '1', 'Préparer et piloter', "La partie du superviseur. Une fois pour toutes : les balises et l'équipe. Puis, à chaque inventaire : le créer, importer les fichiers, suivre, arbitrer, clôturer.", 'Superviseur')
    d.pied(s, 4, PIED)
  }

  // ════ 5. Une fois pour toutes ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · une fois pour toutes')
    d.titreLarge(s, 'Deux choses à faire une seule fois : les balises, l’équipe.')
    await troisEcrans(s, [
      { titre: 'La boîte à outils', texte: "Imprimez, collez, indiquez. C'est de là que part la planche d'étiquettes.", ecran: 'outils' },
      { titre: 'Choisir la série, imprimer', texte: "Numérotation, premier numéro, nombre. Le PDF sort sur planche Avery L7160, 21 par page.", ecran: 'balises' },
      { titre: 'Constituer son équipe', texte: "Prénom, nom, adresse. L'invitation part tout de suite.", ecran: 'membre' },
    ])
    d.pied(s, 5, PIED)
    s.addNotes("La planche se dessine sur l'appareil et part à l'impression : rien n'est enregistré côté serveur. Changer de téléphone n'invalide pas les balises déjà collées, il faut seulement réimprimer si on en veut d'autres.")
  }

  // ════ 6. Coller les balises ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · une fois pour toutes')
    d.titre(s, 'Où coller les balises, et combien.')
    d.alineas(s, [
      ['Une par rayon,', "à hauteur d'yeux, au début du linéaire. Dans une réserve, une par travée ou par étagère."],
      ['Dans l’ordre des numéros.', "C'est ce qui rend les plages lisibles : « Textile femme, 1 à 12 », « Réserve, 25 à 36 »."],
      ['Trop plutôt que pas assez.', "Une zone trop grande se compte mal à deux, et l'audit devient un second inventaire complet. Une balise coûte une étiquette."],
      ['Elles restent en place.', "Elles ne portent ni date ni inventaire : la même planche sert en janvier et en juin. On ne réimprime que pour agrandir la série."],
    ], { x: M, y: 2.95, w: 7.9, h: 3.6, size: 12, gap: 11 })
    const g = d.cadre(s, capSuivi, { x: RX - 0.6, y: 1.5, w: RW + 0.6 })
    d.legende(s, "Une fois collées et affectées, les balises deviennent l'avancement que le superviseur suit sur le site.", { x: RX - 0.6, y: 1.5 + g.h + 0.15, w: RW + 0.6 })
    d.pied(s, 6, PIED)
    s.addNotes("La question qui revient : « combien de balises ? » Réponse de terrain : une par rayon, et on ne regrette jamais d'en avoir mis trop.")
  }

  // ════ 7. Créer et préparer ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · à chaque inventaire')
    d.titreLarge(s, 'Créer un inventaire prend une minute. Le préparer, dix.')
    await troisEcrans(s, [
      { titre: '1 — L’inventaire', texte: "Un nom, un magasin, un code d'accès. « Utiliser des zones » reste activé : c'est ce qui permet les balises.", ecran: 'nouvel' },
      { titre: '2 — Les zones', texte: "Une plage par emplacement : « Textile femme, 1 à 12 ». Les compteurs verront ce nom en scannant.", ecran: 'zones' },
      { titre: '3 — Les fichiers', texte: "Référentiel et stock théorique, en CSV ou Excel, tels qu'ils sortent de votre système.", ecran: 'importer' },
    ])
    d.pied(s, 7, PIED)
    s.addNotes("Le code d'accès sert à faire entrer un renfort de dernière minute sans l'inviter nommément. Il s'affiche sur la fiche de l'inventaire, avec un bouton de partage.")
  }

  // ════ 8. Les fichiers ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · à chaque inventaire')
    d.titre(s, 'Deux fichiers, et ce que chacun change.')
    d.alineas(s, [
      ['Le référentiel articles.', "Code, libellé, prix d'achat. Il permet de reconnaître ce qu'on scanne : sans lui, chaque article scanné sort en « inconnu »."],
      ['Le stock théorique.', "Code et quantité attendue. C'est lui qui permet de calculer les écarts — et de révéler la démarque."],
      ['Ce que le second change.', "Avec lui, le rapport part de l'attendu : un article jamais scanné apparaît « Non compté », avec son manque. Sans lui, le rapport ne montre que ce qui a été compté."],
    ], { x: M, y: 2.95, w: 7.9, h: 3.0, size: 12, gap: 11 })
    d.encadre(s, 'Vos colonnes sont reconnues', "SKU, Code article, Référence · EAN, Code-barres, GTIN, Gencod · Quantité, Qté, Stock. Majuscules, accents et séparateurs n'ont pas d'importance. Si une colonne manque, l'écran le dit avant d'importer.", { x: M, y: 6.05, w: COL + 0.6, h: 0.95, size: 10.5 })
    const g = d.cadre(s, capRapport, { x: RX, y: 1.5, w: RW, h: 5.0 })
    d.legende(s, "Le rapport, sur le site : la ligne « Non compté » n'existe que si le stock théorique a été importé.", { x: RX, y: 1.5 + g.h + 0.15, w: RW })
    d.pied(s, 8, PIED)
    s.addNotes("Le message clé : on n'a pas à retravailler ses fichiers. Le second : le stock théorique est ce qui fait foi pour le rapport.")
  }

  // ════ 9. Pendant ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · pendant')
    d.titreLarge(s, 'Pendant l’inventaire, deux écrans et un geste.')
    await troisEcrans(s, [
      { titre: 'La progression, en un chiffre', texte: "Comptées, auditées, et ce qui reste. Le bandeau ambre mène aux emplacements concernés.", ecran: 'inventaireSup' },
      { titre: 'La fiche de l’inventaire', texte: "Numéro, code d'accès et partage, membres. Le bouton « i » l'ouvre de n'importe où.", ecran: 'fiche' },
      { titre: 'Qui est dans l’équipe', texte: "« Mot de passe à créer » veut dire : invitée, pas encore connectée. C'est un état, pas une erreur.", ecran: 'equipe' },
    ])
    d.pied(s, 9, PIED)
    s.addNotes("Le suivi est agrégé par construction. Si un compteur demande « est-ce qu'on me voit ? », la réponse est : on voit qu'un appareil compte, pas lequel.")
  }

  // ════ 10. Les écarts ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · pendant et après')
    d.titreLarge(s, "Auditer, puis arbitrer. L'écart se règle à chaud.")
    d.para(s, "L'audit est un second comptage d'une zone déjà comptée, par une autre personne. Quand la balise auditée est clôturée, chaque article dont les deux quantités diffèrent apparaît ici. Vous retenez la quantité du compteur, celle de l'auditeur, ou une troisième que vous avez vérifiée vous-même.", { x: M, y: 2.3, w: W - 2 * M, h: 0.85, size: 12.5 })
    const g = d.cadre(s, capEcarts, { x: M + 1.6, y: 3.25, w: W - 2 * M - 3.2 })
    d.legende(s, "Onglet Écarts d'audit. Tant qu'un écart n'est pas arbitré, c'est la quantité de l'auditeur qui part au rapport.", { x: M + 1.6, y: 3.25 + g.h + 0.15, w: RW + 2 })
    d.pied(s, 10, PIED)
    s.addNotes("La comparaison n'a lieu que dans une balise dont l'audit est clôturé : sinon tout article pas encore repassé ressortirait à tort en écart.")
  }

  // ════ 11. Clôturer ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · après')
    d.titre(s, 'Le rapport, puis la clôture.')
    d.alineas(s, [
      ['Télécharger.', "Un fichier Excel : résultats par article, écarts en pièces et en valeur d'achat, détail par zone. La quantité retenue suit une règle simple — l'arbitrage, sinon l'auditeur, sinon le compteur."],
      ['Regarder « Non compté » d’abord.', "Ce sont les articles attendus que personne n'a scannés. C'est là que se lit la démarque."],
      ['Clôturer.', "Plus aucun scan n'est accepté, le rapport ne bouge plus. Tout superviseur de l'inventaire peut clôturer ; seul son créateur, ou l'administrateur d'entreprise, peut le rouvrir ou le supprimer."],
      ['Supprimer.', "Efface comptages, fichiers, audits et membres. La confirmation nomme l'inventaire ; lisez-la."],
    ], { x: M, y: 2.95, w: 7.9, h: 3.6, size: 12, gap: 11 })
    await grandEcran(s, {
      titre: 'Les gestes de fin',
      texte: "Écarts, rapport, clôture, suppression : tous sur la même page, dans cet ordre.",
      ecran: 'inventaireSup',
    })
    d.pied(s, 11, PIED)
    s.addNotes("Tant qu'un écart n'est pas arbitré, le rapport l'annonce en bandeau. Trancher avant d'exporter.")
  }

  // ════ 12. Partie compteur ════
  {
    const s = pres.addSlide()
    partie(s, '2', 'Compter', "La partie du compteur. Cinq pages, à imprimer seules si on veut : rejoindre, les trois gestes, l'audit, et quoi faire quand quelque chose ne se passe pas comme prévu.", 'Compteur')
    d.pied(s, 12, PIED)
  }

  // ════ 13. Rejoindre ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Compteur')
    d.titre(s, "Rejoindre un inventaire. La première façon suffit presque toujours.")
    d.alineas(s, [
      ['On vous a ajouté.', "L'inventaire est dans « Mes inventaires » dès l'ouverture de l'application, et vous avez reçu une notification. Touchez-le."],
      ['On vous a donné un numéro et un code.', "Le formulaire du bas : le numéro (INV-…), le code. C'est le cas d'un renfort de dernière minute."],
      ['Ensuite.', "L'écran de l'inventaire propose « Compter des articles », « Auditer des articles », et « Quitter l'inventaire ». Quitter ne supprime rien de ce que vous avez compté."],
    ], { x: M, y: 2.95, w: 7.9, h: 3.2, size: 12, gap: 11 })
    await grandEcran(s, {
      titre: 'Votre accueil',
      texte: "Les inventaires où vous êtes attendu, et la porte d'entrée pour les autres.",
      ecran: 'accueilCpt',
    })
    d.pied(s, 13, PIED)
    s.addNotes("Le numéro et le code sont affichés sur la fiche de l'inventaire côté superviseur, avec un bouton « Partager les identifiants ».")
  }

  // ════ 14. Trois gestes ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Compteur')
    d.titreLarge(s, 'Compter, en trois gestes. Puis la balise suivante.')
    let y = 2.35
    const gestes = [
      ['Scannez la balise du rayon', "Elle ouvre la zone. Tant qu'elle est ouverte, tout ce que vous scannez compte ici. Vous pouvez aussi saisir son numéro au clavier."],
      ['Scannez les articles', "Le scan est automatique. Un article scanné trois fois compte trois ; pour une pile, scannez une fois et ajustez avec + et −. Pas de code lisible ? L'onglet « Manuel »."],
      ['Clôturez la balise', "Le bouton rouge, en haut de l'écran ou en bas de la liste. Il dit « j'ai fini ici » : la zone passe en comptée chez le superviseur, et vous passez au rayon suivant."],
    ]
    gestes.forEach(([h4, txt], i) => {
      d.numero(s, i + 1, M, y + 0.02, 0.4)
      s.addText(h4, { x: M + 0.56, y, w: 6.4, h: 0.36, fontFace: FONTD, fontSize: 15, bold: true, color: P.DEEP, margin: 0 })
      s.addText(txt, { x: M + 0.56, y: y + 0.4, w: 6.4, h: 0.9, fontFace: FONT, fontSize: 11.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
      y += 1.45
    })
    // Un seul écran porte les trois gestes : la balise ouverte en haut, la
    // liste au milieu, la clôture en bas. Entier, donc, plutôt que débordant.
    await ecranEntier(s, { ecran: 'comptage', legende: "L'écran de comptage, balise 6 ouverte." })
    d.pied(s, 14, PIED)
    s.addNotes("Le geste qu'on oublie le plus : clôturer la balise. Sans lui, la zone reste « en cours » sur le tableau de bord et l'audit ne peut pas se comparer.")
  }

  // ════ 14 bis. La balise est finie ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Compteur')
    d.titre(s, 'Ce que vous voyez quand une balise est finie.')
    d.alineas(s, [
      ['Les chiffres, tout de suite.', "Pièces et références de la balise que vous venez de fermer. C'est la vérification la plus simple : si le compte vous surprend, vous rouvrez la balise et vous revoyez le rayon."],
      ['« déjà sur le tableau de bord ».', "La phrase est là pour ça : ce que vous venez de compter est parti. Le superviseur n'a rien à demander."],
      ['Puis la suivante.', "L'écran revient de lui-même sur la lecture de balise. Vous marchez jusqu'au rayon d'après et vous scannez."],
    ], { x: M, y: 3.0, w: 7.9, h: 3.4, size: 12, gap: 11 })
    await ecranEntier(s, { ecran: 'terminee', legende: "La feuille de fin de balise." })
    d.pied(s, 15, PIED)
    s.addNotes("Cette feuille n'apparaît qu'à la première clôture, par appareil et par personne : c'est un repère, pas une confirmation à chaque fois.")
  }

  // ════ 15. L'audit ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Compteur')
    d.titre(s, 'Auditer : les mêmes gestes, en ambre.')
    d.alineas(s, [
      ["C'est un second passage.", "Vous recomptez une zone que quelqu'un d'autre a déjà comptée. Le superviseur vous dit laquelle et quand."],
      ["L'écran change de couleur.", "Ambre au lieu de violet, du bandeau au bouton. C'est le seul repère dont on a besoin pour savoir dans quel passage on est."],
      ['Vous ne voyez pas le premier comptage.', "Et c'est voulu : un second comptage influencé ne vérifie rien. L'écart se calcule après, sur le tableau de bord."],
      ['Vous clôturez pareil.', "La balise passe en auditée, et les articles dont les deux comptages diffèrent remontent au superviseur."],
    ], { x: M, y: 2.95, w: 7.9, h: 3.6, size: 12, gap: 11 })
    await grandEcran(s, {
      titre: "L'écran d'audit",
      texte: "Même disposition, même bouton de clôture — seule la couleur dit le passage.",
      ecran: 'audit', fill: 'FDF3E0',
    })
    d.pied(s, 16, PIED)
    s.addNotes("Le point à dire à voix haute avant un audit : ne pas montrer le premier comptage à l'auditeur. C'est ce qui fait qu'un écart veut dire quelque chose.")
  }

  // ════ 16. Vérifier ce qui est parti ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Compteur')
    d.titreLarge(s, 'Vérifier que tout est bien parti.')
    await troisEcrans(s, [
      { titre: 'Vos totaux, en haut', texte: "Pièces comptées et auditées, à jour à chaque retour du scanner. Si le chiffre bouge, c'est arrivé.", ecran: 'inventaireCpt' },
      { titre: 'Le détail, balise par balise', texte: "Touchez une balise : les articles, leur code, leur quantité, telles qu'elles sont arrivées.", ecran: 'detail' },
      { titre: 'Hors ligne, rien n’est perdu', texte: "En réserve, les scans attendent sur l'appareil et partent seuls au retour du réseau.", ecran: 'scanBalise' },
    ])
    d.pied(s, 17, PIED)
    s.addNotes("Insister : ne pas désinstaller l'application et ne pas laisser effacer le téléphone tant que le bandeau signale des balises en attente. C'est le seul moyen de perdre du travail.")
  }

  // ════ 17. Quand ça coince ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Compteur')
    d.titre(s, 'Quand ça ne se passe pas comme prévu.')
    let y = 2.9
    const cas = [
      ['« Balise hors plage »', "Le numéro n'est dans aucune plage. Si l'étiquette est bien collée dans ce magasin, touchez « Ajouter » : la zone est créée, le superviseur la nommera. Sinon, vérifiez le numéro."],
      ['« Article inconnu »', "Il n'est pas dans le référentiel. Ajoutez-le avec un libellé : il entrera dans le rapport avec un prix d'achat à zéro, que le superviseur complétera."],
      ['Plus de réseau', "Continuez à compter. Tout part au retour du réseau. Ne désinstallez pas l'application, et ne laissez pas effacer le téléphone avant que ce soit parti."],
      ['Vous changez de téléphone', "Reconnectez-vous : ce qui est déjà parti est sur le serveur. Ce qui attendait sur l'ancien partira quand il retrouvera du réseau."],
    ]
    for (const [h4, txt] of cas) {
      s.addText(h4, { x: M, y, w: 7.9, h: 0.4, fontFace: FONTD, fontSize: 13, bold: true, color: P.INK, margin: 0 })
      s.addText(txt, { x: M, y: y + 0.36, w: 7.9, h: 0.75, fontFace: FONT, fontSize: 11, color: P.INK2, margin: 0, lineSpacingMultiple: 1.12 })
      y += 1.02
    }
    await grandEcran(s, {
      titre: 'Une balise inconnue se rattrape',
      texte: "L'alerte ne bloque pas : elle propose d'ajouter la balise et de compter tout de suite.",
      ecran: 'horsPlage',
    })
    d.pied(s, 18, PIED)
    s.addNotes("Hors ligne, l'ajout d'une balise inconnue n'est pas proposé : l'échec se découvre à la synchronisation. À dire si le magasin travaille en zone sans réseau.")
  }

  // ════ 18. Le matin de l'inventaire ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: "Le matin de l'inventaire.",
      texte: "Les balises sont collées et affectées. Les deux fichiers sont importés. L'équipe est invitée et chacun s'est connecté une fois. Les téléphones sont chargés, le réseau a été essayé en réserve. Le superviseur a le tableau de bord ouvert. On peut compter.",
      contact: 'Une question : contact@quantinvo.com',
      bas: 'Quantinvo, par Devkaylab. L’outil d’inventaire pour le commerce.',
    })
    s.addNotes("La liste à lire à voix haute la veille. Si un point manque, c'est celui-là qui fera perdre une heure le lendemain.")
  }

  await ecrire(pres, 'Quantinvo-prise-en-main')
}

main().catch((e) => { console.error(e); process.exit(1) })
