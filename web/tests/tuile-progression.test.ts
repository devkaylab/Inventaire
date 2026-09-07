// La tuile Progression : le halo cède la place à une couleur (7 septembre 2026).
//
// Constat de Julien, capture à l'appui : « retirer l'effet halo de la tuile
// progression, je veux plutôt une couleur pour la différencier des autres ».
// Trois variantes proposées sur maquette, la B retenue — le vert d'appui, celui
// que le produit emploie déjà pour le rang actif du rail.
//
// Maquette validée avant codage :
// https://claude.ai/code/artifact/db6b08a8-ec91-42b7-a582-c17ae31d49f2
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8')

/**
 * ⚠️ Le CSS SANS ses commentaires. Ceux de la tuile citent nommément tout ce
 * qu'on vient de retirer — `backdrop-filter`, les deux indigos, la gouttière
 * bleu nuit — précisément pour dire qu'on ne les remet pas. Une garde d'absence
 * qui lit le fichier brut se lit elle-même : dixième variante de ce piège sur
 * ce dépôt.
 */
const nu = css.replace(/\/\*[\s\S]*?\*\//g, ' ')

/** Le corps de chaque règle dont le sélecteur contient `motif`. */
function reglesDe(motif: string): string[] {
  const out: string[] = []
  let i = nu.indexOf(motif)
  while (i !== -1) {
    const ouvre = nu.indexOf('{', i)
    // On ne retient que les sélecteurs, pas les mentions dans un corps de règle.
    const entre = nu.slice(i, ouvre)
    if (ouvre !== -1 && !entre.includes('}') && !entre.includes(';')) {
      let profondeur = 0
      let j = ouvre
      for (; j < nu.length; j++) {
        if (nu[j] === '{') profondeur++
        else if (nu[j] === '}' && --profondeur === 0) break
      }
      out.push(nu.slice(ouvre + 1, j))
    }
    i = nu.indexOf(motif, i + motif.length)
  }
  return out
}

const tuile = reglesDe('.dash-progress').join('\n')

describe('le halo est parti', () => {
  it('⚠️ plus de verre : ni backdrop-filter, ni lueur radiale, ni ::before', () => {
    // Le verre ne floutait rien — le fond de la page est uni. Ce qu'on voyait
    // était une tache colorée sous une carte blanchâtre, ce qui explique
    // qu'elle se distinguait mal de ses voisines.
    expect(tuile, 'le backdrop-filter est revenu sur la tuile')
      .not.toContain('backdrop-filter')
    expect(tuile, 'une lueur radiale est revenue')
      .not.toContain('radial-gradient')
    expect(nu, 'le ::before du halo est revenu')
      .not.toContain('.dash-progress::before')
  })

  it('⚠️ les quatre couleurs D’AVANT ARDOISE ont quitté la feuille', () => {
    // C'est la vraie leçon du chantier : ces valeurs étaient écrites EN DUR,
    // hors des jetons, et c'est ce qui leur a permis de survivre à la passe
    // d'identité du 6 septembre — qui, elle, balaie les jetons.
    for (const morte of ['99, 102, 241', '56, 201, 255', '79, 70, 229', '10, 165, 216']) {
      expect(nu, `rgba(${morte}) est un reste de l’ancienne identité`)
        .not.toContain(morte)
    }
  })

  it('⚠️ le fond vient d’un jeton, jamais d’une valeur écrite sur place', () => {
    const base = reglesDe('.dash-progress {')[0]
    expect(base, 'la règle de base de .dash-progress a disparu').toBeDefined()
    expect(base).toContain('background: var(--accent-soft)')
  })
})

describe('les deux barres ne changent pas', () => {
  it('⚠️ les remplissages gardent leurs couleurs, à la lettre', () => {
    // Demande explicite de Julien : « les deux barres de progression ne doivent
    // pas changer ». Le comptage garde son dégradé — c'est le seul endroit où
    // le dégradé dit encore quelque chose, le grand pourcentage l'ayant perdu.
    expect(nu).toContain('.dash-bar-count { background: linear-gradient(90deg, var(--accent), var(--cyan)); }')
    expect(nu).toContain('.dash-bar-audit { background: var(--success); }')
  })

  it('⚠️ et rien, sous la tuile, ne les repeint', () => {
    // Le reflet « Flux » vit sur le `::after` du remplissage, pas sur le
    // remplissage : repeindre celui-ci effacerait le dégradé sans qu'on le
    // voie dans le diff.
    for (const barre of ['.dash-progress .dash-bar-count {', '.dash-progress .dash-bar-audit {']) {
      for (const corps of reglesDe(barre)) {
        expect(corps, `${barre} repeint un remplissage de barre`)
          .not.toMatch(/(^|[\s;])background(-color)?\s*:/)
      }
    }
  })

  it('⚠️ la GOUTTIÈRE, elle, suit le fond — et dans les deux thèmes', () => {
    // Elle était écrite en dur en bleu nuit (`rgba(11, 15, 25, 0.55)`) : sur un
    // aplat vert, elle ferait une entaille. Elle est désormais une
    // transparence, donc elle se creuse dans n'importe quel fond — mais il en
    // faut DEUX, une seule ne creusant pas également sur un pastel et sur un
    // fond déjà sombre.
    expect(tuile, 'la gouttière bleu nuit est revenue').not.toContain('11, 15, 25')
    expect(nu).toContain('.dash-progress .dash-bar { background: rgba(0, 0, 0, 0.3); }')
    expect(nu).toContain(':root[data-theme="light"] .dash-progress .dash-bar { background: rgba(20, 25, 40, 0.09); }')
  })

  it('⚠️ le reflet « Flux » reste, et s’arrête quand on le demande', () => {
    expect(nu).toContain('animation: dash-flux 3.4s ease-in-out infinite')
    expect(nu).toContain('width: 56px')
    const repos = reglesDe('@media (prefers-reduced-motion: reduce)').join('\n')
    expect(repos, 'le reflet ne s’arrête plus sous prefers-reduced-motion')
      .toContain('.dash-progress .dash-bar-count::after { animation: none; opacity: 0; }')
  })
})

describe('les deux thèmes', () => {
  it('⚠️ le filet a sa valeur dans chacun, et le clair passe par data-theme', () => {
    // Le site pose TOUJOURS `data-theme` — le script de `layout.tsx` retombe
    // sur « dark » même s'il lève. Il n'y a donc jamais d'état non marqué : la
    // règle de base sert le sombre, `[data-theme="light"]` sert le clair, et
    // `prefers-color-scheme` n'a rien à faire dans ce bloc.
    const base = reglesDe('.dash-progress {')[0]
    expect(base).toContain('box-shadow: inset 0 0 0 1px rgba(95, 168, 138, 0.3)')
    expect(nu).toContain(':root[data-theme="light"] .dash-progress { box-shadow: inset 0 0 0 1px var(--accent-2); }')
    expect(tuile, 'ce bloc n’a pas à consulter prefers-color-scheme')
      .not.toContain('prefers-color-scheme')
  })

  it('⚠️ le filet est une INCRUSTATION, pas une bordure', () => {
    // `.panel` est à `border: 0` avec 24 px de rembourrage : une vraie bordure
    // ajouterait 2 px à la tuile et la décalerait de ses voisines dans le rail.
    const base = reglesDe('.dash-progress {')[0]
    expect(base).toContain('inset 0 0 0 1px')
    expect(base, 'une bordure décalerait la tuile de ses voisines')
      .not.toMatch(/(^|[\s;])border\s*:/)
  })

  it('⚠️ le grand pourcentage perd son dégradé de texte', () => {
    // Sur un fond teinté, un texte peint par `background-clip: text` se lit
    // moins bien qu'un aplat. Le dégradé reste dans la barre de comptage.
    expect(tuile, 'le pourcentage est repassé en texte dégradé')
      .not.toContain('background-clip: text')
    expect(nu).toContain('.dash-progress .dash-big { color: var(--accent); }')
  })
})
