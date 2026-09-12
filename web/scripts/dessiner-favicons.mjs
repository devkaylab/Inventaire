// Rasterise le favicon du site — l'ICO que Safari et les robots réclament, et
// l'icône d'écran d'accueil d'iOS.
//
//   node scripts/dessiner-favicons.mjs        (depuis web/)
//
// ⚠️ LA MARQUE N'EST PAS REDESSINÉE ICI. Tout part de `public/favicon.svg`,
// qui reste la seule définition côté site : un second dessin divergerait au
// premier ajustement, et c'est exactement ce que le projet a déjà payé avec
// les trois copies de la géométrie (Logo.tsx, AppLogo.tsx, generate-icons).
//
// ⚠️ ET ON NE REND PAS DIRECTEMENT EN 16 px. Les allées de la marque font un
// douzième de sa largeur : à 16 px, 1,3 pixel. Rendu à cette taille, le trait
// tombe entre deux pixels et disparaît. On rend donc en 256 puis on réduit
// avec un filtre de Lanczos, qui garde une trace grise là où le trait est plus
// fin qu'un pixel.
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(racine, 'public/favicon.svg'))

/** Le rendu de référence : assez grand pour que la réduction ait de la matière. */
const source = () => sharp(svg, { density: 1200 }).resize(256, 256)

/**
 * Un ICO est un en-tête de 6 octets, puis une entrée de 16 octets par taille,
 * puis les images elles-mêmes. Depuis Windows Vista, une entrée peut être un
 * PNG tel quel — c'est ce que lisent tous les navigateurs d'aujourd'hui, et ça
 * évite d'encoder du BMP à l'envers.
 */
function ico(images) {
  const entetes = Buffer.alloc(6 + images.length * 16)
  entetes.writeUInt16LE(0, 0)               // réservé
  entetes.writeUInt16LE(1, 2)               // type : icône
  entetes.writeUInt16LE(images.length, 4)
  let decalage = entetes.length
  images.forEach(({ taille, png }, i) => {
    const e = 6 + i * 16
    entetes.writeUInt8(taille >= 256 ? 0 : taille, e)       // largeur (0 = 256)
    entetes.writeUInt8(taille >= 256 ? 0 : taille, e + 1)   // hauteur
    entetes.writeUInt8(0, e + 2)            // couleurs de la palette : aucune
    entetes.writeUInt8(0, e + 3)            // réservé
    entetes.writeUInt16LE(1, e + 4)         // plans
    entetes.writeUInt16LE(32, e + 6)        // bits par pixel
    entetes.writeUInt32LE(png.length, e + 8)
    entetes.writeUInt32LE(decalage, e + 12)
    decalage += png.length
  })
  return Buffer.concat([entetes, ...images.map((i) => i.png)])
}

const TAILLES = [16, 32, 48]

const images = []
for (const taille of TAILLES) {
  images.push({ taille, png: await source().resize(taille, taille, { kernel: 'lanczos3' }).png().toBuffer() })
}
writeFileSync(join(racine, 'public/favicon.ico'), ico(images))

// ⚠️ L'icône d'écran d'accueil d'iOS est un CARRÉ PLEIN et OPAQUE : le système
// arrondit lui-même les coins, et un PNG déjà arrondi en ressort doublement
// rogné. Le fond posé ici est l'encre du SVG : l'arrondi du fichier source
// devient invisible puisqu'il se fond dans la même couleur.
await source()
  .resize(180, 180, { kernel: 'lanczos3' })
  .flatten({ background: '#14181A' })
  .png()
  .toFile(join(racine, 'public/apple-touch-icon.png'))

console.log(`OK favicon.ico (${TAILLES.join(', ')}) et apple-touch-icon.png (180)`)
