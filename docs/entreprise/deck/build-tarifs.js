// Deck tarification Quantinvo — fond blanc, charte « Papier » v1.1.
// node build-tarifs.js                 → Quantinvo-tarification.pptx
// FONT_MODE=brand node build-tarifs.js → Quantinvo-tarification-marque.pptx
//
// ⚠️ Les prix ne sont PAS écrits ici : `offres.js` les lit dans
// `web/lib/offres.ts`, la source du site. Un chiffre changé là-bas se retrouve
// dans ce deck à la prochaine génération, et une grille remaniée sans que le
// module suive fait échouer le build au lieu de sortir un prix périmé.
//
// Le raisonnement derrière la grille (hypothèse 4, 30 août 2026) vit dans
// `docs/entreprise/hypotheses-tarifaires.md`. Ce deck en présente la face
// client : ce qu'on facture, pourquoi, et ce qui se passe si on dépasse.

const { P, FONT, FONTD, W, H, M, COL, RX, RW, preparer, ecrire, capture } = require('./charte')
const { GRILLE, grilleOffres, auDela, euros, economie } = require('./blocs')

async function main() {
  const d = await preparer({ titre: 'Quantinvo — tarification' })
  const { pres } = d
  const PIED = 'Quantinvo · tarification · août 2026'

  const capTarifs = await capture('light-desktop-tarifs.png', { left: 195, top: 370, width: 1050, height: 890 })
  const capSouscrire = await capture('light-desktop-souscrire.png', { left: 425, top: 275, width: 590, height: 430 })

  const [essential, advanced, enterprise] = GRILLE.offres

  // ════ 1. Couverture ════
  {
    const s = pres.addSlide()
    d.couverture(s, {
      sur: 'Tarification',
      titre: 'Un prix calé sur le nombre de personnes qui comptent.',
      sousTitre: "Rien à déclarer, rien à justifier, rien à régulariser en fin d'année. Le tarif est public, et il se souscrit en ligne.",
      bas: 'Devkaylab  ·  août 2026  ·  www.quantinvo.com',
    })
    s.addNotes("Ouvrir sur ce que la tarification supprime — la déclaration de stock — avant d'annoncer un chiffre. C'est ce qui la distingue du reste du marché.")
  }

  // ════ 2. Ce qu'on facture, et pourquoi ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le principe')
    d.titre(s, 'Nous facturons la seule chose que vous puissiez vérifier.')
    d.para(s, "Un prix qu'on ne peut pas contrôler soi-même est un prix qu'on subit.", { x: M, y: 3.9, w: COL, h: 0.8, size: 12.5, italic: true, color: P.SLATE })
    d.alineas(s, [
      ["Le nombre d'appareils qui comptent en même temps.", "C'est votre organisation du jour de l'inventaire : deux personnes dans une boutique, trente dans un entrepôt. Vous le savez avant de signer, et vous le voyez le jour même."],
      ['Pas le volume de votre stock.', "Le marché facture au nombre de pièces — le vôtre, que vous devez déclarer, que personne ne peut vérifier, et qu'il faut régulariser. Nous avons retiré cette assiette."],
      ["Pas le nombre de comptes.", "Créez-en autant que nécessaire. Un saisonnier, un renfort du samedi, un chef d'équipe qui compte une fois par trimestre : seuls les appareils qui scannent en même temps entrent dans le palier."],
      ["Pas le nombre d'inventaires.", "C'est le point qui compte pour un inventaire tournant : compter chaque semaine ne coûte pas un euro de plus que compter une fois par an."],
    ], { y: 1.5, h: 5.0, size: 13, gap: 13 })
    d.pied(s, 2, PIED)
    s.addNotes("Le raisonnement avant le chiffre. La question qui vient toujours : « et si on dépasse ? » — répondre qu'elle a sa page, deux slides plus loin.")
  }

  // ════ 3. La grille ════
  {
    const s = pres.addSlide()
    d.entete(s, 'La grille')
    d.titreLarge(s, 'Trois offres, une licence par magasin', { y: 1.3, size: 26 })
    d.para(s, "Le prix est hors taxes, par magasin. Chaque magasin prend la sienne, choisie selon la taille de son équipe : un entrepôt qui compte à trente et une boutique qui compte à deux ne prennent pas la même.", { x: M, y: 1.95, w: W - 2 * M, h: 0.5, size: 11.5, color: P.SLATE })
    grilleOffres(d, s, { x: M, y: 2.4, w: W - 2 * M, h: 4.15, rythme: 'mois' })
    d.para(s, auDela(), { x: M, y: 6.65, w: W - 2 * M, h: 0.4, size: 11, italic: true, color: P.SLATE, align: 'center' })
    d.pied(s, 3, PIED)
    s.addNotes(`Annoncer le mensuel : un acheteur compare en mois. L'annuel se présente ensuite comme une économie en euros — ${euros(economie(advanced))} sur Advanced —, jamais en pourcentage.`)
  }

  // ════ 4. Le prix est public ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le prix est public')
    d.titre(s, 'Vous n’avez pas eu à nous le demander.', { size: 25, h: 1.6 })
    d.alineas(s, [
      [null, "Sur ce marché, aucun tarif n'est affiché. On demande un devis, on attend, on reçoit un prix qu'on ne peut comparer à rien."],
      [null, "Le nôtre est sur le site, à la vue de vos concurrents comme de vos équipes. Vous savez ce que paie le magasin d'à côté : c'est le même prix."],
      [null, "Le devis ne revient que pour deux cas — plusieurs magasins à équiper, ou plus de cent appareils sur un même site."],
    ], { x: M, y: 3.15, w: COL, h: 3.2, size: 12.5, gap: 12 })
    const g = d.cadre(s, capTarifs, { x: RX, y: 1.5, w: RW, h: 4.9 })
    d.legende(s, 'www.quantinvo.com/tarifs', { x: RX, y: 1.5 + g.h + 0.15, w: RW })
    d.pied(s, 4, PIED)
    s.addNotes("Argument souvent sous-estimé : un prix affiché est en soi une promesse de traitement égal. Le dire, puis se taire — la capture parle seule.")
  }

  // ════ 5. Ce qui est compris ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Ce qui est compris')
    d.titreLarge(s, 'Ce que le prix contient, quelle que soit l’offre')
    const cw = (W - 2 * M - 0.6) / 2
    d.alineas(s, [
      ['Les terminaux.', "Aucun. Vos équipes comptent avec les téléphones qu'elles ont déjà en poche. Rien à acheter, à louer, à charger la veille ni à remplacer quand un écran casse."],
      ['Les mises à jour.', "Toutes, tout le temps. Il n'y a pas de version ancienne à racheter, pas de palier de maintenance, pas de module en supplément."],
    ], { x: M, y: 2.5, w: cw, h: 3.0, size: 12.5, gap: 12 })
    d.alineas(s, [
      ['Les inventaires.', "Autant que vous voulez dans l'année : complets, tournants, ciblés sur une marque ou un rayon. C'est ce qui rend l'inventaire tournant possible — il ne se facture pas au passage."],
      ['Les comptes.', "Autant que nécessaire, pour toute l'équipe. Le palier ne compte que les appareils qui scannent en même temps."],
    ], { x: M + cw + 0.6, y: 2.5, w: cw, h: 3.0, size: 12.5, gap: 12 })
    d.encadre(s, 'Ce qui ne l’est pas', "Le paiement se fait par carte, à la souscription. Un accompagnement sur site, une reprise de données ou un développement spécifique se chiffrent à part — et se disent avant, pas sur la facture.", { x: M, y: 5.6, w: W - 2 * M, h: 1.1 })
    d.pied(s, 5, PIED)
    s.addNotes("« Aucun terminal » est l'argument qui déplace un budget : en face, une flotte de terminaux durcis se compte en dizaines de milliers d'euros, hors licence.")
  }

  // ════ 6. Le plafond est souple ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le dépassement')
    d.citation(s, 'On ne refuse jamais un appareil pendant un comptage.', { y: 1.5, h: 2.2, size: 24 })
    d.para(s, "La règle qui a décidé de tout le reste.", { x: M, y: 3.5, w: COL, h: 0.5, size: 12, color: P.SLATE })
    d.alineas(s, [
      ['Le jour de l’inventaire, rien ne se passe.', "Vous avez pris Advanced pour vingt appareils, vous êtes vingt-trois un samedi de forte affluence : les vingt-trois comptent. Un outil qui dit non à 22 h, un soir de comptage, ne rend service à personne — et personne n'est là pour lever le blocage."],
      ['Le dépassement se règle au renouvellement.', "S'il est ponctuel, il ne change rien. S'il devient votre habitude, nous passons au palier du dessus à l'échéance suivante, à la date que vous connaissez."],
      ['Vous n’avez rien à surveiller.', "Pas de compteur à consulter chaque mois, pas de régularisation à provisionner, pas de facture surprise en fin d'exercice."],
    ], { y: 1.5, h: 5.0, size: 13, gap: 14 })
    d.pied(s, 6, PIED)
    s.addNotes("Cette page répond à l'objection avant qu'elle ne soit posée. Elle dit aussi quelque chose sur la maison : le plafond est commercial, il n'est pas technique.")
  }

  // ════ 7. Mensuel ou annuel ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Mensuel ou annuel')
    d.titreLarge(s, 'Douze prélèvements, ou un seul')
    let y = 2.5
    s.addText('', { x: M, y, w: 1, h: 0.1 })
    const cols = [3.5, 2.6, 2.6, 2.9]
    const head = ['', 'Par mois', 'À l’année', 'Ce que l’année économise']
    let cx = M
    head.forEach((h4, i) => {
      s.addText(h4, { x: cx, y, w: cols[i], h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: i === 3 ? P.OK : P.SLATE, margin: 0, align: i === 0 ? 'left' : 'right' })
      cx += cols[i]
    })
    y += 0.38
    d.filet(s, M, y, W - 2 * M)
    for (const o of GRILLE.offres) {
      y += 0.14
      cx = M
      const cells = [o.nom, euros(o.mois), euros(o.an), euros(economie(o))]
      cells.forEach((c, i) => {
        s.addText(c, {
          x: cx, y, w: cols[i], h: 0.44,
          fontFace: i === 0 ? FONTD : FONTD, fontSize: i === 0 ? 15 : 17, bold: true,
          color: i === 3 ? P.OK : i === 0 ? P.INK : P.DEEP,
          align: i === 0 ? 'left' : 'right', margin: 0, valign: 'middle',
        })
        cx += cols[i]
      })
      s.addText(o.plage, { x: M, y: y + 0.4, w: cols[0], h: 0.26, fontFace: FONT, fontSize: 10, color: P.SLATE, margin: 0 })
      y += 0.72
      d.filet(s, M, y, W - 2 * M)
    }
    d.alineas(s, [
      ['Sans engagement.', "Le mensuel se règle en douze prélèvements et s'arrête quand vous le décidez. L'annuel est dû jusqu'à son terme — c'est la contrepartie de l'économie."],
    ], { x: M, y: y + 0.4, w: W - 2 * M, h: 0.9, size: 12.5 })
    d.encadre(s, 'À savoir', "Les prix sont hors taxes, comme partout en B2B. Au moment de payer, l'écran affiche le montant qui sera réellement débité, TVA comprise — on ne découvre pas l'écart sur le relevé bancaire.", { x: M, y: 5.85, w: W - 2 * M, h: 1.0 })
    d.pied(s, 7, PIED)
    s.addNotes("Annoncer l'économie en euros, jamais en pourcentage : « trois cents euros » se retient, « 11 % » ne dit rien. Et prévenir sur l'annuel dû jusqu'au terme — mieux vaut le dire ici qu'au moment de la résiliation.")
  }

  // ════ 8. Souscrire ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Souscrire')
    d.titre(s, 'Quatre informations, puis le paiement.', { size: 25, h: 1.4 })
    d.alineas(s, [
      ['En ligne, les trois offres comprises.', "Enterprise se souscrit comme les autres : il n'y a pas de parcours réservé, pas de rendez-vous obligatoire, pas de délai de validation."],
      ['Votre espace est créé dès l’encaissement.', "Vous recevez vos accès par e-mail, vous invitez votre équipe, et le premier inventaire peut se faire le jour même."],
      ['La carte ne passe jamais par nous.', "Le paiement se fait sur la page sécurisée de Stripe. Nous ne voyons pas votre numéro de carte. La facture est émise automatiquement."],
    ], { x: M, y: 3.0, w: COL, h: 3.4, size: 12.5, gap: 12 })
    const g = d.cadre(s, capSouscrire, { x: RX + 0.8, y: 1.5, w: RW - 1.6, h: 4.9 })
    d.legende(s, 'www.quantinvo.com/souscrire', { x: RX + 0.8, y: 1.5 + g.h + 0.15, w: RW })
    d.pied(s, 8, PIED)
    s.addNotes("Le contraste avec le marché : ailleurs, un devis, une négociation, six semaines. Ici, quatre champs. C'est aussi ce qui rend le prix affiché crédible.")
  }

  // ════ 9. Les questions ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Les questions qu’on nous pose')
    d.titreLarge(s, 'Les questions qu’on nous pose')
    const QA = [
      ["Qu'est-ce qu'un « appareil qui compte » ?", "Un téléphone ou une tablette qui scanne, en même temps que les autres, pendant un inventaire. Changer d'appareil ne change rien à votre facture : c'est le nombre simultané qui compte, pas le parc que vous possédez."],
      ['Une licence couvre-t-elle plusieurs magasins ?', "Non. Chaque magasin prend la sienne, choisie selon la taille de son équipe. Si vous en équipez plusieurs, nous établissons un devis pour l'ensemble."],
      ['Faut-il déclarer notre stock ?', "Non. Rien à déclarer, rien à justifier, rien à régulariser. C'est précisément ce que cette façon de facturer supprime."],
      ['Peut-on résilier ?', "Le mensuel, quand vous voulez : le service va au terme du mois payé. L'annuel est dû jusqu'à son échéance, et ne se reconduit que si vous le décidez."],
    ]
    const cw = (W - 2 * M - 0.7) / 2
    QA.forEach(([q, r], i) => {
      const x = M + (i % 2) * (cw + 0.7)
      const y = 2.4 + Math.floor(i / 2) * 2.2
      s.addText(q, { x, y, w: cw, h: 0.4, fontFace: FONTD, fontSize: 13.5, bold: true, color: P.DEEP, margin: 0, lineSpacingMultiple: 1.05 })
      s.addText(r, { x, y: y + 0.44, w: cw, h: 1.4, fontFace: FONT, fontSize: 11.5, color: P.INK2, margin: 0, lineSpacingMultiple: 1.18 })
    })
    d.pied(s, 9, PIED)
    s.addNotes("Ces quatre questions sont celles de la page publique. Les connaître par cœur permet de répondre sans consulter le deck.")
  }

  // ════ 10. Ce que ça remplace ════
  {
    const s = pres.addSlide()
    d.entete(s, 'Le budget')
    d.titreLarge(s, 'Ce que la licence remplace dans votre budget')
    const x1 = M, x2 = M + 5.6, wc = 5.3
    let y = 2.45
    s.addText("Le budget d'inventaire d'un magasin", { x: x1, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.SLATE, margin: 0 })
    s.addText('Avec Quantinvo', { x: x2, y, w: wc, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: P.DEEP, margin: 0 })
    y += 0.4
    d.filet(s, M, y, W - 2 * M)
    const rows = [
      ['Un prestataire de comptage, facturé à la pièce, une ou deux fois par an.', 'Vos équipes comptent, autant de fois que vous voulez, pour le même prix.'],
      ['Une flotte de terminaux : achat ou location, maintenance, remplacement.', 'Aucun matériel. Les téléphones sont déjà là, et déjà payés.'],
      ['Une licence logicielle sur devis, renégociée chaque année.', 'Un prix affiché, le même pour tout le monde, que vous souscrivez en ligne.'],
      ['Les heures passées à préparer, surveiller et réconcilier.', 'Le rapport sort croisé avec votre stock théorique. Il ne reste qu’à ajuster.'],
    ]
    for (const [a, b] of rows) {
      y += 0.16
      s.addText(a, { x: x1, y, w: wc, h: 0.66, fontFace: FONT, fontSize: 13, color: P.INK2, margin: 0, lineSpacingMultiple: 1.15 })
      s.addText(b, { x: x2, y, w: wc, h: 0.66, fontFace: FONT, fontSize: 13, color: P.INK, margin: 0, lineSpacingMultiple: 1.15 })
      y += 0.72
      d.filet(s, M, y, W - 2 * M)
    }
    d.para(s, `À ${euros(advanced.an)} par an, une équipe de vingt personnes qui compte toute l'année coûte moins qu'un seul passage de prestataire dans la plupart des magasins.`, { x: M, y: y + 0.28, w: W - 2 * M, h: 0.5, size: 11.5, italic: true, color: P.SLATE })
    d.pied(s, 10, PIED)
    s.addNotes("Ne jamais comparer à un abonnement logiciel : comparer au budget d'inventaire, celui du prestataire et du matériel. C'est là que la licence se justifie toute seule.")
  }

  // ════ 11. Pour finir ════
  {
    const s = pres.addSlide()
    d.finale(s, {
      titre: 'Combien de personnes comptent chez vous ?',
      texte: "C'est la seule question à laquelle il faut répondre pour connaître votre prix. Dites-nous le chiffre, on vous dit l'offre — et si vous avez plusieurs magasins, on établit le devis de l'ensemble.",
      contact: 'contact@quantinvo.com   ·   www.quantinvo.com/tarifs',
      bas: 'Prix hors taxes, par magasin. Sans engagement au mois. Aucun matériel à acheter.',
    })
    s.addNotes("Clore sur la question la plus simple du marché. Si le prospect y répond, il est déjà en train de choisir son offre.")
  }

  await ecrire(pres, 'Quantinvo-tarification')
}

main().catch((e) => { console.error(e); process.exit(1) })
