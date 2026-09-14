// Deck « Pourquoi j'ai créé Quantinvo » — charte « Ardoise » v2.
// node build-pourquoi.js                 → Quantinvo-pourquoi.pptx        (Arial)
// FONT_MODE=brand node build-pourquoi.js → Quantinvo-pourquoi-marque.pptx (Archivo/Public Sans)
//
// ⚠️ LE TEXTE EST DE JULIEN, pas de moi. Il l'a écrit le 14 septembre 2026 en
// onze points, depuis sa place de contrôleur des stocks. Mon travail est de le
// mettre en page et de le relier à ce que le produit fait — jamais d'ajouter un
// constat qu'il n'a pas fait. Les onze points sont tous là, regroupés en cinq
// obstacles :
//   1. autonomie  — dépendance à l'inventory control, profils demandés au
//                   fournisseur, magasins sans outil qui externalisent
//   2. cadence    — une marque par an, pas de recomptage, pas de suivi de
//                   variance, un seul inventaire à la fois sur la plateforme
//   3. matériel   — scanners en fin de vie, balises commandées à l'étranger et
//                   à encodage propriétaire, alors que l'iPhone est déjà là
//   4. donnée     — référentiel arrêté en mars, mise à jour qui mobilise l'IT,
//                   seuls les articles connus reconnus
//   5. zone       — zones de comptage imposées, et l'écart qu'on n'a pas en
//                   direct (qui prend sa propre page)
//
// ⚠️ LE NOM DU MAGASIN N'EST PAS ÉCRIT. Julien nomme son employeur dans son
// texte ; un deck circule. On dit « le magasin où je travaille ». Si Julien
// veut le nommer, c'est à un seul endroit — la page « D'où je parle ».
//
// ⚠️ AUCUN CHIFFRE INVENTÉ. Les seuls chiffrés sont les siens : deux personnes
// à l'inventaire, un référentiel de mars. Pas de « 30 % de gain de temps ».
//
// ⚠️ LES CAPTURES SONT RÉELLES, et c'est la règle des sept decks : celles de
// l'application viennent de `captures/` (simulateur, 9 septembre 2026), celles
// du tableau de bord de `web/screenshots/` (harnais Playwright, faux Supabase).
// Une capture refaite à la main en ferait une démonstration au lieu d'une
// preuve.

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer } = require('./charte')

async function main() {
  const d = await preparer({ titre: "Quantinvo — pourquoi je l'ai créé" })
  const { pres } = d
  const PIED = 'Quantinvo · note d’intention'

  // ── Captures du tableau de bord ───────────────────────────
  // Recadrages en pixels des fichiers de `web/screenshots/` (1440 × 1100).
  // Ils retirent l'en-tête, le rail et le nom du magasin d'essai, et coupent
  // avant le bas de page vide.
  const capEcarts = await capture('light-desktop-ecarts.png', { left: 448, top: 285, width: 962, height: 375 })
  const capRapport = await capture('light-desktop-rapport.png', { left: 448, top: 285, width: 962, height: 434 })
  const capBarres = await capture('light-desktop-tableau-de-bord.png', { left: 108, top: 240, width: 780, height: 590 })

  // ── Le téléphone des pages d'obstacle ─────────────────────
  // Entier, jamais coupé : ici il illustre, il n'est pas le sujet de la page.
  const TEL_H = 4.55
  const telEntier = (f) => cadrer(f, { w: 2.4, h: 6.5 })

  /**
   * Page d'obstacle : la pastille et le constat à gauche, la réponse au
   * milieu, l'écran à droite. Les trois colonnes ne se chevauchent jamais —
   * la largeur du milieu se DÉDUIT de la place que prend le téléphone.
   */
  async function obstacle(s, n, { titre, constat, reponse, ecran, legende }) {
    d.entete(s, PIED)
    d.numero(s, n, M, 1.36, 0.42, P.INK)
    d.titre(s, titre, { x: M + 0.62, y: 1.32, w: COL - 0.62, size: 23, h: 1.5 })

    // ⚠️ 2,78 et non 2,62 : un titre de TROIS lignes descend jusqu'à 2,50, et
    // à 2,62 le filet lui passait dedans. Vu au PDF sur la page « matériel ».
    d.filet(s, M, 2.78, COL)
    d.alineas(s, constat, { x: M, y: 3.0, w: COL, h: 3.7, size: 11.5, gap: 9 })

    const tel = await telEntier(ecran)
    const tw = TEL_H * tel.ratio
    const tx = W - M - tw
    d.ecranEntier(s, { x: tx, y: 1.95, h: TEL_H, tel, legende })

    const mw = tx - 0.5 - RX
    s.addText('CE QUE QUANTINVO FAIT', {
      x: RX, y: 1.34, w: mw, h: 0.3, fontFace: FONT, fontSize: 9.5, bold: true,
      color: P.SLATE, charSpacing: 0.6, margin: 0,
    })
    d.filet(s, RX, 1.72, mw)
    d.para(s, reponse, { x: RX, y: 1.92, w: mw, h: 4.4, size: 12 })
  }

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Note d’intention',
      titre: 'Pourquoi j’ai créé Quantinvo',
      sousTitre:
        'Je suis contrôleur des stocks. Ce qui suit ne vient pas d’une étude de marché mais de ce que je constate en magasin, inventaire après inventaire — et de ce que Quantinvo en fait, point par point.',
      bas: 'Julien Thiong-Kay  ·  Devkaylab  ·  septembre 2026  ·  www.quantinvo.com',
    })
    s.addNotes("Poser le cadre en une phrase : ce document part du terrain, pas d'une idée de produit. Le reste se lit dans l'ordre.")
  }

  // ════ 2. D'où je parle ════
  {
    const s = pres.addSlide()
    d.entete(s, PIED)
    d.titre(s, 'Je fais des inventaires.\nJe n’en vendais pas.', { size: 26 })
    d.chiffre(s, '2', 'personnes à l’inventaire, pour l’ensemble du magasin', { y: 4.25 })

    d.para(
      s,
      'Mon métier est le contrôle des stocks en grand magasin. Je prépare les inventaires, je les conduis, je relève les écarts et je les explique. C’est de cette place que j’ai vu les mêmes obstacles revenir — et qu’aucun d’eux ne tenait aux équipes.',
      { y: 1.5, h: 1.4, size: 13 },
    )
    d.para(
      s,
      'Ils tenaient à l’organisation et aux outils : un service d’inventaire minuscule dont tout le magasin dépend, une plateforme qui décide de ce qu’on peut faire, du matériel qu’il faut commander. Quantinvo n’est pas né d’une idée de produit. Il est né de cette liste, que j’ai fini par écrire.',
      { y: 3.05, h: 1.6, size: 13 },
    )
    d.encadre(
      s,
      'Le point de départ',
      'Le magasin ne lance pas un inventaire : il le demande. Ce qui sera compté, et quand, dépend de la disponibilité de deux personnes.',
      { y: 5.05, h: 1.2 },
    )
    d.pied(s, 2, PIED)
    s.addNotes('Dire qui parle avant de dire ce qui ne va pas. Le chiffre « 2 » est celui de mon magasin, pas une moyenne du secteur.')
  }

  // ════ 3. Les cinq obstacles ════
  {
    const s = pres.addSlide()
    d.entete(s, PIED)
    d.titreLarge(s, 'Cinq obstacles, toujours les mêmes', { y: 1.35, size: 27 })
    d.para(
      s,
      'Ils ne sont ni exotiques ni propres à une enseigne. Je les retrouve partout où l’inventaire se fait avec un prestataire et sa plateforme.',
      { x: M, y: 2.12, w: 9.4, h: 0.5, size: 12.5, color: P.SLATE },
    )

    const items = [
      ['L’autonomie', 'Le magasin ne peut rien lancer, ni ajouter personne, sans passer par un tiers.'],
      ['La cadence', 'Une marque comptée une fois par an, et aucune seconde chance quand l’écart est gros.'],
      ['Le matériel', 'Des terminaux en fin de vie, des balises commandées à l’étranger — quand chacun a déjà un téléphone.'],
      ['La donnée', 'Un référentiel arrêté au mois de mars, qu’on ne peut pas rafraîchir soi-même.'],
      ['La zone', 'Des zones de comptage imposées, et un écart qu’on ne découvre qu’à la fin.'],
    ]
    let y = 2.95
    items.forEach(([t, p], i) => {
      d.numero(s, i + 1, M, y, 0.36, P.INK)
      s.addText(t, { x: M + 0.56, y: y - 0.04, w: 2.5, h: 0.4, fontFace: FONTD, fontSize: 15, bold: true, color: P.INK, margin: 0 })
      d.para(s, p, { x: M + 3.15, y: y - 0.02, w: W - M - (M + 3.15), h: 0.5, size: 12.5 })
      if (i < items.length - 1) d.filet(s, M, y + 0.56, W - 2 * M)
      y += 0.76
    })
    d.pied(s, 3, PIED)
    s.addNotes('Donner la carte avant le détail. Les cinq pages qui suivent reprennent ces titres dans cet ordre.')
  }

  // ════ 4. L'autonomie ════
  {
    const s = pres.addSlide()
    await obstacle(s, 1, {
      titre: 'Le magasin ne décide de rien',
      constat: [
        ['Tout passe par une équipe de deux.', 'Le magasin ne lance pas un inventaire, il le demande. Notre disponibilité décide de ce qui sera compté, et quand.'],
        ['Ajouter quelqu’un demande un e-mail.', 'Créer un profil ou ajouter un membre se demande au fournisseur, et on attend sa réponse — pour un geste d’une minute.'],
        ['Et la plupart des magasins n’ont rien.', 'Une grande majorité n’a aucun outil d’inventaire et l’externalise. Un comptage décidé le matin même n’existe pas.'],
      ],
      reponse:
        'Le superviseur du magasin crée ses inventaires, invite ses compteurs et retire leurs accès lui-même. Rien à demander, personne à attendre : une invitation part par e-mail, la personne choisit son mot de passe, elle compte.\n\nL’administrateur de l’entreprise garde la vue d’ensemble — les magasins, les équipes, les inventaires de chacun — sans être sur le chemin de ceux qui comptent.',
      ecran: 'ajouter-membre.png',
      legende: 'Ajouter un compteur, depuis le magasin',
    })
    d.pied(s, 4, PIED)
    s.addNotes('Le point le plus important des cinq : tous les autres en découlent. Insister sur « rien à demander ».')
  }

  // ════ 5. La cadence ════
  {
    const s = pres.addSlide()
    await obstacle(s, 2, {
      titre: 'Une marque par an,\net pas de seconde chance',
      constat: [
        ['Une marque par an, au mieux.', 'Le magasin ne peut pas compter chaque marque dans l’année : il n’y a ni le matériel ni les bras.'],
        ['Un gros écart n’est pas recompté.', 'Une marque qui sort un écart important n’est revue qu’à l’inventaire global du département. C’est-à-dire trop tard.'],
        ['Un seul inventaire à la fois.', 'La plateforme n’en accepte qu’un : plusieurs marques comptées ensemble donnent un rapport unique, où plus rien ne se distingue.'],
      ],
      reponse:
        'Quantinvo n’a pas de limite d’inventaires simultanés. Chaque marque, chaque rayon, chaque réserve peut avoir le sien, mené en même temps que les autres, avec son périmètre et son rapport.\n\nRecompter une marque la semaine suivante ne demande donc qu’un inventaire de plus — et c’est ce qui rend le suivi de variance possible : deux mesures, deux rapports, l’écart de l’un à l’autre.',
      ecran: 'nouvel-inventaire.png',
      legende: 'Un inventaire se crée en trois champs',
    })
    d.pied(s, 5, PIED)
    s.addNotes('C’est ici que se joue l’inventaire tournant : compter souvent et peu, plutôt que tout, une fois.')
  }

  // ════ 6. Le matériel ════
  {
    const s = pres.addSlide()
    await obstacle(s, 3, {
      titre: 'Du matériel à commander,\nquand il est en poche',
      constat: [
        ['Des terminaux en fin de vie.', 'Les scanners vieillissent et ne seront vraisemblablement plus renouvelés. Les remplacer, c’est acheter ou louer du matériel qui ne sert qu’à l’inventaire.'],
        ['Des balises qui viennent de loin.', 'Les étiquettes de zone se commandent au fournisseur quand le stock baisse et arrivent de l’étranger. Le bilan carbone n’est pas neutre.'],
        ['Et lisibles d’un seul appareil.', 'Leur encodage est propriétaire : seuls ses scanners les lisent. Une étiquette ne se remplace donc pas.'],
      ],
      reponse:
        'Quantinvo compte avec le téléphone que chacun a déjà — un iPhone récent, suivi par Apple pour plusieurs années encore. Zéro matériel à acheter, à louer ou à charger la veille. Une douchette Bluetooth se branche pour qui préfère.\n\nLes balises s’impriment dans le magasin, sur du papier ordinaire, en choisissant la numérotation. Ce sont des QR standards : n’importe quel appareil photo les lit.',
      ecran: 'creer-balises.png',
      legende: 'La planche de balises s’imprime sur place',
    })
    d.pied(s, 6, PIED)
    s.addNotes('Le matériel est l’argument le plus facile à vérifier : montrer la planche de balises et laisser conclure.')
  }

  // ════ 7. La donnée ════
  {
    const s = pres.addSlide()
    await obstacle(s, 4, {
      titre: 'Un référentiel\nqui date du mois de mars',
      constat: [
        ['La base n’est plus mise à jour.', 'Les inventaires d’aujourd’hui se font sur des données arrêtées il y a des mois. Tout ce qui est entré depuis est inconnu.'],
        ['La rafraîchir mobilise l’informatique.', 'L’envoi des données au fournisseur n’est pas automatisé : il faut une équipe IT pour chaque mise à jour.'],
        ['Ce qui manque ne se scanne pas.', 'Seuls les articles connus de la base sont reconnus par le scanner. Le reste se traite à la main, après coup.'],
      ],
      reponse:
        'Le superviseur charge ses fichiers lui-même, au début de chaque inventaire : le référentiel articles, et le stock théorique si le magasin en a un. Un tableur, deux minutes, aucun intermédiaire — donc une base à jour à chaque comptage.\n\nUn article absent se crée sur place, au moment du scan : on ne s’arrête pas, et il figure au rapport.',
      ecran: 'importer.png',
      legende: 'Le référentiel se charge depuis un tableur',
    })
    d.pied(s, 7, PIED)
    s.addNotes('Ne pas promettre de connecteur ERP : Quantinvo lit un fichier, et c’est ce qui le rend indépendant de l’informatique.')
  }

  // ════ 8. La zone de comptage ════
  {
    const s = pres.addSlide()
    await obstacle(s, 5, {
      titre: 'Des zones imposées,\nqu’il faut traduire',
      constat: [
        ['La liste est figée.', 'Salesfloor, stock room, Luxury, sportswear : on choisit dans une liste, et on ne peut pas nommer la zone comme le magasin la nomme.'],
        ['Donc une traduction tenue à côté.', 'Il faut noter quelque part quelle zone de la plateforme correspond à quel endroit réel. C’est une source d’erreur qui n’a aucune raison d’exister.'],
      ],
      reponse:
        'Le magasin nomme ses emplacements : Réserve, Surface de vente, Corner, le nom qu’il emploie déjà. Il leur affecte des plages de balises — les balises 1000 à 1049 sont la surface de vente — et l’avancement se lit emplacement par emplacement.\n\nRien à traduire, rien à noter à côté : ce que le compteur scanne porte le nom que le magasin lui donne.',
      ecran: 'zones.png',
      legende: 'L’emplacement porte le nom du magasin',
    })
    d.pied(s, 8, PIED)
    s.addNotes('Détail en apparence, mais c’est celui qui produit le plus d’erreurs de saisie sur le terrain.')
  }

  // ════ 9. L'écart en direct ════
  {
    const s = pres.addSlide()
    d.entete(s, PIED)
    d.titreLarge(s, 'L’écart pendant l’inventaire, pas après', { y: 1.32, size: 27 })
    d.para(
      s,
      [
        { text: 'C’est le manque que je reproche le plus à la plateforme actuelle : ', options: {} },
        { text: 'elle ne donne pas l’écart en direct', options: { bold: true, color: P.INK } },
        {
          text: '. On compte, on clôture, on découvre. Quand l’écart tombe, l’équipe est partie et le rayon a déjà bougé. Quantinvo compare le comptage et l’audit au fil de l’inventaire : chaque écart s’affiche dès que la balise est auditée, avec les deux quantités et sa valeur — et il se tranche d’un bouton.',
          options: {},
        },
      ],
      { x: M, y: 2.05, w: 11.0, h: 0.95, size: 12.5 },
    )
    const dims = d.cadre(s, capEcarts, { x: (W - 9.6) / 2, y: 3.15, w: 9.6, h: 3.3 })
    d.legende(s, 'Onglet « Écarts d’audit » — données d’essai. « Compteur » et « Auditeur » retiennent l’une des deux quantités en un clic.', {
      x: (W - dims.w) / 2, y: 3.15 + dims.h + 0.16, w: dims.w,
    })
    d.pied(s, 9, PIED)
    s.addNotes('Page centrale de la démonstration. L’écart se tranche sur place, pendant que quelqu’un peut encore retourner au rayon.')
  }

  // ════ 10. Le rapport ════
  {
    const s = pres.addSlide()
    d.entete(s, PIED)
    d.titreLarge(s, 'Un rapport par inventaire', { y: 1.32, size: 27 })
    d.para(
      s,
      'Chaque inventaire produit le sien : stock théorique, stock compté, écart en unités et en valeur, ligne par ligne, et le statut de chaque référence. Il se télécharge en Excel ou en CSV. Quand un magasin mène plusieurs inventaires, un rapport consolidé les additionne et signale les références vues deux fois.',
      { x: M, y: 2.05, w: 11.0, h: 0.9, size: 12.5 },
    )
    const dims = d.cadre(s, capRapport, { x: (W - 9.0) / 2, y: 3.1, w: 9.0, h: 3.35 })
    d.legende(s, 'Onglet « Rapport » — données d’essai. Le bandeau prévient quand un écart n’a pas encore été arbitré.', {
      x: (W - dims.w) / 2, y: 3.1 + dims.h + 0.16, w: dims.w,
    })
    d.pied(s, 10, PIED)
    s.addNotes('Insister sur « par inventaire » : c’est la réponse au rapport unique de la plateforme actuelle.')
  }

  // ════ 11. Le suivi dans le temps ════
  {
    const s = pres.addSlide()
    d.entete(s, PIED)
    d.titre(s, 'Et l’écart\ndevient une courbe', { size: 26 })
    d.para(
      s,
      'Ce qui manquait le plus : savoir si l’écart d’une marque se réduit d’un inventaire au suivant. Il faut pour cela pouvoir recompter — donc lever les quatre obstacles précédents — et garder la trace des deux mesures.',
      { x: M, y: 3.3, w: COL, h: 1.5, size: 12.5 },
    )
    d.para(
      s,
      'Le tableau de bord du magasin porte les pièces comptées, la valeur comptée et l’écart des trente derniers jours. Le suivi de variance cesse d’être un tableur tenu à la main.',
      { x: M, y: 4.85, w: COL, h: 1.3, size: 12.5 },
    )
    const x = W - M - 5.6
    const dims = d.cadre(s, capBarres, { x, y: 1.5, w: 5.6, h: 4.6 })
    d.legende(s, 'Tableau de bord du superviseur — données d’essai.', { x, y: 1.5 + dims.h + 0.16, w: dims.w })
    d.pied(s, 11, PIED)
    s.addNotes('Fermer la boucle : compter souvent n’a d’intérêt que si l’on compare. C’est la promesse de l’inventaire tournant.')
  }

  // ════ 12. Ce que je ne promets pas ════
  //
  // ⚠️ Page à garder. C'est celle qu'aucun document de produit n'écrit, et
  // c'est elle qui rend les onze autres crédibles (règle des livrables :
  // « des pages que seule une personne écrit »).
  {
    const s = pres.addSlide()
    d.entete(s, PIED)
    d.titre(s, 'Ce que je ne\npromets pas', { size: 26 })
    d.para(s, 'Un outil d’inventaire qui prétend tout faire ment sur au moins un point.', {
      x: M, y: 3.15, w: COL, h: 0.9, size: 12.5, color: P.SLATE,
    })
    d.alineas(
      s,
      [
        ['Quantinvo ne remplace ni l’ERP ni la caisse.', 'Il compte, il compare, il rend un rapport. L’ajustement du stock reste dans vos systèmes, et c’est vous qui le décidez.'],
        ['Il ne compte pas à votre place.', 'Un rayon se parcourt à la main, article par article, et cela prend le temps que cela prend. Ce qui change, c’est tout ce qu’il y avait autour.'],
        ['Il ne lit pas la RFID.', 'Codes-barres et QR, oui, à la caméra ou à la douchette. La RFID, non.'],
        ['Et il ne fait pas disparaître la démarque.', 'Il la montre plus tôt, plus souvent, et au bon endroit. C’est déjà beaucoup — ce n’est pas la même chose.'],
      ],
      { y: 1.5, h: 3.6, size: 12.5, gap: 12 },
    )
    d.encadre(
      s,
      'Et ce qu’il fait, lui',
      'Il retire tout ce qui empêchait de compter souvent : la demande à envoyer, le matériel à commander, la base à rafraîchir, la zone à traduire. Ce qui reste est le comptage — et il est à vous.',
      { y: 5.05, h: 1.25 },
    )
    d.pied(s, 12, PIED)
    s.addNotes('Dire les limites avant qu’on nous les oppose. C’est la page qui fait passer le reste pour vrai, parce qu’il l’est.')
  }

  // ════ 13. Finale ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Ce que je voulais,\nau fond',
      texte:
        'Que chacun soit autonome : que le magasin ne dépende plus d’un service, d’un fournisseur ou d’une commande de matériel pour compter ce qu’il a. Et que là où un service d’inventaire existe, il travaille avec les équipes au lieu de travailler à leur place.',
      contact: 'contact@quantinvo.com',
      bas: 'Julien Thiong-Kay  ·  Devkaylab  ·  www.quantinvo.com',
    })
  }

  await ecrire(pres, 'Quantinvo-pourquoi')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
