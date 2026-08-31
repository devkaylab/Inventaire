// Encadre une capture de `captures/` dans le téléphone dessiné des decks, et
// l'écrit en PNG à fond transparent — pour la poser telle quelle sur une
// diapositive.
//
// Les decks, eux, n'ont pas besoin de ce script : `cadrer()` de `charte.js`
// fait le même travail à la volée, et coupe le bas du téléphone pour qu'il
// déborde de sa carte. Ici on veut le téléphone ENTIER, puisqu'il est le sujet
// de la page et non une illustration posée dans un bloc.
//
//   node encadrer.js lancement            → lancement-encadre.png
//   node encadrer.js lancement mon-titre  → mon-titre.png

const fs = require('fs')
const path = require('path')
const { cadrer } = require('./charte')

async function main() {
  const nom = process.argv[2]
  if (!nom) {
    console.error('usage : node encadrer.js <capture> [nom-de-sortie]')
    process.exit(1)
  }
  const sortie = path.join(__dirname, (process.argv[3] || nom + '-encadre') + '.png')
  // Une place plus haute que large dans les mêmes proportions que le
  // téléphone : `cadrer()` ne coupe alors rien et rend `complet: true`.
  const cadre = await cadrer(nom + '.png', { w: 1, h: 10 })
  if (!cadre.complet) throw new Error('le téléphone a été coupé — augmenter h')
  fs.writeFileSync(sortie, Buffer.from(cadre.data.split(',')[1], 'base64'))
  console.log('OK', path.relative(process.cwd(), sortie))
}

main().catch((e) => { console.error(e.message); process.exit(1) })
