/**
 * Installe SheetJS depuis l'archive déposée dans vendor/, et branche les deux
 * paquets dessus. (Constat C2 de l'audit du 13 août 2026.)
 *
 * npm ne distribue plus que `xlsx@0.18.5`, figée en 2022 et porteuse de deux
 * failles de la partie **lecture** — pollution de prototype (CVE-2023-30533,
 * corrigée en 0.19.3) et ReDoS (CVE-2024-22363, corrigée en 0.20.2). SheetJS a
 * quitté npm : `npm audit` répond « No fix available », et les versions
 * corrigées ne sont publiées que sur cdn.sheetjs.com.
 *
 * L'archive est donc versionnée dans le dépôt et installée en `file:` : plus
 * aucun téléchargement au moment du build, ni sur Vercel ni sur EAS, et plus de
 * republieur tiers dans la chaîne d'approvisionnement.
 *
 *   1. Télécharger l'archive sur https://cdn.sheetjs.com/ (version ≥ 0.20.2)
 *   2. La déposer telle quelle dans vendor/ — sans la renommer ni l'ouvrir
 *   3. node scripts/installer-sheetjs.mjs
 *
 * Le CDN sert aussi l'alias `xlsx-latest.tgz` : le script le renomme d'après la
 * version qu'il trouve à l'intérieur, pour que la dépendance reste figée sur un
 * numéro et non sur un nom qui changera de sens à la prochaine publication.
 *
 * Idempotent : le relancer ne fait que revérifier.
 */
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR = join(RACINE, 'vendor')

// 0.19.3 corrige la pollution de prototype, 0.20.2 le ReDoS : il faut les deux.
const MINIMALE = [0, 20, 2]

// Les deux paquets du dépôt, avec le chemin de l'archive vu depuis chacun.
const PAQUETS = [
  { nom: 'application', dossier: RACINE, prefixe: 'vendor/' },
  { nom: 'site', dossier: join(RACINE, 'web'), prefixe: '../vendor/' },
]

const echec = (...m) => { console.error('\n✗', ...m); process.exit(1) }

function versionEnNombres(v) {
  return v.split('.').map(Number)
}

function auMoins(version, minimale) {
  const a = versionEnNombres(version)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== minimale[i]) return (a[i] ?? 0) > minimale[i]
  }
  return true
}

// ─── 1. Trouver l'archive ────────────────────────────────────────────────────
if (!existsSync(VENDOR)) echec(`Dossier introuvable : ${VENDOR}`)

const NOM_ARCHIVE = /^xlsx-(\d+\.\d+\.\d+|latest)\.tgz$/
const archives = readdirSync(VENDOR).filter(f => NOM_ARCHIVE.test(f))

if (archives.length === 0) {
  echec(
    'Aucune archive dans vendor/.\n\n' +
    "  1. Ouvrir https://cdn.sheetjs.com/ et télécharger la dernière archive\n" +
    "     nommée xlsx-<version>.tgz (version ≥ 0.20.2)\n" +
    '  2. La déposer dans vendor/ sans la renommer\n' +
    '  3. Relancer : node scripts/installer-sheetjs.mjs\n\n' +
    "  Détail du pourquoi : vendor/LISEZMOI.md",
  )
}
if (archives.length > 1) {
  echec(`Plusieurs archives dans vendor/ : ${archives.join(', ')}.\n  N'en garder qu'une.`)
}

let archive = archives[0]
let chemin = join(VENDOR, archive)
const nomme = archive.match(NOM_ARCHIVE)[1]        // « latest » ou un numéro
const alias = nomme === 'latest'

console.log(`\nArchive   : vendor/${archive}`)
console.log(`SHA-256   : ${createHash('sha256').update(readFileSync(chemin)).digest('hex')}`)

// ─── 2. Le manifeste interne fait foi ────────────────────────────────────────
// Le nom du fichier ne prouve rien, et vaut « latest » sur l'archive que sert
// le CDN : c'est le manifeste qui donne la version.
let version = alias ? null : nomme
try {
  const manifeste = JSON.parse(
    execSync(`tar -xzOf "${chemin}" package/package.json`, { encoding: 'utf8' }),
  )
  if (manifeste.name !== 'xlsx') echec(`L'archive contient « ${manifeste.name} », pas « xlsx ».`)
  if (!alias && manifeste.version !== version) {
    echec(`L'archive dit ${manifeste.version} alors que son nom annonce ${version}.`)
  }
  version = manifeste.version
  console.log(`Contenu   : ${manifeste.name}@${version} ✓`)

  // Figer le nom sur la version : « latest » cessera d'être vrai un jour.
  if (alias) {
    const renomme = `xlsx-${version}.tgz`
    renameSync(chemin, join(VENDOR, renomme))
    archive = renomme
    chemin = join(VENDOR, renomme)
    console.log(`Renommée  : vendor/${renomme}`)
  }
} catch (e) {
  // `tar` absent du poste : on laisse passer, l'installation vérifiera ensuite
  // ce qui a réellement atterri dans node_modules. Tout autre échec veut dire
  // que l'archive est illisible — ne pas l'installer.
  const tarAbsent = e?.status === 127 || e?.code === 'ENOENT'
  if (!tarAbsent) {
    echec(
      `Archive illisible : ${archive}\n` +
      "  Le téléchargement a probablement échoué (une page d'erreur enregistrée\n" +
      '  sous le nom du fichier, par exemple). La retélécharger depuis\n' +
      '  https://cdn.sheetjs.com/ puis relancer.',
    )
  }
  if (alias) {
    echec(
      `Impossible de lire la version de ${archive} sans « tar ».\n` +
      '  Renommer l\'archive en xlsx-<version>.tgz — le numéro figure sur la page\n' +
      '  de téléchargement — puis relancer.',
    )
  }
  console.log("Contenu   : non vérifié (tar indisponible) — contrôle reporté après l'installation")
}

// ─── 3. La version doit corriger les deux failles ────────────────────────────
if (!auMoins(version, MINIMALE)) {
  echec(
    `Version ${version} trop ancienne — il faut au moins ${MINIMALE.join('.')}.\n` +
    '  En deçà, les deux failles de la partie lecture sont toujours présentes.',
  )
}

// ─── 4. Brancher les deux package.json ───────────────────────────────────────
for (const { nom, dossier, prefixe } of PAQUETS) {
  const fichier = join(dossier, 'package.json')
  const avant = readFileSync(fichier, 'utf8')
  const attendu = `file:${prefixe}${archive}`

  if (!/"xlsx"\s*:\s*"[^"]*"/.test(avant)) echec(`Aucune dépendance « xlsx » dans ${fichier}`)

  const apres = avant.replace(/("xlsx"\s*:\s*)"[^"]*"/, `$1"${attendu}"`)
  if (apres !== avant) {
    writeFileSync(fichier, apres)
    console.log(`\n${nom} : package.json → ${attendu}`)
  } else {
    console.log(`\n${nom} : déjà branché sur ${attendu}`)
  }
}

// ─── 5. Installer, puis vérifier ce qui a réellement atterri ─────────────────
for (const { nom, dossier } of PAQUETS) {
  console.log(`\n─── npm install (${nom}) ───`)
  execSync('npm install', { cwd: dossier, stdio: 'inherit' })
}

console.log('\n─── Vérification ───')
let bon = true
for (const { nom, dossier } of PAQUETS) {
  const manifeste = join(dossier, 'node_modules', 'xlsx', 'package.json')
  if (!existsSync(manifeste)) { console.log(`${nom} : xlsx absent de node_modules ✗`); bon = false; continue }
  const installee = JSON.parse(readFileSync(manifeste, 'utf8')).version
  const ok = auMoins(installee, MINIMALE)
  console.log(`${nom} : xlsx@${installee} ${ok ? '✓' : '✗'}`)
  if (!ok) bon = false
}

if (!bon) echec('Installation incomplète — voir ci-dessus.')

console.log(
  '\n✓ SheetJS installé depuis le dépôt.\n' +
  '  Penser à versionner : vendor/' + archive + ', les deux package.json et les deux package-lock.json.\n',
)
