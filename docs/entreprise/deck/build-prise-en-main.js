// Guide de prise en main Quantinvo, superviseurs et compteurs.
// node build-prise-en-main.js                 → Quantinvo-prise-en-main.pptx
// FONT_MODE=brand node build-prise-en-main.js → Quantinvo-prise-en-main-marque.pptx
//
// Les écrans décrits sont ceux du code : `src/app/(employee)`, `(supervisor)`,
// `(compte)` et `web/app/dashboard`. Si un libellé change dans l'application,
// il change ici.

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture } = require('./charte')

async function main() {
  const d = await preparer({ titre: 'Quantinvo — prise en main' })
  const { pres } = d
  const PIED = 'Quantinvo · prise en main · août 2026'

  const capCreation = await capture('light-desktop-creation.png', { left: 384, top: 235, width: 672, height: 613 })
  const capSuivi = await capture('light-desktop-suivi.png', { left: 104, top: 254, width: 1232, height: 446 })
  const capEcarts = await capture('light-desktop-ecarts.png', { left: 444, top: 440, width: 892, height: 340 })
  const capRapport = await capture('light-desktop-rapport.png', { left: 444, top: 250, width: 892, height: 600 })

  // Étapes numérotées, empilées, dans la colonne de droite.
  function etapes(s, items, { x = RX, y = 1.5, w = RW, size = 12, step = 1.0 } = {}) {
    items.forEach(([h4, txt], i) => {
      d.numero(s, i + 1, x, y + 0.02, 0.36)
      s.addText(h4, { x: x + 0.55, y, w: w - 0.55, h: 0.32, fontFace: FONTD, fontSize: 13, bold: true, color: P.INK, margin: 0 })
      s.addText(txt, { x: x + 0.55, y: y + 0.36, w: w - 0.55, h: step - 0.4, fontFace: FONT, fontSize: size, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
      y += step
    })
  }

  // Intercalaire de partie : une page presque vide, qui dit à qui elle s'adresse.
  function partie(s, n, titre, texte, qui) {
    s.background = { color: P.PAPER }
    d.entete(s, qui)
    s.addText(n, { x: M, y: 2.2, w: 3, h: 1.2, fontFace: FONTD, fontSize: 72, bold: true, color: P.TINT, margin: 0 })
    s.addText(titre, { x: M, y: 3.35, w: 9, h: 0.9, fontFace: FONTD, fontSize: 34, bold: true, color: P.DEEP, margin: 0 })
    s.addText(texte, { x: M, y: 4.35, w: 8.5, h: 1.4, fontFace: FONT, fontSize: 14, color: P.INK2, margin: 0, lineSpacingMultiple: 1.2 })
  }

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Guide de prise en main',
      titre: 'Compter avec Quantinvo. Une demi-heure de lecture, puis on y va.',
      sousTitre: "Pour les superviseurs, qui préparent et pilotent. Pour les compteurs, qui scannent. Chacun sa partie, et une page d'avance pour savoir ce que fait l'autre.",
      bas: 'Devkaylab  ·  août 2026  ·  contact@quantinvo.com',
    })
    s.addNotes("Ce guide se remet au client après la signature, avec le plan de déploiement. La partie compteur tient en trois pages : c'est voulu, elle peut être imprimée seule.")
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
      ['Superviseur', "Sur le site et dans l'application", "Il prépare l'inventaire (balises, fichiers, équipe), le suit pendant qu'il se déroule, arbitre les écarts et clôture. Il peut compter lui-même. Ce guide lui consacre six pages."],
      ['Compteur', "Dans l'application seulement", "Il ouvre l'inventaire sur son téléphone, scanne la balise du rayon, puis les articles. Il peut aussi auditer, c'est-à-dire recompter une zone déjà comptée par quelqu'un d'autre. Trois pages lui suffisent."],
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
    d.titre(s, 'Votre premier accès. Personne ne s’inscrit : on vous invite.')
    d.para(s, "Si vous n'avez pas reçu d'e-mail, regardez dans les indésirables, puis demandez à la personne qui vous a ajouté : elle voit sur son écran si l'invitation est partie.", { x: M, y: 3.8, w: COL, h: 1.4, size: 12 })
    etapes(s, [
      ["L'e-mail d'invitation", "Il vient de Quantinvo et vous dit qui vous a ajouté. Le lien est personnel : ne le transférez pas."],
      ['La page « Bienvenue »', "Vérifiez votre prénom et votre nom, puis choisissez un mot de passe : douze caractères au moins, avec une majuscule, une minuscule, un chiffre et un symbole. Un mot de passe connu des fuites publiques est refusé."],
      ["L'application", "Elle arrive par le catalogue d'applications de votre entreprise, ou par l'App Store si votre entreprise n'en a pas. Connectez-vous avec votre adresse e-mail et votre mot de passe."],
      ['Si vous voulez, la double authentification', "Depuis « Mon compte », dans l'application ou sur le site. Un code à usage unique vous sera demandé à chaque connexion. Notez bien : il n'y a pas de code de secours, un téléphone perdu se dépanne auprès de votre administrateur."],
    ], { step: 1.2, size: 11.5 })
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
    d.titre(s, 'Deux choses à faire une seule fois : les balises, l’équipe.')
    d.para(s, "Une balise, c'est une étiquette avec un code QR et un numéro, collée à l'entrée d'un rayon ou d'une travée. Le compteur la scanne pour dire « je compte ici ». Une fois collées, elles servent à tous les inventaires suivants.", { x: M, y: 3.8, w: COL, h: 1.8, size: 12 })
    d.alineas(s, [
      ['Imprimer les balises.', "Boîte à outils, « Créer et imprimer des balises ». Choisissez une numérotation (1, 2, 3… ou à quatre chiffres), un premier numéro, un nombre. Vous obtenez un PDF sur planche d'étiquettes standard (Avery L7160, 21 par page), à imprimer sur une imprimante ordinaire."],
      ['Les coller.', "Une par rayon, à hauteur d'yeux, au début du linéaire. Dans une réserve, une par travée ou par étagère. Trop de balises vaut mieux que pas assez : une zone trop grande se compte mal à deux."],
      ['Constituer son équipe.', "Mon équipe, « Ajouter un compteur » : prénom, nom, adresse e-mail, et le ou les magasins. La personne reçoit son invitation tout de suite et apparaît dans la liste avec la mention « Mot de passe à créer » tant qu'elle n'a pas ouvert l'application."],
    ], { y: 1.5, h: 5.2, size: 12, gap: 11 })
    d.pied(s, 5, PIED)
    s.addNotes("La planche se dessine sur le téléphone ou l'ordinateur et part à l'impression : rien n'est enregistré côté serveur. Si on change de téléphone, on réimprime, les balises collées restent valables.")
  }

  // ════ 6. Créer un inventaire ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · à chaque inventaire')
    d.titre(s, 'Créer un inventaire prend une minute. Le préparer, dix.', { size: 24, h: 1.5 })
    d.alineas(s, [
      ['Un nom', "pour le reconnaître dans la liste. Le numéro (INV-…) est généré tout seul."],
      ['Un magasin', "parmi les vôtres."],
      ["Un code d'accès", "de quatre caractères au moins. Avec le numéro, il permet à un compteur de rejoindre l'inventaire sans avoir été invité nommément."],
      ['Zones et balises', "recommandé. Sans balises, tout le monde compte dans une seule zone et l'audit se compare article par article."],
    ], { x: M, y: 3.1, w: COL, h: 3.4, size: 11.5, gap: 8 })
    const g = d.cadre(s, capCreation, { x: RX + 0.6, y: 1.5, w: RW - 1.2, h: 4.9 })
    d.legende(s, "Site, « Nouvel inventaire ». Le même formulaire existe dans l'application.", { x: RX + 0.6, y: 1.5 + g.h + 0.15, w: RW })
    d.pied(s, 6, PIED)
    s.addNotes("Après la création, l'écran enchaîne sur Set up : zones, puis fichiers. C'est la page suivante.")
  }

  // ════ 7. Set up ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · à chaque inventaire')
    d.titre(s, 'Set up : dire où on compte, et ce qu’on attend.')
    d.para(s, "Les deux volets de l'onglet Set up. Leur en-tête dit où vous en êtes (« 3 emplacements · 40 balises affectées », « 135 références · aucun stock théorique ») : vous n'avez pas à les ouvrir pour le savoir.", { x: M, y: 3.8, w: COL, h: 1.8, size: 12 })
    d.alineas(s, [
      ['Zone de comptage.', "Affectez une plage de balises à un emplacement : « Textile, balises 1 à 20 », « Réserve, 21 à 35 ». Une balise scannée qui n'est dans aucune plage sera proposée à l'ajout par le compteur ; vous la nommerez ensuite."],
      ["Données d'inventaire.", "Deux fichiers, en CSV ou en Excel, tels qu'ils sortent de votre système. Le référentiel articles (code, libellé, prix d'achat) permet de reconnaître ce qu'on scanne. Le stock théorique (code, quantité attendue) permet de calculer les écarts."],
      ['Ce que le stock théorique change.', "Avec lui, le rapport part de ce qui est attendu : un article jamais scanné apparaît « Non compté », avec son manque. Sans lui, le rapport ne montre que ce qui a été compté. Pour révéler la démarque, il le faut."],
    ], { y: 1.5, h: 4.2, size: 12, gap: 11 })
    d.encadre(s, 'Vos colonnes sont reconnues', "SKU, Code article, Référence · EAN, Code-barres, GTIN, Gencod · Quantité, Qté, Stock. Majuscules, accents et séparateurs n'ont pas d'importance. Si une colonne n'est pas trouvée, l'écran le dit avant d'importer.", { x: RX, y: 5.55, w: RW, h: 1.15 })
    d.pied(s, 7, PIED)
    s.addNotes("Le message clé : on n'a pas à retravailler ses fichiers. Le second : le stock théorique est ce qui fait foi pour le rapport.")
  }

  // ════ 8. Pendant ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · pendant')
    d.titreLarge(s, 'Pendant l’inventaire : l’onglet Suivi, et deux gestes à connaître.')
    d.para(s, "Appareils connectés, en comptage, en audit ; avancement par zone ; derniers scans. La page se met à jour toute seule. Si un compteur est parti en laissant sa balise ouverte, Set up permet de la clôturer à sa place ; l'inverse aussi, pour la rouvrir.", { x: M, y: 2.3, w: W - 2 * M, h: 0.8, size: 12.5 })
    const cw = 3.55 * capSuivi.ratio, cx = (W - cw) / 2
    const g = d.cadre(s, capSuivi, { x: cx, y: 3.15, w: cw })
    d.legende(s, "Onglet Suivi, données d'essai. Les compteurs d'appareils ne disent jamais qui : seulement combien.", { x: cx, y: 3.15 + g.h + 0.15, w: RW + 2 })
    d.pied(s, 8, PIED)
    s.addNotes("Le suivi est agrégé par construction. Si un compteur demande « est-ce qu'on me voit ? », la réponse est : on voit qu'un appareil compte, pas lequel.")
  }

  // ════ 9. Les écarts ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · pendant et après')
    d.titreLarge(s, "Auditer, puis arbitrer. L'écart se lit du point de vue de l'auditeur.")
    d.para(s, "L'audit est un second comptage d'une zone déjà comptée, par une autre personne, en mode « Auditer ». Quand la balise auditée est terminée, chaque article dont les deux quantités diffèrent apparaît ici. Vous retenez la quantité du compteur, celle de l'auditeur, ou une autre que vous avez vérifiée vous-même.", { x: M, y: 2.3, w: W - 2 * M, h: 0.85, size: 12.5 })
    const g = d.cadre(s, capEcarts, { x: M + 1.6, y: 3.25, w: W - 2 * M - 3.2 })
    d.legende(s, "Onglet Écarts d'audit, données d'essai. Un article trouvé à l'audit mais jamais compté est signalé à part.", { x: M + 1.6, y: 3.25 + g.h + 0.15, w: RW + 2 })
    d.pied(s, 9, PIED)
    s.addNotes("La comparaison n'a lieu que dans une balise dont l'audit est terminé : sinon tout article pas encore repassé ressortirait à tort en écart.")
  }

  // ════ 10. Rapport et clôture ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Superviseur · après')
    d.titre(s, 'Le rapport, puis la clôture.', { size: 24, h: 1.2 })
    d.alineas(s, [
      ['Télécharger.', "Un fichier Excel : résultats par article, écarts en pièces et en valeur d'achat, détail par zone. La quantité retenue suit une règle simple : l'arbitrage, sinon l'auditeur, sinon le compteur."],
      ['« Non compté ».', "Les articles du stock théorique jamais scannés. C'est la ligne à regarder en premier."],
      ['Clôturer.', "Depuis l'onglet Équipe. Plus aucun scan n'est accepté, le rapport ne bouge plus. Tout superviseur de l'inventaire peut clôturer ; seul celui qui l'a créé, ou l'administrateur d'entreprise, peut rouvrir ou supprimer."],
      ['Supprimer.', "Efface comptages, fichiers, audits et membres. La confirmation nomme l'inventaire ; lisez-la."],
    ], { x: M, y: 2.75, w: COL, h: 3.8, size: 11.5, gap: 8 })
    const g = d.cadre(s, capRapport, { x: RX, y: 1.5, w: RW, h: 5.0 })
    d.legende(s, "Onglet Rapport, données d'essai.", { x: RX, y: 1.5 + g.h + 0.15, w: RW })
    d.pied(s, 10, PIED)
    s.addNotes("Tant qu'un écart n'est pas arbitré, le rapport l'annonce en bandeau : c'est la quantité de l'auditeur qui part. Trancher avant d'exporter.")
  }

  // ════ 11. Partie compteur ════
  {
    const s = pres.addSlide()
    partie(s, '2', 'Compter', "La partie du compteur. Trois pages, à imprimer si on veut : rejoindre, compter en trois gestes, et quoi faire quand quelque chose ne se passe pas comme prévu.", 'Compteur')
    d.pied(s, 11, PIED)
  }

  // ════ 12. Rejoindre ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Compteur')
    d.titre(s, "Rejoindre un inventaire. Deux façons, la première suffit presque toujours.")
    d.alineas(s, [
      ['On vous a ajouté.', "L'inventaire est dans « Mes inventaires » dès que vous ouvrez l'application, et vous avez reçu une notification. Touchez-le."],
      ['On vous a donné un numéro et un code.', "« Rejoindre un inventaire », en bas de l'écran : le numéro (INV-…), le code. C'est le cas d'un renfort de dernière minute."],
      ['Ensuite.', "L'écran de l'inventaire propose « Compter des articles », « Auditer des articles », et « Quitter l'inventaire ». Quitter ne supprime rien de ce que vous avez compté."],
    ], { x: M, y: 3.75, w: COL + 1.2, h: 3.0, size: 11.5, gap: 9 })
    const px = RX + 2.3
    d.telephone(s, px, 1.45, 2.4, [
      { t: 'Bonjour, Camille', style: 'ligne', h: 0.4 },
      { t: 'MES INVENTAIRES', style: 'titre' },
      { t: 'Rayon textile · En cours\nINV-20260901-A3F2', style: 'ligne', h: 0.6 },
      { t: 'Réserve · Préparation\nINV-20260828-C9B1', style: 'ligne', h: 0.6 },
      { t: '', style: 'espace', h: 0.15 },
      { t: 'Rejoindre un autre inventaire', style: 'bouton2' },
      { t: "N° d'inventaire", style: 'champ' },
      { t: 'Code inventaire', style: 'champ' },
      { t: 'Rejoindre', style: 'bouton' },
    ])
    d.legende(s, "Schéma de l'écran d'accueil du compteur.", { x: px - 0.5, y: 1.45 + 2.4 * 2.05 + 0.1, w: 3.4 })
    d.pied(s, 12, PIED)
    s.addNotes("Le numéro et le code sont affichés sur l'écran de l'inventaire du superviseur, avec un bouton « Partager les identifiants ».")
  }

  // ════ 13. Compter en trois gestes ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Compteur')
    d.titreLarge(s, 'Compter, en trois gestes. Puis la balise suivante.')
    const gestes = [
      ['Scannez la balise du rayon', "Elle ouvre la zone. Tant qu'elle est ouverte, tout ce que vous scannez compte ici. L'application vous le rappelle si vous essayez de scanner un article sans balise."],
      ['Scannez les articles', "Pointez la caméra vers le code-barres : le scan est automatique. Un article scanné trois fois compte trois. Pour une pile, scannez une fois puis ajustez la quantité avec + et − dans la liste. Pas de code-barres lisible ? Tapez le code (EAN ou SKU) dans le champ."],
      ['Clôturez la balise', "« Clôturer la balise » dit « j'ai fini ici ». Le superviseur voit la zone passer en comptée. Passez à la balise suivante. « Revenir sur une balise » la rouvre si vous avez oublié un rayonnage."],
    ]
    const cw = (W - 2 * M - 2 * 0.5) / 3
    gestes.forEach(([h4, txt], i) => {
      const x = M + i * (cw + 0.5)
      d.numero(s, i + 1, x, 2.6, 0.5)
      s.addText(h4, { x, y: 3.25, w: cw, h: 0.45, fontFace: FONTD, fontSize: 16, bold: true, color: P.DEEP, margin: 0 })
      s.addText(txt, { x, y: 3.75, w: cw, h: 1.9, fontFace: FONT, fontSize: 12, color: P.INK2, margin: 0, lineSpacingMultiple: 1.18 })
    })
    d.encadre(s, 'Se corriger', "Une ligne de trop se supprime, une quantité se modifie, depuis la liste sous le scanner. Rien n'est définitif avant la clôture par le superviseur. Et si vous quittez l'application, vos comptages restent.", { x: M, y: 5.8, w: W - 2 * M, h: 1.0 })
    d.pied(s, 13, PIED)
    s.addNotes("Le geste qu'on oublie le plus : clôturer la balise. Sans lui, la zone reste « en cours » sur le tableau de bord et l'audit ne peut pas se comparer.")
  }

  // ════ 14. Quand ça ne se passe pas comme prévu ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Compteur')
    d.titreLarge(s, 'Quand ça ne se passe pas comme prévu')
    const x1 = M, x2 = M + 4.3, wc2 = W - M - x2
    let y = 2.3
    s.addText('Ce qui arrive', { x: x1, y, w: 4, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.SLATE, margin: 0 })
    s.addText('Ce que vous faites', { x: x2, y, w: wc2, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.DEEP, margin: 0 })
    y += 0.4
    d.filet(s, M, y, W - 2 * M)
    const rows = [
      ['« Balise non définie »', "Le numéro n'est dans aucune plage. Si l'étiquette est bien collée dans ce magasin, touchez « Ajouter » : la zone est créée, le superviseur la nommera. Sinon, vérifiez le numéro."],
      ['Article inconnu', "Il n'est pas dans le référentiel. Vous pouvez l'ajouter avec un libellé ; il entrera dans le rapport avec un prix d'achat à zéro, que le superviseur complétera."],
      ['Plus de réseau', "Continuez à compter. L'écran indique ce qui attend ; tout part au retour du réseau. Ne désinstallez pas l'application et ne laissez personne effacer le téléphone avant que ce soit parti."],
      ["On vous demande d'auditer", "Mêmes gestes, bouton « Auditer des articles » à la place de « Compter ». Vous recomptez une zone que quelqu'un d'autre a déjà comptée ; l'écart se réglera sur le tableau de bord."],
      ['Vous changez de téléphone en cours', "Reconnectez-vous : les comptages déjà envoyés sont sur le serveur. Ceux qui attendaient sur l'ancien téléphone partiront quand il retrouvera le réseau."],
    ]
    for (const [a, b] of rows) {
      y += 0.1
      s.addText(a, { x: x1, y, w: 4, h: 0.6, fontFace: FONTD, fontSize: 12.5, bold: true, color: P.INK, margin: 0 })
      s.addText(b, { x: x2, y, w: wc2, h: 0.65, fontFace: FONT, fontSize: 11.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.12 })
      y += 0.68
      d.filet(s, M, y, W - 2 * M)
    }
    d.pied(s, 14, PIED)
    s.addNotes("Hors ligne, l'ajout d'une balise inconnue n'est pas proposé : l'échec se découvre à la synchronisation. À connaître si le cas se présente.")
  }

  // ════ 15. Avant de commencer, la liste ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: "Le matin de l'inventaire.",
      texte: "Les balises sont collées. Les deux fichiers sont importés et l'en-tête de Set up dit « Prêt ». L'équipe est invitée et chacun s'est connecté une fois. Les téléphones sont chargés, le réseau a été essayé en réserve. Le superviseur a le tableau de bord ouvert. On peut compter.",
      contact: 'Une question : contact@quantinvo.com',
      bas: 'Quantinvo, par Devkaylab. L’outil d’inventaire pour le commerce.',
    })
    s.addNotes("La liste à lire à voix haute la veille. Si un point manque, c'est celui-là qui fera perdre une heure le lendemain.")
  }

  await ecrire(pres, 'Quantinvo-prise-en-main')
}

main().catch((e) => { console.error(e); process.exit(1) })
