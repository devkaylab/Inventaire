#!/usr/bin/env node
/**
 * La dérive entre le dossier de migrations et la base réelle, mesurée.
 *
 *   node scripts/mesurer-migrations.mjs
 *
 * Elle répond à deux questions, et elle sort en erreur si l'une des deux
 * répond mal :
 *
 *   1. **Un objet de la base n'est-il décrit nulle part ?** C'est le défaut qui
 *      a duré des mois : neuf objets créés à la main par la console, invisibles
 *      au dépôt — donc invisibles aux gardes. `derniereDefinition()` ne trouvait
 *      rien pour eux, et une garde posée dessus n'aurait rien gardé.
 *   2. **Ce que le dossier écrit correspond-il à ce qui tourne ?** Un
 *      `create or replace` ne compare rien, il remplace : une fonction réécrite
 *      en direct diverge de son fichier sans un mot.
 *
 * ⚠️ ELLE INTERROGE LA BASE, ELLE NE DEVINE RIEN. Un test hors ligne ne peut
 * pas savoir ce que la production porte ; c'est pour ça que cette mesure est un
 * script et pas une garde vitest. La garde vitest, elle, tient le versant
 * dossier (`web/tests/discipline-migrations.test.ts`) et tourne à chaque suite.
 *
 * ⚠️ UN CHIFFRE DE DÉRIVE INVRAISEMBLABLE EST D'ABORD UN DÉFAUT DE MESURE.
 * La première version annonçait 83 fonctions divergentes : elle n'ancrait le
 * corps que sur `\nas $$` et `\nAS $function$`, et ratait la moitié des
 * fichiers qui écrivent `as $function$` en minuscules. Avant de conclure à une
 * dérive massive, relire l'extracteur.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dossier = path.join(racine, 'supabase', 'migrations')

const REQUETE = `
select json_build_object(
  'fonctions', (
    select json_agg(json_build_object('nom', p.proname,
      'args', pg_get_function_identity_arguments(p.oid), 'def', pg_get_functiondef(p.oid))
      order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  ),
  'tables', (
    select json_agg(c.relname order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'colonnes', (
    select json_agg(json_build_object('table', table_name, 'colonne', column_name)
      order by table_name, ordinal_position)
    from information_schema.columns where table_schema = 'public'
  )
) as etat;
`

/**
 * Le SQL sans ses commentaires.
 *
 * ⚠️ JUSQU'À LA FIN DE LA LIGNE, PAS SEULEMENT LES LIGNES ENTIÈRES. Un
 * `end if;      -- rien à compter` posé DANS le corps d'une fonction ne se
 * retrouve pas dans `pg_get_functiondef`… si, justement : Postgres garde le
 * corps verbatim. Ce qui diverge, c'est que le fichier du dépôt et la base ont
 * été écrits à deux moments. Le nettoyage doit donc retirer la queue de ligne,
 * sinon `rate_limit_ok` ressort « divergente » alors qu'elle est identique mot
 * pour mot. Un `--` dans une chaîne littérale serait mal coupé ; il n'y en a
 * pas dans ce dépôt, et une mesure n'est pas un compilateur.
 */
const sansCommentaires = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')

const normaliser = (s) => sansCommentaires(s).replace(/\s+/g, ' ').trim().toLowerCase()

/** Le corps d'une définition, à partir du `as $tag$` qui l'ouvre. */
function corps(texte, depart) {
  const apres = texte.slice(depart)
  const ouvre = /\bas\s+(\$[A-Za-z_]*\$)/i.exec(apres)
  if (!ouvre) return null
  const debut = ouvre.index + ouvre[0].length
  const fin = apres.indexOf(ouvre[1], debut)
  return fin === -1 ? null : apres.slice(debut, fin)
}

const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()
const textes = fichiers.map((f) => [f, readFileSync(path.join(dossier, f), 'utf8')])

/**
 * Toutes les définitions de `nom` écrites dans le dossier, la plus récente
 * d'abord.
 *
 * ⚠️ TOUTES, PAS SEULEMENT LA DERNIÈRE — À CAUSE DES SURCHARGES. Deux fonctions
 * peuvent porter le même nom avec des signatures différentes :
 * `ca_request_store` en a deux depuis le 2 septembre 2026 (l'ancienne, devenue
 * un refus lisible le temps du déploiement, et la nouvelle). Comparer les deux
 * corps de la base à la seule dernière définition en déclare forcément une
 * divergente, alors que les deux sont écrites. Un corps est en règle s'il est
 * écrit QUELQUE PART dans le dossier.
 */
function definitions(nom) {
  const out = []
  for (let i = textes.length - 1; i >= 0; i--) {
    const [fichier, texte] = textes[i]
    const marqueur = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?${nom}\\s*\\(`, 'gi')
    for (const t of texte.matchAll(marqueur)) out.push({ fichier, corps: corps(texte, t.index) })
  }
  return out
}

function definitTable(nom) {
  const marqueur = new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${nom}\\b`, 'i')
  return textes.some(([, texte]) => marqueur.test(texte))
}

/**
 * Tout ce qu'une migration écrit AU SUJET d'une table : sa création, et chaque
 * `alter table` qui la vise.
 *
 * ⚠️ POURQUOI CE VOLET EXISTE. Le 6 septembre 2026, une garde de l'archivage
 * déduisait la liste des « tables d'inventaire » en cherchant les clés
 * étrangères du dossier — et le sabotage `delete from public.articles` est
 * passé : `articles.session_id` n'était décrite nulle part. Une garde qui
 * déduit d'une source trouée déduit mal, et ne le dit jamais. Cette mesure
 * ferme la classe entière : cinq colonnes manquaient sur 282.
 */
const blocsParTable = (() => {
  const out = new Map()
  const ajoute = (t, bloc) => {
    const k = t.toLowerCase()
    out.set(k, (out.get(k) ?? '') + '\n' + bloc)
  }
  for (const [, texte] of textes) {
    const nu = sansCommentaires(texte)
    for (const m of nu.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)([\s\S]*?);/gi)) {
      ajoute(m[1], m[2])
    }
    for (const m of nu.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?public\.([a-z0-9_]+)([\s\S]*?);/gi)) {
      ajoute(m[1], m[2])
    }
  }
  return out
})()

/**
 * ⚠️ UNE APPROXIMATION, ET ELLE EST ASSUMÉE. On cherche le NOM de la colonne
 * dans ce que le dossier écrit au sujet de sa table. Une colonne renommée, ou
 * dont le nom apparaît par coïncidence dans un `alter table` voisin, serait mal
 * jugée. C'est une mesure, pas un compilateur : elle sert à repérer ce qui n'a
 * jamais été écrit, et cinq colonnes sur 282 est un résultat qu'on peut
 * vérifier à la main.
 */
function definitColonne(table, colonne) {
  const corpus = blocsParTable.get(table.toLowerCase())
  if (!corpus) return false
  return new RegExp(`\\b${colonne}\\b`, 'i').test(corpus)
}

// ---- la base
const tmp = mkdtempSync(path.join(tmpdir(), 'mesure-migrations-'))
const sql = path.join(tmp, 'etat.sql')
writeFileSync(sql, REQUETE)
const brut = execFileSync('supabase',
  ['db', 'query', '--file', sql, '--linked', '--output-format', 'json'],
  { cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const etat = JSON.parse(brut).rows[0].etat

// ---- la comparaison
const orphelinesFn = []
const divergentes = []
for (const f of etat.fonctions) {
  const ecrites = definitions(f.nom)
  if (ecrites.length === 0) { orphelinesFn.push(f.nom); continue }
  const enBase = corps(f.def, 0)
  if (enBase === null) continue
  const attendu = normaliser(enBase)
  if (!ecrites.some((d) => d.corps !== null && normaliser(d.corps) === attendu)) {
    divergentes.push(`${f.nom}(${f.args})  — écrite dans ${ecrites[0].fichier}, mais pas ainsi`)
  }
}
const orphelinesTable = etat.tables.filter((t) => !definitTable(t))
const orphelinesColonne = etat.colonnes
  .filter((c) => !definitColonne(c.table, c.colonne))
  .map((c) => `${c.table}.${c.colonne}`)

const ligne = (t, n, l) => {
  console.log(`${t.padEnd(12)} ${String(n).padStart(4)} en base, ${String(l.length).padStart(3)} sans migration`)
  for (const x of l) console.log(`               · ${x}`)
}
console.log(`Dossier : ${fichiers.length} migrations`)
ligne('Fonctions', etat.fonctions.length, orphelinesFn)
ligne('Tables', etat.tables.length, orphelinesTable)
ligne('Colonnes', etat.colonnes.length, orphelinesColonne)
console.log(`Corps divergents : ${divergentes.length}`)
for (const x of divergentes) console.log(`               · ${x}`)

const total = orphelinesFn.length + orphelinesTable.length + orphelinesColonne.length + divergentes.length
console.log(total === 0
  ? '\nLe dossier décrit la base.'
  : `\n${total} écart(s) : écrire la migration qui manque, ou remettre le fichier d'accord avec la base.`)
process.exit(total === 0 ? 0 : 1)
