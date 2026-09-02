const pptxgen = require('pptxgenjs')

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE'          // 13.3 x 7.5
pres.author = 'Devkaylab'
pres.company = 'Devkaylab'
pres.title = 'Quantinvo — Sécurité et protection des données'

// ── Palette : sémantique d'audit (statut des constats) ─────────────────────
const NAVY = '12233A'   // fond sombre, titres
const SLATE = '44607F'  // texte secondaire
const INK = '1B2A3A'    // texte courant
const MUTED = '6B7C8F'  // légendes
const CLOS = '1F7A5C'   // vert : traité
const ATTENTE = 'B07A1E' // ambre : en attente
const COURS = '9B2C2C'  // rouge sombre : en cours
const LIGHT = 'F4F6F8'  // fond de carte
const WHITE = 'FFFFFF'

const TITLE_FONT = 'Cambria'
const BODY_FONT = 'Calibri'

const W = 13.3
const M = 0.7           // marge

/** Titre de section, identique sur toutes les slides claires. */
function titre(slide, texte, sousTitre) {
  slide.addText(texte, {
    x: M, y: 0.45, w: W - 2 * M, h: 0.65,
    fontFace: TITLE_FONT, fontSize: 34, bold: true, color: NAVY, margin: 0,
  })
  if (sousTitre) {
    slide.addText(sousTitre, {
      x: M, y: 1.12, w: W - 2 * M, h: 0.35,
      fontFace: BODY_FONT, fontSize: 14, color: MUTED, margin: 0,
    })
  }
}

/** Pastille ronde portant le code du constat — motif répété du deck. */
function pastille(slide, code, x, y, couleur, taille = 0.52) {
  slide.addText(code, {
    shape: pres.ShapeType.ellipse,
    x, y, w: taille, h: taille,
    fill: { color: couleur },
    fontFace: BODY_FONT, fontSize: 12, bold: true, color: WHITE,
    align: 'center', valign: 'middle', margin: 0,
  })
}

// ═══════════════════════════════════════════════════════════ 1. Couverture
{
  const s = pres.addSlide()
  s.background = { color: NAVY }

  s.addText('Sécurité et protection\ndes données', {
    x: M, y: 1.5, w: 7.6, h: 1.9,
    fontFace: TITLE_FONT, fontSize: 42, bold: true, color: WHITE,
    lineSpacing: 46, margin: 0,
  })
  s.addText('Quantinvo — bilan de l’audit du 13 août 2026', {
    x: M, y: 3.6, w: 7.6, h: 0.4,
    fontFace: BODY_FONT, fontSize: 17, color: 'CADCFC', margin: 0,
  })
  s.addText('Document de synthèse à l’usage de nos clients entreprises', {
    x: M, y: 4.08, w: 7.6, h: 0.4,
    fontFace: BODY_FONT, fontSize: 13, italic: true, color: '8FA6C4', margin: 0,
  })
  s.addText('Devkaylab · état au 19 août 2026', {
    x: M, y: 6.5, w: 7, h: 0.3,
    fontFace: BODY_FONT, fontSize: 11, color: '7E93AC', margin: 0,
  })

  // Bilan chiffré, en colonne à droite.
  const stats = [
    { n: '15', l: 'constats relevés', c: 'CADCFC' },
    { n: '13', l: 'clos', c: '5FD3A6' },
    { n: '2', l: 'restants', c: 'E8B85F' },
  ]
  stats.forEach((st, i) => {
    const y = 1.75 + i * 1.35
    s.addText(st.n, {
      x: 9.5, y, w: 1.1, h: 0.85,
      fontFace: TITLE_FONT, fontSize: 44, bold: true, color: st.c,
      align: 'right', valign: 'middle', margin: 0,
    })
    s.addText(st.l, {
      x: 10.7, y, w: 1.9, h: 0.85,
      fontFace: BODY_FONT, fontSize: 13, color: 'B9C9DC',
      valign: 'middle', margin: 0,
    })
  })

  s.addNotes(
    'Deck de synthèse destiné aux clients entreprises. '
    + 'L’audit du 13 août 2026 a relevé 15 manquements (2 critiques, 7 élevés, 6 moyens). '
    + 'Au 19 août : 13 clos — dont le suivi d’activité, rendu agrégé ce jour-là —, '
    + '1 au socle en place (mentions légales, activation à l’immatriculation) '
    + 'et 1 en relecture (documentation juridique).',
  )
}

// ═══════════════════════════════════════════════════════ 2. La démarche
{
  const s = pres.addSlide()
  titre(s, 'La démarche', 'Un audit volontaire, mené avant toute mise en service à grande échelle')

  const blocs = [
    {
      t: 'Pourquoi',
      d: 'Quantinvo traite des données de salariés — qui compte quoi, où et quand. '
       + 'Nous avons voulu savoir ce que le produit faisait réellement, avant de le proposer largement.',
    },
    {
      t: 'Périmètre',
      d: 'Application mobile, tableau de bord web, base de données et ses règles d’accès, '
       + 'sous-traitants, documents obligatoires et information des personnes.',
    },
    {
      t: 'Méthode',
      d: 'Revue du code et du schéma de la base, ligne par ligne — pas un questionnaire déclaratif. '
       + 'Chaque constat a été reproduit avant d’être corrigé, puis vérifié après correction.',
    },
  ]

  blocs.forEach((b, i) => {
    const x = M + i * 4.07
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 1.85, w: 3.75, h: 3.5, rectRadius: 0.1,
      fill: { color: LIGHT }, line: { color: 'E1E7ED', width: 1 },
    })
    s.addText(String(i + 1), {
      shape: pres.ShapeType.ellipse,
      x: x + 0.3, y: 2.15, w: 0.55, h: 0.55,
      fill: { color: NAVY },
      fontFace: BODY_FONT, fontSize: 15, bold: true, color: WHITE,
      align: 'center', valign: 'middle', margin: 0,
    })
    s.addText(b.t, {
      x: x + 0.3, y: 2.85, w: 3.15, h: 0.4,
      fontFace: TITLE_FONT, fontSize: 20, bold: true, color: NAVY, margin: 0,
    })
    s.addText(b.d, {
      x: x + 0.3, y: 3.3, w: 3.15, h: 1.85,
      fontFace: BODY_FONT, fontSize: 12.5, color: INK, lineSpacing: 17, margin: 0,
    })
  })

  s.addText(
    'L’audit a été conduit sur notre initiative, sans obligation réglementaire ni incident déclencheur.',
    {
      x: M, y: 5.7, w: W - 2 * M, h: 0.4,
      fontFace: BODY_FONT, fontSize: 13, italic: true, color: SLATE, margin: 0,
    },
  )
}

// ═════════════════════════════════════════════ 3. Résultat en un coup d'œil
{
  const s = pres.addSlide()
  titre(s, 'Où nous en sommes', 'Les 15 constats, par gravité et par état au 19 août 2026')

  s.addChart(
    pres.ChartType.bar,
    [
      { name: 'Clos', labels: ['Critiques', 'Élevés', 'Moyens'], values: [2, 6, 5] },
      { name: 'Socle en place', labels: ['Critiques', 'Élevés', 'Moyens'], values: [0, 1, 0] },
      { name: 'En cours', labels: ['Critiques', 'Élevés', 'Moyens'], values: [0, 0, 1] },
    ],
    {
      x: M, y: 1.85, w: 7.3, h: 3.9,
      barDir: 'bar', barGrouping: 'stacked',
      chartColors: [CLOS, ATTENTE, COURS],
      showValue: true, dataLabelPosition: 'ctr',
      dataLabelColor: WHITE, dataLabelFontFace: BODY_FONT, dataLabelFontSize: 12,
      dataLabelFormatCode: '#;;',
      showLegend: true, legendPos: 'b', legendFontSize: 11, legendColor: INK,
      catAxisLabelColor: INK, catAxisLabelFontFace: BODY_FONT, catAxisLabelFontSize: 13,
      valAxisLabelColor: MUTED, valAxisLabelFontSize: 10,
      valGridLine: { color: 'E8EDF2', size: 1 },
      catGridLine: { style: 'none' },
      valAxisMaxVal: 7,
      barGapWidthPct: 60,
    },
  )

  const notes = [
    { c: CLOS, t: 'Clos', d: 'Corrigé, vérifié, et protégé par un test automatique qui fait échouer toute régression.' },
    { c: ATTENTE, t: 'Socle en place', d: 'La page des mentions légales existe ; son activation attend l’immatriculation de l’activité éditrice.' },
    { c: COURS, t: 'En cours', d: 'La documentation juridique, rédigée, attend sa relecture par un conseil.' },
  ]
  notes.forEach((n, i) => {
    const y = 2.0 + i * 1.25
    s.addShape(pres.ShapeType.ellipse, {
      x: 8.4, y: y + 0.06, w: 0.22, h: 0.22, fill: { color: n.c }, line: { color: n.c, width: 0 },
    })
    s.addText(n.t, {
      x: 8.75, y, w: 3.9, h: 0.32,
      fontFace: BODY_FONT, fontSize: 14, bold: true, color: NAVY, margin: 0,
    })
    s.addText(n.d, {
      x: 8.75, y: y + 0.33, w: 3.9, h: 0.85,
      fontFace: BODY_FONT, fontSize: 11.5, color: INK, lineSpacing: 15, margin: 0,
    })
  })

  s.addNotes('Plus aucun constat critique ni élevé n’est ouvert. Le seul point en cours relève de la relecture juridique, pas de la sécurité technique.')
}

// ═══════════════════════════════════════ 4. Qui est responsable de quoi
{
  const s = pres.addSlide()
  titre(s, 'Qui est responsable de quoi', 'La question que pose tout service juridique — voici la réponse')

  const cartes = [
    {
      x: M, w: 5.85,
      tete: 'Vous, entreprise cliente',
      role: 'Responsable de traitement',
      couleur: NAVY,
      items: [
        'Les données d’inventaire : comptages, audits, activité des équipes',
        'Vous décidez des finalités, des durées et de la base légale',
        'Vous informez vos salariés et consultez votre CSE',
        'Vous êtes l’interlocuteur de vos salariés pour leurs droits',
      ],
    },
    {
      x: M + 6.15, w: 5.85,
      tete: 'Devkaylab, éditeur',
      role: 'Sous-traitant',
      couleur: CLOS,
      items: [
        'Nous traitons ces données sur vos seules instructions',
        'Nous assurons la sécurité technique et le cloisonnement',
        'Nous vous alertons sans délai en cas de violation',
        'Nous restons responsables pour nos propres données de relation client',
      ],
    },
  ]

  cartes.forEach(c => {
    s.addShape(pres.ShapeType.roundRect, {
      x: c.x, y: 1.8, w: c.w, h: 3.75, rectRadius: 0.1,
      fill: { color: LIGHT }, line: { color: 'E1E7ED', width: 1 },
    })
    s.addText(c.tete, {
      x: c.x + 0.35, y: 2.05, w: c.w - 0.7, h: 0.35,
      fontFace: BODY_FONT, fontSize: 13, color: MUTED, margin: 0,
    })
    s.addText(c.role, {
      x: c.x + 0.35, y: 2.4, w: c.w - 0.7, h: 0.45,
      fontFace: TITLE_FONT, fontSize: 22, bold: true, color: c.couleur, margin: 0,
    })
    s.addText(c.items.map((t, i) => ({
      text: t,
      options: { bullet: true, breakLine: i < c.items.length - 1 },
    })), {
      x: c.x + 0.35, y: 3.0, w: c.w - 0.7, h: 2.35,
      fontFace: BODY_FONT, fontSize: 12.5, color: INK,
      lineSpacing: 16, paraSpaceAfter: 8, margin: 0,
    })
  })

  s.addText(
    'Cette répartition se formalise par un contrat de sous-traitance (article 28 du RGPD) : '
    + 'les clauses sont rédigées et vous sont remises sur demande ; leur relecture juridique est en cours.',
    {
      x: M, y: 5.8, w: W - 2 * M, h: 0.5,
      fontFace: BODY_FONT, fontSize: 13, color: SLATE, lineSpacing: 17, margin: 0,
    },
  )
}

// ═════════════════════════════════════════════ 5. Les deux constats critiques
{
  const s = pres.addSlide()
  titre(s, 'Les deux constats critiques', 'Tous deux corrigés, vérifiés et sous test automatique')

  const items = [
    {
      code: 'C1',
      t: 'Le suivi en direct n’était pas cloisonné',
      pb: 'Les canaux de suivi temps réel ne vérifiaient aucune autorisation à l’abonnement : '
        + 'techniquement, l’activité d’un inventaire pouvait être écoutée depuis l’extérieur de l’équipe.',
      fix: 'Canaux privés des deux côtés, et autorisation vérifiée par la base au moment de l’abonnement — '
        + 'plus seulement par l’application.',
    },
    {
      code: 'C2',
      t: 'Deux failles connues dans la lecture des fichiers Excel',
      pb: 'La bibliothèque qui lit vos fichiers d’articles et de stock portait deux vulnérabilités publiées, '
        + 'sans version corrigée disponible sur le canal habituel.',
      fix: 'Version officielle corrigée récupérée à la source et figée dans le projet. '
        + 'Les deux failles ont disparu des contrôles de sécurité, un test empêche tout retour en arrière.',
    },
  ]

  items.forEach((it, i) => {
    const y = 1.8 + i * 2.1
    pastille(s, it.code, M, y + 0.05, COURS, 0.58)
    s.addText(it.t, {
      x: M + 0.85, y, w: 10.9, h: 0.4,
      fontFace: TITLE_FONT, fontSize: 19, bold: true, color: NAVY, margin: 0,
    })
    s.addText([
      { text: 'Le constat — ', options: { bold: true, color: COURS } },
      { text: it.pb, options: { color: INK } },
    ], {
      x: M + 0.85, y: y + 0.45, w: 10.9, h: 0.65,
      fontFace: BODY_FONT, fontSize: 12.5, lineSpacing: 16, margin: 0,
    })
    s.addText([
      { text: 'Ce qui a été fait — ', options: { bold: true, color: CLOS } },
      { text: it.fix, options: { color: INK } },
    ], {
      x: M + 0.85, y: y + 1.12, w: 10.9, h: 0.65,
      fontFace: BODY_FONT, fontSize: 12.5, lineSpacing: 16, margin: 0,
    })
  })

  s.addText(
    'Aucune trace d’exploitation n’a été relevée : ces constats portaient sur des possibilités, non sur des incidents.',
    {
      x: M, y: 6.15, w: W - 2 * M, h: 0.4,
      fontFace: BODY_FONT, fontSize: 12.5, italic: true, color: SLATE, margin: 0,
    },
  )
}

// ═══════════════════════════════════════════ 6. Constats élevés
{
  const s = pres.addSlide()
  titre(s, 'Constats de gravité élevée', '7 constats — 6 clos, 1 au socle en place')

  const lignes = [
    ['E1', 'Effacement des comptes', 'La suppression d’un compte échouait après un comptage.', CLOS, 'Clos'],
    ['E2', 'Durées de conservation', 'Aucune durée posée ni outillée.', CLOS, 'Clos'],
    ['E3', 'Suivi d’activité des salariés', 'Suivi nominatif du travail de chacun, en direct.', CLOS, 'Clos'],
    ['E4', 'Mentions légales', 'Le site n’identifiait pas son éditeur.', ATTENTE, 'Socle en place'],
    ['E5', 'Politique de confidentialité', 'Sous-traitants et transferts non déclarés.', CLOS, 'Clos'],
    ['E6', 'Hébergement de la politique', 'L’adresse publiée était introuvable.', CLOS, 'Clos'],
    ['E7', 'Robustesse des mots de passe', 'Seuil trop bas pour un mot de passe seul.', CLOS, 'Clos'],
  ]

  lignes.forEach((l, i) => {
    const y = 1.78 + i * 0.66
    pastille(s, l[0], M, y, l[3], 0.44)
    s.addText(l[1], {
      x: M + 0.62, y, w: 3.2, h: 0.44,
      fontFace: BODY_FONT, fontSize: 13, bold: true, color: NAVY,
      valign: 'middle', margin: 0,
    })
    s.addText(l[2], {
      x: M + 3.9, y, w: 5.5, h: 0.44,
      fontFace: BODY_FONT, fontSize: 12, color: INK, valign: 'middle', margin: 0,
    })
    s.addText(l[4], {
      x: 10.4, y, w: 2.2, h: 0.44,
      fontFace: BODY_FONT, fontSize: 11.5, bold: true, color: l[3],
      align: 'right', valign: 'middle', margin: 0,
    })
  })

  s.addText(
    'E4 : la page existe et se remplit depuis un seul fichier ; elle reste discrète tant que l’activité éditrice '
    + 'n’est pas immatriculée — une identification incomplète ne vaut pas mieux qu’aucune page.',
    {
      x: M, y: 6.5, w: W - 2 * M, h: 0.55,
      fontFace: BODY_FONT, fontSize: 11.5, italic: true, color: SLATE, lineSpacing: 15, margin: 0,
    },
  )
}

// ═══════════════════════════════════════════ 7. Constats moyens
{
  const s = pres.addSlide()
  titre(s, 'Constats de gravité moyenne', '6 constats — 5 clos, 1 en relecture')

  const lignes = [
    ['M1', 'En-têtes de sécurité du site', 'Aucun en-tête : réglages navigateur permissifs.', CLOS, 'Clos'],
    ['M2', 'Vérification d’invitation', 'Permettait de tester l’existence d’une adresse.', CLOS, 'Clos'],
    ['M3', 'Formulaires publics', 'Réponses distinctes servant d’oracle ; aucune limite.', CLOS, 'Clos'],
    ['M4', 'Traçabilité des actions admin', 'Aucun journal : qui a fait quoi restait inconnu.', CLOS, 'Clos'],
    ['M5', 'Registre et contrat de sous-traitance', 'Documents obligatoires non établis.', COURS, 'En cours'],
    ['M6', 'Exercice des droits', 'Aucun outil pour accéder à ses données.', CLOS, 'Clos'],
  ]

  lignes.forEach((l, i) => {
    const y = 1.85 + i * 0.72
    pastille(s, l[0], M, y, l[3], 0.44)
    s.addText(l[1], {
      x: M + 0.62, y, w: 3.5, h: 0.44,
      fontFace: BODY_FONT, fontSize: 13, bold: true, color: NAVY,
      valign: 'middle', margin: 0,
    })
    s.addText(l[2], {
      x: M + 4.2, y, w: 5.2, h: 0.44,
      fontFace: BODY_FONT, fontSize: 12, color: INK, valign: 'middle', margin: 0,
    })
    s.addText(l[4], {
      x: 10.4, y, w: 2.2, h: 0.44,
      fontFace: BODY_FONT, fontSize: 11.5, bold: true, color: l[3],
      align: 'right', valign: 'middle', margin: 0,
    })
  })

  s.addText(
    'Chaque correction est accompagnée d’un test automatique : réintroduire le défaut fait échouer la suite '
    + 'avant toute mise en ligne.',
    {
      x: M, y: 6.35, w: W - 2 * M, h: 0.45,
      fontFace: BODY_FONT, fontSize: 12.5, italic: true, color: SLATE, margin: 0,
    },
  )
}

// ═══════════════════════════════════ 8. Au-delà de l'audit
{
  const s = pres.addSlide()
  titre(s, 'Au-delà de l’audit', 'Renforcements décidés depuis, sans qu’aucun constat ne les impose')

  const items = [
    {
      t: 'La session ne survit plus au navigateur',
      d: 'Fermer le navigateur déconnecte. Indispensable sur les postes partagés d’un magasin, '
       + 'où la session précédente restait ouverte.',
    },
    {
      t: 'Double authentification',
      d: 'Code à usage unique en plus du mot de passe. Exigé par le serveur lui-même pour toute '
       + 'action d’administration, pas seulement par l’interface.',
    },
    {
      t: 'Mots de passe renforcés',
      d: '12 caractères, majuscule, minuscule, chiffre et symbole. Les mots de passe présents dans '
       + 'des fuites connues sont refusés.',
    },
    {
      t: 'Réinitialisation autonome',
      d: 'Parcours « mot de passe oublié » complet, sans divulguer si une adresse correspond '
       + 'à un compte existant.',
    },
  ]

  items.forEach((it, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = M + col * 6.15
    const y = 1.85 + row * 2.15
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: 5.85, h: 1.85, rectRadius: 0.09,
      fill: { color: LIGHT }, line: { color: 'E1E7ED', width: 1 },
    })
    s.addText('✓', {
      shape: pres.ShapeType.ellipse,
      x: x + 0.3, y: y + 0.32, w: 0.5, h: 0.5,
      fill: { color: CLOS },
      fontFace: BODY_FONT, fontSize: 16, bold: true, color: WHITE,
      align: 'center', valign: 'middle', margin: 0,
    })
    s.addText(it.t, {
      x: x + 0.95, y: y + 0.28, w: 4.65, h: 0.42,
      fontFace: BODY_FONT, fontSize: 14.5, bold: true, color: NAVY,
      valign: 'middle', margin: 0,
    })
    s.addText(it.d, {
      x: x + 0.95, y: y + 0.75, w: 4.65, h: 0.95,
      fontFace: BODY_FONT, fontSize: 12, color: INK, lineSpacing: 15.5, margin: 0,
    })
  })

  s.addNotes('Ces quatre renforcements datent du 19 août 2026. Ils ne figuraient pas dans l’audit.')
}

// ═══════════════════════════════════ 9. Où vivent vos données
{
  const s = pres.addSlide()
  titre(s, 'Où vivent vos données', 'Hébergement, prestataires et transferts — déclarés sans exception')

  // Bloc hébergement
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 1.8, w: 5.4, h: 2.0, rectRadius: 0.1,
    fill: { color: NAVY }, line: { color: NAVY, width: 1 },
  })
  s.addText('Irlande', {
    x: M + 0.4, y: 2.05, w: 4.6, h: 0.7,
    fontFace: TITLE_FONT, fontSize: 30, bold: true, color: WHITE, margin: 0,
  })
  s.addText('Base de données, comptes et suivi en direct, hébergés dans l’Union européenne (région eu-west-1).', {
    x: M + 0.4, y: 2.8, w: 4.6, h: 0.85,
    fontFace: BODY_FONT, fontSize: 12.5, color: 'CADCFC', lineSpacing: 16, margin: 0,
  })

  // Sous-traitants
  s.addText('Nos sous-traitants', {
    x: 6.55, y: 1.8, w: 6.05, h: 0.35,
    fontFace: BODY_FONT, fontSize: 14, bold: true, color: NAVY, margin: 0,
  })
  const st = [
    ['Supabase', 'Base de données, comptes, temps réel'],
    ['Vercel', 'Hébergement du site'],
    ['Resend', 'Courriers électroniques de service'],
    ['Expo', 'Acheminement des notifications mobiles'],
  ]
  st.forEach((r, i) => {
    const y = 2.25 + i * 0.48
    s.addText(r[0], {
      x: 6.55, y, w: 1.75, h: 0.42,
      fontFace: BODY_FONT, fontSize: 12.5, bold: true, color: INK, valign: 'middle', margin: 0,
    })
    s.addText(r[1], {
      x: 8.35, y, w: 4.25, h: 0.42,
      fontFace: BODY_FONT, fontSize: 12, color: SLATE, valign: 'middle', margin: 0,
    })
  })

  // Trois garanties
  const g = [
    ['Aucun traceur', 'Ni cookie publicitaire ni mesure d’audience. Aucun bandeau à afficher à vos salariés.'],
    ['Cloisonnement en base', 'Les droits sont appliqués ligne par ligne par la base de données, pas seulement par l’application.'],
    ['Violation : 72 heures', 'Procédure écrite. Sur vos données d’inventaire, nous vous alertons sans délai — c’est vous qui notifiez la CNIL.'],
  ]
  g.forEach((b, i) => {
    const x = M + i * 4.07
    s.addText(b[0], {
      x, y: 4.15, w: 3.75, h: 0.35,
      fontFace: BODY_FONT, fontSize: 14, bold: true, color: CLOS, margin: 0,
    })
    s.addText(b[1], {
      x, y: 4.52, w: 3.75, h: 1.2,
      fontFace: BODY_FONT, fontSize: 12, color: INK, lineSpacing: 15.5, margin: 0,
    })
  })

  s.addText(
    'Les prestataires établis hors de l’Union européenne, et les transferts qui en découlent, sont nommés '
    + 'dans notre politique de confidentialité et dans notre registre des traitements.',
    {
      x: M, y: 6.0, w: W - 2 * M, h: 0.5,
      fontFace: BODY_FONT, fontSize: 12, italic: true, color: SLATE, lineSpacing: 16, margin: 0,
    },
  )
}

// ═══════════════════════════════════ 10. Le suivi d'activité, repensé
{
  const s = pres.addSlide()
  titre(s, 'Le suivi d’activité, repensé', 'Décision produit du 19 août 2026 — la question que pose tout CSE')

  const cols = [
    {
      x: M, tete: 'Avant', couleur: COURS,
      items: [
        'Le nom de chaque personne, en direct',
        'L’écran ouvert et la zone en cours',
        'Un battement toutes les 30 secondes',
        'L’application au premier plan — un téléphone rangé devenait un signal',
      ],
    },
    {
      x: M + 6.15, tete: 'Depuis le 19 août', couleur: CLOS,
      items: [
        'Des compteurs : appareils connectés, en comptage, en audit',
        'Le pilotage passe par l’avancement des zones, pas par les personnes',
        'Le signal ne porte plus aucun nom, ni aucun identifiant de compte',
        'L’état d’avant-plan a purement disparu',
      ],
    },
  ]

  cols.forEach(c => {
    s.addShape(pres.ShapeType.roundRect, {
      x: c.x, y: 1.8, w: 5.85, h: 2.95, rectRadius: 0.1,
      fill: { color: LIGHT }, line: { color: 'E1E7ED', width: 1 },
    })
    s.addText(c.tete, {
      x: c.x + 0.35, y: 2.02, w: c.w ?? 5.15, h: 0.4,
      fontFace: TITLE_FONT, fontSize: 19, bold: true, color: c.couleur, margin: 0,
    })
    s.addText(c.items.map((t, i) => ({
      text: t, options: { bullet: true, breakLine: i < c.items.length - 1 },
    })), {
      x: c.x + 0.35, y: 2.5, w: 5.15, h: 2.1,
      fontFace: BODY_FONT, fontSize: 12.5, color: INK,
      lineSpacing: 16, paraSpaceAfter: 7, margin: 0,
    })
  })

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 5.0, w: W - 2 * M, h: 1.35, rectRadius: 0.1,
    fill: { color: NAVY }, line: { color: NAVY, width: 1 },
  })
  s.addText('Ce que cela change pour vous', {
    x: M + 0.4, y: 5.15, w: 11.5, h: 0.35,
    fontFace: BODY_FONT, fontSize: 13, bold: true, color: '5FD3A6', margin: 0,
  })
  s.addText(
    'Les lignes directrices européennes retenaient deux critères pour imposer une analyse d’impact : '
    + 'surveillance systématique et personnes vulnérables. Le premier tombe — il n’en reste qu’un. '
    + 'L’AIPD n’est donc, en principe, plus requise ; cela reste à motiver par écrit avec votre conseil.',
    {
      x: M + 0.4, y: 5.5, w: 11.5, h: 0.75,
      fontFace: BODY_FONT, fontSize: 12.5, color: 'D8E3F0', lineSpacing: 16.5, margin: 0,
    },
  )

  s.addText(
    'Ce qui reste enregistré : l’auteur de chaque comptage, restitué dans le rapport. '
    + 'Arbitrer un écart suppose de savoir qui a compté — c’est une autre finalité, consultée à la demande.',
    {
      x: M, y: 6.5, w: W - 2 * M, h: 0.5,
      fontFace: BODY_FONT, fontSize: 11.5, italic: true, color: SLATE, lineSpacing: 15, margin: 0,
    },
  )

  s.addNotes('Argument à mettre en avant devant un CSE ou un service juridique : le produit ne permet plus de suivre l’activité individuelle en direct.')
}

// ═══════════════════════════════════ 10 bis. Ce qui reste ouvert
{
  const s = pres.addSlide()
  titre(s, 'Ce qui reste ouvert', 'Deux points, aucun ne portant sur la sécurité technique')

  const items = [
    {
      code: 'M5',
      t: 'Documentation juridique',
      etat: 'Rédigée · relecture à venir',
      couleur: COURS,
      d: 'Le registre des traitements (huit traitements, établis en relisant le code) et les clauses de '
       + 'sous-traitance de l’article 28 sont écrits et disponibles. Ils n’ont pas encore été relus par un '
       + 'conseil juridique, et ne sont donc pas opposables en l’état à un tiers.',
      next: 'Relecture prévue avant la première mise en service contractuelle.',
    },
    {
      code: 'E4',
      t: 'Mentions légales',
      etat: 'Socle en place · activation administrative',
      couleur: ATTENTE,
      d: 'La page existe et se remplit depuis un seul fichier. Elle reste volontairement discrète tant que '
       + 'l’activité éditrice n’est pas immatriculée : une identification à trous ne vaut pas mieux qu’aucune page.',
      next: 'Activation en une modification, le jour de l’immatriculation.',
    },
  ]

  items.forEach((it, i) => {
    const y = 1.85 + i * 2.3
    pastille(s, it.code, M, y + 0.04, it.couleur, 0.58)
    s.addText(it.t, {
      x: M + 0.85, y, w: 5.9, h: 0.4,
      fontFace: TITLE_FONT, fontSize: 19, bold: true, color: NAVY, margin: 0,
    })
    s.addText(it.etat, {
      x: 7.55, y: y + 0.03, w: 4.85, h: 0.35,
      fontFace: BODY_FONT, fontSize: 11.5, bold: true, color: it.couleur,
      align: 'right', margin: 0,
    })
    s.addText(it.d, {
      x: M + 0.85, y: y + 0.45, w: 11.0, h: 1.0,
      fontFace: BODY_FONT, fontSize: 12.5, color: INK, lineSpacing: 16, margin: 0,
    })
    s.addText([
      { text: 'Prochaine étape — ', options: { bold: true, color: SLATE } },
      { text: it.next, options: { color: SLATE } },
    ], {
      x: M + 0.85, y: y + 1.5, w: 11.0, h: 0.55,
      fontFace: BODY_FONT, fontSize: 11.5, italic: true, lineSpacing: 15, margin: 0,
    })
  })

  s.addText(
    'Aucun constat critique ni de gravité élevée ne reste ouvert sur la sécurité du produit.',
    {
      x: M, y: 6.5, w: W - 2 * M, h: 0.4,
      fontFace: BODY_FONT, fontSize: 12.5, italic: true, color: SLATE, margin: 0,
    },
  )
}

// ═══════════════════════════════════ 11. Ce qui vous revient
{
  const s = pres.addSlide()
  titre(s, 'Ce qui vous revient', 'Responsable de traitement, trois points à traiter avant le premier inventaire')

  const actes = [
    {
      n: '1',
      t: 'Informer vos salariés',
      d: 'Ce qui est observé pendant un inventaire, pourquoi, et pendant combien de temps. '
       + 'Nous vous remettons une note type, à adapter et à diffuser.',
    },
    {
      n: '2',
      t: 'Informer votre CSE',
      d: 'Le suivi en direct ayant été retiré, l’obligation de consultation se discute — mais informer '
       + 'le comité social et économique coûte peu et sécurise la démarche.',
    },
    {
      n: '3',
      t: 'Écarter l’analyse d’impact par écrit',
      d: 'Un seul critère sur six reste rempli : l’AIPD n’est en principe plus requise. Une AIPD écartée '
       + 'se motive par écrit — elle ne se déduit pas d’un silence. Notre analyse vous sert de base.',
    },
  ]

  actes.forEach((a, i) => {
    const y = 1.95 + i * 1.45
    s.addText(a.n, {
      shape: pres.ShapeType.ellipse,
      x: M, y, w: 0.62, h: 0.62,
      fill: { color: NAVY },
      fontFace: BODY_FONT, fontSize: 17, bold: true, color: WHITE,
      align: 'center', valign: 'middle', margin: 0,
    })
    s.addText(a.t, {
      x: M + 0.95, y: y - 0.02, w: 4.0, h: 0.42,
      fontFace: BODY_FONT, fontSize: 15, bold: true, color: NAVY, margin: 0,
    })
    s.addText(a.d, {
      x: M + 0.95, y: y + 0.42, w: 10.9, h: 0.85,
      fontFace: BODY_FONT, fontSize: 12.5, color: INK, lineSpacing: 16, margin: 0,
    })
  })

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 6.15, w: W - 2 * M, h: 0.75, rectRadius: 0.08,
    fill: { color: LIGHT }, line: { color: 'E1E7ED', width: 1 },
  })
  s.addText(
    'Nous fournissons les documents ; la décision et la diffusion vous appartiennent, '
    + 'parce que vous seul déterminez la finalité du traitement.',
    {
      x: M + 0.35, y: 6.15, w: W - 2 * M - 0.7, h: 0.75,
      fontFace: BODY_FONT, fontSize: 12.5, color: INK, valign: 'middle', margin: 0,
    },
  )
}

// ═══════════════════════════════════ 12. Questions fréquentes
{
  const s = pres.addSlide()
  titre(s, 'Vos questions, nos réponses', 'Ce que nous demandent le plus souvent les services juridiques')

  const faq = [
    ['Nos données sortent-elles de l’Union européenne ?',
      'La base est en Irlande. Certains prestataires sont établis aux États-Unis ; tous sont nommés dans notre politique.'],
    ['Un magasin peut-il voir les inventaires d’un autre ?',
      'Non. Le cloisonnement est appliqué par la base de données ligne par ligne, indépendamment de l’application.'],
    ['Utilisez-vous des cookies ou du traçage ?',
      'Aucun. Ni mesure d’audience, ni publicité, ni bandeau de consentement.'],
    ['Que se passe-t-il en cas de violation de données ?',
      'Procédure écrite. Nous vous alertons sans délai ; sur vos données, c’est vous qui notifiez la CNIL sous 72 heures.'],
    ['Nos salariés sont-ils surveillés pendant un inventaire ?',
      'Non. Le superviseur voit des compteurs agrégés, jamais qui fait quoi en direct. L’auteur d’un comptage n’apparaît que dans le rapport, après coup.'],
    ['Un salarié peut-il récupérer ou effacer ses données ?',
      'Oui : export en un clic depuis son compte, et suppression sur demande — les comptages sont alors anonymisés, pas détruits.'],
  ]

  faq.forEach((q, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = M + col * 6.15
    const y = 1.85 + row * 1.6
    s.addText('?', {
      shape: pres.ShapeType.ellipse,
      x, y, w: 0.42, h: 0.42,
      fill: { color: CLOS },
      fontFace: BODY_FONT, fontSize: 14, bold: true, color: WHITE,
      align: 'center', valign: 'middle', margin: 0,
    })
    s.addText(q[0], {
      x: x + 0.6, y: y - 0.03, w: 5.25, h: 0.5,
      fontFace: BODY_FONT, fontSize: 13, bold: true, color: NAVY, lineSpacing: 15.5, margin: 0,
    })
    s.addText(q[1], {
      x: x + 0.6, y: y + 0.5, w: 5.25, h: 0.95,
      fontFace: BODY_FONT, fontSize: 11.5, color: INK, lineSpacing: 15, margin: 0,
    })
  })
}

// ═══════════════════════════════════ 13. Clôture
{
  const s = pres.addSlide()
  s.background = { color: NAVY }

  s.addText('Notre engagement', {
    x: M, y: 1.5, w: 8.5, h: 0.7,
    fontFace: TITLE_FONT, fontSize: 36, bold: true, color: WHITE, margin: 0,
  })

  const points = [
    'Chaque correction est protégée par un test automatique : un défaut réintroduit fait échouer la mise en ligne.',
    'Ce qui n’est pas fait est écrit noir sur blanc, dans ce document comme dans notre politique de confidentialité.',
    'Notre documentation de conformité est tenue à jour à chaque évolution du produit, et peut vous être remise.',
  ]
  points.forEach((p, i) => {
    const y = 2.55 + i * 0.95
    s.addShape(pres.ShapeType.ellipse, {
      x: M, y: y + 0.09, w: 0.2, h: 0.2, fill: { color: '5FD3A6' }, line: { color: '5FD3A6', width: 0 },
    })
    s.addText(p, {
      x: M + 0.5, y, w: 8.9, h: 0.75,
      fontFace: BODY_FONT, fontSize: 14, color: 'D8E3F0', lineSpacing: 19, margin: 0,
    })
  })

  s.addText('Devkaylab · éditeur de Quantinvo · contact@quantinvo.com', {
    x: M, y: 6.05, w: 8.5, h: 0.35,
    fontFace: BODY_FONT, fontSize: 12.5, color: '8FA6C4', margin: 0,
  })
  s.addText('Document interne à vocation d’information — ne se substitue pas à un avis juridique.', {
    x: M, y: 6.4, w: 9.5, h: 0.35,
    fontFace: BODY_FONT, fontSize: 10.5, italic: true, color: '6E85A0', margin: 0,
  })

  s.addText('19.08\n2026', {
    x: 10.4, y: 2.4, w: 2.2, h: 1.6,
    fontFace: TITLE_FONT, fontSize: 40, bold: true, color: '1B3557',
    align: 'right', lineSpacing: 42, margin: 0,
  })
}

pres.writeFile({ fileName: '/tmp/claude-0/-home-user-Inventaire/856a8d1e-3800-5e33-9587-adc7500c929e/scratchpad/quantinvo-audit.pptx' })
  .then(f => console.log('OK', f))
