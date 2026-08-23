// Deck commercial Quantinvo — fond blanc, charte « Papier » v1.1.
// node build.js                 → Quantinvo-presentation.pptx        (Arial)
// FONT_MODE=brand node build.js → Quantinvo-presentation-marque.pptx (Sora/Inter)

const { P, FONT, FONTD, W, M, COL, RX, RW, preparer, ecrire, capture } = require('./charte')

async function main() {
  const d = await preparer({ titre: 'Quantinvo — présentation' })
  const { pres } = d
  const PIED = 'Quantinvo · présentation'

  // Captures du tableau de bord (données d'essai), recadrées hors en-tête.
  const capSuivi = await capture('light-desktop-suivi.png', { left: 104, top: 254, width: 1232, height: 446 })
  const capEcarts = await capture('light-desktop-ecarts.png', { left: 444, top: 440, width: 892, height: 340 })
  const capRapport = await capture('light-desktop-rapport.png', { left: 444, top: 250, width: 892, height: 600 })

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
      [null, "Son auteur fait du contrôle des stocks en magasin. Les irritants, il les a sous les yeux à chaque inventaire : la balise qu'on ne retrouve pas, la réserve sans réseau, le fichier Excel qu'il faut reformater avant chaque import, le rapport qui arrive trois jours après, quand tout le monde est passé à autre chose."],
      [null, "Quantinvo est la réponse à ces irritants. Rien de plus. Une application sur le téléphone que l'équipe a déjà en poche, un tableau de bord pour celui qui pilote, un rapport à la fin."],
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
      ["On sait où on en est à la fin.", 'On le voit pendant, zone par zone, depuis le bureau.'],
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

  // ════ 6. Pendant que ça compte ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le tableau de bord')
    d.titreLarge(s, 'Pendant que ça compte, vous voyez où ça en est.')
    d.para(s, "Depuis le bureau, sur le site : combien d'appareils comptent, combien auditent, l'avancement zone par zone, les derniers scans. Ce que vous ne voyez pas, et c'est voulu : qui fait quoi. Le suivi est agrégé, on pilote le travail, pas les personnes.", { x: M, y: 2.3, w: W - 2 * M, h: 0.8, size: 12.5 })
    const cw = 3.55 * capSuivi.ratio, cx = (W - cw) / 2
    const g = d.cadre(s, capSuivi, { x: cx, y: 3.15, w: cw })
    d.legende(s, 'Onglet Suivi, données d’essai.', { x: cx, y: 3.15 + g.h + 0.15, w: RW })
    d.pied(s, 6, PIED)
    s.addNotes("Montrer la capture, ne pas la commenter ligne à ligne. L'argument du suivi agrégé parle aux RH et au CSE : le dire ici évite une objection plus tard.")
  }

  // ════ 7. Les écarts ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les écarts')
    d.titreLarge(s, "Un écart se règle pendant l'inventaire, pas trois jours après.")
    d.para(s, "Quand une balise a été comptée puis auditée, les deux quantités s'affichent côte à côte, avec l'écart en pièces et en valeur d'achat. Le superviseur retient l'une, l'autre, ou une troisième qu'il a vérifiée lui-même. Tant qu'il n'a pas tranché, le rapport le lui rappelle.", { x: M, y: 2.3, w: W - 2 * M, h: 0.8, size: 12.5 })
    const g = d.cadre(s, capEcarts, { x: M + 1.6, y: 3.15, w: W - 2 * M - 3.2 })
    d.legende(s, "Onglet Écarts d'audit, données d'essai.", { x: M + 1.6, y: 3.15 + g.h + 0.15, w: RW })
    d.pied(s, 7, PIED)
    s.addNotes("Le point qui compte pour un responsable de magasin : trancher à chaud, avec le compteur encore dans le rayon.")
  }

  // ════ 8. Le rapport ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le rapport')
    d.titre(s, "À la fin, un rapport qui dit aussi ce qui n'a pas été compté.", { size: 24 })
    d.para(s, "Le rapport part du stock attendu, pas seulement de ce qui a été scanné. Un article attendu et jamais trouvé y figure, avec son manque. C'est la démarque que l'inventaire est censé révéler.", { x: M, y: 3.4, w: COL, h: 1.5, size: 12.5 })
    d.para(s, "Export Excel en un clic, prêt pour la correction du stock.", { x: M, y: 4.95, w: COL, h: 0.6, size: 12.5 })
    const g = d.cadre(s, capRapport, { x: RX, y: 1.5, w: RW, h: 5.0 })
    d.legende(s, "Onglet Rapport, données d'essai.", { x: RX, y: 1.5 + g.h + 0.15, w: RW })
    d.pied(s, 8, PIED)
    s.addNotes("La règle : le fichier qui fait foi est le stock théorique. Sans fichier théorique, le rapport ne montre que ce qui a été compté.")
  }

  // ════ 9. Ce qu'on ne promet pas ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Pour être clair')
    d.titre(s, "Ce qu'on ne vous promet pas.")
    d.para(s, "Autant le dire avant la démonstration qu'après.", { x: M, y: 3.7, w: COL, h: 0.6, size: 12.5, italic: true, color: P.SLATE })
    d.alineas(s, [
      ["L'inventaire fiscal certifié.", "Si votre commissaire aux comptes exige un comptage par un tiers, ce comptage reste. Quantinvo fait tout le reste de l'année, et il le prépare."],
      ['Une connexion à votre ERP.', "Pas encore. Quantinvo importe vos fichiers et rend un Excel. C'est ce qui permet de démarrer en une journée, sans projet informatique."],
      ['Android.', "L'application est sur iPhone aujourd'hui. La version Android est en cours."],
      ['La connexion par votre annuaire.', "Les comptes sont nominatifs, créés par invitation. Pas de SAML ni d'Entra ID pour l'instant ; dites-nous si c'est une exigence."],
    ], { y: 1.5, h: 4.8, size: 14, gap: 14 })
    d.pied(s, 9, PIED)
    s.addNotes("Cette page désarme les objections. Ne pas la sauter : un prospect qui découvre une limite après coup perd confiance, un prospect averti la comprend.")
  }

  // ════ 10. Confiance ════
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
    d.encadre(s, 'Pour votre direction informatique', "Un dossier technique séparé répond aux questions d'une DSI : architecture, hébergement, déploiement par votre catalogue d'entreprise, comptes, sécurité. Demandez-le.", { x: M, y: 5.75, w: W - 2 * M, h: 1.0 })
    d.pied(s, 10, PIED)
    s.addNotes("Conformité réelle, suivi agrégé, données en Europe. Le dossier DSI existe : le proposer tout de suite évite six semaines d'aller-retour.")
  }

  // ════ 11. L'offre ════
  {
    const s = pres.addSlide()
    d.entete(s, "L'offre")
    d.titre(s, 'Une licence par magasin, à l’année, comptages illimités.', { size: 24, h: 1.8 })
    d.para(s, "Le prix suit la taille de votre stock, en unités physiques. Il ne dépend ni du nombre de compteurs, ni du nombre d'inventaires dans l'année.", { x: M, y: 3.35, w: COL, h: 1.3, size: 12.5 })
    d.para(s, "Tout est compris : l'application, le tableau de bord, les mises à jour. Un réseau active une licence par magasin, à son rythme.", { x: M, y: 4.6, w: COL, h: 1.2, size: 12.5 })

    // Grille au volume de stock, en unités (pièces physiques, jamais en
    // références). Les noms de profil sont ceux de `web/lib/tarifs.ts` et de
    // l'annexe 2 des CGV. La borne à 200 000 sépare la grande surface du
    // grand magasin.
    const TIERS = [
      ['Boutique', 'jusqu’à 10 000 unités', '2 100 €', false],
      ['Magasin', '10 001 à 50 000 unités', '4 200 €', true],
      ['Grande surface', '50 001 à 200 000 unités', '6 600 €', false],
      ['Grand magasin', '200 001 à 500 000 unités', '10 200 €', false],
      ['Très grand magasin', '500 001 à 1 000 000 unités', '14 400 €', false],
      ['Au-delà', 'plus d’un million d’unités', 'sur devis', false],
    ]
    let y = 1.5
    s.addText('Profil du magasin', { x: RX, y, w: 3, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: P.SLATE, margin: 0 })
    s.addText('par an et par magasin, HT', { x: RX + RW - 3.2, y, w: 3.2, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: P.SLATE, align: 'right', margin: 0 })
    y += 0.38
    d.filet(s, RX, y, RW)
    for (const [profil, bornes, prix, hot] of TIERS) {
      const rh = 0.72
      if (hot) s.addShape('rect', { x: RX - 0.15, y: y + 0.02, w: RW + 0.3, h: rh - 0.04, fill: { color: P.TINT }, line: { color: P.TINT, width: 0 } })
      s.addText(profil, { x: RX, y: y + 0.12, w: 3.6, h: 0.3, fontFace: FONTD, fontSize: 13.5, bold: true, color: P.INK, margin: 0 })
      s.addText(bornes, { x: RX, y: y + 0.42, w: 3.6, h: 0.26, fontFace: FONT, fontSize: 10.5, color: P.SLATE, margin: 0 })
      if (hot) s.addText('le plus courant', { x: RX + 3.6, y: y + 0.22, w: 1.8, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: P.ACCENT, margin: 0 })
      s.addText(prix, { x: RX + RW - 3.2, y: y + 0.12, w: 3.2, h: 0.5, fontFace: FONTD, fontSize: 20, bold: true, color: P.DEEP, align: 'right', margin: 0 })
      y += rh
      d.filet(s, RX, y, RW)
    }
    d.pied(s, 11, PIED)
    s.addNotes("Parler en budget d'inventaire annuel, jamais en prix d'application. Le volume se lit dans le fichier de stock du prospect ; il le déclare au devis. Un grand magasin dépasse 200 000 pièces : c'est la borne qui parle dans le métier. Tarifs confirmés au devis.")
  }

  // ════ 12. Pour finir ════
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
