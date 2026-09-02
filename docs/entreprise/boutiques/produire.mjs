/**
 * Produit les deux visuels que Google Play exige et qui n'existent pas dans
 * l'application : le bandeau 1024 × 500 et l'icône 512.
 *
 *   node produire.mjs
 *
 * ⚠️ **Les images sont générées, jamais retouchées à la main** — même règle
 * que les decks. Une retouche serait écrasée à la génération suivante ; le
 * bandeau se modifie dans `bandeau-play.html`.
 *
 * ⚠️ **Le rendu refuse de sortir si Sora n'a pas été résolue.** Une police
 * absente ne lève aucune erreur : le navigateur retombe en silence sur une
 * fonte système, et le bandeau part chez Google en Helvetica. C'est
 * exactement le motif du « succès silencieux » que ce projet a déjà payé
 * cinq fois. On mesure donc la largeur d'un mot témoin dans les deux fontes
 * avant d'écrire le fichier.
 *
 * Chromium vient de Playwright, installé pour les tests du site. `CHROMIUM_PATH`
 * n'est pas facultatif : la configuration principale vise le navigateur d'une
 * image Docker, absent d'un Mac.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const ici = path.dirname(fileURLToPath(import.meta.url))
const racine = path.join(ici, '..', '..', '..')

// ⚠️ Aucun `node_modules` ici, et c'est délibéré : ce dossier n'installe rien.
// Playwright vient des tests du site, sharp de la génération des decks — les
// deux sont déjà là. Un troisième arbre de dépendances serait un troisième à
// tenir à jour, et `npm install` dans un dossier sans manifeste a déjà élagué
// celui du deck une fois (voir `../deck/LISEZMOI.md`).
const depuisSite = createRequire(path.join(racine, 'web', 'package.json'))
const depuisDeck = createRequire(path.join(ici, '..', 'deck', 'package.json'))
const { chromium } = depuisSite('playwright')
const sharp = depuisDeck('sharp')

const BANDEAU = { l: 1024, h: 500 }
const OG = { l: 1200, h: 630 }
const ICONE = 512

/**
 * Rend un fichier HTML de taille fixe en PNG, en vérifiant que Sora a bien été
 * résolue. Le contrôle est la partie qui compte : une police absente ne lève
 * aucune erreur, le navigateur retombe en silence sur une fonte système.
 */
async function rendre({ fichier, sortie, l, h, quoi }) {
  const exe = process.env.CHROMIUM_PATH
  if (exe && !existsSync(exe)) throw new Error(`CHROMIUM_PATH introuvable : ${exe}`)
  const navigateur = await chromium.launch({ executablePath: exe })
  const page = await navigateur.newPage({
    viewport: { width: l, height: h },
    deviceScaleFactor: 1,
  })
  await page.goto('file://' + path.join(ici, fichier))
  await page.waitForTimeout(1200)

  // Le contrôle de fonte : Sora est très différente d'une grotesque système,
  // le même mot n'y fait pas la même largeur.
  const { avecSora, sansSora } = await page.evaluate(() => {
    const mesure = (famille) => {
      const s = document.createElement('span')
      s.textContent = 'Quantinvo'
      s.style.cssText = `position:absolute;visibility:hidden;font-size:64px;font-weight:800;font-family:${famille}`
      document.body.appendChild(s)
      const l = s.getBoundingClientRect().width
      s.remove()
      return l
    }
    return { avecSora: mesure('Sora, sans-serif'), sansSora: mesure('sans-serif') }
  })
  if (Math.abs(avecSora - sansSora) < 1) {
    await navigateur.close()
    throw new Error(
      'Sora n’a pas été chargée : le bandeau sortirait dans une fonte système. ' +
      'Installer Sora sur le poste, ou rendre la machine capable d’atteindre fonts.googleapis.com.',
    )
  }

  await page.screenshot({ path: sortie, clip: { x: 0, y: 0, width: l, height: h } })
  await navigateur.close()

  const m = await sharp(sortie).metadata()
  if (m.width !== l || m.height !== h) {
    throw new Error(`${quoi} à ${m.width}×${m.height}, attendu ${l}×${h}`)
  }
  console.log(`OK ${quoi} (${m.width}×${m.height}) → ${path.relative(racine, sortie)}`)
}

async function icone() {
  // ⚠️ Google accepte la transparence sur l'icône, Apple non — mais on part de
  // la même source opaque que le binaire pour que les deux boutiques montrent
  // exactement la même icône que le téléphone.
  const source = path.join(racine, 'assets', 'images', 'icon.png')
  const sortie = path.join(ici, 'icone-512.png')
  await sharp(source).resize(ICONE, ICONE).png({ compressionLevel: 9 }).toFile(sortie)
  const m = await sharp(sortie).metadata()
  console.log(`OK icone-512.png (${m.width}×${m.height}, alpha ${m.hasAlpha ? 'oui' : 'non'})`)
}

await rendre({
  fichier: 'bandeau-play.html',
  sortie: path.join(ici, 'bandeau-play-1024x500.png'),
  l: BANDEAU.l, h: BANDEAU.h, quoi: 'bandeau Play',
})

// ⚠️ L'image de partage sort dans `web/public/`, pas ici : c'est le site qui
// la sert, et une copie dans deux dossiers finirait par diverger. C'est le
// seul fichier que ce script écrit hors de son dossier.
await rendre({
  fichier: 'og.html',
  sortie: path.join(racine, 'web', 'public', 'og.png'),
  l: OG.l, h: OG.h, quoi: 'image de partage',
})

await icone()
