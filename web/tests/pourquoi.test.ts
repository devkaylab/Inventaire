// « Pourquoi nous choisir » — chaque raison montre l'écran dont elle parle.
//
// Demande de Julien, 12 septembre 2026 : « habille la page pourquoi nous
// choisir avec des captures d'écran ». Avant, six paragraphes empilés se
// lisaient comme un mur : rien n'accrochait le regard, et rien ne PROUVAIT ce
// que les phrases affirmaient. Ces gardes figent le remède.
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const page = lire('../components/vitrine/Pourquoi.tsx')
const css = lire('../app/globals.css')

/** Le code seul : un commentaire qui EXPLIQUE une règle en cite les mots. */
const sansCommentaires = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const code = sansCommentaires(page)
const raisons = /const RAISONS: Raison\[\] = \[([\s\S]*?)\n\]/.exec(code)?.[1] ?? ''
/** Les captures que la page pose réellement, dans l'ordre. */
const captures = [...raisons.matchAll(/'(\/vitrine\/[^']+)'/g)].map((m) => m[1])
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

describe('chaque raison porte sa capture', () => {
  it('autant de captures que de raisons, et chacune avec son texte de remplacement', () => {
    // Une raison sans image redevient un bloc de texte au milieu de cinq
    // illustrations : c'est le rang dépareillé qui se remarque, pas l'absence.
    expect(raisons.length).toBeGreaterThan(0)
    const titres = raisons.match(/^\s{4}title:/gm) ?? []
    expect(titres.length).toBeGreaterThanOrEqual(6)
    expect(captures).toHaveLength(titres.length)
    expect(raisons.match(/^\s{6}alt:/gm) ?? []).toHaveLength(titres.length)
    // Et le rendu les affiche, sous le même texte de remplacement traduit.
    expect(code).toContain('src={r.image.src}')
    expect(code).toContain('alt={t(r.image.alt)}')
  })

  it('⚠️ aucune capture ne sert DEUX FOIS sur la page', () => {
    // Deux fois la même image donne l'impression qu'on n'a qu'un écran à
    // montrer. ⚠️ La règle vaut DANS une page : le tableau de bord sert aussi
    // sur l'accueil, et c'est assumé — c'est le seul écran qui montre à la
    // fois l'avancement par zone et les appareils comptés sans nommer
    // personne, les deux choses que la raison affirme.
    expect(new Set(captures).size, `capture en double : ${captures.join(', ')}`)
      .toBe(captures.length)
  })

  it('et chacune EXISTE', () => {
    // Une image manquante ne casse pas le build : elle laisse un trou dans la
    // page. Même garde que le guide de prise en main.
    for (const src of captures) {
      const fichier = path.resolve(__dirname, '../public' + src)
      expect(statSync(fichier).isFile(), `${src} est absent de public/`).toBe(true)
    }
  })
})

describe('le cadre est dans l’image, jamais dans la feuille', () => {
  it('⚠️ un téléphone ne porte ni filet, ni ombre, ni rayon', () => {
    // Le corps du téléphone est DANS le PNG, sur fond transparent (voir
    // `docs/entreprise/deck/encadrer.js`) : un cadre CSS par-dessus en
    // dessinerait un second autour du premier.
    const bloc = regle('\\.raison-vue img')
    expect(bloc.length).toBeGreaterThan(0)
    for (const interdit of ['border', 'box-shadow', 'radius']) {
      expect(bloc, `.raison-vue img ne doit pas porter ${interdit}`).not.toContain(interdit)
    }
  })

  it('⚠️ mais la capture du SITE en porte un', () => {
    // Elle est rectangulaire : sans filet elle flotterait sur le fond de la
    // carte. Même partage que `.duo-tel img` / `.duo-ecran img` de l'accueil.
    expect(regle('\\.raison--large \\.raison-vue img')).toContain('border')
    // Et elle est la SEULE exception : les autres captures sont encadrées.
    const larges = [...raisons.matchAll(/large:\s*true/g)]
    for (const src of captures) {
      const encadree = /-encadre\.png$/.test(src)
      if (!encadree) expect(larges.length, `${src} n’est ni encadrée ni large`).toBeGreaterThan(0)
    }
    expect(larges.length, 'plus d’une capture large : l’alternance ne tient plus')
      .toBeLessThanOrEqual(1)
  })
})

describe('la mise en page', () => {
  it('⚠️ l’alternance vient de la GRILLE, pas d’un ordre inversé', () => {
    // Le DOM garde partout l'ordre capture-puis-texte : l'ordre de lecture ne
    // dépend donc pas de la parité du rang. Inverser en DOM ferait lire une
    // raison sur deux à l'envers dans un lecteur d'écran.
    expect(code.indexOf('raison-vue')).toBeLessThan(code.indexOf('raison-dire'))
    expect(css).toContain('.raison:nth-child(even) > .raison-vue { grid-column: 2; }')
    expect(code, 'la page inverse l’ordre au lieu de laisser la grille le faire')
      .not.toMatch(/order:\s*[-0-9]/)
  })

  it('⚠️ le texte garde une largeur de LECTURE', () => {
    // À côté d'une colonne de 230 px, la ligne montait à 95 caractères — bien
    // au-delà des 65 qui se lisent sans perdre le début de la ligne suivante.
    expect(regle('\\.raison-dire p')).toMatch(/max-width:\s*\d+ch/)
  })

  it('⚠️ sous 900 px la capture passe AU-DESSUS du texte', () => {
    // Deux colonnes sur la largeur d'un téléphone donneraient une colonne de
    // texte de vingt caractères.
    const petit = blocsMedia('max-width: 900px').find((m) => m.includes('.raison-vue')) ?? ''
    expect(petit.length, 'aucune règle des raisons sous 900 px').toBeGreaterThan(0)
    expect(petit).toContain('grid-row: 2')
    // Et le téléphone reste borné : étiré sur la largeur, il ferait 700 px de
    // haut et il faudrait le faire défiler pour atteindre la raison qu'il
    // illustre.
    expect(petit).toMatch(/\.raison-vue img\s*\{[^}]*max-width/)
  })
})
