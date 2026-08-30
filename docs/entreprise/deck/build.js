// Deck commercial Quantinvo — fond blanc, charte « Papier » v1.1.
// node build.js                 → Quantinvo-presentation.pptx        (Arial)
// FONT_MODE=brand node build.js → Quantinvo-presentation-marque.pptx (Sora/Inter)
//
// C'est la présentation longue, celle qu'on déroule en rendez-vous. Le deck
// court (`build-court.js`) en est la version dix pages, pour un prospect qui
// a déjà une solution.
//
// ⚠️ La grille tarifaire n'est PAS écrite ici : `offres.js` la lit dans
// `web/lib/offres.ts`. Ce deck a porté pendant une semaine une grille au
// volume de stock remplacée depuis — c'est ce qui a fait écrire ce module.

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture, cadrer } = require('./charte')
const { GRILLE, grilleOffres, auDela, euros, economie } = require('./blocs')

async function main() {
  const d = await preparer({ titre: 'Quantinvo — présentation' })
  const { pres } = d
  const PIED = 'Quantinvo · présentation'

  // Captures du tableau de bord (données d'essai), recadrées hors en-tête et
  // hors nom du magasin. Les coordonnées suivent la mise en page au rail,
  // posée le 30 août 2026 : un recadrage d'avant décalerait tout.
  const capSuivi = await capture('light-desktop-suivi.png', { left: 104, top: 155, width: 1330, height: 505 })
  const capEcarts = await capture('light-desktop-ecarts.png', { left: 448, top: 375, width: 964, height: 370 })
  const capRapport = await capture('light-desktop-rapport.png', { left: 448, top: 160, width: 964, height: 660 })

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

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: "L'outil d'inventaire pour le commerce",
      titre: 'Un stock fiable toute l’année, compté par vos propres équipes.',
      sousTitre: "Une application sur le téléphone des compteurs, un tableau de bord pour celui qui pilote, un rapport à la fin. Rien d'autre à acheter.",
      bas: 'Devkaylab  ·  août 2026  ·  www.quantinvo.com',
    })
    s.addNotes("Ouvrir sur la promesse, pas sur le produit : un stock fiable toute l'année, compté par vos équipes. Le nom vient de « quantité » et « inventaire ».")
  }

  // ════ 2. Le constat ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le constat')
    d.titre(s, 'On compte son stock une fois par an. On décide dessus tous les jours.')
    d.chiffre(s, '365', 'jours de commandes, de réassorts et de démarque reposent sur un chiffre vérifié une seule fois.')
    d.alineas(s, [
      ['Le grand inventaire.', "Il se prépare des mois à l'avance, il mobilise tout le magasin une nuit, et le lendemain chacun est soulagé d'en avoir fini pour un an."],
      ['Le prestataire.', "Il compte vite, il facture à la pièce, et il repart. Entre deux passages, personne ne sait vraiment où en est le stock."],
      ['Le chiffre.', "Le stock théorique se remet à dériver dès le lendemain. La démarque, on la découvre au comptage suivant, trop tard pour comprendre d'où elle vient."],
      ['Le papier.', "Compter soi-même, sur une feuille ou un tableur, c'est possible. C'est lent, et une ligne sautée ne se voit pas."],
    ], { y: 1.5, h: 4.8, size: 14, gap: 14 })
    d.pied(s, 2, PIED)
    s.addNotes("Le stock est le principal actif du magasin, et on ne le vérifie qu'une fois par an. Laisser le silence après la phrase du titre.")
  }

  // ════ 3. D'où ça vient ════
  {
    const s = pres.addSlide()
    d.entete(s, "D'où ça vient")
    d.citation(s, "J'ai dessiné Quantinvo pendant des inventaires, pas dans une salle de réunion.", { y: 1.5, h: 2.4, size: 22 })
    d.para(s, 'Julien Thiong-kay, Devkaylab', { x: M, y: 3.45, w: COL, h: 0.4, size: 12, color: P.SLATE })
    d.alineas(s, [
      [null, "Je fais du contrôle des stocks en magasin. Les irritants, je les ai sous les yeux à chaque inventaire : la balise qu'on ne retrouve pas, la réserve sans réseau, le fichier Excel qu'il faut reformater avant chaque import, le rapport qui arrive trois jours après, quand tout le monde est passé à autre chose."],
      [null, "Quantinvo est la réponse à ces irritants, et rien de plus. Une application sur le téléphone que l'équipe a déjà en poche, un tableau de bord pour celui qui pilote, un rapport à la fin."],
      [null, "Ce n'est pas un module d'ERP qu'on adapte au magasin. C'est un outil de magasin, qui tient dans une poche et se prend en main en dix minutes."],
    ], { y: 1.5, h: 4.8, size: 14, gap: 14 })
    d.pied(s, 3, PIED)
    s.addNotes("Dire d'où on parle. C'est ce qui distingue d'un éditeur généraliste : on connaît le rayon, la réserve, la nuit d'inventaire.")
  }

  // ════ 4. Ce que ça change ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Ce que ça change')
    d.titreLarge(s, 'Ce que ça change, concrètement')
    const x1 = M, x2 = M + 5.6, wc = 5.3
    let y = 2.45
    s.addText("Aujourd'hui", { x: x1, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.SLATE, margin: 0 })
    s.addText('Avec Quantinvo', { x: x2, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.DEEP, margin: 0 })
    y += 0.4
    d.filet(s, M, y, W - 2 * M)
    const rows = [
      ['Une date par an, imposée par le calendrier.', "Vos dates. En janvier, en juin, un mardi matin avant l'ouverture. Autant de fois que vous voulez."],
      ['Des équipes externes, ou du papier.', 'Vos équipes, avec le téléphone qu’elles ont déjà.'],
      ['On sait où on en est à la fin.', 'On le voit pendant, zone par zone, depuis le bureau.'],
      ['Les écarts se découvrent au rapport.', "Les écarts se règlent sur place, pendant que ça compte."],
      ['Un fichier à reformater avant chaque import.', 'Vos fichiers tels quels. Quantinvo reconnaît vos colonnes.'],
    ]
    for (const [a, b] of rows) {
      y += 0.16
      s.addText(a, { x: x1, y, w: wc, h: 0.6, fontFace: FONT, fontSize: 13, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
      s.addText(b, { x: x2, y, w: wc, h: 0.6, fontFace: FONT, fontSize: 13, color: P.INK, margin: 0, lineSpacingMultiple: 1.15 })
      y += 0.66
      d.filet(s, M, y, W - 2 * M)
    }
    d.pied(s, 4, PIED)
    s.addNotes("Lire deux ou trois lignes, pas les cinq. La cinquième (les fichiers) est celle qui surprend le plus en démonstration.")
  }

  // ════ 5. Quatre gestes ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Comment ça se passe')
    d.titreLarge(s, 'Un inventaire, en quatre gestes')
    const steps = [
      ['Importez', "Votre référentiel et votre stock théorique, en CSV ou en Excel, tels qu'ils sortent de votre système. SKU, EAN, Gencod, Qté : les noms de colonnes sont reconnus."],
      ['Scannez', "Chaque compteur ouvre l'inventaire sur son téléphone, scanne la balise de son rayon, puis les articles. Plusieurs personnes comptent en même temps, chacune sa zone."],
      ['Auditez', "Un second passage sur les zones qui le méritent. L'écart entre les deux comptages s'affiche, le superviseur tranche."],
      ['Corrigez', "Le rapport sort en Excel : résultats, écarts en valeur, détail par zone. Il part tel quel à la correction du stock."],
    ]
    const n = steps.length, cw = (W - 2 * M - 0.4 * (n - 1)) / n
    const yl = 2.75
    d.filet(s, M + 0.2, yl + 0.21, W - 2 * M - 0.4, P.HAIR)
    steps.forEach(([h4, txt], i) => {
      const x = M + i * (cw + 0.4)
      d.numero(s, i + 1, x, yl, 0.42)
      s.addText(h4, { x, y: yl + 0.65, w: cw, h: 0.4, fontFace: FONTD, fontSize: 17, bold: true, color: P.DEEP, margin: 0 })
      s.addText(txt, { x, y: yl + 1.1, w: cw, h: 2.2, fontFace: FONT, fontSize: 12, color: P.INK2, margin: 0, lineSpacingMultiple: 1.18 })
    })
    d.encadre(s, 'Sur le terrain', "Le premier inventaire se fait généralement sur un rayon, un mardi matin, avec deux personnes. Pas besoin de la nuit entière pour commencer : c'est justement l'idée.", { x: M, y: 5.75, w: W - 2 * M, h: 1.0 })
    d.pied(s, 5, PIED)
    s.addNotes("Insister sur l'import : « importez vos fichiers tels quels ». C'est ce que le prospect vérifie dès le premier essai, et c'est là qu'on gagne la confiance.")
  }

  // ════ 6. L'application ════
  {
    const s = pres.addSlide()
    d.entete(s, "L'application")
    d.titreLarge(s, 'Ce que voit la personne qui compte', { y: 1.3, size: 26 })
    await troisEcrans(s, [
      { titre: 'Les balises s’impriment', texte: "Une planche d'étiquettes numérotées, en PDF. Elles délimitent les zones et se collent en rayon.", fichier: 'creer-balises.png', fill: P.MIST },
      { titre: 'On scanne, ça compte', texte: "Caméra, saisie manuelle ou douchette Bluetooth. La quantité se corrige d'un appui.", fichier: 'comptage.png', fill: P.TINT },
      { titre: 'L’audit repasse derrière', texte: "Un second passage sur la même zone, par quelqu'un d'autre. C'est ce qui fiabilise le comptage.", fichier: 'audit.png', fill: P.MIST },
    ], { y: 2.05 })
    d.pied(s, 6, PIED)
    s.addNotes("De vraies captures. Le point à faire remarquer : il n'y a rien d'autre sur ces écrans. Un compteur n'a pas de menu à apprendre.")
  }

  // ════ 7. Pendant que ça compte ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le tableau de bord')
    d.titreLarge(s, 'Pendant que ça compte, vous voyez où ça en est.')
    d.para(s, "Depuis le bureau, sur le site : combien d'appareils comptent, combien auditent, l'avancement zone par zone, les derniers scans. Ce que vous ne voyez pas, et c'est voulu : qui fait quoi. Le suivi est agrégé, on pilote le travail, pas les personnes.", { x: M, y: 2.25, w: W - 2 * M, h: 0.8, size: 12.5 })
    const cw = 3.3 * capSuivi.ratio, cx = (W - cw) / 2
    const g = d.cadre(s, capSuivi, { x: cx, y: 3.1, w: cw })
    d.legende(s, 'Onglet Suivi, données d’essai.', { x: cx, y: 3.1 + g.h + 0.14, w: RW })
    d.pied(s, 7, PIED)
    s.addNotes("Montrer la capture, ne pas la commenter ligne à ligne. L'argument du suivi agrégé parle aux RH et au CSE : le dire ici évite une objection plus tard.")
  }

  // ════ 8. Les écarts ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les écarts')
    d.titreLarge(s, "Un écart se règle pendant l'inventaire, pas trois jours après.")
    d.para(s, "Quand une balise a été comptée puis auditée, les deux quantités s'affichent côte à côte, avec l'écart en pièces et en valeur d'achat. Le superviseur retient l'une, l'autre, ou une troisième qu'il a vérifiée lui-même — en un appui. Tant qu'il n'a pas tranché, le rapport le lui rappelle.", { x: M, y: 2.25, w: W - 2 * M, h: 0.8, size: 12.5 })
    const g = d.cadre(s, capEcarts, { x: M + 1.6, y: 3.1, w: W - 2 * M - 3.2 })
    d.legende(s, "Onglet Écarts d'audit, données d'essai.", { x: M + 1.6, y: 3.1 + g.h + 0.14, w: RW })
    d.pied(s, 8, PIED)
    s.addNotes("Le point qui compte pour un responsable de magasin : trancher à chaud, avec le compteur encore dans le rayon. Les deux boutons portent la quantité de chacun — un appui suffit.")
  }

  // ════ 9. Le rapport ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le rapport')
    d.titre(s, "À la fin, un rapport qui dit aussi ce qui n'a pas été compté.", { size: 24 })
    d.para(s, "Le rapport part du stock attendu, pas seulement de ce qui a été scanné. Un article attendu et jamais trouvé y figure, avec son manque. C'est la démarque que l'inventaire est censé révéler.", { x: M, y: 3.4, w: COL, h: 1.5, size: 12.5 })
    d.para(s, "Export Excel en un clic, prêt pour la correction du stock.", { x: M, y: 4.95, w: COL, h: 0.6, size: 12.5 })
    const g = d.cadre(s, capRapport, { x: RX, y: 1.5, w: RW, h: 4.9 })
    d.legende(s, "Onglet Rapport, données d'essai.", { x: RX, y: 1.5 + g.h + 0.14, w: RW })
    d.pied(s, 9, PIED)
    s.addNotes("La règle : le fichier qui fait foi est le stock théorique. Sans fichier théorique, le rapport ne montre que ce qui a été compté.")
  }

  // ════ 10. Mise en route ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Mise en route')
    d.titreLarge(s, 'De la souscription au premier comptage')
    const steps = [
      ['Le jour même', "Vous souscrivez en ligne, votre espace est créé dès l'encaissement. Vous recevez vos accès par e-mail."],
      ['Dans l’heure', "Vous invitez votre équipe — prénom, nom, adresse. Chacun reçoit son lien, choisit son mot de passe et installe l'application."],
      ['Le premier rayon', "Vous importez vos fichiers, vous imprimez une planche de balises, et deux personnes comptent un rayon pour prendre la main."],
      ['Ensuite', "Vous comptez à votre rythme : un rayon par semaine, une marque, un magasin entier. Le prix ne bouge pas."],
    ]
    const n = steps.length, cw = (W - 2 * M - 0.4 * (n - 1)) / n
    const yl = 2.6
    d.filet(s, M + 0.2, yl + 0.21, W - 2 * M - 0.4, P.HAIR)
    steps.forEach(([h4, txt], i) => {
      const x = M + i * (cw + 0.4)
      d.numero(s, i + 1, x, yl, 0.42)
      s.addText(h4, { x, y: yl + 0.65, w: cw, h: 0.4, fontFace: FONTD, fontSize: 16, bold: true, color: P.DEEP, margin: 0 })
      s.addText(txt, { x, y: yl + 1.08, w: cw, h: 2.0, fontFace: FONT, fontSize: 12, color: P.INK2, margin: 0, lineSpacingMultiple: 1.18 })
    })
    d.encadre(s, 'Pas de projet informatique', "Aucun serveur à installer, aucune intégration obligatoire, aucun développement. L'échange se fait par fichiers : vous importez un CSV ou un Excel, vous récupérez un Excel.", { x: M, y: 5.6, w: W - 2 * M, h: 1.0 })
    d.pied(s, 10, PIED)
    s.addNotes("Cette page répond à la question qui bloque tous les achats logiciels : « combien de temps avant que ça serve ? ». La réponse est : le jour même.")
  }

  // ════ 11. Confiance ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Confiance')
    d.titreLarge(s, 'Pensé pour une entreprise, pas pour un particulier')
    const cw = (W - 2 * M - 0.6) / 2
    d.alineas(s, [
      ['Les données restent en Europe.', "Les données d'inventaire sont hébergées en Irlande. La politique de confidentialité est publique et les sous-traitants y sont nommés."],
      ['Le RGPD est dans le produit.', "Chaque personne peut télécharger ses données ou demander la suppression de son compte depuis son écran. Les clauses de sous-traitance sont fournies à la signature."],
    ], { x: M, y: 2.5, w: cw, h: 3.2, size: 12.5, gap: 12 })
    d.alineas(s, [
      ['Les accès sont nominatifs.', "Pas d'inscription libre : on entre sur invitation. Administrateur, superviseur, compteur, chacun voit son périmètre. Double authentification pour qui le souhaite."],
      ['Aucun traceur.', "Pas de cookie publicitaire, pas de mesure d'audience, pas de revente. L'outil travaille, il n'observe pas."],
    ], { x: M + cw + 0.6, y: 2.5, w: cw, h: 3.2, size: 12.5, gap: 12 })
    d.encadre(s, 'Pour votre direction informatique', "Un dossier technique séparé répond aux questions d'une DSI : architecture, hébergement, distribution de l'application, mise en place, comptes, sécurité. Demandez-le.", { x: M, y: 5.75, w: W - 2 * M, h: 1.0 })
    d.pied(s, 11, PIED)
    s.addNotes("Conformité réelle, suivi agrégé, données en Europe. Le dossier DSI existe : le proposer tout de suite évite six semaines d'aller-retour.")
  }

  // ════ 12. L'offre ════
  {
    const s = pres.addSlide()
    d.entete(s, "L'offre")
    d.titreLarge(s, 'Une licence par magasin, comptages illimités', { y: 1.3, size: 26 })
    d.para(s, "Le prix suit le nombre d'appareils qui comptent en même temps — la seule chose que vous puissiez vérifier vous-même. Ni le volume de votre stock, ni le nombre de comptes, ni le nombre d'inventaires dans l'année.", { x: M, y: 1.95, w: W - 2 * M, h: 0.5, size: 11.5, color: P.SLATE })
    grilleOffres(d, s, { x: M, y: 2.55, w: W - 2 * M, h: 3.0, rythme: 'mois', points: false })
    d.alineas(s, [
      ['Tout est compris.', "L'application, le tableau de bord, les rapports, les mises à jour. Aucun terminal à acheter. Un réseau active une licence par magasin, à son rythme."],
    ], { x: M, y: 5.75, w: W - 2 * M, h: 0.7, size: 12.5 })
    d.para(s, auDela(), { x: M, y: 6.45, w: W - 2 * M, h: 0.4, size: 10.5, italic: true, color: P.SLATE })
    d.pied(s, 12, PIED)
    s.addNotes(`Parler en budget d'inventaire annuel, jamais en prix d'application : comparer au prestataire et au matériel. Annoncer le mensuel ; l'annuel économise ${euros(economie(GRILLE.offres[1]))} sur Advanced. Le détail vit dans le deck tarification.`)
  }

  // ════ 13. Ce qu'on ne promet pas ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pour être clair')
    d.titre(s, "Ce qu'on ne vous promet pas.")
    d.para(s, "Autant le dire avant la démonstration qu'après.", { x: M, y: 3.7, w: COL, h: 0.6, size: 12.5, italic: true, color: P.SLATE })
    d.alineas(s, [
      ["L'inventaire fiscal certifié.", "Si votre commissaire aux comptes exige un comptage par un tiers, ce comptage reste. Quantinvo fait tout le reste de l'année, et il le prépare."],
      ['Une connexion à votre ERP.', "Pas encore. Quantinvo importe vos fichiers et rend un Excel. C'est ce qui permet de démarrer en une journée, sans projet informatique."],
      ['Android sur les boutiques.', "L'application tourne sur Android, et elle est disponible sur iPhone. La mise en ligne sur Google Play est en cours ; d'ici là, l'installation passe par votre catalogue d'entreprise."],
      ['La connexion par votre annuaire.', "Les comptes sont nominatifs, créés par invitation. Pas de SAML ni d'Entra ID pour l'instant ; dites-nous si c'est une exigence."],
    ], { y: 1.5, h: 4.8, size: 14, gap: 14 })
    d.pied(s, 13, PIED)
    s.addNotes("Cette page désarme les objections. Ne pas la sauter : un prospect qui découvre une limite après coup perd confiance, un prospect averti la comprend.")
  }

  // ════ 14. Pour finir ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Venez avec vos fichiers.',
      texte: "Une démonstration de trente minutes, sur votre propre référentiel : vous l'importez, on scanne quelques articles, et vous repartez avec le rapport. Pas de données fictives.",
      contact: 'contact@quantinvo.com   ·   www.quantinvo.com',
      bas: 'Quantinvo, par Devkaylab. L’outil d’inventaire pour le commerce.',
    })
    s.addNotes("Clore sur la démonstration concrète, sur leurs fichiers. C'est l'engagement qu'on prend et celui qu'on leur demande.")
  }

  await ecrire(pres, 'Quantinvo-presentation')
}

main().catch((e) => { console.error(e); process.exit(1) })
