import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { dossierMigrations } from './migrations'

/**
 * La discipline des migrations (6 septembre 2026).
 *
 * Neuf objets ont vécu des mois en base sans aucune migration — trois tables et
 * six fonctions, créés à la main par la console aux tout premiers jours. Ils ne
 * cassaient rien : ils étaient simplement **invisibles au dépôt**. Ce qui coûte,
 * c'est que `derniereDefinition()` ne trouvait rien pour eux : une garde posée
 * sur `request_account_deletion` n'aurait rien gardé, et personne ne l'aurait
 * su. C'est la famille des gardes périmées qui revient tout au long de ce
 * projet, par une porte de plus.
 *
 * ⚠️ CES GARDES DÉDUISENT LEUR LISTE, ELLES NE LA CITENT PAS. Une garde qui
 * nommerait les neuf objets d'aujourd'hui ne protégerait que ceux-là — et le
 * dixième passerait en silence, exactement comme les neuf premiers. Chacune
 * part donc d'une trace que le dépôt porte déjà : une RPC appelée par le
 * produit, des droits réglés sur une fonction, une table qu'on altère.
 *
 * ⚠️ ET ELLES NE VOIENT QUE LE DOSSIER. Un test hors ligne ne sait pas ce que
 * la production porte : un objet créé à la main ET jamais touché par une
 * migration ni appelé par le produit resterait invisible ici. C'est
 * `scripts/mesurer-migrations.mjs` qui interroge la base et tranche — il est
 * gardé plus bas, et il se relance en une commande.
 */

const racine = path.resolve(__dirname, '../..')
const fichiers = readdirSync(dossierMigrations).filter((f) => f.endsWith('.sql')).sort()
const migrations = fichiers.map((f) => readFileSync(path.join(dossierMigrations, f), 'utf8'))

/** Le SQL sans ses commentaires : ils citent forcément ce qu'ils décrivent. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

const sqlNu = migrations.map(code)

const definitFonction = (nom: string) =>
  sqlNu.some((t) => new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${nom}\\s*\\(`, 'i').test(t))

const definitTable = (nom: string) =>
  sqlNu.some((t) => new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${nom}\\b`, 'i').test(t))

/** Tous les noms capturés par `motif` dans les migrations. */
const dansMigrations = (motif: RegExp) => {
  const out = new Set<string>()
  for (const t of sqlNu) for (const m of t.matchAll(motif)) out.add(m[1].toLowerCase())
  return [...out].sort()
}

/** Tous les fichiers de code du produit — le site, l'application, les fonctions edge. */
const fichiersProduit = (() => {
  const out: string[] = []
  const marcher = (dir: string) => {
    if (!existsSync(dir)) return
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.next') continue
        marcher(p)
      } else if (/\.(ts|tsx)$/.test(e.name) && statSync(p).size < 2_000_000) {
        out.push(readFileSync(p, 'utf8'))
      }
    }
  }
  for (const d of ['web/app', 'web/lib', 'web/components', 'src', 'supabase/functions']) {
    marcher(path.join(racine, d))
  }
  return out
})()

describe('toute RPC appelée par le produit est écrite dans une migration', () => {
  it('⚠️ c’est cette règle qui aurait vu request_account_deletion', () => {
    // Elle était appelée par « Supprimer mon compte » depuis des mois, et elle
    // n'existait dans aucun fichier du dépôt. Une garde sur elle — sur ce
    // qu'elle fige avant la suppression, par exemple — aurait cherché dans le
    // vide sans que rien ne le signale.
    const appelees = new Set<string>()
    for (const src of fichiersProduit) {
      for (const m of src.matchAll(/\.rpc\(\s*'([a-z0-9_]+)'/g)) appelees.add(m[1])
    }
    expect(appelees.size, 'la détection des appels RPC est cassée').toBeGreaterThan(100)

    const sansMigration = [...appelees].filter((f) => !definitFonction(f)).sort()
    expect(sansMigration, 'ces fonctions tournent en base sans être écrites nulle part').toEqual([])
  })
})

describe('toute fonction dont une migration règle les droits y est aussi définie', () => {
  it('⚠️ un revoke sur une fonction qu’aucun fichier ne définit est un objet fantôme', () => {
    // `20260812000004_revoke_anon_session_rpcs.sql` retirait `anon` de cinq
    // fonctions de balise que le dépôt ne décrivait pas : le fichier prouvait
    // leur existence sans jamais dire ce qu'elles font.
    const reglees = dansMigrations(/(?:revoke|grant)[a-z ,]*\s+on\s+function\s+public\.([a-z0-9_]+)\s*\(/gi)
    expect(reglees.length, 'la détection des droits de fonction est cassée').toBeGreaterThan(150)

    const sansDefinition = reglees.filter((f) => !definitFonction(f))
    expect(sansDefinition, 'ces fonctions ont des droits écrits, pas de définition').toEqual([])
  })
})

describe('toute table qu’une migration touche y est aussi créée', () => {
  it('⚠️ c’est cette règle qui aurait vu stores et zones', () => {
    // Les deux tables les plus centrales du produit — la licence se facture par
    // magasin, l'inventaire se compte par balise — étaient altérées par une
    // vingtaine de migrations qui supposaient toutes leur existence.
    const alterees = dansMigrations(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?public\.([a-z0-9_]+)/gi)
    const aPolicy = dansMigrations(/create\s+policy\s+"?[a-z0-9_]+"?\s+on\s+public\.([a-z0-9_]+)/gi)
    const touchees = [...new Set([...alterees, ...aPolicy])].sort()
    expect(touchees.length, 'la détection des tables touchées est cassée').toBeGreaterThan(25)

    const sansCreation = touchees.filter((t) => !definitTable(t))
    expect(sansCreation, 'ces tables sont modifiées par le dossier mais créées nulle part').toEqual([])
  })
})

describe('et la mesure qui interroge la base reste à portée d’une commande', () => {
  it('⚠️ le versant que ces gardes ne voient pas', () => {
    // Un objet créé à la main, jamais altéré et jamais appelé depuis le code
    // n'apparaît dans aucune des trois règles ci-dessus. Seule la base peut le
    // dire — d'où le script, qui sort en erreur au premier orphelin.
    const script = path.join(racine, 'scripts', 'mesurer-migrations.mjs')
    expect(existsSync(script), 'la mesure de dérive a disparu').toBe(true)
    const s = readFileSync(script, 'utf8')
    expect(s).toContain('pg_get_functiondef')
    expect(s).toMatch(/process\.exit\(total === 0 \? 0 : 1\)/)

    // ⚠️ ET LES TROIS VOLETS, PAS DEUX. La mesure du 5 septembre comparait les
    // fonctions et les tables ; elle ne voyait pas les COLONNES, et cinq
    // manquaient — dont `profiles.is_admin`, le drapeau qui garde les dix-huit
    // RPC d'administration. Une garde de l'archivage en a fait les frais le
    // lendemain : elle déduisait sa liste d'un dossier troué, et le sabotage
    // est passé.
    for (const volet of ['fonctions', 'tables', 'colonnes']) {
      expect(s, `la mesure ne couvre plus les ${volet}`).toContain(`'${volet}',`)
    }
    expect(s, 'les colonnes ne sont plus comparées').toMatch(/orphelinesColonne/)
  })
})

describe('le rattrapage n’a rien changé, et ne doit rien changer', () => {
  const rattrapage = fichiers.filter((f) => f.includes('socle_des_premiers_jours'))

  it('⚠️ chaque table y est sous une garde d’absence', () => {
    // C'est ce qui rend l'application inoffensive sur la production : le bloc
    // ne s'exécute que si la table n'existe pas. Sans cette garde, les `grant`
    // qu'il porte RÉ-OUVRIRAIENT `stores` en écriture à `authenticated` — le
    // trou que VR-009 a fermé le 28 août 2026.
    expect(rattrapage.length, 'la migration de rattrapage a disparu').toBe(1)
    const t = readFileSync(path.join(dossierMigrations, rattrapage[0]), 'utf8')
    for (const table of ['zones', 'stores', 'account_deletion_requests']) {
      expect(code(t), `${table} n’est pas sous garde d’absence`)
        .toContain(`if to_regclass('public.${table}') is null then`)
    }
    expect(code(t).match(/if to_regclass/g)?.length).toBe(3)
  })

  it('⚠️ et chaque fonction y repose ses droits', () => {
    // `create or replace` rend EXECUTE à PUBLIC : la leçon de `20260819172706`,
    // et le constat n°6 du 28 août. Aucune de ces six n'est publique.
    const t = code(readFileSync(path.join(dossierMigrations, rattrapage[0]), 'utf8'))
    const definies = [...t.matchAll(/create or replace function public\.([a-z0-9_]+)\(/g)].map((m) => m[1])
    expect(definies.length).toBe(6)
    for (const f of definies) {
      expect(t, `${f} ne repose pas ses droits`)
        .toMatch(new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon;`))
      expect(t, `${f} n’est pas rendue à authenticated`)
        .toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to authenticated, service_role;`))
    }
  })
})
