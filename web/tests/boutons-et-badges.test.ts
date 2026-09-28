// Deux défauts vus par Julien sur la production, le 28 septembre 2026 — pas
// par moi. Ils ont la même forme : une règle qui n'a jamais été posée, et que
// rien ne réclamait.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const racine = path.resolve(__dirname, '..')
const css = readFileSync(path.join(racine, 'app/globals.css'), 'utf8')

function fichiers(dossier: string): string[] {
  const out: string[] = []
  for (const nom of readdirSync(dossier)) {
    const p = path.join(dossier, nom)
    if (statSync(p).isDirectory()) { if (!['node_modules', '.next'].includes(nom)) out.push(...fichiers(p)) }
    else if (/\.tsx?$/.test(nom)) out.push(p)
  }
  return out
}
const sources = [...fichiers(path.join(racine, 'app')), ...fichiers(path.join(racine, 'components'))]

describe('un bouton ressemble à un bouton', () => {
  /**
   * ⚠️ **`.btn` SEUL N'A NI FOND NI BORDURE VISIBLE** : il pose la forme
   * — hauteur, gouttière, graisse — et rien de la couleur, qui vient d'une
   * variante. Un `class="btn btn-sm"` s'affiche donc en texte gras nu, et
   * personne ne le voit tant qu'il n'est pas à côté d'un vrai bouton.
   * Constat de Julien : « mets un vrai bouton pour ouvrir le guide ».
   *
   * ⚠️ **LA GARDE DÉDUIT LA LISTE DES VARIANTES DE LA FEUILLE DE STYLE** : une
   * variante ajoutée demain sera acceptée sans qu'on touche à ce fichier, et
   * un `btn-sm` — qui ne pose qu'une taille — ne comptera jamais pour une.
   */
  const variantes = [...css.matchAll(/^\.(btn-[a-z0-9-]+)\s*\{([^}]*)\}/gm)]
    .filter(m => /(^|;)\s*background\s*:/.test(m[2]))
    .map(m => m[1])

  it('la feuille de style déclare des variantes de couleur', () => {
    expect(variantes.length, 'aucune variante trouvée : le motif de lecture a changé')
      .toBeGreaterThanOrEqual(4)
    expect(variantes).toContain('btn-primary')
    // Une taille n'est pas une couleur.
    expect(variantes).not.toContain('btn-sm')
    expect(variantes).not.toContain('btn-block')
  })

  it('aucun `btn` de l’interface n’est laissé sans variante', () => {
    const nus: string[] = []
    for (const f of sources) {
      const texte = readFileSync(f, 'utf8')
      for (const m of texte.matchAll(/className="([^"]*)"/g)) {
        // ⚠️ ON COMPARE DES JETONS ENTIERS. Un `\bbtn\b` attrapait aussi
        // `link-btn` et `refresh-btn` — deux composants qui ont leurs propres
        // styles et n'ont jamais eu besoin d'une variante. Le tiret est une
        // frontière de mot pour une expression régulière, pas pour CSS.
        const classes = m[1].split(/\s+/).filter(Boolean)
        if (!classes.includes('btn')) continue
        if (!classes.some(c => variantes.includes(c))) {
          nus.push(`${path.relative(racine, f)} : "${m[1]}"`)
        }
      }
    }
    expect(nus, `un bouton sans variante s’affiche en texte nu :\n${nus.join('\n')}`).toEqual([])
  })
})

describe('le badge de boutique garde ses couleurs', () => {
  /**
   * ⚠️⚠️ **UN CONTENEUR QUI COLORE SES LIENS BAT LE BADGE.** `.site-footer a`
   * pose `color: var(--text-2)`, et un badge EST un lien : au pied du site, le
   * texte des deux boutons est sorti gris sur noir — 2,3 pour 1, illisible.
   * Mesuré dans le navigateur, avant et après : 2,3 puis 16,05.
   *
   * La garde vérifie le CONTRASTE, à partir des jetons de la feuille de style,
   * dans les deux thèmes. Elle ne relit pas le sélecteur : c'est la lisibilité
   * qu'on défend, pas une ligne de CSS.
   */
  const jeton = (bloc: string, nom: string) => {
    const m = bloc.match(new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})`))
    expect(m, `le jeton --${nom} doit être une couleur hexadécimale`).toBeTruthy()
    return m![1]
  }
  const canal = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => canal(parseInt(hex.slice(i, i + 2), 16) / 255))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contraste = (a: string, b: string) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (l1 + 0.05) / (l2 + 0.05)
  }

  // Le thème sombre vit dans `:root`, le clair dans le bloc qui le suit.
  const sombre = css.slice(css.indexOf(':root {'), css.indexOf('--bg: #f2f3f1'))
  const clair = css.slice(css.indexOf('--bg: #f2f3f1'))

  it.each([['sombre', sombre], ['clair', clair]])(
    'le texte du badge se lit sur son fond, en thème %s', (_nom, bloc) => {
      // Le badge peint `--text` en fond et `--bg` en texte : les deux jetons
      // de la même paire, donc l'inverse exact du corps de page.
      const r = contraste(jeton(bloc, 'text'), jeton(bloc, 'bg'))
      expect(r, `contraste de ${r.toFixed(2)} pour 1`).toBeGreaterThanOrEqual(4.5)
    })

  it('aucun conteneur ne peut le repeindre', () => {
    // Deux classes battent `<conteneur> a`, quel que soit l'ordre du fichier.
    expect(css).toMatch(/\.boutiques \.store-badge\s*\{[^}]*color:\s*var\(--bg\)/)
    // Et le survol, qui remettait le texte en encre sur encre.
    expect(css).toMatch(/\.boutiques \.store-badge:hover\s*\{[^}]*color:\s*var\(--bg\)/)
  })
})
