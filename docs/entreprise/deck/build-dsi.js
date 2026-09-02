// Dossier technique Quantinvo, pour la direction informatique du client.
// node build-dsi.js                 → Quantinvo-dossier-DSI.pptx
// FONT_MODE=brand node build-dsi.js → Quantinvo-dossier-DSI-marque.pptx
//
// Les faits viennent de `deploiement-mdm.md`, de `docs/privacy.html` et
// d'AGENTS.md (audits, mots de passe, sessions). Si l'un d'eux bouge, ce deck
// doit bouger avec.
//
// Depuis le 30 août 2026 il couvre aussi ce qu'une DSI doit organiser après la
// signature — d'où on télécharge l'application, comment on met en place, et ce
// que chaque rôle a à apprendre. Ces trois parties étaient dans trois
// documents différents, et personne ne les recevait ensemble.
//
// ⚠️ Les captures de l'application (page 10) datent du 27 août 2026, et deux
// d'entre elles montrent des écrans que l'application n'a plus : le viseur de
// `scanner-balise` est devenu carré en phase balise le 28 août, et la liste de
// `comptage` est passée derrière un bouton le 29. Elles se refont dans la
// passe de captures — voir « Ce qu'il reste à faire » dans LISEZMOI.md.

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer } = require('./charte')

async function main() {
  const d = await preparer({ titre: 'Quantinvo — dossier technique' })
  const { pres } = d
  // ⚠️ Le mois est celui de la DERNIÈRE RÉVISION du contenu, pas la date du
  // jour : il ne se calcule pas. Un pied qui avance tout seul à chaque
  // génération promettrait une fraîcheur que le document n'a pas.
  const PIED = 'Quantinvo · dossier technique · septembre 2026'

  const capTelechargement = await cadrer('../../../web/screenshots/light-mobile-telechargement.png', { w: 1, h: 99 })
  const capSetup = await capture('light-desktop-setup.png', { left: 448, top: 155, width: 964, height: 620 })

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

  // Petit tableau à filets : colonnes [{w}], lignes [[cellules]].
  function tableau(s, { x, y, w, cols, head, rows, size = 11.5, rh = 0.5, headColor = P.SLATE }) {
    let cy = y
    let cx = x
    head.forEach((h, i) => {
      s.addText(h, { x: cx, y: cy, w: cols[i], h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: headColor, margin: 0 })
      cx += cols[i]
    })
    cy += 0.36
    d.filet(s, x, cy, w)
    for (const r of rows) {
      cx = x
      r.forEach((c, i) => {
        const bold = i === 0
        s.addText(c, { x: cx, y: cy + 0.11, w: cols[i] - 0.15, h: rh - 0.1, fontFace: bold ? FONTD : FONT, fontSize: size, bold, color: bold ? P.INK : P.INK2, margin: 0, lineSpacingMultiple: 1.12 })
        cx += cols[i]
      })
      cy += rh
      d.filet(s, x, cy, w)
    }
    return cy
  }

  function boite(s, x, y, w, h, titre, lignes, { fill = P.MIST, line = P.HAIR } = {}) {
    s.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: line, width: 1 } })
    s.addText(titre, { x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.3, fontFace: FONTD, fontSize: 12.5, bold: true, color: P.INK, margin: 0 })
    s.addText(lignes.join('\n'), { x: x + 0.2, y: y + 0.5, w: w - 0.4, h: h - 0.6, fontFace: FONT, fontSize: 10.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
  }
  function lien(s, x1, y1, x2, y2, libelle, lw = 1.2) {
    s.addShape('line', { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), line: { color: P.SLATE, width: 1, dashType: 'dash' } })
    if (libelle) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
      s.addText(libelle, { x: mx - lw / 2, y: my - 0.5, w: lw, h: 0.45, fontFace: FONT, fontSize: 8.5, color: P.SLATE, align: 'center', valign: 'bottom', margin: 0 })
    }
  }

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Dossier technique, pour la direction informatique',
      titre: 'Ce qu’il faut savoir avant de déployer Quantinvo.',
      sousTitre: "Architecture, hébergement, distribution de l'application, mise en place, prise en main, comptes, sécurité, protection des données. Et ce qui n'existe pas encore, dit tel quel.",
      bas: 'Devkaylab  ·  état au 30 août 2026  ·  www.quantinvo.com',
    })
    s.addNotes("Ce dossier accompagne la présentation commerciale. Il répond aux questions qu'une DSI pose avant signature, et à celles qu'elle pose après — d'où on télécharge, qui met en place, ce que les équipes ont à apprendre.")
  }

  // ════ 2. En une page ════
  {
    const s = pres.addSlide()
    d.entete(s, 'En une page')
    d.titre(s, 'Une application mobile, un site web, et rien à installer chez vous.')
    d.alineas(s, [
      ['Ce que c’est.', "Une application sur iPhone (Android en cours de publication) pour les personnes qui comptent, un site web pour celles qui pilotent, et une base de données hébergée en Irlande qui relie les deux."],
      ['Ce que ça touche chez vous.', "Les téléphones qui comptent, votre réseau sortant en HTTPS, et un compte nominatif par personne. C'est tout."],
      ["Ce que ça n'exige pas.", "Aucun serveur chez vous, aucun VPN, aucun terminal dédié, aucune intégration obligatoire avec votre système de gestion. On importe un fichier, on rend un Excel."],
      ['Ce que ça demande de votre part.', "Autoriser l'application dans votre catalogue, laisser la caméra et trois adresses réseau accessibles, et ne pas effacer un téléphone pendant un comptage hors ligne. Les pages suivantes détaillent chacun de ces points."],
    ], { y: 1.5, h: 5.0, size: 13, gap: 13 })
    d.pied(s, 2, PIED)
    s.addNotes("La page à lire si on n'en lit qu'une. Tout le reste la détaille.")
  }

  // ════ 3. Architecture ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Architecture')
    d.titreLarge(s, 'Comment les pièces se parlent')
    const by = 2.6
    const w1 = 2.95, w2 = 3.55, w3 = 2.95, g = (W - 2 * M - w1 - w2 - w3) / 2
    const x1 = M, x2 = M + w1 + g, x3 = x2 + w2 + g
    boite(s, x1, by, w1, 1.85, 'Téléphones des compteurs', ['Application Quantinvo (iOS, Android en cours de publication).', 'Scan par la caméra ; comptages gardés sur l’appareil hors réseau, renvoyés au retour.'])
    boite(s, x2, by, w2, 1.85, 'Base et services, Irlande', ['Postgres, authentification, temps réel, fonctions serveur. Hébergé par Supabase, région eu-west-1.', 'Chaque requête est filtrée côté serveur, par entreprise et par rôle.'], { fill: P.TINT, line: P.ACCENT })
    boite(s, x3, by, w3, 1.85, 'Postes des superviseurs', ['Site web www.quantinvo.com, sans installation.', 'Tableau de bord, imports, rapports. Hébergé par Vercel.'])
    lien(s, x1 + w1, by + 0.92, x2, by + 0.92, 'HTTPS 443', g)
    lien(s, x2 + w2, by + 0.92, x3, by + 0.92, 'HTTPS, WebSocket', g)
    const by2 = by + 2.55
    boite(s, x1, by2, w1, 1.3, 'Notifications', ['Jeton obtenu via Expo (exp.host), puis APNs / FCM. Sert à prévenir d’une invitation.'])
    boite(s, x2, by2, w2, 1.3, 'E-mails de service', ['Invitations, factures, accusés. Envoyés par Resend, depuis send.quantinvo.com. Jamais de code d’accès par e-mail.'])
    boite(s, x3, by2, w3, 1.3, 'Ce qui n’existe pas', ['Pas d’API publique, pas de connecteur ERP, pas de SSO. L’échange se fait par fichiers.'])
    lien(s, x1 + w1 / 2, by + 1.85, x1 + w1 / 2, by2)
    lien(s, x2 + w2 / 2, by + 1.85, x2 + w2 / 2, by2)
    d.para(s, "Tout le trafic sort de chez vous en HTTPS sur le port 443. Rien n'entre. Aucun composant n'est installé sur votre réseau.", { x: M, y: 6.5, w: W - 2 * M, h: 0.4, size: 11.5, italic: true, color: P.SLATE })
    d.pied(s, 3, PIED)
    s.addNotes("Trois blocs, deux flux. Le point qui rassure une DSI : rien n'entre, tout sort en 443, aucun composant sur site.")
  }

  // ════ 4. Hébergement ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Hébergement')
    d.titre(s, 'Où sont les données, et qui les traite.')
    d.para(s, "Les données d'inventaire, les comptes et les journaux sont stockés en Irlande et n'en sortent pas. Les services annexes (site, e-mails, notifications, paiement) font appel à des prestataires établis aux États-Unis, sur la base de leurs clauses contractuelles types.", { x: M, y: 3.8, w: COL, h: 2.2, size: 12 })
    tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [2.2, 3.3, 1.7],
      head: ['Prestataire', 'Rôle', 'Localisation'],
      rows: [
        ['Supabase', 'Base de données, authentification, temps réel, fonctions', 'Irlande (eu-west-1)'],
        ['Vercel', 'Hébergement du site www.quantinvo.com', 'États-Unis'],
        ['Resend', 'Acheminement des e-mails de service', 'États-Unis'],
        ['Stripe', 'Paiement de la licence et facturation', 'Irlande, États-Unis'],
        ['Expo', "Obtention du jeton de notification de l'appareil", 'États-Unis'],
        ['Apple, Google', "Distribution de l'application mobile", 'États-Unis'],
      ],
      rh: 0.55,
    })
    d.encadre(s, 'À savoir', "La liste est celle de la politique de confidentialité publiée. Un test automatique empêche d'ajouter un prestataire au produit sans le déclarer. Aucune donnée bancaire ne transite par nos serveurs : la carte se saisit chez Stripe.", { x: RX, y: 5.3, w: RW, h: 1.2 })
    d.pied(s, 4, PIED)
    s.addNotes("Être précis sur la frontière : les données d'inventaire restent en Irlande ; ce qui passe par les États-Unis, c'est l'acheminement des e-mails et des notifications, et le site.")
  }

  // ════ 5. Le hub de téléchargement ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Où prendre l’application')
    d.titre(s, 'Une seule adresse, quel que soit l’appareil.', { size: 24, h: 1.6 })
    d.alineas(s, [
      ['www.quantinvo.com/open', "L'adresse à diffuser à vos équipes. Ouverte depuis un téléphone, elle lance l'application si elle est installée, et propose les deux boutiques sinon. Depuis un poste, elle mène à l'espace web."],
      ['Le lien d’invitation y mène tout seul.', "Chaque personne invitée reçoit un e-mail qui la conduit à choisir son mot de passe, puis à l'application. Il n'y a pas de notice à écrire, pas de code à faire circuler."],
      ['Par votre catalogue, l’étape disparaît.', "Si vous distribuez par MDM, l'application est déjà là quand la personne ouvre son lien. C'est le chemin recommandé pour un parc géré — la page suivante le détaille."],
    ], { x: M, y: 3.05, w: COL, h: 3.3, size: 12, gap: 11 })
    d.ecranEntier(s, { x: RX + 1.6, y: 1.5, h: 4.7, tel: capTelechargement, legende: 'www.quantinvo.com/open, vu d’un téléphone.' })
    d.pied(s, 5, PIED)
    s.addNotes("Point d'honnêteté à dire à l'oral : tant que la publication sur les boutiques n'est pas achevée, ces deux boutons ouvrent la recherche, et la page l'annonce. Un parc géré par MDM n'est pas concerné.")
  }

  // ════ 6. Déploiement ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Déploiement')
    d.titre(s, 'Par votre catalogue d’entreprise, comme n’importe quelle application.')
    d.para(s, "Workspace ONE, Intune, SOTI, Ivanti, Jamf ou autre : il n'y a pas de version spéciale à demander, pas d'installation manuelle, pas de compte Apple ou Google personnel sur les appareils.", { x: M, y: 3.8, w: COL, h: 1.8, size: 12 })
    tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [2.6, 4.6],
      head: ["Identifiants de l'application", ''],
      rows: [
        ['Nom', 'Quantinvo'],
        ['Identifiant iOS', 'com.quantinvo.app'],
        ['Identifiant Android', 'com.quantinvo.app'],
        ['Version minimale iOS', '16.4'],
        ['Version minimale Android', '7.0, à confirmer'],
        ['Éditeur', 'Devkaylab'],
      ],
      rh: 0.4, size: 11,
    })
    d.alineas(s, [
      ['iPhone et iPad.', "Depuis Apple Business Manager, « Apps et livres » : vous attribuez les licences, votre MDM distribue, l'installation est silencieuse. Si votre politique interdit les applications publiques, nous publions une application personnalisée réservée à votre organisation."],
      ['Android et terminaux durcis.', "Par Managed Google Play, ou en chargeant l'APK que nous vous remettons comme application interne. Zebra, Honeywell et Datalogic fonctionnent ; le mode « application unique » est compatible."],
    ], { x: RX, y: 4.55, w: RW, h: 2.2, size: 11.5, gap: 8 })
    d.pied(s, 6, PIED)
    s.addNotes("La fiche de déploiement MDM reprend ces éléments en une page, à remettre telle quelle à l'équipe qui administre le parc.")
  }

  // ════ 7. Profil de restrictions ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Profil de restrictions')
    d.titre(s, 'Quatre points à vérifier. Trois bloquent en silence.')
    d.para(s, "Sans les trois premiers, l'application s'installe et ne sert à rien. Personne ne vous le dira : le compteur verra juste un écran noir, ou un téléphone qui ne synchronise pas.", { x: M, y: 3.8, w: COL, h: 1.6, size: 12 })
    const items = [
      ['La caméra reste autorisée.', "C'est le lecteur de codes-barres. Une restriction qui coupe l'appareil photo rend le comptage impossible. Les douchettes Bluetooth marchent aussi, en complément."],
      ['Trois adresses joignables en HTTPS, port 443.', "heabesqvlinzarqenymj.supabase.co (données, authentification, temps réel, WebSocket compris) · exp.host (jeton de notification, au premier lancement) · www.quantinvo.com (liens reçus par e-mail). APNs et FCM sont ouverts par défaut presque partout."],
      ["Pas d'effacement à distance pendant un inventaire.", "L'application fonctionne hors ligne : en réserve, en chambre froide, les comptages attendent sur l'appareil et partent au retour du réseau. Un effacement ou une désinstallation pendant cette fenêtre perd ce travail. C'est propre à Quantinvo, et c'est le point qu'on oublie."],
      ['Les notifications, recommandées.', "Elles servent à prévenir quelqu'un qu'il a été invité à un inventaire. Sans elles, tout fonctionne ; la personne ouvre simplement l'application pour voir."],
    ]
    let y = 1.5
    items.forEach(([h4, txt], i) => {
      d.numero(s, i + 1, RX, y + 0.02, 0.36, i < 3 ? P.DEEP : P.SLATE)
      s.addText(h4, { x: RX + 0.55, y, w: RW - 0.55, h: 0.32, fontFace: FONTD, fontSize: 13, bold: true, color: P.INK, margin: 0 })
      s.addText(txt, { x: RX + 0.55, y: y + 0.36, w: RW - 0.55, h: 0.95, fontFace: FONT, fontSize: 11.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
      y += i === 1 || i === 2 ? 1.4 : 1.15
    })
    d.pied(s, 7, PIED)
    s.addNotes("Le troisième point est celui qu'aucune autre application ne pose. Le dire explicitement à l'équipe parc, pas seulement à la DSI.")
  }

  // ════ 8. La mise en place ════
  {
    const s = pres.addSlide()
    d.entete(s, 'La mise en place')
    d.titreLarge(s, 'De la signature au premier comptage')
    const steps = [
      ['Les comptes', "L'administrateur d'entreprise est créé à la souscription. Il invite ses superviseurs, qui invitent leurs compteurs : prénom, nom, adresse professionnelle. Chacun reçoit son lien et choisit son mot de passe."],
      ["L'application", "Vous la poussez par votre catalogue, ou chacun l'installe depuis /open. Rien à configurer à l'ouverture : adresse e-mail et mot de passe."],
      ['Les fichiers', "Le superviseur importe le référentiel articles et le stock théorique, en CSV ou Excel, tels qu'ils sortent de votre système. Les noms de colonnes usuels sont reconnus."],
      ['Les zones', "Il imprime une planche de balises — des étiquettes numérotées en PDF —, les colle en rayon et affecte les plages aux emplacements."],
    ]
    const n = steps.length, cw = (W - 2 * M - 0.4 * (n - 1)) / n
    const yl = 2.5
    d.filet(s, M + 0.2, yl + 0.21, W - 2 * M - 0.4, P.HAIR)
    steps.forEach(([h4, txt], i) => {
      const x = M + i * (cw + 0.4)
      d.numero(s, i + 1, x, yl, 0.42)
      s.addText(h4, { x, y: yl + 0.65, w: cw, h: 0.4, fontFace: FONTD, fontSize: 16, bold: true, color: P.DEEP, margin: 0 })
      s.addText(txt, { x, y: yl + 1.08, w: cw, h: 2.3, fontFace: FONT, fontSize: 11.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.16 })
    })
    d.encadre(s, 'Ce que ça vous coûte en temps', "Une demi-journée pour un premier magasin, le plus long étant l'export de vos fichiers depuis votre système. Il n'y a ni serveur à provisionner, ni recette à organiser, ni fenêtre de bascule à réserver.", { x: M, y: 5.6, w: W - 2 * M, h: 1.05 })
    d.pied(s, 8, PIED)
    s.addNotes("Question systématique d'une DSI : combien de jours-homme de notre côté ? La réponse honnête est une demi-journée, et le travail est surtout côté métier, pas côté informatique.")
  }

  // ════ 9. La préparation, à l'écran ════
  {
    const s = pres.addSlide()
    d.entete(s, 'La préparation')
    d.titre(s, 'Tout se prépare depuis le navigateur.', { size: 24, h: 1.4 })
    d.alineas(s, [
      ['Aucune installation sur les postes.', "Le superviseur travaille sur www.quantinvo.com, dans le navigateur qu'il a déjà. Rien à déployer, rien à mettre à jour, rien à ouvrir sur le poste."],
      ['Deux fichiers, et c’est prêt.', "Le référentiel articles donne les libellés et les prix d'achat ; le stock théorique donne l'attendu. L'écran indique ce qui manque encore avant de pouvoir commencer."],
      ['Les balises sortent en PDF.', "Une planche d'étiquettes numérotées, imprimée sur des feuilles autocollantes du commerce. Aucun consommable spécifique."],
    ], { x: M, y: 2.9, w: COL, h: 3.4, size: 12, gap: 11 })
    const g = d.cadre(s, capSetup, { x: RX, y: 1.5, w: RW, h: 4.9 })
    d.legende(s, 'Onglet Set up, données d’essai.', { x: RX, y: 1.5 + g.h + 0.14, w: RW })
    d.pied(s, 9, PIED)
    s.addNotes("Insister sur « rien à installer sur les postes » : c'est ce qui retire le sujet de la liste des chantiers de la DSI.")
  }

  // ════ 10. La prise en main ════
  {
    const s = pres.addSlide()
    d.entete(s, 'La prise en main')
    d.titreLarge(s, 'Ce que la personne qui compte a à apprendre', { y: 1.3, size: 25 })
    await troisEcrans(s, [
      { titre: '1 — Rejoindre l’inventaire', texte: "Elle ouvre l'application, choisit l'inventaire du jour, et se met en comptage ou en audit.", fichier: 'inventaire-compteur.png', fill: P.MIST },
      { titre: '2 — Scanner la balise du rayon', texte: "L'étiquette numérotée ouvre la zone. Tout ce qui suit s'y rattache.", fichier: 'scanner-balise.png', fill: P.TINT },
      { titre: '3 — Scanner les articles', texte: "Caméra, saisie manuelle ou douchette. La quantité se corrige d'un appui, la zone se clôture à la fin.", fichier: 'comptage.png', fill: P.MIST },
    ], { y: 2.05 })
    d.pied(s, 10, PIED)
    s.addNotes("Trois gestes, dix minutes de prise en main, aucun briefing matériel. C'est ce qui permet de faire compter des équipes de vente plutôt qu'un service spécialisé. Le guide illustré complet est remis après la signature — et depuis septembre 2026 il vit aussi dans le produit : le superviseur l'ouvre depuis sa boîte à outils, sur le site, et peut l'imprimer pour la réserve.")
  }

  // ════ 11. Comptes et accès ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Comptes et accès')
    d.titre(s, 'Des comptes nominatifs, créés sur invitation. Personne ne s’inscrit.')
    d.para(s, "Savoir qui a compté quoi est nécessaire pour arbitrer un écart. C'est pour cela que chaque personne a son compte, et qu'il n'y a pas d'inscription libre.", { x: M, y: 3.8, w: COL, h: 1.5, size: 12 })
    tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [2.3, 4.9],
      head: ['Rôle', 'Ce qu’il voit et ce qu’il fait'],
      rows: [
        ["Administrateur d'entreprise", "Tous les magasins, toutes les personnes, tous les inventaires de son entreprise. Invite, retire, supprime, lit le journal des actions."],
        ['Superviseur', "Ses magasins. Crée et pilote les inventaires, constitue son équipe, arbitre les écarts, lit les rapports."],
        ['Compteur', "Les inventaires auxquels il est invité. Il scanne, il compte, il audite. Aucun accès au site."],
      ],
      rh: 0.66,
    })
    d.alineas(s, [
      ['Mot de passe.', "Douze caractères minimum, majuscule, minuscule, chiffre, symbole ; refus des mots de passe présents dans les fuites connues. Changer le sien exige l'ancien."],
      ['Double authentification.', "Par code à usage unique (TOTP), activable par chacun depuis son compte. Quand elle est activée, le serveur la vérifie, pas seulement l'écran."],
      ['Sessions.', "Expiration après 30 jours sans usage, et au plus 180 jours depuis la connexion. Un téléphone perdu cesse d'être connecté."],
      ['Cloisonnement.', "Le filtrage par entreprise et par rôle est fait dans la base, à chaque requête. Un écran contourné ne donne rien."],
    ], { x: RX, y: 4.05, w: RW, h: 2.7, size: 11.5, gap: 7 })
    d.pied(s, 11, PIED)
    s.addNotes("Le point à retenir pour un RSSI : les droits sont appliqués par le serveur (policies de base de données), pas par l'interface. La double authentification est vérifiée côté serveur.")
  }

  // ════ 12. Sécurité ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Sécurité')
    d.titre(s, 'Ce qui est en place.')
    d.para(s, "Le détail des audits est en page suivante.", { x: M, y: 3.7, w: COL, h: 0.5, size: 12, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['En transit et au repos.', "Tout le trafic est chiffré (TLS). Les données sont chiffrées au repos par l'hébergeur, qui en assure aussi les sauvegardes quotidiennes."],
      ['Sur le téléphone.', "Le jeton de session est rangé dans le trousseau du système — Keychain sur iOS, Keystore sur Android — chiffré par l'appareil, pas dans un fichier de l'application."],
      ['Site.', "En-têtes de sécurité posés (politique de contenu, interdiction d'intégration dans un cadre, restriction des destinations réseau). Aucun traceur, aucune mesure d'audience : il n'y a pas de bandeau cookies parce qu'il n'y a pas de cookie à déclarer."],
      ['Journal.', "Chaque action d'administration — création d'un compte, retrait d'un accès, suppression — est journalisée avec son auteur, et conservée un an. Votre administrateur lit le sien depuis son espace."],
      ['Suivi d’activité.', "Le tableau de bord voit des compteurs (appareils connectés, en comptage, en audit), jamais qui fait quoi en direct. Ce qui reste nominatif, c'est l'auteur d'un comptage, pour l'arbitrage."],
      ['Effacement.', "Les durées de conservation sont appliquées automatiquement, chaque nuit : journaux à un an, demandes et invitations traitées à trois mois, et purge des données expirées."],
    ], { y: 1.5, h: 5.2, size: 12, gap: 9 })
    d.pied(s, 12, PIED)
    s.addNotes("Deux points que peu d'éditeurs de cette taille peuvent dire : le jeton dans le trousseau système, et les durées de conservation réellement exécutées par une tâche planifiée — pas seulement écrites dans une politique.")
  }

  // ════ 13. Ce qui a été audité ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les audits')
    d.titre(s, 'Ce qui a été audité, et par quelle méthode.')
    d.chiffre(s, '3', "revues conduites en août 2026 : conformité, parcours de paiement, et l'ensemble des surfaces serveur.", { y: 3.5, size: 46 })
    d.alineas(s, [
      ['Conformité RGPD et sécurité.', "Quinze constats relevés le 13 août, treize clos au 19. Les deux restants sont des documents juridiques en relecture — registre des traitements et clauses de sous-traitance."],
      ['Modélisation de menaces du parcours de l’argent.', "Méthode STRIDE, appliquée au chemin complet — demande, devis, acceptation, paiement, création des accès. Quatre constats, tous corrigés le jour même, avec des tests qui empêchent leur retour."],
      ['Revue des surfaces serveur.', "Balayage des fonctions de base de données, des règles d'accès et des fonctions distantes, par motif de défaut connu. Cinq constats, tous corrigés le jour même. Trois l'ont été par retrait : une permission dont personne ne se sert n'a pas besoin d'un contrôle, elle a besoin d'être injoignable."],
      ['Ce que nous ne faisons pas.', "Pas de test d'intrusion externe à ce jour, et pas de certification ISO. Si votre politique l'exige, nous accueillons le vôtre."],
    ], { y: 1.5, h: 5.2, size: 12, gap: 10 })
    d.pied(s, 13, PIED)
    s.addNotes("Le dernier alinéa est volontaire : un pentest externe n'a pas été fait, autant le dire avant qu'on ne le demande. Les synthèses d'audit se remettent au DPO ou au RSSI sur demande.")
  }

  // ════ 14. Hors ligne et charge ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Hors ligne et charge')
    d.titre(s, 'Le réseau tombe en réserve. Le comptage continue.')
    d.para(s, "C'est le cas le plus fréquent sur le terrain, et celui pour lequel l'application a été construite.", { x: M, y: 3.8, w: COL, h: 1.0, size: 12, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['Hors ligne.', "Les scans sont enregistrés sur le téléphone et renvoyés automatiquement au retour du réseau, dans l'ordre. Le compteur voit ce qui attend et ce qui est parti. Une session expirée n'efface rien : la file attend la reconnexion."],
      ['Plusieurs compteurs par magasin.', "Chaque téléphone envoie un signal toutes les 5 à 30 secondes ; il n'écoute rien. Seul le tableau de bord écoute. Le coût du suivi croît avec le nombre de téléphones, pas avec son carré."],
      ['Tableau de bord.', "Les totaux sont calculés par la base, pas téléchargés. Un tableau de bord ouvert recalcule au plus une fois par minute, et se met au repos quand personne ne scanne."],
      ['Volumes.', "Un référentiel de plusieurs dizaines de milliers de références s'importe par lots. Pour un réseau de plusieurs centaines de magasins comptant le même jour, nous montons la capacité de la base : c'est un réglage, pas un chantier."],
    ], { y: 1.5, h: 5.2, size: 12, gap: 10 })
    d.pied(s, 14, PIED)
    s.addNotes("Le point d'architecture qui compte : les téléphones n'écoutent pas le canal temps réel. C'est ce qui permet cent compteurs dans le même magasin.")
  }

  // ════ 15. RGPD ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Protection des données')
    d.titreLarge(s, 'Qui est responsable de quoi')
    const cw = (W - 2 * M - 0.6) / 2
    s.addText('Vous, responsable de traitement', { x: M, y: 2.45, w: cw, h: 0.35, fontFace: FONTD, fontSize: 13.5, bold: true, color: P.DEEP, margin: 0 })
    s.addText('Devkaylab, sous-traitant', { x: M + cw + 0.6, y: 2.45, w: cw, h: 0.35, fontFace: FONTD, fontSize: 13.5, bold: true, color: P.DEEP, margin: 0 })
    d.filet(s, M, 2.9, W - 2 * M)
    d.liste(s, [
      "Vous décidez des inventaires, de qui compte, et de la durée de conservation des données d'inventaire.",
      "Vous informez vos salariés (une note type vous est fournie) et consultez votre CSE si votre organisation le prévoit.",
      "En cas de violation, c'est vous qui notifiez la CNIL sous 72 heures ; nous vous prévenons sans délai et vous donnons les éléments.",
    ], { x: M, y: 3.05, w: cw, h: 3.0, size: 11.5, gap: 8 })
    d.liste(s, [
      "Nous hébergeons, sécurisons, sauvegardons, et n'utilisons les données que pour rendre le service. Rien n'est vendu ni réutilisé.",
      "Les clauses de sous-traitance (article 28) sont fournies à la signature, avec la liste des sous-traitants ultérieurs.",
      "Les droits sont outillés : chaque personne télécharge ses données depuis son compte ; la suppression d'un compte conserve les comptages mais les détache du nom.",
      "Durées : comptes tant qu'ils sont actifs, journaux un an, demandes et invitations purgées. Le suivi en direct n'est jamais enregistré.",
    ], { x: M + cw + 0.6, y: 3.05, w: cw, h: 3.4, size: 11.5, gap: 8 })
    d.encadre(s, 'Documents remis', "Politique de confidentialité (publique), clauses article 28, synthèses d'audit, note d'information aux salariés, registre des traitements sur demande de votre DPO.", { x: M, y: 5.7, w: W - 2 * M, h: 0.95 })
    d.pied(s, 15, PIED)
    s.addNotes("La répartition des rôles est ce qui évite un malentendu plus tard : pour les données d'inventaire, le client est responsable de traitement, nous sommes sous-traitant.")
  }

  // ════ 16. Ce qui n'existe pas encore ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pour être clair')
    d.titre(s, "Ce qui n'existe pas encore.")
    d.para(s, "Rien de tout cela n'empêche de déployer. Dites-nous ce qui est une exigence chez vous, et dans quel ordre.", { x: M, y: 3.7, w: COL, h: 1.2, size: 12.5, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['Connexion par votre annuaire (SAML 2.0, Entra ID).', "Les comptes sont locaux, créés par invitation. Techniquement possible ; pas planifié tant qu'un client ne le demande pas."],
      ['Configuration administrée (AppConfig).', "Pré-remplir l'adresse e-mail ou le magasin depuis votre MDM, pour que la personne n'ait rien à saisir au premier lancement."],
      ['Publication sur Google Play.', "L'application tourne sur Android ; sa mise en ligne est en cours. En attendant, l'APK se distribue par votre catalogue — ce qui est de toute façon le chemin d'un parc géré."],
      ['API et connecteur ERP.', "L'échange se fait par fichiers : import CSV ou Excel, export Excel. Un connecteur viendra avec le premier client qui en a besoin, pas avant."],
      ['Codes de secours pour la double authentification.', "Un téléphone perdu se dépanne par nous, sur demande de votre administrateur. C'est dit avant l'activation, pas après la perte."],
    ], { y: 1.5, h: 5.2, size: 12, gap: 10 })
    d.pied(s, 16, PIED)
    s.addNotes("Page volontairement franche. Une DSI qui découvre un manque après signature se souvient du manque ; une DSI prévenue se souvient de la franchise.")
  }

  // ════ 17. Pour finir ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Ce qu’on vous remet, et à qui.',
      texte: "La fiche de déploiement MDM pour l'équipe parc. La politique de confidentialité, les clauses article 28 et les synthèses d'audit pour votre DPO. Le guide de prise en main pour vos superviseurs — remis en présentation, et consultable à tout moment depuis leur espace, où il s'imprime pour la réserve. La note d'information aux salariés pour vos RH. Et un interlocuteur qui répond.",
      contact: 'contact@quantinvo.com   ·   www.quantinvo.com',
      bas: 'Quantinvo, par Devkaylab. L’outil d’inventaire pour le commerce.',
    })
    s.addNotes("Finir sur les documents concrets. Chacun a un destinataire chez le client ; le dire évite que tout parte à la même personne.")
  }

  await ecrire(pres, 'Quantinvo-dossier-DSI')
}

main().catch((e) => { console.error(e); process.exit(1) })
