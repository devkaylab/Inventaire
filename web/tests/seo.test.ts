// Ce que les moteurs et les assistants voient du site.
//
// Avant le 2 septembre 2026, le site n'avait NI `robots.txt`, NI plan du site,
// NI Open Graph, NI données structurées, et une seule balise titre pour toutes
// ses pages. Ces tests figent les fondations posées ce jour-là — leur intérêt
// n'est pas de vérifier que Next fonctionne, mais qu'une page publique ajoutée
// plus tard ne reste pas invisible, et qu'une page privée ne devienne pas
// visible.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const APP = path.resolve(__dirname, '../app')

const site = lire('../lib/site.ts')
const robots = lire('../app/robots.ts')
const layout = lire('../app/layout.tsx')
const structurees = lire('../components/DonneesStructurees.tsx')

/** Les segments de premier niveau qui portent réellement une page. */
function routes(): string[] {
  return readdirSync(APP, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(path.join(APP, d.name, 'page.tsx')))
    .map(d => d.name)
}

describe('le site est explorable', () => {
  it('l’origine canonique porte le www, comme le domaine', () => {
    // ⚠️ `quantinvo.com` redirige en 308 vers `www`. Déclarer l'origine sans
    // `www` ferait pointer les balises canoniques et le plan du site vers des
    // adresses qui redirigent — c'est ce qui dilue un référencement.
    expect(site).toContain("export const SITE_URL = 'https://www.quantinvo.com'")
    expect(lire('../lib/links.ts')).toContain('https://www.quantinvo.com/')
  })

  it('le plan du site ne cite que des pages qui existent', () => {
    const chemins = [...site.matchAll(/chemin: '([^']+)'/g)].map(m => m[1])
    expect(chemins.length).toBeGreaterThan(5)
    for (const c of chemins) {
      const attendu = c === '/'
        ? path.join(APP, 'page.tsx')
        : path.join(APP, c.replace(/^\//, ''), 'page.tsx')
      expect(existsSync(attendu), `${c} est au plan du site mais n’a pas de page`).toBe(true)
    }
  })

  it('toute page publique nouvelle entre au plan du site, ou est écartée nommément', () => {
    // ⚠️ C'est LE test utile de ce fichier. Une page publique ajoutée dans six
    // mois et oubliée du plan du site ne se verrait nulle part : ni erreur, ni
    // avertissement, juste une page que personne ne trouve. Ici, elle fait
    // échouer la suite tant que quelqu'un n'a pas tranché.
    const ECARTEES = new Set([
      // Étapes de parcours, arrivées par un lien personnel : rien à indexer.
      'bienvenue', 'reinitialisation', 'mot-de-passe-oublie', 'login',
      // Une page par prospect, derrière un jeton : l'indexer publierait des devis.
      'devis',
      // L'espace connecté — il ne s'ouvre même pas sous 720 px.
      'dashboard', 'inventaires', 'entreprise', 'equipe', 'magasins',
      'journal', 'messages', 'admin', 'outils', 'account',
      // Se met elle-même en noindex tant que l'éditeur n'est pas immatriculé.
      'mentions-legales',
    ])
    const auPlan = new Set(
      [...site.matchAll(/chemin: '\/([^']*)'/g)].map(m => m[1].split('/')[0]).filter(Boolean),
    )
    const orphelines = routes().filter(r => !ECARTEES.has(r) && !auPlan.has(r))
    expect(orphelines, `pages publiques absentes du plan du site : ${orphelines.join(', ')}`).toEqual([])
  })

  it('les pages à jeton et l’espace connecté sont fermés aux robots', () => {
    for (const chemin of ['/devis/', '/dashboard', '/admin', '/account', '/messages']) {
      expect(robots, `${chemin} doit être fermé`).toContain(`'${chemin}'`)
    }
    expect(robots).toContain('sitemap')
  })
})

describe('ce qu’un aperçu de partage affiche', () => {
  it('une base d’adresses absolue est déclarée', () => {
    // Sans `metadataBase`, Next rend l'adresse de l'image en relatif et aucun
    // aperçu ne peut la charger.
    expect(layout).toContain('metadataBase: new URL(SITE_URL)')
  })

  it('l’image de partage existe vraiment, à la bonne taille', () => {
    const og = path.resolve(__dirname, '../public/og.png')
    expect(existsSync(og), 'web/public/og.png manque — le générer par docs/entreprise/boutiques/produire.mjs').toBe(true)
    expect(layout).toContain('width: 1200, height: 630')
  })

  it('aucun titre de page ne répète la marque', () => {
    // ⚠️ Le gabarit du layout ajoute « — Quantinvo ». Les pages le portaient
    // aussi en dur : elles affichaient « Tarifs — Quantinvo — Quantinvo ».
    expect(layout).toContain("template: '%s — Quantinvo'")
    for (const r of routes()) {
      const f = path.join(APP, r, 'page.tsx')
      const t = readFileSync(f, 'utf8').match(/^\s*title: '([^']*)'/m)?.[1]
      if (!t) continue
      expect(t, `${r} répète la marque : le gabarit l’ajoute déjà`).not.toMatch(/— Quantinvo$/)
    }
  })
})

describe('les données structurées disent ce que la page dit', () => {
  it('les prix viennent de la grille, jamais recopiés', () => {
    // Les decks ont porté une grille remplacée pendant une semaine. Un
    // balisage périmé serait pire : il est lu par des machines.
    // ⚠️ On vérifie CE QUI EST IMPORTÉ, pas la ligne mot pour mot : elle a
    // gagné `TVA_APPLICABLE` le 4 septembre 2026, et une assertion sur la
    // chaîne exacte casse à chaque ajout sans rien protéger de plus.
    expect(structurees).toMatch(/import \{[^}]*\bOFFRES\b[^}]*\} from '@\/lib\/offres'/)
    expect(structurees).toContain('offers: OFFRES.map')
    expect(structurees).not.toMatch(/price: \d{3,}/)
  })

  it('le JSON est échappé avant d’entrer dans le document', () => {
    expect(structurees).toContain("replace(/</g, '\\\\u003c')")
  })

  // ⚠️ AMENDÉ LE 4 SEPTEMBRE 2026, PAS AFFAIBLI. Ce que le test défend n'a pas
  // changé — **le balisage dit la même chose que la page**, sinon il annonce
  // aux machines un prix qui n'est pas celui payé. Ce qui a changé, c'est ce
  // que la page dit : en franchise en base, le prix affiché EST le prix dû,
  // donc la taxe est « incluse » au sens du balisage.
  it('le prix est annoncé comme sur la page', () => {
    expect(structurees).toContain('valueAddedTaxIncluded: !TVA_APPLICABLE')
  })

  it('l’éditeur et le site sont déclarés une fois, à la racine', () => {
    expect(layout).toContain('<OrganisationJsonLd />')
  })
})

describe('la suppression de compte a une adresse publique', () => {
  const page = lire('../components/vitrine/SuppressionCompte.tsx')

  it('la page existe et reste hors de la coquille', () => {
    // ⚠️ Google Play l'exige : un lien web accessible SANS installer
    // l'application. Derrière une connexion, elle ne remplirait pas la
    // condition — la personne qui veut supprimer son compte est justement
    // celle qui n'arrive plus à entrer.
    expect(page).not.toContain('<AppShell')
    expect(page).not.toContain('useAuthGuard')
  })

  it('elle donne les deux chemins, et dit ce qui reste', () => {
    expect(page).toContain('Depuis l’application')
    expect(page).toContain('Par courrier électronique')
    // La politique de confidentialité dit la même chose en section 9 : les
    // comptages sont conservés par l'entreprise, détachés de l'identité.
    expect(page).toContain('détachés de votre')
    expect(lire('../../docs/privacy.html')).toContain('détachés de votre identité')
  })

  it('elle n’est pas fermée aux robots', () => {
    expect(robots).not.toContain('suppression-compte')
    expect(site).toContain("chemin: '/suppression-compte'")
  })
})

describe('la preuve de propriété du site', () => {
  // ⚠️ CE FICHIER N'EST PAS UN RÉSIDU DE TÉLÉCHARGEMENT. Il prouve à la Google
  // Search Console que www.quantinvo.com nous appartient, et cette preuve est
  // ce qui débloque, dans la Play Console, « Modifier le type de compte » —
  // donc le passage du compte personnel au compte ORGANISATION, donc la sortie
  // de l'obligation de test fermé (12 testeurs, 14 jours) que Google n'impose
  // qu'aux comptes personnels. Voir AGENTS.md, « Le tour des consoles ».
  //
  // Le supprimer casse la validation en silence : Search Console revérifie le
  // fichier périodiquement, et une propriété perdue peut faire retomber le
  // statut du compte. Il reste donc dans `public/`, servi à la racine.
  const PUBLIC = path.resolve(__dirname, '../public')
  const fichiers = readdirSync(PUBLIC).filter(f => /^google[0-9a-f]+\.html$/.test(f))

  it('est posée dans public/, et une seule fois', () => {
    // Une seule : deux jetons veulent dire qu'une ancienne propriété traîne, et
    // on ne saurait plus laquelle fait foi.
    expect(fichiers).toHaveLength(1)
  })

  it('porte EXACTEMENT le jeton que Google attend', () => {
    // Google compare le contenu à la lettre — une ligne d'explication ajoutée
    // dans le fichier suffit à faire échouer la validation. L'explication vit
    // donc ici, jamais dedans. Le nom du fichier EST le jeton : la garde le
    // déduit plutôt que de le citer.
    const nom = fichiers[0]
    expect(readFileSync(path.join(PUBLIC, nom), 'utf8'))
      .toBe(`google-site-verification: ${nom}`)
  })
})

describe('les questions visibles sont aussi balisées', () => {
  // ⚠️ `FaqJsonLd` a été écrit le 2 septembre 2026 et n'a été posé NULLE PART
  // pendant un mois : deux pages affichaient une vraie foire aux questions,
  // et aucune ne la signalait. C'est la matière que les réponses IA de Google
  // et les assistants vont chercher — un composant prêt et jamais appelé ne
  // produit rien, et rien ne le disait.
  //
  // La garde DÉDUIT les pages concernées : toute page de la vitrine qui
  // déplie une liste `QUESTIONS` doit porter le balisage. Une troisième page
  // à questions, écrite dans six mois, entre d'elle-même dans la liste.
  const VITRINE = path.resolve(__dirname, '../components/vitrine')
  const aQuestions = readdirSync(VITRINE)
    .filter(f => f.endsWith('.tsx'))
    .map(f => ({ f, src: readFileSync(path.join(VITRINE, f), 'utf8') }))
    .filter(({ src }) => /const QUESTIONS\s*=/.test(src) && src.includes('<details'))

  it('il y a bien des pages à questions à surveiller', () => {
    // Si ce compte tombe à zéro, c'est que la forme a changé et que les deux
    // tests suivants ne vérifient plus rien — une garde qui s'éteint en
    // silence est pire qu'une garde absente.
    expect(aQuestions.length).toBeGreaterThan(1)
  })

  it('chacune pose FaqJsonLd', () => {
    const nues = aQuestions.filter(({ src }) => !src.includes('<FaqJsonLd items=')).map(({ f }) => f)
    expect(nues, `questions visibles sans balisage : ${nues.join(', ')}`).toEqual([])
  })

  it('le balisage et l’affichage lisent la MÊME liste', () => {
    // Deux parcours de `QUESTIONS` — un pour les blocs dépliables, un pour le
    // balisage — dérivent dès qu'on touche à l'un des deux, et le balisage
    // annonce alors aux machines une réponse que la page n'affiche plus.
    // Google compte ça comme une fausse déclaration.
    for (const { f, src } of aQuestions) {
      const parcours = src.match(/QUESTIONS\.map/g) ?? []
      expect(parcours, `${f} parcourt QUESTIONS ${parcours.length} fois : une seule liste dérivée`).toHaveLength(1)
      expect(src, `${f} doit afficher la liste dérivée`).toMatch(/\{FAQ\.map\(/)
    }
  })
})

describe('ce que les assistants lisent', () => {
  // ⚠️ ON VÉRIFIE LE TEXTE PRODUIT, PAS LE FICHIER. Première version de cette
  // garde : elle cherchait les mots interdits dans la SOURCE de la route — et
  // elle mordait sur le commentaire qui explique justement pourquoi ils sont
  // interdits. Un contrôle qui lit les commentaires ne contrôle pas le code.
  const ROUTE = path.resolve(__dirname, '../app/llms.txt/route.ts')

  it('llms.txt est servi par le site', async () => {
    expect(existsSync(ROUTE), 'app/llms.txt/route.ts manque').toBe(true)
    const { GET } = await import('../app/llms.txt/route')
    const reponse = GET()
    expect(reponse.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await reponse.text()).toMatch(/^# Quantinvo\n/)
  })

  it('il annonce la grille telle qu’elle est, pas une copie', async () => {
    // ⚠️ Un llms.txt statique vieillit EN SILENCE : personne ne relit un
    // fichier destiné aux machines, et ce qu'il raconte ressort mot pour mot
    // dans la réponse d'un assistant, sans guillemets et sans date. La garde
    // déduit ce qu'elle attend de `lib/offres.ts` — elle ne cite aucun prix.
    const { GET } = await import('../app/llms.txt/route')
    const { MENTION_TVA, OFFRES, TVA_APPLICABLE, euros } = await import('../lib/offres')
    const texte = await GET().text()
    for (const o of OFFRES) {
      expect(texte, `${o.nom} manque`).toContain(o.nom)
      expect(texte, `le prix mensuel de ${o.nom} manque`).toContain(euros(o.mois))
      expect(texte, `le prix annuel de ${o.nom} manque`).toContain(euros(o.an))
    }
    expect(texte).toContain(TVA_APPLICABLE ? 'hors taxes' : MENTION_TVA)
  })

  it('il dit de la vente ce que le site en dit', async () => {
    const { GET } = await import('../app/llms.txt/route')
    const { venteOuverte } = await import('../lib/legal')
    const texte = await GET().text()
    // ⚠️ La vente est fermée tant que `lib/legal.ts` est incomplet. Annoncer
    // aux assistants une souscription en ligne qui refuse les paiements leur
    // ferait promettre au prospect ce que la page ne tient pas.
    expect(/souscription en ligne est ouverte/.test(texte)).toBe(venteOuverte())
  })

  it('il ne renvoie que vers des adresses absolues du site', async () => {
    const { GET } = await import('../app/llms.txt/route')
    const { SITE_URL } = await import('../lib/site')
    const texte = await GET().text()
    const liens = [...texte.matchAll(/\((https?:\/\/[^)]+)\)/g)].map(m => m[1])
    expect(liens.length).toBeGreaterThan(4)
    for (const l of liens) {
      expect(l, `${l} ne pointe pas sur l’origine canonique`).toContain(SITE_URL)
    }
  })

  it('il ne promet pas ce que les CGV écartent', async () => {
    // Les points des offres ont été purgés de ces phrases le 19 septembre
    // 2026 (CGV 8.2 et 8.3). Elles ne doivent pas rentrer par cette porte.
    const { GET } = await import('../app/llms.txt/route')
    const texte = (await GET().text()).toLowerCase()
    for (const interdit of ['disponibilité', 'jour ouvré', 'garantie', 'sous 24', 'assistance']) {
      expect(texte, `llms.txt promet « ${interdit} »`).not.toContain(interdit)
    }
  })

  it('il donne les fiches de boutique ouvertes', async () => {
    const { GET } = await import('../app/llms.txt/route')
    const { boutiquesEnLigne, PUBLIEE_ANDROID, PUBLIEE_IOS } = await import('../lib/appStores')
    const texte = await GET().text()
    for (const b of boutiquesEnLigne(PUBLIEE_IOS, PUBLIEE_ANDROID)) {
      expect(texte, `${b} manque`).toContain(b)
    }
    expect(texte, 'une recherche n’est pas une fiche').not.toContain('/search')
  })
})

describe('les fiches de boutique annoncées aux machines', () => {
  it('une boutique fermée ne fournit AUCUNE adresse', async () => {
    // ⚠️ Les constantes `APP_STORE_URL` / `PLAY_STORE_URL` retombent sur la
    // RECHERCHE de la plateforme quand la boutique n'a pas ouvert. C'est juste
    // pour un bouton ; dans un balisage, ce serait annoncer une page de
    // recherche comme la page officielle du produit. La garde exerce les
    // quatre cas, pas seulement celui du jour.
    const { boutiquesEnLigne } = await import('../lib/appStores')
    expect(boutiquesEnLigne(false, false)).toEqual([])
    expect(boutiquesEnLigne(true, false)).toHaveLength(1)
    expect(boutiquesEnLigne(false, true)).toHaveLength(1)
    expect(boutiquesEnLigne(true, true)).toHaveLength(2)
    for (const [ios, android] of [[true, false], [false, true], [true, true]] as const) {
      for (const adresse of boutiquesEnLigne(ios, android)) {
        expect(adresse, 'une recherche n’est pas une fiche').not.toMatch(/\/search/)
      }
    }
  })

  it('elles sont portées par le logiciel, pas par l’éditeur', () => {
    // Une fiche App Store décrit l'APPLICATION. La poser sur `Organization`
    // annoncerait la page de l'app comme une page de la société.
    const bloc = structurees.slice(structurees.indexOf('export function LogicielJsonLd'))
    expect(bloc).toContain('sameAs: boutiquesEnLigne')
    expect(bloc).toContain('installUrl: boutiquesEnLigne')
    const organisation = structurees.slice(
      structurees.indexOf('export function OrganisationJsonLd'),
      structurees.indexOf('export function LogicielJsonLd'),
    )
    expect(organisation, 'les boutiques ne décrivent pas l’éditeur').not.toContain('boutiquesEnLigne')
  })
})

describe('le moyeu des pages de sujet', () => {
  /*
   * ⚠️ TROIS PAGES DE RÉFÉRENCEMENT SONT ARRIVÉES LE 3 OCTOBRE 2026, et elles
   * traitent des morceaux d'un sujet que `/inventaire` traite en large. C'est
   * la structure qui les sauve : sans liens depuis la page large, elles
   * n'existeraient que dans le plan du site — et surtout, deux pages d'un même
   * site qui traitent le même sujet au même niveau se font concurrence au lieu
   * de s'additionner. Les liens disent à un moteur laquelle traite quoi.
   *
   * LA GARDE DÉDUIT SA LISTE DU MOYEU LUI-MÊME : elle lit les pages que
   * `/inventaire` cite, et exige la réciproque. Une quatrième page ajoutée
   * demain à ce bloc entre dans la garde sans que personne n'y pense.
   */
  const VITRINE = path.resolve(__dirname, '../components/vitrine')
  const moyeu = readFileSync(path.join(VITRINE, 'Inventaire.tsx'), 'utf8')
  const rayons = [...moyeu.matchAll(/className="dq-lien"/g)].length
  const cites = [...moyeu.matchAll(/lien\('(\/[a-z0-9-]+)'\)\} className="dq-lien"/g)].map(m => m[1])

  /** Le composant qui sert une adresse publique, via son `app/<chemin>/page.tsx`. */
  function composantDe(chemin: string): string {
    const page = readFileSync(path.resolve(APP, chemin.replace(/^\//, ''), 'page.tsx'), 'utf8')
    const nom = /from '@\/components\/vitrine\/(\w+)'/.exec(page)?.[1]
    expect(nom, `${chemin} ne sert pas un composant de la vitrine`).toBeTruthy()
    return readFileSync(path.join(VITRINE, `${nom}.tsx`), 'utf8')
  }

  it('la page large cite ses pages de détail', () => {
    // Si ce compte tombe à zéro, la garde ne vérifie plus rien : le bloc a
    // changé de forme et les deux tests suivants passent à vide.
    expect(rayons, 'le bloc « Pour aller plus loin » a disparu de /inventaire').toBeGreaterThan(2)
    expect(cites).toHaveLength(rayons)
  })

  it('chaque page citée existe, est au plan du site et renvoie au moyeu', () => {
    const site = lire('../lib/site.ts')
    for (const chemin of cites) {
      expect(existsSync(path.resolve(APP, chemin.replace(/^\//, ''), 'page.tsx')), `${chemin} n’existe pas`).toBe(true)
      expect(site, `${chemin} n’est pas au plan du site`).toContain(`chemin: '${chemin}'`)
      // ⚠️ La réciproque, c'est ce qui fait un moyeu et pas un cul-de-sac.
      expect(composantDe(chemin), `${chemin} ne renvoie pas vers /inventaire`)
        .toContain("lien('/inventaire')")
    }
  })

  it('aucune page de détail ne reprend le titre de la page large', () => {
    // Deux titres qui visent la même requête se remplacent dans les
    // résultats au lieu de s'ajouter. Les titres vivent tous dans
    // `metaVitrineTextes.ts` : on les compare entre eux, sans en citer un.
    const textes = lire('../lib/metaVitrineTextes.ts')
    const titres = [...textes.matchAll(/title: '([^']+)'/g)].map(m => m[1])
    const doublons = titres.filter((t, i) => titres.indexOf(t) !== i)
    expect(doublons, `titres en double : ${doublons.join(' · ')}`).toEqual([])
  })
})

describe('aucune page du plan du site n’est orpheline', () => {
  /*
   * ⚠️ TROIS PAGES ONT VÉCU AU PLAN DU SITE SANS QU'AUCUN LIEN NE MÈNE À
   * ELLES — `/souscrire`, `/superviseur` et `/suppression-compte`, jusqu'au
   * 3 octobre 2026. Rien ne le signalait : elles répondaient en 200, elles
   * étaient au plan du site, et chaque test passait. Mais un moteur suit les
   * liens avant tout : une page que rien ne cite a l'air de n'intéresser
   * personne, et elle est explorée en dernier, si elle l'est.
   *
   * ⚠️ CELLE DE GOOGLE PLAY EST LA PLUS COÛTEUSE DES TROIS : la boutique
   * exige une adresse publique de suppression de compte, et une page
   * atteignable seulement en tapant son adresse tient mal cette promesse.
   *
   * LA GARDE DÉDUIT SA LISTE DU PLAN DU SITE. Une page publique ajoutée
   * demain devra être citée quelque part, ou justifier ici pourquoi non.
   */
  const SOURCES = (() => {
    const out: string[] = []
    const balayer = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) balayer(p)
        else if (/\.tsx?$/.test(e.name)) out.push(p)
      }
    }
    for (const d of ['app', 'components', 'lib']) balayer(path.resolve(__dirname, '..', d))
    // ⚠️ `lib/site.ts` EST LE PLAN DU SITE LUI-MÊME : s'y citer n'est pas être
    // lié. Les titres et descriptions non plus — ils décrivent, ils ne mènent
    // nulle part.
    return out
      .filter(f => !/lib[/\\](site|metaVitrineTextes)\.ts$/.test(f))
      .map(f => readFileSync(f, 'utf8'))
      .join('\n')
  })()

  /** Les formes qu'un VRAI lien prend dans ce dépôt — pas une balise canonique. */
  function liensVers(chemin: string): number {
    const e = chemin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const formes = [
      new RegExp(`lien\\('${e}'\\)`, 'g'),       // vitrine, dans la langue de la page
      new RegExp(`href="${e}"`, 'g'),            // lien écrit en dur
      new RegExp(`href: '${e}'`, 'g'),           // entrée de lib/navigation.ts
      new RegExp(`quantinvo\\.com${e}'`, 'g'),   // adresse absolue (PRIVACY_URL)
    ]
    return formes.reduce((n, r) => n + (SOURCES.match(r)?.length ?? 0), 0)
  }

  const site = lire('../lib/site.ts')
  const francaises = [...site.matchAll(/chemin: '(\/[^']*)'/g)]
    .map(m => m[1])
    .filter(c => c !== '/' && !c.startsWith('/en'))

  it('la liste se déduit bien du plan du site', () => {
    expect(francaises.length).toBeGreaterThan(8)
  })

  it('chaque page française du plan du site est citée quelque part', () => {
    const orphelines = francaises.filter(c => liensVers(c) === 0)
    expect(
      orphelines,
      `au plan du site mais aucun lien n’y mène : ${orphelines.join(', ')}`,
    ).toEqual([])
  })

  it('les jumelles /en n’ont pas besoin d’être citées séparément', () => {
    // `lien()` traduit l'adresse à l'affichage : un seul `lien('/tarifs')`
    // rend `/tarifs` en français et `/en/tarifs` en anglais. Les citer deux
    // fois serait l'erreur inverse.
    const anglaises = [...site.matchAll(/chemin: '(\/en[^']*)'/g)].map(m => m[1])
    expect(anglaises.length).toBeGreaterThan(5)
    for (const c of anglaises) {
      expect(SOURCES, `${c} est écrit en dur : il doit passer par lien()`).not.toContain(`href="${c}"`)
    }
  })
})
