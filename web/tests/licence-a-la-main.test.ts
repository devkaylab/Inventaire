// Ouvrir un accès sans Stripe, et marquer ses propres essais (4 octobre 2026).
//
// Deux besoins de Julien, un seul mécanisme : « créer des entreprises et
// magasins de test avec le choix des licences », et « ce flux peut aussi
// servir si le client paie autrement que par Stripe ». Ce qui distingue un
// essai d'un virement, c'est la case cochée et le motif écrit au journal —
// pas le geste.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { derniereDefinition, dossierMigrations, fichierDe } from './migrations'

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

/** Le SQL sans ses commentaires : ils citent forcément ce qu'ils interdisent. */
const sansCommentaires = (s: string) => s.replace(/--.*$/gm, ' ')

/** Le TSX sans ses commentaires, même raison. */
const codeSeul = (s: string) =>
  s.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

describe('les essais sortent des chiffres', () => {
  /**
   * ⚠️ LA LISTE SE DÉDUIT DES MIGRATIONS, elle ne se recopie pas ici. Une
   * sixième fonction de pilotage écrite dans six mois — un revenu par mois,
   * un taux de conversion — entrerait dans cette garde sans que personne n'y
   * pense, et c'est tout l'intérêt : une entreprise d'essai qui ressort dans
   * UN seul écran, c'est celui qu'on ne regarde pas qui ment.
   */
  const ECARTEE = new Map([
    // Compte les superviseurs d'un magasin pour refuser d'en retirer le
    // dernier. Ce n'est pas un chiffre de pilotage : un magasin d'essai doit
    // garder son superviseur comme les autres.
    ['admin_unassign_supervisor', 'règle métier, pas un chiffre de pilotage'],
  ])

  function fonctionsAdmin(): string[] {
    const noms = new Set<string>()
    for (const f of readdirSync(dossierMigrations).filter((f) => f.endsWith('.sql'))) {
      const texte = readFileSync(path.join(dossierMigrations, f), 'utf8')
      for (const m of texte.matchAll(/create (?:or replace )?function public\.(admin_[a-z_]+)\(/gi)) {
        noms.add(m[1])
      }
    }
    return [...noms].sort()
  }

  /** Celles qui totalisent quelque chose sur les entreprises ou les magasins. */
  const agregats = fonctionsAdmin().filter((fn) => {
    const corps = sansCommentaires(derniereDefinition(fn).corps).toLowerCase()
    const lit = corps.includes('from public.stores') || corps.includes('from public.companies')
    return lit && (corps.includes('sum(') || corps.includes('count('))
  })

  it('il y a bien des écrans de pilotage à surveiller', () => {
    // Si ce compte tombe, la déduction est cassée et les tests suivants
    // passent à vide. Une garde qui s'éteint en silence est pire qu'absente.
    expect(agregats.length).toBeGreaterThan(3)
  })

  it('chacun connaît la règle des essais', () => {
    const aveugles = agregats
      .filter((fn) => !ECARTEE.has(fn))
      .filter((fn) => {
        const corps = sansCommentaires(derniereDefinition(fn).corps)
        return !/est_test|est_un_essai/.test(corps)
      })
    expect(
      aveugles,
      `comptent les essais comme des clients : ${aveugles.join(', ')}`,
    ).toEqual([])
  })

  /**
   * ⚠️ **AMENDÉE AVANT MÊME D'AVOIR SERVI**, et c'est le sabotage qui l'a dit.
   * La garde au-dessus demande que la fonction MENTIONNE la règle quelque
   * part. En retirant le filtre d'UNE seule mesure du tableau de bord — le
   * nombre d'entreprises — elle est restée verte : les neuf autres mentions
   * suffisaient. Or c'est exactement le défaut à craindre, une mesure ajoutée
   * plus tard sans son filtre.
   *
   * Celle-ci découpe le tableau de bord MESURE PAR MESURE et les exige toutes.
   */
  it('et aucune mesure du tableau de bord n’y échappe', () => {
    const corps = sansCommentaires(derniereDefinition('admin_business_overview').corps)
    // Les mesures sont les clés du json rendu, à leur indentation.
    const cles = [...corps.matchAll(/\n {4}'(\w+)',/g)].map((m) => ({ nom: m[1], a: m.index! }))
    expect(cles.length, 'le tableau de bord a changé de forme').toBeGreaterThan(8)

    // Ce qui ne porte sur aucune entreprise : un barème, et une obligation
    // légale qui ne dépend pas de l'entreprise qui la porte.
    const SANS_OBJET = new Set(['default_price_cents', 'pending_deletions'])

    const nues: string[] = []
    for (let i = 0; i < cles.length; i++) {
      const { nom, a } = cles[i]
      if (SANS_OBJET.has(nom)) continue
      const bloc = corps.slice(a, i + 1 < cles.length ? cles[i + 1].a : corps.length)
      if (!/est_test|est_un_essai/.test(bloc)) nues.push(nom)
    }
    expect(nues, `mesures qui comptent encore les essais : ${nues.join(', ')}`).toEqual([])
  })

  it('la règle se calcule en un seul endroit', () => {
    // Deux fonctions, une par entité, et elles portent l'héritage : un magasin
    // d'une entreprise d'essai est un essai, même si sa propre case est vide.
    const { corps } = derniereDefinition('magasin_est_un_essai')
    expect(corps).toContain('s.est_test or c.est_test')
    expect(derniereDefinition('entreprise_est_un_essai').corps).toContain('c.est_test')
  })

  /**
   * ⚠️ **DEUX FONCTIONS, DEUX FORMES, DONC DEUX GARDES.** Une seule
   * expression pour les deux est restée verte sur un sabotage : en retirant
   * `c.est_test` de la LISTE DES COLONNES de `admin_list_companies_overview`,
   * le `order by c.est_test` resté en place suffisait à la satisfaire — et
   * l'écran n'aurait plus rien reçu. Chacune se vérifie là où elle rend sa
   * valeur.
   */
  it('la liste des entreprises REND le drapeau, pas seulement le déclare', () => {
    const corps = sansCommentaires(derniereDefinition('admin_list_companies_overview').corps)
    const colonnes = corps.slice(corps.indexOf('return query'), corps.indexOf('from public.companies'))
    expect(colonnes, 'le drapeau doit figurer parmi les colonnes rendues').toContain('c.est_test')
    expect(corps, 'la liste ne doit écarter personne').not.toMatch(/not\s+c\.est_test|est_un_essai/)
  })

  it('la fiche d’une entreprise rend le drapeau, et les appareils de ses magasins', () => {
    const corps = sansCommentaires(derniereDefinition('admin_company_detail').corps)
    expect(corps, 'la fiche doit rendre le drapeau de l’entreprise').toContain("'est_test', c.est_test")
    expect(corps, 'et celui de chaque magasin').toContain("'est_test', s.est_test")
    // Sans les appareils, l'écran ne peut ni afficher la licence ni la changer.
    expect(corps, 'et les appareils de chaque magasin').toContain("'devices', s.devices")
    expect(corps, 'la fiche ne doit écarter personne').not.toMatch(/not\s+[cs]\.est_test|est_un_essai/)
  })
})

describe('poser une licence à la main', () => {
  const { corps } = derniereDefinition('admin_poser_licence_magasin')
  const nu = sansCommentaires(corps)

  it('elle est réservée à Quantinvo', () => {
    expect(nu).toContain('is_admin()')
  })

  it('⚠️ elle ne touche AUCUN champ Stripe', () => {
    // Un client qui règle par virement n'a pas d'abonnement. Lui en inventer
    // un ferait mentir `sync_subscription_status` et, pire,
    // `deposer_changement_offre` : il modifierait l'article d'un abonnement
    // qui n'existe pas au lieu d'ouvrir un paiement.
    expect(nu.toLowerCase()).not.toContain('stripe')
  })

  it('elle écrit les appareils, et laisse le prix tranquille s’il n’est pas donné', () => {
    expect(nu).toMatch(/set devices = p_devices/)
    expect(nu).toContain('coalesce(p_annual_price_cents, annual_price_cents)')
  })

  it('elle refuse un nombre d’appareils absurde, mais accepte le vide', () => {
    // Nul = « non déclarée », ce qu'il faut pouvoir reposer après un pilote.
    expect(nu).toMatch(/p_devices is not null and p_devices <= 0/)
  })

  it('elle laisse une trace, avec son motif', () => {
    // Dans six mois, « virement du 12/10 » et « essai Bon Marché » ne se
    // devinent pas d'un nombre d'appareils.
    expect(nu).toContain('log_admin_action')
    expect(nu).toContain("'motif', v_motif")
    expect(nu).toMatch(/appareils_avant/)
    expect(nu).toMatch(/appareils_apres/)
  })
})

describe('les droits des fonctions neuves', () => {
  /**
   * ⚠️ `create or replace` REND `EXECUTE` À `PUBLIC`. Les gardes citent la
   * fonction, jamais sa signature : elle tombe sinon le jour où un paramètre
   * s'ajoute, sur du code juste.
   */
  const OUVERTES_AUX_CONNECTES = [
    'admin_poser_licence_magasin',
    'admin_marquer_entreprise_essai',
    'admin_marquer_magasin_essai',
  ]
  const INTERNES = ['magasin_est_un_essai', 'entreprise_est_un_essai']

  it('aucune n’est ouverte à un visiteur non connecté', () => {
    for (const fn of [...OUVERTES_AUX_CONNECTES, ...INTERNES]) {
      const fichier = fichierDe(fn)
      const revoke = new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`)
      expect(revoke.test(fichier), `${fn} ne referme pas sa porte à anon`).toBe(true)
    }
  })

  it('la règle des essais n’est pas une porte d’API', () => {
    // Personne ne l'appelle depuis un navigateur : les fonctions qui s'en
    // servent sont `security definer` et tournent avec les droits du
    // propriétaire.
    for (const fn of INTERNES) {
      const fichier = fichierDe(fn)
      expect(fichier).toMatch(new RegExp(`revoke all on function public\\.${fn}\\(uuid\\) from public, anon, authenticated`))
      expect(fichier).not.toMatch(new RegExp(`grant execute on function public\\.${fn}\\(uuid\\) to authenticated`))
    }
  })
})

describe('la console pose la licence', () => {
  const page = lire('app/admin/entreprise/[companyId]/page.tsx')
  const nu = codeSeul(page)

  it('⚠️ un magasin créé en console reçoit sa licence', () => {
    // C'est LE défaut que ce chantier ferme. `admin_add_store` accepte
    // `p_devices` depuis toujours ; l'écran ne lui passait que le nom, et tout
    // magasin créé ici naissait plafonné à deux appareils sans que rien ne le
    // dise.
    const appel = nu.slice(nu.indexOf("'admin_add_store'"))
    expect(appel.slice(0, 400)).toContain('p_devices')
  })

  it('les tranches viennent de la grille, jamais écrites à la main', () => {
    // La grille a déjà été revalorisée une fois (31 août 2026). Une liste
    // recopiée ici aurait vieilli en silence.
    expect(nu).toContain('OFFRES.map')
    const bloc = nu.slice(nu.indexOf('const TRANCHES'), nu.indexOf('const TRANCHES') + 200)
    expect(bloc).not.toMatch(/\b(2|20|100)\b/)
  })

  it('l’écran sait marquer, et démarquer', () => {
    expect(nu).toContain('admin_marquer_entreprise_essai')
    expect(nu).toContain('admin_marquer_magasin_essai')
    // La case d'un magasin s'efface quand toute l'entreprise est un essai :
    // la laisser cliquable laisserait croire qu'elle change quelque chose.
    expect(nu).toContain('disabled={detail.company.est_test}')
  })

  it('la licence et le prix restent deux gestes distincts', () => {
    // Une licence posée à la main peut couvrir un tarif négocié qui n'est pas
    // celui de la grille : le prix garde sa propre ligne.
    expect(nu).toContain('admin_poser_licence_magasin')
    expect(nu).toContain('admin_set_store_price')
  })
})

describe('la liste des entreprises montre l’essai', () => {
  const page = codeSeul(lire('app/admin/entreprises/page.tsx'))

  it('la pastille existe', () => {
    expect(page).toContain('est_test')
    expect(page).toMatch(/Essai/)
  })

  it('une entreprise d’essai ne se lit pas comme un client à problème', () => {
    // « Aucun magasin » sur un essai, c'est une anomalie qui n'en est pas une.
    expect(page).toContain('!c.est_test && c.store_count === 0')
  })
})
