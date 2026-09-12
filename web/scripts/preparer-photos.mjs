// Prépare les photographies de la vitrine : recadrage, deux largeurs, WebP.
//
//   node scripts/preparer-photos.mjs        (depuis web/)
//
// Les originaux vivent hors du site (`docs/entreprise/deck/Photos-inventaire/`)
// et ne sont jamais servis tels quels : ce sont des JPEG de 100 à 180 ko qui
// partiraient en entier sur un téléphone.
//
// ⚠️ DEUX LARGEURS PAR PHOTO, ET C'EST LE POINT. Une seule, dimensionnée pour
// l'écran d'un ordinateur, se télécharge aussi sur un téléphone qui l'affiche
// trois fois plus petite. Le `srcset` des pages laisse le navigateur choisir.
//
// ⚠️ ON NE REMONTE JAMAIS AU-DESSUS DE LA SOURCE. Les originaux plafonnent à
// 1264 px de large : agrandir n'inventerait que des pixels, et une photo
// agrandie se voit plus qu'une photo un peu petite.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const sources = join(racine, '../docs/entreprise/deck/Photos-inventaire')
const sortie = join(racine, 'public/vitrine/photos')
mkdirSync(sortie, { recursive: true })

const PHOTOS = [
  {
    // Le bandeau d'ouverture de l'article : l'étiquette collée sur la
    // glissière, et le téléphone qui la vise. ⚠️ Recadré en 2:1 — au format
    // d'origine (3:2) la bande ferait 720 px de haut sur un ordinateur et
    // repousserait le premier paragraphe hors de l'écran.
    // ⚠️ Le recadrage n'est pas centré : au centre, le haut du téléphone
    // passait hors cadre et il n'en restait que des doigts sur une tranche.
    // Comparé image par image — 55 px plus haut, l'appareil tient entier et il
    // reste un bout de rayon en bas à droite.
    src: 'IMG_4746.JPG', nom: 'etiquette', ratio: 2 / 1, haut: 55, largeurs: [1264, 640],
  },
  {
    // « La démarque inconnue » : ce qui disparaît, dans une réserve mal
    // éclairée. Aucun écran ne montre un vol ni une casse — une photo, si.
    src: 'IMG_4748.JPG', nom: 'reserve-sombre', largeurs: [760, 380],
  },
  {
    // « Ce que l'inventaire révèle d'autre » : on cherche, et on trouve ce que
    // le logiciel ignorait.
    src: 'IMG_4749.JPG', nom: 'reserve', largeurs: [760, 380],
  },
]

for (const photo of PHOTOS) {
  const image = sharp(join(sources, photo.src))
  const { width, height } = await image.metadata()
  for (const largeur of photo.largeurs) {
    if (largeur > width) throw new Error(`${photo.src} : ${largeur} px demandés pour ${width} px de source`)
    const hauteur = Math.round(largeur / (photo.ratio ?? width / height))
    const fichier = join(sortie, `${photo.nom}-${largeur}.webp`)
    let rendu = sharp(join(sources, photo.src))
    if (photo.haut !== undefined) {
      // Recadrage explicite avant réduction : `fit: cover` ne sait couper
      // qu'au centre ou sur un bord, jamais à une hauteur choisie.
      rendu = rendu.extract({
        left: 0, top: photo.haut, width, height: Math.round(width / photo.ratio),
      })
    }
    await rendu
      .resize(largeur, hauteur, { fit: 'cover' })
      .webp({ quality: 80, effort: 6 })
      .toFile(fichier)
    console.log(`OK ${photo.nom}-${largeur}.webp  ${largeur}×${hauteur}`)
  }
}
