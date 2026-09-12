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

/** Les captures qu'une page pose réellement, dans l'ordre. */
const capturesDe = (code: string) =>
  [...code.matchAll(/'(\/vitrine\/[^']+\.(?:png|jpg))'/g)].map((m) => m[1])
    .concat([...code.matchAll(/src="(\/vitrine\/[^"]+\.(?:png|jpg))"/g)].map((m) => m[1]))

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
      const captures = capturesDe(code)
      expect(new Set(captures).size, `${f} : capture en double — ${captures.join(', ')}`)
        .toBe(captures.length)
    }
  })

  it('et chaque capture EXISTE', () => {
    // Une image manquante ne casse pas le build : elle laisse un trou dans la
    // page. Même garde que le guide de prise en main.
    for (const [f, code] of PAGES_ILLUSTREES) {
      for (const src of capturesDe(code)) {
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
