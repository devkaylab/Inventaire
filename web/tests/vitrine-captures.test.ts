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

/** Les pages vitrines qui posent le bloc illustré, avec leur code sans commentaires. */
const PAGES_ILLUSTREES = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => [f, sansCommentaires(readFileSync(path.join(DOSSIER, f), 'utf8'))] as const)
  .filter(([, code]) => code.includes('bloc-illustre'))

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
  it('il y en a, et chacune pose plusieurs captures', () => {
    // Une détection cassée rendrait toutes les gardes qui suivent silencieuses,
    // ce qui est pire que pas de garde.
    expect(PAGES_ILLUSTREES.length).toBeGreaterThanOrEqual(2)
    for (const [f, code] of PAGES_ILLUSTREES) {
      expect(capturesDe(code).length, `${f} n’a qu’une capture, ou aucune`).toBeGreaterThan(1)
    }
  })

  it('⚠️ chaque bloc illustré porte une capture ET son texte de remplacement', () => {
    // Un bloc dont la figure est vide laisse un trou dans la grille ; une
    // capture sans `alt` n'existe pas pour un lecteur d'écran.
    for (const [f, code] of PAGES_ILLUSTREES) {
      const blocs = code.match(/className=(?:"|\{')?[^"'}]*bloc-illustre/g) ?? []
      expect(blocs.length, `${f} : aucun bloc illustré`).toBeGreaterThan(0)
      const vues = code.match(/bloc-vue/g) ?? []
      expect(vues.length, `${f} : ${blocs.length} blocs pour ${vues.length} captures`)
        .toBe(blocs.length)
      // Autant de textes de remplacement que de captures.
      const alts = (code.match(/alt=\{t\(/g) ?? []).length + (code.match(/^\s+alt: '/gm) ?? []).length
      expect(alts, `${f} : une capture sans alt`).toBeGreaterThanOrEqual(vues.length)
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

describe('le cadre est dans l’image, jamais dans la feuille', () => {
  it('⚠️ un téléphone ne porte ni filet, ni ombre, ni rayon', () => {
    // Le corps du téléphone est DANS le PNG, sur fond transparent (voir
    // `docs/entreprise/deck/encadrer.js`) : un cadre CSS par-dessus en
    // dessinerait un second autour du premier.
    const bloc = regle('\\.bloc-vue img')
    expect(bloc.length).toBeGreaterThan(0)
    for (const interdit of ['border', 'box-shadow', 'radius']) {
      expect(bloc, `.bloc-vue img ne doit pas porter ${interdit}`).not.toContain(interdit)
    }
  })

  it('⚠️ mais la capture du SITE en porte un, et elle est la seule exception', () => {
    // Elle est rectangulaire : sans filet elle flotterait sur le fond de la
    // carte. Même partage que `.duo-tel img` / `.duo-ecran img` de l'accueil.
    expect(regle('\\.bloc-illustre--large \\.bloc-vue img')).toContain('border')
    // ⚠️ Ce qui compte se DÉDUIT des captures, pas d'un marqueur : une capture
    // qui n'est pas encadrée est forcément une capture du site, donc large.
    for (const [f, code] of PAGES_ILLUSTREES) {
      const nues = capturesDe(code).filter((src) => !/-encadre\.png$/.test(src))
      expect(nues.length, `${f} : plus d’une capture large — ${nues.join(', ')}`)
        .toBeLessThanOrEqual(1)
      if (nues.length === 1) {
        expect(code, `${f} : ${nues[0]} n’est pas déclarée large`).toMatch(/large/)
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

  it('⚠️ une photo n’est PAS mise au gabarit d’un téléphone', () => {
    // Le corps du téléphone tient dans sa colonne parce qu'il est deux fois
    // plus haut que large ; une photo au même gabarit ferait 230 × 153, une
    // vignette. Les deux colonnes doivent donc différer — et c'est ça qu'on
    // vérifie, pas une valeur : le jour où 380 devient 420, la garde tient.
    const colonne = (selecteur: string) =>
      /grid-template-columns:\s*([^;]+);/.exec(regle(selecteur))?.[1]?.trim()
    const telephone = colonne('\\.bloc-illustre')
    const photo = colonne('\\.bloc-illustre--photo')
    expect(telephone, 'le bloc illustré n’a plus de colonnes').toBeTruthy()
    expect(photo, 'les photos ont perdu leur propre largeur').toBeTruthy()
    expect(photo, 'une photo est mise au gabarit d’un téléphone').not.toBe(telephone)
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

describe('la mise en page', () => {
  it('⚠️ UNE SEULE définition pour toute la vitrine', () => {
    // Deux copies de cette grille divergeraient au premier ajustement, et
    // c'est la page qu'on regarde le moins qui garderait l'ancienne.
    expect((css.match(/^\.bloc-illustre\s*\{/gm) ?? []).length).toBe(1)
    expect((css.match(/^\.bloc-vue\s+img\s*\{/gm) ?? []).length).toBe(1)
  })

  it('⚠️ l’alternance est un choix de PAGE, et elle vient de la grille', () => {
    // Une liste d'arguments de même rang y gagne un rythme ; un article dont
    // seuls certains paragraphes sont illustrés, non — les blocs sans capture
    // y casseraient la parité. D'où le modificateur sur le conteneur.
    // ⚠️ La garde porte sur TOUTES les règles de parité, pas sur la présence
    // d'une seule : vérifier qu'un sélecteur existe laisse passer un second
    // qui alterne sans le modificateur — sabotage du 12 septembre 2026, qui
    // est passé au vert la première fois.
    const parites = [...css.matchAll(/^([^{}\n]*\.bloc-illustre[^{}\n]*nth-child[^{}\n]*)\{/gm)]
      .map((m) => m[1].trim())
    expect(parites.length, 'plus aucune règle d’alternance').toBeGreaterThan(0)
    for (const sel of parites) {
      expect(sel, `« ${sel} » alterne sans le modificateur de conteneur`)
        .toContain('blocs-illustres--alterne')
    }
    // ⚠️ Et c'est la GRILLE qui alterne, jamais l'ordre du DOM : inverser en
    // DOM ferait lire un bloc sur deux à l'envers dans un lecteur d'écran.
    for (const [f, code] of PAGES_ILLUSTREES) {
      expect(code.indexOf('bloc-vue'), `${f} : le texte précède la capture`)
        .toBeLessThan(code.indexOf('bloc-dire'))
      expect(code, `${f} inverse l’ordre au lieu de laisser la grille le faire`)
        .not.toMatch(/order:\s*[-0-9]/)
    }
  })

  it('⚠️ le texte garde une largeur de LECTURE', () => {
    // Sans plafond, la ligne montait à 95 caractères à côté d'une colonne de
    // 230 px, et à 130 sur un bloc pleine largeur — bien au-delà des 65 qui se
    // lisent sans perdre le début de la ligne suivante.
    expect(regle('\\.bloc-dire p')).toMatch(/max-width:\s*\d+ch/)
    for (const [f, code] of PAGES_ILLUSTREES) {
      // Une page qui pose ses paragraphes en style en ligne doit les borner
      // elle-même : l'attribut l'emporte sur la feuille.
      const enLigne = /const P = \{([^}]*)\}/.exec(code)
      if (enLigne) expect(enLigne[1], `${f} : le paragraphe en ligne n’est pas borné`).toContain('maxWidth')
    }
  })

  it('⚠️ sous 900 px la capture passe AU-DESSUS du texte', () => {
    // Deux colonnes sur la largeur d'un téléphone donneraient une colonne de
    // texte de vingt caractères.
    const petit = blocsMedia('max-width: 900px').find((m) => m.includes('.bloc-vue')) ?? ''
    expect(petit.length, 'aucune règle des blocs illustrés sous 900 px').toBeGreaterThan(0)
    expect(petit).toContain('grid-row: 2')
    // Et le téléphone reste borné : étiré sur la largeur, il ferait 700 px de
    // haut et il faudrait le faire défiler pour atteindre le bloc qu'il
    // illustre.
    expect(petit).toMatch(/\.bloc-vue img\s*\{[^}]*max-width/)
  })
})
