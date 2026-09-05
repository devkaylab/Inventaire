import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Les règles de la fiche magasin, portées aux pages connectées (5 septembre 2026).
 *
 * Julien : « les sections se ressemblent toutes, i just feel lost most of the
 * time ». La fiche magasin a été reprise le matin ; ces quatre pages
 * bâtissaient sur `.panel` et `.dash-*`, elles n'en avaient donc pas profité.
 *
 * ⚠️ CE QUE CES GARDES DÉFENDENT EST MESURÉ, PAS DESSINÉ. Sur l'écran de
 * Julien (1568 px), avant ce chantier : une tuile de 465 px pour afficher
 * « 2 », 918 px de vide entre le nom d'une personne et ses boutons, un champ
 * « Rechercher une personne » de 1 072 px, un titre de section à 1,33 fois le
 * texte courant, et pas une seule section avec un fond.
 *
 * ⚠️ /dashboard ET /entreprise NE SONT PAS DANS CE LOT (décision de Julien le
 * 5 septembre : « on ne touche pas au tableau de bord »). Ils vivent dans
 * `.tb-plein` — plein écran, tout en `em`, calé sur l'échelle de la maquette du
 * 30 août. Y poser des sections en pixels ferait se battre deux échelles. Un
 * test plus bas fige cette exclusion, pour qu'on ne « complète » pas le lot un
 * jour en croyant qu'il manque deux pages.
 */

const racine = path.join(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

/**
 * Le code sans ses commentaires.
 *
 * ⚠️ Les blocs se retirent AVANT le filtre des lignes : un commentaire JSX
 * (`{/* … *​/}`) ne commence par aucun préfixe reconnaissable sur ses lignes du
 * milieu. Sixième variante de ce piège sur ce dépôt — toute assertion
 * d'ABSENCE passe par là, sans quoi elle se lit sur la documentation qui
 * explique justement pourquoi la chose est absente.
 */
const code = (src: string) =>
  src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')

/** Les quatre pages du lot. */
const LOT = {
  '/inventaires': 'app/inventaires/page.tsx',
  '/equipe': 'app/equipe/page.tsx',
  '/magasins': 'app/magasins/page.tsx',
  '/journal': 'app/journal/page.tsx',
} as const

const css = lire('app/globals.css')

describe('les pages connectées suivent les règles de la fiche magasin', () => {
  it('⚠️ chacune range son contenu en SECTIONS, plus en marges', () => {
    // ⚠️ « Au moins une section » ne garde RIEN : une page qui en a deux passe
    // en en perdant une. La garde exige donc aussi que les classes de l'ancien
    // monde aient disparu — un bloc qui redevient une marge se signale par le
    // nom qu'il reprend. (Premier sabotage : il ne mordait pas.)
    const ancienMonde = ['dash-store', 'dash-kpi', 'className="dash-sub"']
    for (const [nom, f] of Object.entries(LOT)) {
      const src = code(lire(f))
      expect(src, `${nom} doit poser des .admin-section`)
        .toContain('className="admin-section"')
      for (const vieux of ancienMonde) {
        expect(src, `${nom} ne doit plus poser de ${vieux}`).not.toContain(vieux)
      }
    }
  })

  it('⚠️ et chaque titre de section porte sa phrase', () => {
    for (const [nom, f] of Object.entries(LOT)) {
      const src = code(lire(f))
      const sections = (src.match(/className="admin-section"/g) ?? []).length
      const phrases = (src.match(/className="section-note"/g) ?? []).length
      // Une section sans phrase oblige à lire son contenu pour savoir si c'est
      // le bon endroit — c'est le second manque que la comparaison a montré.
      expect(phrases, `${nom} : ${sections} sections pour ${phrases} phrases`)
        .toBeGreaterThanOrEqual(sections - 1)
    }
  })

  it('⚠️ chaque page dit en une phrase ce qu’on y fait', () => {
    for (const [nom, f] of Object.entries(LOT)) {
      expect(code(lire(f)), `${nom} doit porter un .page-sub sous son titre`)
        .toContain('className="page-sub"')
    }
  })

  it('⚠️ AUCUN champ de recherche ne traverse la page', () => {
    // Mesuré avant : 1 072 px pour taper un nom de personne, 1 428 pour un
    // inventaire. Un champ qui traverse l'écran laisse croire qu'il cherche
    // ailleurs que dans la section qui le porte.
    for (const [nom, f] of Object.entries(LOT)) {
      const src = code(lire(f))
      const recherches = (src.match(/type="search"/g) ?? []).length
      if (recherches === 0) continue
      const bornes = (src.match(/className="champ-borne"/g) ?? []).length
      expect(bornes, `${nom} : ${recherches} champ(s) de recherche pour ${bornes} borné(s)`)
        .toBe(recherches)
      expect(src, `${nom} ne doit plus poser de champ pleine largeur`)
        .not.toContain('toolbar-grow')
    }
  })

  it('⚠️ ET LES RANGÉES QU’ON N’A PAS MISES EN COLONNES SE COLLENT AUSSI', () => {
    // Trouvé en REGARDANT l'écran une fois le tableau des membres en place :
    // les invitations en attente et les demandes de magasin gardaient encore
    // 868 px entre leur texte et leurs boutons. Le tableau avait déplacé le
    // défaut, il ne l'avait pas fermé — mesuré à 24 px après correctif.
    expect(css).toMatch(/\.admin-section \.req-row \{[^}]*justify-content: flex-start/)
    expect(css).toMatch(/\.admin-section \.req-row > \*:first-child \{[^}]*max-width: 760px/)
  })

  it('et la borne vaut une largeur de lecture, pas la page', () => {
    // ⚠️ Ce n'est PAS un max-width sur `.app-main` : c'est le CONTRÔLE qui se
    // borne, la page reste pleine (décision du 30 août, deux fois constatée).
    // `navigation.test.ts` garde déjà l'absence de largeur maximale sur la
    // page — on ne la garde pas deux fois.
    expect(css).toMatch(/\.toolbar \.champ-borne \{[^}]*flex: 0 1 340px/)
  })
})

describe('/inventaires : la bande répond avant qu’on cherche', () => {
  const src = code(lire('app/inventaires/page.tsx'))

  it('⚠️ les trois tuiles de 465 px sont devenues une bande', () => {
    expect(src).toContain('className="resume-bande"')
    expect(src, 'les tuiles géantes ne reviennent pas').not.toContain('dash-kpi')
  })

  it('⚠️ et elle ne demande RIEN de plus au serveur', () => {
    // Elle compte ce que `getAccessibleSessions` a déjà rendu. Un chiffre qui
    // coûterait une requête n'a pas sa place dans un résumé de page.
    const bande = src.slice(src.indexOf('className="resume-bande"'), src.indexOf('className="resume-bande"') + 1400)
    expect(bande).not.toMatch(/supabase|rpc\(|await /)
  })

  it('l’ambre n’y désigne que ce qui est en cours', () => {
    // La couleur dit ce qu'il faut regarder, jamais ce qui s'est passé — même
    // règle que la tuile des refus (4 septembre) et que le zéro sans couleur
    // (29 août). Un inventaire clôturé n'appelle aucun geste.
    expect(src).toMatch(/activeCount > 0 \? 'attention' : undefined/)
  })

  it('⚠️ « clôturé ce mois-ci » se mesure sur la CLÔTURE', () => {
    // Sur `created_at`, un inventaire ouvert en juin et clôturé aujourd'hui ne
    // serait pas compté — et un ouvert ce mois-ci le serait à tort.
    expect(src).toContain('closed_at')
    expect(src).not.toMatch(/status === 'closed' && new Date\(s\.created_at\)/)
  })

  it('⚠️ la grille des cartes se REMPLIT, elle ne s’étire pas', () => {
    expect(css).toMatch(/\.dash-grid \{[^}]*repeat\(auto-fill, minmax\(280px, 1fr\)\)/)
    expect(css, 'trois colonnes fixes donnaient 465 px par carte')
      .not.toMatch(/\.dash-grid \{[^}]*repeat\(3, 1fr\)/)
  })

  it('« Clôturés » n’est plus un sous-titre plus petit que le texte', () => {
    // 12 px en capitales au-dessus d'un texte à 15 : ça ne sépare pas, ça
    // chuchote. La phrase de section porte le compte, la pastille de chaque
    // carte dit laquelle est clôturée.
    expect(src).not.toContain('dash-sub')
  })
})

describe('/equipe : une équipe se compare, elle ne se lit pas', () => {
  const src = code(lire('app/equipe/page.tsx'))

  it('⚠️ les 918 px de vide sont devenus des colonnes', () => {
    expect(src).toContain('className="membres"')
    for (const colonne of ['Personne', 'Rôle', 'Magasins', 'Activité']) {
      expect(src, `la colonne ${colonne} doit avoir son en-tête`)
        .toContain(`<div className="membres-th">${colonne}</div>`)
    }
  })

  it('⚠️ et les cellules sont des FRÈRES de la grille', () => {
    // Un conteneur par rangée casserait l'alignement des colonnes : c'est tout
    // l'intérêt d'une grille CSS, et c'est le genre d'erreur qu'un refactor
    // réintroduit sans que rien ne se voie sur une seule rangée.
    expect(src).toMatch(/<Fragment key=\{m\.id\}>/)
    expect(src).toContain('className="membres-fin"')
  })

  it('⚠️ le geste destructeur se va chercher, et il est le DERNIER', () => {
    // « Passer compteur » et « Supprimer le compte » étaient deux liens voisins
    // de même dessin, l'un réversible d'un clic et l'autre définitif. Famille
    // du défaut corrigé le 28 août dans l'application.
    expect(src).toContain('MenuActions')
    const menu = code(lire('components/ui/MenuActions.tsx'))
    expect(menu).toContain('destructif')
    // L'action destructive est écrite en dernier dans la liste des actions.
    const iSupprimer = src.indexOf("libelle: 'Supprimer le compte'")
    const iRole = src.indexOf("libelle: superviseur ? 'Passer compteur'")
    expect(iSupprimer).toBeGreaterThan(iRole)
  })

  it('⚠️ mais la recopie du nom ne bouge pas', () => {
    // Le menu déplace un bouton, pas un garde-fou. Un test de
    // `admin-entreprise.test.ts` garde déjà la confirmation elle-même ; celui-ci
    // vérifie qu'elle survit à ce chantier.
    expect(src).toContain('requireText: nom || p.email')
  })

  it('l’ambre ne dit qu’une chose : cette personne n’est jamais entrée', () => {
    // ⚠️ `is_active` veut dire « s'est déjà connecté », rien d'autre — le
    // contresens corrigé le 23 août 2026, à ne pas réintroduire.
    expect(src).toMatch(/membres-cell\$\{!m\.is_active \? ' attente' : ''\}/)
    expect(src).toContain('Mot de passe à créer')
  })

  it('⚠️ le superviseur ordinaire garde son rangement MAGASIN PAR MAGASIN', () => {
    // Règle du 23 août : un saisonnier part d'un magasin, pas de tous. Le
    // chantier change la forme de la section, jamais son découpage.
    expect(src).toMatch(/\(sup\?\.stores \?\? \[\]\)\.map/)
    expect(src).toContain('remove_counter_from_store')
  })
})

describe('/magasins : le compte quitte le titre', () => {
  const src = code(lire('app/magasins/page.tsx'))

  it('⚠️ « Magasins (2) » redevient « Magasins »', () => {
    // Un nombre entre parenthèses dans un titre n'aide personne à décider ; il
    // vit dans la bande, où il se compare aux autres. Même geste que
    // « Superviseurs · 3 » sur la fiche d'un magasin.
    expect(src).toContain('<h1 className="page-title">Magasins</h1>')
    expect(src).not.toMatch(/Magasins\{estAdmin && magasins\.length > 0/)
  })

  it('la bande compte ce qui est déjà chargé, et rien d’autre', () => {
    expect(src).toContain('className="resume-bande"')
    // Les compteurs d'un magasin peuvent se recouper d'un magasin à l'autre :
    // on ne les additionne pas. Les superviseurs se dédoublonnent par leur id.
    expect(src).toMatch(/new Set\(magasins\.flatMap\(\(m\) => m\.supervisors\.map\(\(p\) => p\.id\)\)\)/)
  })

  it('⚠️ « Seul Quantinvo peut créer un magasin » a disparu — c’était faux', () => {
    // Depuis le 4 septembre 2026 un magasin s'achète en libre-service. Le
    // commentaire en tête du fichier le disait déjà ; le texte de l'écran, lui,
    // était resté sur l'ancien monde.
    expect(src).not.toContain('Seul Quantinvo peut créer un magasin')
  })

  it('les demandes passent DEVANT l’ajout, et disparaissent quand il n’y en a pas', () => {
    const iDemandes = src.indexOf('<h2>Demandes en cours</h2>')
    const iAjout = src.indexOf('<h2>Ajouter un magasin</h2>')
    expect(iDemandes).toBeGreaterThan(-1)
    expect(iDemandes).toBeLessThan(iAjout)
    expect(src).toMatch(/demandes\.length > 0 && \(\s*<section className="admin-section">/)
  })
})

describe('/journal : la phrase remonte sous le titre', () => {
  const src = code(lire('app/journal/page.tsx'))

  it('« les 200 dernières » cesse d’être une note de bas de page', () => {
    // Elle décrit ce qu'on s'apprête à lire, pas ce qu'on vient de lire.
    const iNote = src.indexOf('Les 200 dernières')
    const iListe = src.indexOf('className="journal"')
    expect(iNote).toBeGreaterThan(-1)
    expect(iNote).toBeLessThan(iListe)
  })

  it('⚠️ et il n’y a PAS de bande de résumé', () => {
    // Compter des lignes de journal n'appelle aucun geste. On ne pose pas une
    // bande là où il n'y a rien à décider — une bande qui n'aide pas à agir
    // devient une décoration, et les autres cessent d'être crues.
    expect(src).not.toContain('resume-bande')
  })
})

describe('les pièges de couleur, mesurés dans les DEUX thèmes', () => {
  it('⚠️ `--surface-2` ne sert JAMAIS de fond dans ce chantier', () => {
    // En thème clair `--surface-2` vaut #ffffff, exactement `--surface` : une
    // rangée d'en-tête posée dessus serait invisible sur la surface d'une
    // section. Troisième fois que ce piège se présente (les champs de saisie le
    // 22 août et le 4 septembre) — le point commun n'est pas l'élément, c'est
    // ce qu'il y a DERRIÈRE lui.
    const bloc = css.slice(css.indexOf('.membres {'), css.indexOf('.menu-actions-item.destructif'))
    expect(code(bloc)).not.toContain('--surface-2')
  })

  it('⚠️ « Mot de passe à créer » se LIT', () => {
    // `--warning` est la couleur d'une pastille (3,2:1 sur la surface en
    // clair) ; `--warning-text` est celle qui passe AA (5,0:1). Même correctif
    // que `.offre-refus` le 5 septembre, et au même genre d'endroit : celui où
    // l'on cherche qui n'est jamais entré.
    expect(css).toMatch(/\.membres-cell\.attente \{[^}]*var\(--warning-text\)/)
  })

  it('l’en-tête des colonnes n’est pas plus pâle que le texte qu’il coiffe', () => {
    expect(css).toMatch(/\.membres-th \{[^}]*color: var\(--text-2\)/)
  })
})

describe('⚠️ les deux tableaux de bord restent hors du lot', () => {
  // Décision de Julien, 5 septembre 2026 : « on ne touche pas au tableau de
  // bord ». Ce test n'est pas une formalité — il empêche qu'on « complète » le
  // chantier un jour en croyant qu'il manque deux pages, et qu'on fasse se
  // battre deux échelles sur le même écran.
  for (const [nom, f] of [['/dashboard', 'app/dashboard/page.tsx'], ['/entreprise', 'app/entreprise/page.tsx']] as const) {
    it(`${nom} garde son échelle .tb-plein`, () => {
      const src = code(lire(f))
      expect(src, `${nom} doit rester en .tb-plein`).toContain('className="tb-plein"')
      expect(src, `${nom} ne prend pas les sections de la fiche magasin`)
        .not.toContain('admin-section')
    })
  }
})
