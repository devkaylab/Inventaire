// Les pages vitrines qui montrent le produit — ce que les captures doivent tenir.
//
// Demande de Julien, 12 septembre 2026 : « habille la page pourquoi nous
// choisir avec des captures d'écran », puis « mets aussi des captures sur la
// page L'inventaire ». Avant, ces pages empilaient des paragraphes qui se
// lisaient comme un mur : rien n'accrochait le regard, et rien ne PROUVAIT ce
// que les phrases affirmaient. Ces gardes figent le remède.
//
// ⚠️ ELLES DÉDUISENT LES PAGES CONCERNÉES, elles n'en nomment aucune : celle
// qu'on illustrera demain est couverte sans qu'on y pense. Une garde qui cite
// les pages d'aujourd'hui ne protège que celles-là.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const DOSSIER = path.resolve(__dirname, '../components/vitrine')
const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

/** Le code seul : un commentaire qui EXPLIQUE une règle en cite les mots. */
const sansCommentaires = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/**
 * Les pages vitrines qui posent des images de `/vitrine/`, avec leur code sans
 * commentaires.
 *
 * ⚠️ ELLES SE RECONNAISSENT À LEURS IMAGES, PLUS AU BLOC ILLUSTRÉ. Le filtre
 * cherchait `bloc-illustre` ; la refonte du 19 septembre 2026 a fait passer
 * « Pourquoi nous choisir » et « L'inventaire » aux onglets et aux tuiles, et
 * plus aucune page ne le pose — la garde serait tombée à zéro page, donc
 * muette. Ce que protègent les gardes ci-dessous (pas de doublon, pas d'image
 * absente, un texte de remplacement) vaut pour toute image, quel que soit
 * l'objet qui la porte.
 */
const PAGES_ILLUSTREES = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => [f, sansCommentaires(readFileSync(path.join(DOSSIER, f), 'utf8'))] as const)
  // ⚠️ L'accueil a ses propres gardes (`vitrine-accueil.test.ts`) : il pose
  // aussi une vidéo et des images décrites autrement, que celles-ci
  // compteraient de travers.
  .filter(([f, code]) => f !== 'Accueil.tsx' && /["']\/vitrine\//.test(code))

/**
 * Les images qu'une page pose, dans l'ordre — la source PRINCIPALE de chaque
 * `<img>`, pas les variantes d'un `srcset` : celles-ci répètent le même
 * fichier par construction, et les compter ferait crier au doublon.
 *
 * ⚠️ Le `.webp` est dans la liste depuis le 12 septembre 2026. Il n'y était
 * pas, et les trois photographies posées ce jour-là sont passées SOUS TOUTES
 * LES GARDES sans en déclencher une seule — ni le doublon, ni l'existence du
 * fichier. Une garde qui énumère des extensions ne voit que celles d'hier.
 */
const imagesDe = (code: string) =>
  [...code.matchAll(/(?:src=|src: )["'](\/vitrine\/[^"']+)["']/g)].map((m) => m[1])

/** Tout ce qui est référencé, variantes de `srcset` comprises. */
const fichiersDe = (code: string) =>
  [...code.matchAll(/\/vitrine\/[\w/-]+\.(?:png|jpg|jpeg|webp|avif)/g)].map((m) => m[0])

/**
 * ⚠️ LA NATURE D'UNE IMAGE SE LIT DANS SON CHEMIN, pas dans une liste tenue à
 * la main : une PHOTOGRAPHIE vit sous `/vitrine/photos/`, une capture d'écran
 * ailleurs. C'est ce qui permet aux deux de coexister sur une page sans qu'une
 * garde écrite pour l'une refuse l'autre.
 */
const estPhoto = (src: string) => src.startsWith('/vitrine/photos/')
const capturesDe = (code: string) => imagesDe(code).filter((s) => !estPhoto(s))
const photosDe = (code: string) => imagesDe(code).filter(estPhoto)

/**
 * Les CORPS des requêtes média d'une largeur donnée — bornés par accolades,
 * jamais par un `split`. ⚠️ Un `split` sur `@media (…)` rend des morceaux qui
 * courent jusqu'à l'occurrence SUIVANTE : le premier avalait donc les règles
 * déclarées hors requête plus bas, et la garde lisait le mauvais bloc.
 */
const blocsMedia = (condition: string) => {
  const blocs: string[] = []
  const marque = `@media (${condition})`
  for (let i = css.indexOf(marque); i !== -1; i = css.indexOf(marque, i + 1)) {
    let profondeur = 0
    for (let j = css.indexOf('{', i); j < css.length; j++) {
      if (css[j] === '{') profondeur++
      else if (css[j] === '}' && --profondeur === 0) {
        blocs.push(css.slice(css.indexOf('{', i) + 1, j))
        break
      }
    }
  }
  return blocs
}

/** Le bloc d'une règle CSS, commentaires retirés. */
const regle = (selecteur: string) =>
  sansCommentaires(new RegExp(`${selecteur}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '')

describe('les pages illustrées', () => {
  it('il y en a, et chacune pose plusieurs images', () => {
    // Une détection cassée rendrait toutes les gardes qui suivent silencieuses,
    // ce qui est pire que pas de garde.
    expect(PAGES_ILLUSTREES.length).toBeGreaterThanOrEqual(3)
    for (const [f, code] of PAGES_ILLUSTREES) {
      expect(imagesDe(code).length, `${f} n’a qu’une image, ou aucune`).toBeGreaterThan(1)
    }
  })

  it('⚠️ chaque image porte son texte de remplacement', () => {
    // Une capture sans `alt` n'existe pas pour un lecteur d'écran. Les images
    // posées en balise portent `alt=` ; celles d'une liste de données portent
    // `alt: '…'`, qu'un composant passe ensuite à la balise.
    for (const [f, code] of PAGES_ILLUSTREES) {
      const images = (code.match(/src=["{]/g) ?? []).length + (code.match(/\bsrc: '\/vitrine\//g) ?? []).length
      const alts = (code.match(/\balt=\{/g) ?? []).length + (code.match(/\balt: '/g) ?? []).length
      expect(alts, `${f} : ${images} images pour ${alts} textes de remplacement`).toBeGreaterThanOrEqual(images)
    }
  })

  it('⚠️ aucune capture ne sert DEUX FOIS sur une même page', () => {
    // Deux fois la même image donne l'impression qu'on n'a qu'un écran à
    // montrer. ⚠️ La règle vaut DANS une page, pas entre deux : le tableau de
    // bord sert sur l'accueil ET sur « Pourquoi nous choisir », parce que
    // c'est le seul écran qui montre ce que ces deux passages affirment.
    for (const [f, code] of PAGES_ILLUSTREES) {
      const images = imagesDe(code)
      expect(new Set(images).size, `${f} : image en double — ${images.join(', ')}`)
        .toBe(images.length)
    }
  })

  it('et chaque capture EXISTE', () => {
    // Une image manquante ne casse pas le build : elle laisse un trou dans la
    // page. Même garde que le guide de prise en main.
    for (const [f, code] of PAGES_ILLUSTREES) {
      // ⚠️ Les variantes du `srcset` aussi : c'est justement celle qu'on ne
      // regarde jamais, la petite, qui manquerait sans qu'on s'en aperçoive.
      for (const src of fichiersDe(code)) {
        const fichier = path.resolve(__dirname, '../public' + src)
        expect(statSync(fichier).isFile(), `${f} : ${src} est absent de public/`).toBe(true)
      }
    }
  })
})

describe('les photographies', () => {
  const AVEC_PHOTOS = PAGES_ILLUSTREES.filter(([, code]) => photosDe(code).length > 0)

  it('⚠️ elles sont servies en WebP, et en DEUX largeurs', () => {
    // Les originaux sont des JPEG de 100 à 180 ko. Une seule largeur,
    // dimensionnée pour un écran d'ordinateur, part en entier sur un téléphone
    // qui l'affiche trois fois plus petite.
    for (const [f, code] of AVEC_PHOTOS) {
      for (const src of photosDe(code)) {
        expect(src, `${f} : ${src} n’est pas en WebP`).toMatch(/\.webp$/)
      }
      const balises = code.match(/<img[\s\S]*?\/>/g) ?? []
      for (const balise of balises.filter((b) => /\/vitrine\/photos\//.test(b))) {
        expect(balise, `${f} : une photo sans srcset`).toContain('srcSet=')
        // ⚠️ Sans `sizes`, le navigateur suppose que l'image occupe toute la
        // fenêtre et prend la plus grande variante : le srcset ne sert alors
        // à rien.
        expect(balise, `${f} : un srcset sans sizes`).toContain('sizes=')
        expect(balise.match(/\d+w/g)?.length ?? 0, `${f} : une seule largeur au srcset`)
          .toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('⚠️ et elles réservent leur place', () => {
    // `width` et `height` sur la balise donnent le rapport au navigateur avant
    // le téléchargement : sans eux le texte saute quand la photo arrive.
    for (const [f, code] of AVEC_PHOTOS) {
      const balises = (code.match(/<img[\s\S]*?\/>/g) ?? [])
        .filter((b) => /\/vitrine\/photos\//.test(b))
      expect(balises.length, `${f} : aucune balise de photo`).toBeGreaterThan(0)
      for (const balise of balises) {
        expect(balise, `${f} : une photo sans width`).toMatch(/width=\{\d+\}/)
        expect(balise, `${f} : une photo sans height`).toMatch(/height=\{\d+\}/)
      }
    }
  })

  it('⚠️ le script les prépare, on ne sert jamais l’original', () => {
    // Les originaux vivent hors du site et n'ont aucune raison d'y entrer :
    // ce sont les fichiers les plus lourds du dépôt.
    const script = readFileSync(path.resolve(__dirname, '../scripts/preparer-photos.mjs'), 'utf8')
    expect(sansCommentaires(script)).toContain('.webp(')
    // ⚠️ Et il refuse d'agrandir : au-dessus de la source, on n'invente que
    // des pixels, et une photo agrandie se voit plus qu'une photo un peu
    // petite.
    expect(sansCommentaires(script)).toMatch(/largeur > width/)
  })
})
