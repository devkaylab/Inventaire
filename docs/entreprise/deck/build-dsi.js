// Dossier technique Quantinvo, pour la direction informatique du client.
// node build-dsi.js                 → Quantinvo-dossier-DSI.pptx
// FONT_MODE=brand node build-dsi.js → Quantinvo-dossier-DSI-marque.pptx
//
// Réécrit le 19 septembre 2026. Chaque phrase a été vérifiée ce jour-là dans
// le dépôt (src/, web/, supabase/), dans docs/privacy.html, dans les
// conditions générales (docs/entreprise/cgv-quantinvo-brouillon.md) ou sur la
// base en service. Si l'une de ces sources bouge, ce deck bouge avec.
//
// ⚠️ CE QUI N'Y EST VOLONTAIREMENT PAS :
//   · l'adresse du projet Supabase et tout identifiant interne ;
//   · les plafonds mesurés de la tenue en charge : on cite les chiffres du
//     site (100 000 références, 100 compteurs), pas le point de rupture ;
//   · « disponible sur l'App Store / Google Play » : web/lib/appStores.ts
//     dit PUBLIEE = false au 19 septembre 2026 ;
//   · des sauvegardes « au-delà » de ce que l'offre Pro de Supabase fait
//     (quotidiennes, 7 jours) : pas de restauration à un instant précis ;
//   · aucun prix : ce dossier n'en porte pas.
//
// Ordre : où ça tourne (2-4), qui accède (5-8), ce que deviennent les données
// (9-11), le terrain (12-15), puis ce que le client prépare (16).

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer } = require('./charte')

const NB = '\u00A0' // espace insécable, pour les couples que charte.js ne protège pas

/**
 * Apostrophe typographique, sur une chaîne ou sur des runs.
 *
 * ⚠️ PAS DE TRAIT D'UNION INSÉCABLE (U+2011) : Arial et Public Sans n'ont pas
 * ce glyphe, LibreOffice l'affiche en carré vide (« e□mails », essayé le
 * 19 septembre 2026). Une coupure au tiret se corrige en déplaçant la fin de
 * ligne (retour forcé, mot déplacé), puis se vérifie sur le rendu : pdftotext
 * recolle le mot coupé, verifier-typo.js ne la voit donc pas.
 */
function apos(t) {
  if (Array.isArray(t)) return t.map((r) => (r && typeof r.text === 'string' ? { ...r, text: apos(r.text) } : r))
  return typeof t === 'string' ? t.replace(/'/g, '’') : t
}

async function main() {
  const d = await preparer({ titre: 'Quantinvo — dossier technique' })
  const { pres } = d
  // Toute boîte de texte passe par apos(), avant la typographie de charte.js.
  const addSlide0 = pres.addSlide.bind(pres)
  pres.addSlide = (...a) => {
    const s = addSlide0(...a)
    const at = s.addText.bind(s)
    s.addText = (t, o) => at(apos(t), o)
    return s
  }

  // ⚠️ Le mois est celui de la DERNIÈRE RÉVISION du contenu, pas la date du
  // jour : il ne se calcule pas.
  const PIED = 'Quantinvo · dossier technique · septembre 2026'
  const SITE = '../captures-site/2026-09-19-rayon-textile/brut/'

  /**
   * Tableau à filets : en-têtes gris, un filet sous chaque ligne, pas de fond.
   * `rh` : hauteur de ligne, ou un tableau d'une hauteur par ligne.
   */
  function tableau(s, { x, y, w, cols, head, rows, size = 11.5, rh = 0.5 }) {
    let cy = y
    let cx = x
    head.forEach((h, i) => {
      s.addText(h, { x: cx, y: cy, w: cols[i], h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: P.SLATE, margin: 0 })
      cx += cols[i]
    })
    cy += 0.36
    d.filet(s, x, cy, w)
    rows.forEach((r, k) => {
      const hr = Array.isArray(rh) ? rh[k] : rh
      cx = x
      r.forEach((c, i) => {
        const premiere = i === 0
        s.addText(c, {
          x: cx, y: cy + 0.11, w: cols[i] - 0.15, h: hr - 0.14,
          fontFace: premiere ? FONTD : FONT, fontSize: size, bold: premiere,
          color: premiere ? P.INK : P.INK2, margin: 0, lineSpacingMultiple: 1.12,
        })
        cx += cols[i]
      })
      cy += hr
      d.filet(s, x, cy, w)
    })
    return cy
  }

  /** Page avec téléphone entier à droite, alinéas à gauche. */
  async function pageTelephone(n, mention, titre, items, fichier, { gap = 16, h = 4.6, size = 13.5 } = {}) {
    const s = pres.addSlide()
    d.entete(s, mention)
    d.titreLarge(s, titre, { y: 1.3 })
    d.alineas(s, items, { x: M, y: 2.3, w: 8.8, h, size, gap })
    const tel = await cadrer(fichier, { w: 1, h: 99 })
    d.ecranEntier(s, { x: W - M - 2.3, y: 2.05, h: 4.8, tel })
    d.pied(s, n, PIED)
    return s
  }

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Dossier technique pour la direction informatique',
      titre: "Ce qu'il faut valider avant de déployer Quantinvo.",
      sousTitre: "Architecture, données, accès, réseau, appareils, conformité. Ce qui n'existe pas encore est dit sur la page concernée.",
      bas: 'Devkaylab · état au 19 septembre 2026 · www.quantinvo.com',
    })
  }

  // ════ 2. Architecture ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Architecture')
    d.titre(s, 'Une application, un site, une seule base.')
    d.para(s, 'Le téléphone et le navigateur interrogent directement la base. Le site se limite à servir ses pages.', { x: M, y: 2.75, w: COL, h: 1.2, size: 12 })
    tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [2.0, 2.4, 2.23], size: 12,
      head: ['Composant', 'Technologie', 'Usage'],
      rows: [
        ['Application mobile', 'Expo (React Native), pour iOS et Android', 'Comptage sur le terrain. Le superviseur peut aussi y préparer et suivre.'],
        ['Site', 'Next.js, hébergé par Vercel', `Préparation et suivi, sur${NB}ordinateur.`],
        ['Base de données', 'PostgreSQL, chez Supabase', `Données, comptes et règles${NB}d'accès.`],
        ['Traitements serveur', 'Supabase Edge Functions', 'Invitations, e-mails, notifications, paiement.'],
      ],
      rh: [1.02, 0.8, 0.8, 0.8],
    })
    d.pied(s, 2, PIED)
  }

  // ════ 3. Hébergement ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Hébergement')
    d.titre(s, "Les données d'inventaire sont stockées en Irlande.")
    d.para(s, 'Certains prestataires sont établis aux États-Unis. Les transferts de données vers eux reposent sur les clauses contractuelles types de la Commission européenne.', { x: M, y: 2.75, w: COL, h: 1.0, size: 12 })
    d.para(s, 'Liste publiée sur www.quantinvo.com/confidentialite.', { x: M, y: 3.85, w: COL, h: 0.5, size: 12, color: P.SLATE })
    tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [1.35, 2.75, 2.53], size: 11, rh: 0.66,
      head: ['Prestataire', 'Rôle', 'Localisation'],
      rows: [
        ['Supabase', 'Base de données, authentification, temps réel', 'Irlande, société américaine'],
        ['Vercel', 'Hébergement du site', 'États-Unis'],
        ['Resend', 'Envoi des e-mails de service', 'États-Unis'],
        ['Expo', 'Acheminement des notifications', 'États-Unis'],
        ['Stripe', 'Abonnements et factures', 'Irlande, groupe américain'],
        ['Apple, Google', "Distribution de l'application", 'États-Unis'],
      ],
    })
    d.pied(s, 3, PIED)
  }

  // ════ 4. Réseau ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Réseau')
    d.titre(s, 'Uniquement des flux sortants, en HTTPS.')
    d.para(s, "Aucun serveur ni VPN à installer chez vous. Les flux de Quantinvo passent par le port 443, WebSocket compris. Les notifications transitent par APNs (Apple) et FCM (Google), sur les ports de ces services. L'adresse de la base est communiquée sur demande.", { x: M, y: 2.75, w: COL, h: 2.2, size: 12 })
    tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [2.55, 1.95, 2.13], size: 11.5, rh: 0.75,
      head: ['Destination', 'Appelée par', 'Objet'],
      rows: [
        ['Base de données Supabase', 'Application, navigateur', 'Données, connexion, temps réel'],
        ['exp.host', 'Application', 'Jeton de notification'],
        ['www.quantinvo.com', 'Téléphones, postes', "Site, liens d'invitation"],
        ['Stripe', 'Navigateur', "Paiement de l'abonnement"],
      ],
    })
    d.pied(s, 4, PIED)
  }

  // ════ 5. Comptes ════
  await pageTelephone(5, 'Comptes', 'Un compte par personne, sur invitation.', [
    ['Parcours.', `L'administrateur d'entreprise invite les superviseurs. Le superviseur ajoute ses compteurs. La${NB}personne reçoit un lien, vérifie son nom et choisit son mot de passe.`],
    ['Mot de passe.', "Au moins 12 caractères, dont une majuscule, une minuscule, un chiffre et un symbole. Refusé s'il figure dans une fuite publique."],
    ['Double authentification.', "Chacun peut l'activer, avec une application d'authentification. Une fois activée, elle est exigée pour toute action d'administration. Pas de codes de secours."],
    ['Sessions.', 'Elles expirent après 30 jours sans usage, et au plus tard 180 jours après la connexion.'],
    ["Annuaire d'entreprise.", `Pas de connexion par SAML ni par Entra${NB}ID.`],
  ], 'ajouter-membre.png')

  // ════ 6. Rôles ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Rôles')
    d.titre(s, `Trois rôles, chacun${NB}son${NB}périmètre.`, { h: 1.2 })
    d.para(s, `Le compteur peut aussi rejoindre lui-même un inventaire, avec son N°${NB}d'inventaire et son code d'accès. Sur le site, il ne voit que Mon${NB}compte.`, { x: M, y: 2.75, w: COL, h: 1.0, size: 12 })
    const fin = tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [2.1, 2.3, 2.23], size: 11.5, rh: 0.72,
      head: ['Rôle', "Ce qu'il voit", "Ce qu'il fait"],
      rows: [
        ["Administrateur d'entreprise", `Tous les magasins de${NB}l'entreprise`, `Ajoute les magasins, gère${NB}l'abonnement`],
        ['Superviseur', "Les inventaires qu'il crée ou où il est invité", `Arbitre les écarts, clôture${NB}ses${NB}inventaires`],
        ['Compteur', "Les inventaires en cours qu'il a rejoints", `Compte et audite, dans${NB}l'application`],
      ],
    })
    // Le second paragraphe s'aligne sur le haut de la capture.
    d.para(s, "Une même personne peut être administrateur d'entreprise et superviseur. Un inventaire clôturé ne reste visible qu'à son créateur et à l'administrateur.", { x: M, y: fin + 0.45, w: COL, h: 1.2, size: 12 })
    const cap = await capture(SITE + 'equipe-1.png', { left: 862, top: 400, width: 2500, height: 360 })
    const g = d.cadre(s, cap, { x: RX, y: fin + 0.45, w: RW })
    d.legende(s, `Onglet Équipe : N°${NB}d'inventaire et code d'accès. Compte de démonstration.`, { x: RX, y: fin + 0.45 + g.h + 0.16, w: RW })
    d.pied(s, 6, PIED)
  }

  // ════ 7. Cloisonnement ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Cloisonnement')
    d.titre(s, `Les droits se vérifient dans${NB}la${NB}base.`)
    d.para(s, "Au 19 septembre 2026, toutes les tables contrôlent l'accès ligne par ligne.", { x: M, y: 2.75, w: COL, h: 1.0, size: 12 })
    d.alineas(s, [
      ['Écran contourné.', 'Appeler la base directement ne donne accès à rien de plus.'],
      ['Entre entreprises.', 'Un compte client ne lit que les données de son entreprise.'],
      ['Éditeur.', "Le compte d'administration de Devkaylab peut lire les inventaires de tous les clients. Il est protégé par la double authentification."],
      ['Écritures.', 'Toute modification contrôle les droits de son auteur.'],
      ['Journal.', "L'administrateur d'entreprise y retrouve les invitations, retraits d'accès, suppressions de comptes et demandes de magasin."],
    ], { x: RX, y: 1.5, w: RW, h: 5.1, size: 13.5, gap: 18 })
    d.pied(s, 7, PIED)
  }

  // ════ 8. Sécurité ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Sécurité')
    d.titre(s, `Nos revues portent sur la${NB}base en service.`)
    d.para(s, "Nous relisons les fonctions et les règles d'accès en vigueur, pas seulement le code source.", { x: M, y: 2.75, w: COL, h: 1.0, size: 12 })
    d.alineas(s, [
      ['Calendrier.', 'Revues internes les 13 août, 28 août et 8 septembre 2026. Chaque constat est corrigé, un test automatique empêche son retour.'],
      ['Mots de passe.', "Stockés sous forme d'empreinte, jamais en clair."],
      ['Sur le téléphone.', 'La session est conservée dans le trousseau du système : Keychain sur iOS, Keystore sur Android.'],
      ['Sur le site.', "Six en-têtes de sécurité, dont CSP et HSTS. Aucun traceur, aucune mesure d'audience."],
      ["Test d'intrusion.", 'Aucun test externe à ce jour.'],
      ['Continuité.', 'Sauvegarde quotidienne par Supabase, gardée 7 jours. Pas de restauration à la demande ni de taux de disponibilité garanti.'],
    ], { x: RX, y: 1.5, w: RW, h: 5.2, size: 13.5, gap: 16 })
    d.pied(s, 8, PIED)
  }

  // ════ 9. Protection des données ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Protection des données')
    // Retour à la ligne forcé : sans lui, « sous-traitant » se coupe au tiret.
    d.titre(s, 'Pour vos inventaires,\nDevkaylab est\nsous-traitant.', { h: 1.4 })
    // Les deux compteurs remplis seulement : la rangée entière, à 4,6 pouces,
    // sortait le texte du site vers 3,5 points, et ses trois premiers
    // compteurs étaient à zéro (aucun appareil connecté à la prise de vue).
    const cap = await capture(SITE + 'suivi-1.png', { left: 2370, top: 405, width: 1000, height: 235 })
    const g = d.cadre(s, cap, { x: M, y: 3.25, w: COL })
    d.legende(s, "Onglet Suivi d'un inventaire. Compte de démonstration.", { x: M, y: 3.25 + g.h + 0.16, w: COL })
    d.alineas(s, [
      ['Relation client.', "Pour les comptes, la facturation et l'assistance, Devkaylab est responsable de traitement."],
      ['Contrat.', "Les clauses de l'article 28 du RGPD sont annexées aux conditions générales. Leur relecture juridique est à venir."],
      ['Comptages.', 'Tous nominatifs : qui, quoi, où et quand.'],
      ['Suivi en direct.', "Il ne montre que des nombres, sans aucun nom. Rien n'en est conservé après l'inventaire."],
      ['Violation de données.', "Nous vous prévenons dans les meilleurs délais. Vous notifiez la CNIL sous 72 heures s'il y a un risque."],
    ], { x: RX, y: 1.5, w: RW, h: 5.2, size: 13.5, gap: 16 })
    d.pied(s, 9, PIED)
  }

  // ════ 10. Conservation ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Conservation')
    d.titre(s, 'Chaque donnée a sa durée de conservation.', { h: 1.5 })
    d.para(s, 'Une tâche automatique quotidienne efface ou anonymise ce qui a expiré.', { x: M, y: 2.75, w: COL, h: 0.7, size: 12 })
    d.alineas(s, [
      ['Télécharger mes données.', 'Depuis Mon compte, chacun en obtient une copie au format JSON.'],
      ['Supprimer mon compte.', "La demande part du même écran. Les comptages restent à l'entreprise, détachés du nom."],
      ['Côté employeur.', "L'administrateur d'entreprise peut aussi supprimer tout compte de son entreprise."],
    ], { x: M, y: 3.6, w: COL, h: 3.0, size: 12, gap: 10 })
    tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [3.3, 3.33], size: 11.5, rh: [0.54, 0.74, 0.54, 0.54, 0.54, 0.54, 0.54, 0.54],
      head: ['Donnée', 'Durée'],
      rows: [
        ['Détail des comptages', "12 mois après la clôture de l'inventaire"],
        [`Rapport, écarts, référentiel articles, stock${NB}théorique`, "Tant que l'entreprise utilise le service"],
        ['Compte', "Tant qu'il est actif"],
        ['Invitations', '3 mois'],
        ["Journaux d'administration", '1 an'],
        ['Factures', '10 ans'],
        ["Décompte d'appareils, sans nom", '7 jours'],
        ["Pic d'appareils de chaque jour", '13 mois'],
      ],
    })
    d.pied(s, 10, PIED)
  }

  // ════ 11. Fichiers ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Fichiers')
    d.titre(s, 'Vos outils et Quantinvo échangent par fichiers.', { h: 1.4 })
    // Ce qui sort à gauche, ce qui entre à droite, sous la capture de l'import.
    d.alineas(s, [
      ["Rapport d'inventaire.", 'Un classeur Excel, avec les écarts et le détail par zone, ou deux fichiers CSV.'],
      ['Rapport du magasin.', "Les inventaires clôturés d'un magasin, réunis pour l'administrateur d'entreprise."],
      ['Balises.', 'PDF A4 de 21 étiquettes QR, à imprimer sur feuilles autocollantes.'],
      ['Fin de contrat.', 'Les exports restent possibles 30 jours après le terme. Une extraction complète, gratuite une fois, se demande par écrit avant.'],
    ], { x: M, y: 2.75, w: COL, h: 3.9, size: 12.5, gap: 12 })
    const cap = await capture(SITE + 'setup-deplie-2.png', { left: 932, top: 690, width: 2377, height: 575 })
    const g = d.cadre(s, cap, { x: RX, y: 1.5, w: RW })
    d.legende(s, "Onglet Set up d'un inventaire. Compte de démonstration.", { x: RX, y: 1.5 + g.h + 0.16, w: RW })
    d.alineas(s, [
      ['Import.', "CSV, XLSX ou XLS. Le fichier est lu sur l'ordinateur ou le téléphone. Seules ses lignes entrent dans la base."],
      ['Intégration.', 'Ni API publique ni connecteur ERP à ce jour.'],
    ], { x: RX, y: 1.5 + g.h + 0.7, w: RW, h: 2.4, size: 12.5, gap: 12 })
    d.pied(s, 11, PIED)
  }

  // ════ 12. Appareils ════
  await pageTelephone(12, 'Appareils', 'Le téléphone de chacun devient le scanner.', [
    ['Systèmes.', `iPhone à partir d'iOS${NB}16.4, Android à partir de la version${NB}7.0. Pas de version iPad. Terminaux durcis : pas encore testés.`],
    ['Trois modes.', 'Caméra, saisie manuelle ou douchette Bluetooth, reliée comme un clavier.'],
    ['Codes lus.', `EAN, UPC, Code${NB}128, Code${NB}39, ITF, Data Matrix et QR.`],
    ['Autorisations.', "La caméra, qui lit les codes sans enregistrer d'image. Les notifications, si la personne les accepte. Ni micro ni localisation."],
    ['Abonnement.', "Il fixe le nombre d'appareils qui comptent en même temps dans un magasin. Inventaires et comptes sont illimités."],
  ], 'comptage.png')

  // ════ 13. Déploiement ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Déploiement')
    // Titre sur trois lignes : le paragraphe descend d'autant.
    d.titre(s, "L'application s'installera par les boutiques ou votre gestion de parc.")
    d.para(s, 'Une seule application pour tous les clients : aucune version spéciale à demander.', { x: M, y: 3.3, w: COL, h: 1.0, size: 12 })
    const fin = tableau(s, {
      x: RX, y: 1.5, w: RW, cols: [2.7, 3.93], size: 11.5, rh: 0.46,
      head: ['Élément', 'Valeur'],
      rows: [
        ['Nom', 'Quantinvo'],
        ['Identifiant iOS et Android', 'com.quantinvo.app'],
        ['App Store, Google Play', 'Publication en cours'],
      ],
    })
    d.alineas(s, [
      ['Une fois publiée.', `L'application se distribue par Apple${NB}Business${NB}Manager ou Managed${NB}Google${NB}Play.`],
      ['Langues.', "Français et anglais, pour l'application comme pour le site. Les rapports et les e-mails restent en français."],
      ['Configuration administrée.', "AppConfig n'est pas pris en charge."],
      ['Hors boutiques.', 'Distribution privée : à confirmer.'],
    ], { x: RX, y: fin + 0.4, w: RW, h: 3.2, size: 12.5, gap: 11 })
    d.pied(s, 13, PIED)
  }

  // ════ 14. Hors ligne ════
  await pageTelephone(14, 'Hors ligne', 'Sans réseau, le comptage continue.', [
    ['Avant de compter.', 'Le référentiel articles se charge sur le téléphone.'],
    ['Pendant la coupure.', 'Les scans attendent sur le téléphone. Un article inconnu se saisit aussi.'],
    ['Au retour du réseau.', "Les scans partent seuls, si l'application est ouverte. Le compteur voit ce qui est arrivé sur le serveur."],
    ['Session expirée.', "Rien n'est perdu : l'envoi reprend après la reconnexion."],
    ['Appareil partagé.', `À la déconnexion, le référentiel est effacé du téléphone. Les scans en attente sont${NB}gardés.`],
    ['Limites.', 'Se connecter demande du réseau. Un appareil effacé perd ses scans non envoyés.'],
  ], 'balise-terminee.png', { gap: 14 })

  // ════ 15. Tenue en charge ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Tenue en charge')
    // Une phrase par ligne : sinon « calculs. » reste seul sur la dernière.
    d.titre(s, `Les téléphones envoient${NB}peu.\nLa base fait les calculs.`)
    // Le seul usage de l'accent dans ce deck.
    d.chiffre(s, '100 000', 'références par inventaire', { y: 3.35 })
    d.para(s, "Jusqu'à 100 compteurs en même temps.", { x: M, y: 4.95, w: COL, h: 0.5, size: 12.5 })
    d.alineas(s, [
      ['Activité.', "Chaque téléphone signale la sienne, sans recevoir celle des autres. Seul l'onglet Suivi la reçoit."],
      ['Totaux.', "Ils arrivent tout faits : l'écran ne télécharge pas les comptages."],
      ['Rapport et écarts.', 'Affichés par pages de 50 lignes, exportés en entier.'],
      ['Référentiel.', `Après le premier chargement, le téléphone ne reçoit plus que les${NB}changements.`],
      ['Plusieurs magasins le même jour.', 'La capacité de la base se règle avec nous, avant la date.'],
    ], { x: RX, y: 1.5, w: RW, h: 5.0, size: 13.5, gap: 16 })
    d.pied(s, 15, PIED)
  }

  // ════ 16. À prévoir ════
  {
    const s = pres.addSlide()
    d.entete(s, 'À prévoir')
    d.titre(s, 'Avant le premier inventaire, de votre côté.')
    d.para(s, 'Six points à régler avec vos équipes.', { x: M, y: 2.75, w: COL, h: 0.6, size: 12 })
    d.alineas(s, [
      ['Réseau.', 'Autoriser en sortie les destinations de la page 4.'],
      ['Appareils.', 'Un iPhone ou un Android par compteur, caméra autorisée.'],
      ['Gestion de parc.', 'Aucun effacement à distance pendant un inventaire.'],
      ['Comptes.', "Une adresse e-mail par personne, et un administrateur d'entreprise désigné chez vous."],
      ['Postes.', `Un ordinateur avec navigateur, pour les superviseurs et l'administrateur${NB}d'entreprise.`],
      ['Salariés.', "Les informer de l'usage de leurs données et, le cas échéant, consulter le CSE."],
    ], { x: RX, y: 1.5, w: RW, h: 5.2, size: 13.5, gap: 18 })
    d.pied(s, 16, PIED)
  }

  // ════ 17. Finale ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Une question technique ?',
      texte: "Écrivez-nous : l'assistance répond les jours ouvrés, de 9 h à 18 h. La politique de confidentialité et les conditions générales sont en ligne sur le site.",
      contact: 'contact@quantinvo.com · www.quantinvo.com',
      bas: 'Devkaylab · dossier technique · septembre 2026',
    })
  }

  await ecrire(pres, 'Quantinvo-dossier-DSI')
}

main().catch((e) => { console.error(e); process.exit(1) })
