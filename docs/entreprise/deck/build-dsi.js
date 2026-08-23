// Dossier technique Quantinvo, pour la direction informatique du client.
// node build-dsi.js                 → Quantinvo-dossier-DSI.pptx
// FONT_MODE=brand node build-dsi.js → Quantinvo-dossier-DSI-marque.pptx
//
// Les faits viennent de `deploiement-mdm.md`, de `docs/privacy.html` et
// d'AGENTS.md (audit du 13 août 2026, sessions, mots de passe). Si l'un
// d'eux bouge, ce deck doit bouger avec.

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire } = require('./charte')

async function main() {
  const d = await preparer({ titre: 'Quantinvo — dossier technique' })
  const { pres } = d
  const PIED = 'Quantinvo · dossier technique · août 2026'

  // Petit tableau à filets : colonnes [{w, align}], lignes [[cellules]].
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

  // Boîte du schéma d'architecture.
  function boite(s, x, y, w, h, titre, lignes, { fill = P.MIST, line = P.HAIR } = {}) {
    s.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: line, width: 1 } })
    s.addText(titre, { x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.3, fontFace: FONTD, fontSize: 12.5, bold: true, color: P.INK, margin: 0 })
    s.addText(lignes.join('\n'), { x: x + 0.2, y: y + 0.5, w: w - 0.4, h: h - 0.6, fontFace: FONT, fontSize: 10.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
  }
  function lien(s, x1, y1, x2, y2, libelle, lw = 1.2) {
    s.addShape('line', { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), line: { color: P.SLATE, width: 1, dashType: 'dash' } })
    if (libelle) {
      // Le libellé se pose au-dessus du trait, sur la largeur de l'espace entre les boîtes.
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
      sousTitre: "Architecture, hébergement, déploiement par votre catalogue d'entreprise, comptes, sécurité, protection des données. Et ce qui n'existe pas encore, dit tel quel.",
      bas: 'Devkaylab  ·  état au 23 août 2026  ·  www.quantinvo.com',
    })
    s.addNotes("Ce dossier accompagne la présentation commerciale. Il répond aux questions qu'une DSI pose avant signature, et se remet avec la fiche de déploiement MDM.")
  }

  // ════ 2. En une page ════
  {
    const s = pres.addSlide()
    d.entete(s, 'En une page')
    d.titre(s, 'Une application mobile, un site web, et rien à installer chez vous.')
    d.alineas(s, [
      ['Ce que c’est.', "Une application sur iPhone (Android en cours) pour les personnes qui comptent, un site web pour celles qui pilotent, et une base de données hébergée en Irlande qui relie les deux."],
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
    // Téléphones à gauche, base au centre, site à droite ; services annexes en bas.
    const by = 2.6
    const w1 = 2.95, w2 = 3.55, w3 = 2.95, g = (W - 2 * M - w1 - w2 - w3) / 2
    const x1 = M, x2 = M + w1 + g, x3 = x2 + w2 + g
    boite(s, x1, by, w1, 1.85, 'Téléphones des compteurs', ['Application Quantinvo (iOS, Android à venir).', 'Scan par la caméra ; comptages gardés sur l’appareil hors réseau, renvoyés au retour.'])
    boite(s, x2, by, w2, 1.85, 'Base et services, Irlande', ['Postgres, authentification, temps réel, fonctions serveur. Hébergé par Supabase, région eu-west-1.', 'Chaque requête est filtrée côté serveur, par entreprise et par rôle.'], { fill: P.TINT, line: P.ACCENT })
    boite(s, x3, by, w3, 1.85, 'Postes des superviseurs', ['Site web www.quantinvo.com, sans installation.', 'Tableau de bord, imports, rapports. Hébergé par Vercel.'])
    lien(s, x1 + w1, by + 0.92, x2, by + 0.92, 'HTTPS 443', g)
    lien(s, x2 + w2, by + 0.92, x3, by + 0.92, 'HTTPS, WebSocket', g)
    const by2 = by + 2.55
    boite(s, x1, by2, w1, 1.3, 'Notifications', ['Jeton obtenu via Expo (exp.host), puis APNs / FCM. Sert à prévenir d’une invitation.'])
    boite(s, x2, by2, w2, 1.3, 'E-mails de service', ['Invitations, devis, accusés. Envoyés par Resend, depuis send.quantinvo.com. Jamais de code d’accès par e-mail.'])
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
    d.para(s, "Les données d'inventaire, les comptes et les journaux sont stockés en Irlande et n'en sortent pas. Les services annexes (site, e-mails, notifications) font appel à des prestataires établis aux États-Unis, sur la base de leurs clauses contractuelles types.", { x: M, y: 3.8, w: COL, h: 2.2, size: 12 })
    tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [2.2, 3.3, 1.7],
      head: ['Prestataire', 'Rôle', 'Localisation'],
      rows: [
        ['Supabase', 'Base de données, authentification, temps réel, fonctions', 'Irlande (eu-west-1)'],
        ['Vercel', 'Hébergement du site www.quantinvo.com', 'États-Unis'],
        ['Resend', 'Acheminement des e-mails de service', 'États-Unis'],
        ['Expo', "Obtention du jeton de notification de l'appareil", 'États-Unis'],
        ['Apple, Google', "Distribution de l'application mobile", 'États-Unis'],
      ],
      rh: 0.62,
    })
    d.encadre(s, 'À savoir', "La liste est la même que celle de la politique de confidentialité publiée. Un test automatique empêche d'ajouter un prestataire au produit sans le déclarer.", { x: RX, y: 5.3, w: RW, h: 1.1 })
    d.pied(s, 4, PIED)
    s.addNotes("Être précis sur la frontière : les données d'inventaire restent en Irlande ; ce qui passe par les États-Unis, c'est l'acheminement des e-mails et des notifications, et le site.")
  }

  // ════ 5. Déploiement ════
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
        ['Version minimale Android', '7.0, à confirmer au premier build'],
        ['Éditeur', 'Devkaylab'],
      ],
      rh: 0.4, size: 11,
    })
    d.alineas(s, [
      ['iPhone et iPad.', "Depuis Apple Business Manager, « Apps et livres » : vous attribuez les licences, votre MDM distribue, l'installation est silencieuse. Si votre politique interdit les applications publiques, nous publions une application personnalisée réservée à votre organisation."],
      ['Android et terminaux durcis.', "Par Managed Google Play, ou en chargeant l'APK que nous vous remettons comme application interne. Zebra, Honeywell et Datalogic fonctionnent ; le mode « application unique » est compatible."],
    ], { x: RX, y: 4.55, w: RW, h: 2.2, size: 11.5, gap: 8 })
    d.pied(s, 5, PIED)
    s.addNotes("La fiche de déploiement MDM reprend ces éléments en une page, à remettre telle quelle à l'équipe qui administre le parc.")
  }

  // ════ 6. Profil de restrictions ════
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
    d.pied(s, 6, PIED)
    s.addNotes("Le troisième point est celui qu'aucune autre application ne pose. Le dire explicitement à l'équipe parc, pas seulement à la DSI.")
  }

  // ════ 7. Comptes et accès ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Comptes et accès')
    d.titre(s, 'Des comptes nominatifs, créés sur invitation. Personne ne s’inscrit.')
    d.para(s, "Savoir qui a compté quoi est nécessaire pour arbitrer un écart. C'est pour cela que chaque personne a son compte, et qu'il n'y a pas d'inscription libre.", { x: M, y: 3.8, w: COL, h: 1.5, size: 12 })
    tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [2.3, 4.9],
      head: ['Rôle', 'Ce qu’il voit et ce qu’il fait'],
      rows: [
        ["Administrateur d'entreprise", "Tous les magasins, toutes les personnes, tous les inventaires de son entreprise. Invite, retire, supprime. Nommé par Quantinvo."],
        ['Superviseur', "Ses magasins. Crée et pilote les inventaires, constitue son équipe, lit les rapports."],
        ['Compteur', "Les inventaires auxquels il est invité. Il scanne, il compte, il audite. Rien d'autre."],
      ],
      rh: 0.66,
    })
    d.alineas(s, [
      ['Mot de passe.', "Douze caractères minimum, majuscule, minuscule, chiffre, symbole ; refus des mots de passe présents dans les fuites connues. Changer le sien exige l'ancien."],
      ['Double authentification.', "Par code à usage unique (TOTP), activable par chacun depuis son compte. Quand elle est activée, le serveur la vérifie, pas seulement l'écran."],
      ['Sessions.', "Expiration après 30 jours sans usage, et au plus 180 jours depuis la connexion. Un téléphone perdu cesse d'être connecté."],
      ['Cloisonnement.', "Le filtrage par entreprise et par rôle est fait dans la base, à chaque requête. Un écran contourné ne donne rien."],
    ], { x: RX, y: 4.05, w: RW, h: 2.7, size: 11.5, gap: 7 })
    d.pied(s, 7, PIED)
    s.addNotes("Le point à retenir pour un RSSI : les droits sont appliqués par le serveur (policies de base de données), pas par l'interface. La double authentification est vérifiée côté serveur.")
  }

  // ════ 8. Sécurité ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Sécurité')
    d.titre(s, 'Ce qui est en place, et ce qui a été audité.')
    d.chiffre(s, '13 / 15', "constats de l'audit RGPD et sécurité du 13 août 2026 clos au 19 août. Les deux restants sont des documents juridiques en relecture.", { y: 3.6, size: 40 })
    d.alineas(s, [
      ['En transit et au repos.', "Tout le trafic est chiffré (TLS). Les données sont chiffrées au repos par l'hébergeur, qui en assure aussi les sauvegardes quotidiennes."],
      ['Site.', "En-têtes de sécurité posés (politique de contenu, interdiction d'intégration dans un cadre, etc.). Aucun traceur, aucune mesure d'audience : il n'y a pas de bandeau cookies parce qu'il n'y a pas de cookies à déclarer."],
      ['Journal.', "Chaque action d'administration (création d'un compte, retrait d'un accès, suppression) est journalisée, avec son auteur, et conservée un an. Votre administrateur lit le sien."],
      ['Suivi d’activité.', "Le tableau de bord voit des compteurs (appareils connectés, en comptage, en audit), jamais qui fait quoi en direct. Ce qui reste nominatif, c'est l'auteur d'un comptage, pour l'arbitrage."],
      ['Ce que nous ne faisons pas.', "Pas de test d'intrusion externe à ce jour. Si votre politique l'exige, nous l'accueillons."],
    ], { y: 1.5, h: 5.2, size: 12.5, gap: 10 })
    d.pied(s, 8, PIED)
    s.addNotes("La synthèse d'audit est un document séparé, remis au DPO. Le dernier alinéa est volontaire : un pentest n'a pas été fait, autant le dire.")
  }

  // ════ 9. Hors ligne et charge ════
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
    d.pied(s, 9, PIED)
    s.addNotes("Le point d'architecture qui compte : les téléphones n'écoutent pas le canal temps réel. C'est ce qui permet cent compteurs dans le même magasin.")
  }

  // ════ 10. RGPD ════
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
    d.encadre(s, 'Documents remis', "Politique de confidentialité (publique), clauses article 28, synthèse de l'audit, note d'information aux salariés, registre des traitements sur demande de votre DPO.", { x: M, y: 5.7, w: W - 2 * M, h: 0.95 })
    d.pied(s, 10, PIED)
    s.addNotes("La répartition des rôles est ce qui évite un malentendu plus tard : pour les données d'inventaire, le client est responsable de traitement, nous sommes sous-traitant.")
  }

  // ════ 11. Ce qui n'existe pas encore ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pour être clair')
    d.titre(s, "Ce qui n'existe pas encore.")
    d.para(s, "Rien de tout cela n'empêche de déployer. Dites-nous ce qui est une exigence chez vous, et dans quel ordre.", { x: M, y: 3.7, w: COL, h: 1.2, size: 12.5, italic: true, color: P.SLATE })
    d.alineas(s, [
      ['Connexion par votre annuaire (SAML 2.0, Entra ID).', "Les comptes sont locaux, créés par invitation. Techniquement possible ; pas planifié tant qu'un client ne le demande pas."],
      ['Configuration administrée (AppConfig).', "Pré-remplir l'adresse e-mail ou le magasin depuis votre MDM, pour que la personne n'ait rien à saisir au premier lancement."],
      ['Android.', "Le build est en cours. Les identifiants sont réservés ; la fiche MDM le signale."],
      ['API et connecteur ERP.', "L'échange se fait par fichiers : import CSV ou Excel, export Excel. Un connecteur viendra avec le premier client qui en a besoin, pas avant."],
      ['Codes de secours pour la double authentification.', "Un téléphone perdu se dépanne par nous, sur demande de votre administrateur. C'est dit avant l'activation, pas après la perte."],
    ], { y: 1.5, h: 5.2, size: 12, gap: 10 })
    d.pied(s, 11, PIED)
    s.addNotes("Page volontairement franche. Une DSI qui découvre un manque après signature se souvient du manque ; une DSI prévenue se souvient de la franchise.")
  }

  // ════ 12. Pour finir ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Ce qu’on vous remet, et à qui.',
      texte: "La fiche de déploiement MDM pour l'équipe parc. La politique de confidentialité, les clauses article 28 et la synthèse d'audit pour votre DPO. La note d'information aux salariés pour vos RH. Et un interlocuteur qui répond.",
      contact: 'contact@quantinvo.com   ·   www.quantinvo.com',
      bas: 'Quantinvo, par Devkaylab. L’outil d’inventaire pour le commerce.',
    })
    s.addNotes("Finir sur les documents concrets. Chacun a un destinataire chez le client ; le dire évite que tout parte à la même personne.")
  }

  await ecrire(pres, 'Quantinvo-dossier-DSI')
}

main().catch((e) => { console.error(e); process.exit(1) })
