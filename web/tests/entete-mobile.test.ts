import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { barreRetiree, retenirPosition, DEPART, PAS, MOBILE_MAX } from '../lib/enTete'

/**
 * La barre publique sur un téléphone (5 septembre 2026).
 *
 * Trois constats de Julien en parcourant le site sur son téléphone :
 * « ouvrir le menu burger n'affiche pas la croix par moment », « depuis le
 * milieu de la page ça ne l'affiche pas », et « l'en-tête ne disparaît jamais,
 * je veux qu'il disparaisse quand on descend et revienne quand on remonte ».
 *
 * ⚠️ LES DEUX PREMIERS N'EN FONT QU'UN, et la cause est CSS : ouvrir le menu
 * pose `overflow: hidden` sur <html> et <body> pour bloquer le défilement
 * derrière le panneau — et **un ancêtre en `overflow: hidden` casse
 * `position: sticky`**. La barre retombait à sa position statique, en haut du
 * DOCUMENT : depuis le milieu de la page, elle sortait de l'écran avec la croix
 * et le panneau.
 */

const lire = (p: string) => readFileSync(path.join(__dirname, '..', p), 'utf8')
const code = (src: string) =>
  src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

const css = lire('app/globals.css')
/** Le bloc mobile : c'est là que tout se joue. */
const blocMobile = css.slice(css.indexOf('@media (max-width: 780px) {'))

describe('la croix et le panneau ne dépendent plus du défilement', () => {
  it('⚠️ la barre est FIXE sous 780 px, plus collante', () => {
    // C'est le correctif des deux premiers constats : une barre fixe ne dépend
    // pas du contexte de défilement, donc `overflow: hidden` ne peut plus la
    // faire retomber en haut du document.
    expect(blocMobile).toMatch(/\.site-header \{ position: fixed;/)
    expect(code(blocMobile), 'sticky se casse dès qu’un ancêtre passe en overflow: hidden')
      .not.toMatch(/\.site-header \{ position: sticky/)
  })

  it('et le contenu récupère la hauteur qu’elle ne prend plus', () => {
    // Une barre fixe sort du flux : sans espaceur, la première section de
    // chaque page passerait dessous.
    expect(blocMobile).toMatch(/\.site-header-espace \{ height: 64px/)
    expect(code(lire('components/SiteChrome.tsx'))).toContain('className="site-header-espace"')
  })

  it('⚠️ le panneau reste en ABSOLU sur la barre', () => {
    // `backdrop-filter` fait de `.site-header` un bloc conteneur : un
    // descendant en `position: fixed` s'y calerait au lieu de se caler sur
    // l'écran (mesuré le 5 septembre : le panneau sortait à 32 px de haut).
    // Maintenant que la barre est elle-même fixe, « sous la barre » veut enfin
    // dire « sous la barre, à l'écran ».
    expect(css).toMatch(/\.menu-mobile \{\s*position: absolute; top: 100%/)
  })
})

describe('la barre s’efface en descendant, revient en remontant', () => {
  const etat = (o: Partial<Parameters<typeof barreRetiree>[0]>) => ({
    y: 500, precedent: 500, largeur: 375, menuOuvert: false, retiree: false, ...o,
  })

  it('on descend : elle s’efface', () => {
    expect(barreRetiree(etat({ y: 600, precedent: 500 }))).toBe(true)
  })

  it('on remonte : elle revient', () => {
    expect(barreRetiree(etat({ y: 400, precedent: 500, retiree: true }))).toBe(false)
  })

  it('⚠️ en haut de page elle reste, toujours', () => {
    // Le rebond élastique d'iOS ferait clignoter la barre à chaque arrivée.
    expect(barreRetiree(etat({ y: DEPART, precedent: 900, retiree: true }))).toBe(false)
    expect(barreRetiree(etat({ y: 0, precedent: 900, retiree: true }))).toBe(false)
  })

  it('⚠️ menu ouvert, elle reste — sinon on retire la croix sous le doigt', () => {
    expect(barreRetiree(etat({ y: 900, precedent: 500, menuOuvert: true }))).toBe(false)
  })

  it('⚠️ sur un écran large, elle ne bouge pas', () => {
    // La place ne manque pas, et une barre qui va et vient sous la souris
    // agace plus qu'elle ne sert.
    expect(barreRetiree(etat({ y: 900, precedent: 500, largeur: MOBILE_MAX + 1 }))).toBe(false)
  })

  it('un tremblement de doigt ne décide de rien', () => {
    // Sous le pas, l'état ne change pas — dans un sens comme dans l'autre.
    expect(barreRetiree(etat({ y: 500 + PAS - 1, precedent: 500, retiree: false }))).toBe(false)
    expect(barreRetiree(etat({ y: 500 + PAS - 1, precedent: 500, retiree: true }))).toBe(true)
  })

  it('⚠️ et la référence ne bouge QUE lorsqu’on a tranché', () => {
    // Sinon une suite de micro-défilements sous le pas ferait avancer la
    // référence pixel par pixel : le seuil ne serait jamais franchi et la
    // barre ne bougerait plus jamais.
    expect(retenirPosition(etat({ y: 502, precedent: 500 }))).toBe(false)
    expect(retenirPosition(etat({ y: 600, precedent: 500 }))).toBe(true)
  })
})

describe('le mouvement lui-même', () => {
  it('⚠️ transform ET opacity — le fondu seul ne suffit pas', () => {
    // Une barre translucide à mi-chemin se lit par-dessus le texte. Ce sont
    // aussi les deux seules propriétés qu'un navigateur anime sans repeindre.
    expect(blocMobile).toMatch(/\.site-header\.retiree \{ transform: translateY\(-100%\); opacity: 0/)
    expect(blocMobile).toMatch(/transition: transform [^;]*, opacity/)
  })

  it('⚠️ et une préférence de réduction des animations l’annule', () => {
    // Une barre qui bouge sans qu'on le demande est exactement ce que cette
    // préférence vise : elle se contente d'être là.
    const bloc = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .site-header'))
    expect(bloc.slice(0, 220)).toMatch(/\.site-header\.retiree \{ transform: none; opacity: 1/)
  })

  it('⚠️ la décision ne vit PAS dans le composant', () => {
    // Un onglet masqué ne produit aucune frame, donc aucun
    // `requestAnimationFrame` : une règle laissée dans l'effet ne serait
    // vérifiable qu'à l'œil. Quatrième variante de ce piège sur ce dépôt.
    const c = code(lire('components/EnTeteAuDefilement.tsx'))
    expect(c).toContain("from '@/lib/enTete'")
    expect(c, 'les seuils vivent dans le module, pas dans l’écran').not.toMatch(/\d{2,}\s*[<>]/)
  })
})
