// Encadre les captures de `captures/` dans le téléphone dessiné des decks, et
// les écrit en PNG à fond transparent — prêtes à poser telles quelles sur une
// diapositive, dans un document, un e-mail ou une page.
//
//   node encadrer.js                      → encadrees/, toutes les captures
//   node encadrer.js lancement            → lancement-encadre.png (à la racine)
//   node encadrer.js lancement mon-titre  → mon-titre.png
//
// Les decks n'en ont pas besoin : `cadrer()` de `charte.js` fait le même
// travail à la volée, et coupe le bas du téléphone pour qu'il déborde de sa
// carte. Ici on veut le téléphone ENTIER — il est l'objet, pas une
// illustration posée dans un bloc.
//
// ⚠️ LA GÉOMÉTRIE DU TÉLÉPHONE N'EST PAS RECOPIÉE ICI. Bezel, rayon, filet :
// tout vient de `cadrer()`. Deux dessins du même téléphone divergeraient au
// premier ajustement, et les captures livrées au client ne ressembleraient
// plus à celles des présentations.
//
// ⚠️ La résolution de sortie est celle de l'entrée, jamais plus : `captures/`
// est en demi-résolution (603 px de large, voir `preparer-captures.js`), donc
// les téléphones sortent à ~637 px. Agrandir ici n'inventerait que des pixels.
// Pour une version pleine résolution, il faut encadrer les captures BRUTES du
// simulateur, avant leur passage par `preparer-captures.js`.

const fs = require('fs')
const path = require('path')
const { cadrer } = require('./charte')

const CAPTURES = path.join(__dirname, 'captures')
const ENCADREES = path.join(__dirname, 'encadrees')

/** Le téléphone entier : une place bien plus haute que large ne coupe rien. */
async function encadrer(nomFichier) {
  const cadre = await cadrer(nomFichier, { w: 1, h: 10 })
  if (!cadre.complet) throw new Error(`${nomFichier} : le téléphone a été coupé`)
  return Buffer.from(cadre.data.split(',')[1], 'base64')
}

async function toutes() {
  fs.mkdirSync(ENCADREES, { recursive: true })
  const fichiers = fs.readdirSync(CAPTURES).filter((f) => f.endsWith('.png')).sort()
  if (!fichiers.length) throw new Error('aucune capture dans captures/')
  for (const f of fichiers) {
    fs.writeFileSync(path.join(ENCADREES, f), await encadrer(f))
  }
  console.log(`OK ${fichiers.length} captures encadrées dans encadrees/`)
}

async function une(nom, sortie) {
  const cible = path.join(__dirname, (sortie || nom + '-encadre') + '.png')
  fs.writeFileSync(cible, await encadrer(nom + '.png'))
  console.log('OK', path.relative(process.cwd(), cible))
}

module.exports = { toutes, encadrer }

// Lancé directement, pas requis par `preparer-captures.js`.
if (require.main === module) {
  const nom = process.argv[2]
  const p = nom ? une(nom, process.argv[3]) : toutes()
  p.catch((e) => { console.error(e.message); process.exit(1) })
}
