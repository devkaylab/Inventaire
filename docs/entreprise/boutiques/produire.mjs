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
 * ⚠️ **Le rendu refuse de sortir si une police n'a pas été résolue.** Une
 * police absente ne lève aucune erreur : le navigateur retombe en silence sur
 * une fonte système, et le visuel part chez Google en Helvetica. C'est
 * exactement le motif du « succès silencieux » que ce projet a déjà payé
 * cinq fois. On interroge donc `document.fonts` avant d'écrire le fichier —
 * Archivo et Public Sans, les deux polices d'Ardoise.
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

  /**
   * Le contrôle de fonte : une police absente ne lève aucune erreur, le
   * navigateur retombe en silence sur une fonte système, et le visuel part
   * chez Google en Helvetica.
   *
   * ⚠️ **ON COMPARE DEUX SECOURS ENTRE EUX, PAS LA POLICE À UN SECOURS**, et
   * les deux versions précédentes se sont trompées là-dessus :
   *
   *   · **la mesure d'origine** comparait « Quantinvo » en `Sora, sans-serif`
   *     à `sans-serif`, et concluait à l'écart. Ça tenait parce que Sora est
   *     très dessinée — mais Archivo est un grotesque, donc proche
   *     d'Helvetica : le même test se serait mis à refuser des images
   *     parfaitement bonnes le jour où les deux largeurs se seraient
   *     rejointes ;
   *   · **`document.fonts.check()`, essayé le 13 septembre 2026, NE MORD
   *     PAS.** Il répond `true` pour une famille qui n'existe nulle part —
   *     mesuré par sonde directe : `check('700 64px FamilleQuiNexistePas')`
   *     rend `true`. Il dit « rien ne bloque le rendu », pas « la police
   *     demandée sera utilisée ». Ne pas y revenir.
   *
   * ⚠️ **ET LE SABOTAGE ÉVIDENT N'EN EST PAS UN SUR CE MAC : Archivo et
   * Public Sans y sont INSTALLÉES** (`~/Library/Fonts`). Couper le lien Google
   * Fonts ne prouve donc rien ici — le navigateur les résout depuis le
   * système, le visuel sort juste, et la garde a raison de se taire. C'est ce
   * qui a fait croire deux fois de suite, le 13 septembre, que la garde était
   * cassée. Pour l'éprouver, saboter le NOM qu'elle cherche, juste dessous —
   * une police réellement introuvable. Les deux sabotages lèvent.
   *
   * La forme qui tient ne dépend ni du dessin de la police, ni de ce que le
   * navigateur déclare : on rend le même texte avec deux familles de secours
   * que tout système dessine différemment. Si la police demandée est résolue,
   * elle gagne dans les deux cas et les largeurs sont IDENTIQUES ; sinon,
   * chaque secours s'applique et elles diffèrent.
   *
   * ⚠️ **Et il en vérifie DEUX, là où l'original n'en vérifiait qu'une.** Le
   * sous-titre est en Public Sans : il serait tombé en fonte système sans que
   * rien ne le dise — exactement le défaut que ce contrôle existe pour fermer.
   */
  const manquantes = await page.evaluate(async () => {
    await document.fonts.ready
    const largeur = (familles) => {
      const s = document.createElement('span')
      s.textContent = 'Quantinvo — fiabilité du stock 0123456789'
      s.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-size:96px;font-weight:700;font-family:${familles}`
      document.body.appendChild(s)
      const l = s.getBoundingClientRect().width
      s.remove()
      return l
    }
    return [['Archivo', 'Archivo'], ['Public Sans', '"Public Sans"']]
      .filter(([, css]) => Math.abs(largeur(`${css}, monospace`) - largeur(`${css}, serif`)) > 0.5)
      .map(([nom]) => nom)
  })
  if (manquantes.length) {
    await navigateur.close()
    throw new Error(
      `${manquantes.join(' et ')} n’a pas été résolue : l’image sortirait dans ` +
      'une fonte système. Installer la police sur le poste, ou rendre la ' +
      'machine capable d’atteindre fonts.googleapis.com.',
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
