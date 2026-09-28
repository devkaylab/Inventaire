// Les deux parcours de prise en main, LUS DANS LE CODE DU SITE
// (`web/lib/priseEnMain.ts`).
//
// ⚠️ **Ils ne sont pas recopiés ici, et c'est tout l'objet de ce module.** Le
// guide existe déjà en page web ; en fabriquer une seconde version à la main
// garantit qu'un jour les deux diront des choses différentes — et c'est
// exactement ce qui a tué le tutoriel intégré, qui décrivait des écrans
// disparus. En lisant la source, un PDF régénéré dit forcément ce que le site
// dit, et une étape ajoutée sur le site apparaît ici sans qu'on y pense.
//
// L'analyse est volontairement stricte : on ne devine rien, on échoue.

const fs = require('fs')
const path = require('path')

const SOURCE = path.resolve(__dirname, '../../../web/lib/priseEnMain.ts')
/** Les captures que la page web sert — les mêmes fichiers, pas des copies. */
const IMAGES = path.resolve(__dirname, '../../../web/public/prise-en-main')

/** `'…'` ou `"…"` sur une ou plusieurs lignes, apostrophes typographiques comprises. */
function champ(bloc, nom) {
  const m = bloc.match(new RegExp(`${nom}:\\s*\\n?\\s*(['"])([\\s\\S]*?)\\1,`))
  if (!m) throw new Error(`champ « ${nom} » introuvable dans une étape de ${SOURCE}`)
  return m[2].replace(/\\'/g, "'").replace(/\\"/g, '"')
}

function lire() {
  const src = fs.readFileSync(SOURCE, 'utf8')

  const date = src.match(/export const CAPTURES_LE = '(.+?)'/)
  if (!date) throw new Error(`CAPTURES_LE introuvable dans ${SOURCE}`)
  const aRefaire = /export const CAPTURES_A_REFAIRE = true/.test(src)

  const bloc = src.match(/export const PARCOURS: Parcours\[\] = \[([\s\S]*)\n\]/)
  if (!bloc) throw new Error(`PARCOURS introuvable dans ${SOURCE}`)

  // Un parcours s'ouvre sur `cle:` et court jusqu'au suivant.
  const parcours = []
  const debuts = [...bloc[1].matchAll(/^\s{4}cle: '(\w+)',$/gm)]
  if (debuts.length !== 2) throw new Error(`2 parcours attendus, ${debuts.length} lus dans ${SOURCE}`)

  debuts.forEach((d, i) => {
    const fin = i + 1 < debuts.length ? debuts[i + 1].index : bloc[1].length
    const corps = bloc[1].slice(d.index, fin)
    const etapes = []
    for (const e of corps.matchAll(/image: '([\w-]+)',([\s\S]*?)\n      \},/g)) {
      const image = e[1]
      const fichier = path.join(IMAGES, `${image}.png`)
      // ⚠️ On échoue sur une capture manquante plutôt que d'imprimer un trou :
      // un guide qui saute un écran ne se voit pas à la relecture.
      if (!fs.existsSync(fichier)) {
        throw new Error(`capture « ${image}.png » absente de ${IMAGES}`)
      }
      etapes.push({
        image,
        fichier,
        titre: champ(e[2], 'titre'),
        texte: champ(e[2], 'texte'),
        repere: champ(e[2], 'repere'),
      })
    }
    if (!etapes.length) throw new Error(`aucune étape lue pour le parcours « ${d[1]} »`)
    parcours.push({
      cle: d[1],
      nom: champ(corps, 'nom'),
      intro: champ(corps, 'intro'),
      etapes,
    })
  })

  return { parcours, capturesLe: date[1], capturesARefaire: aRefaire }
}

module.exports = { lire, SOURCE, IMAGES }
