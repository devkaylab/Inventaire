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

describe('le code à scanner de la boîte à outils', () => {
  const composant = readFileSync(path.join(racine, 'components/QrInstallation.tsx'), 'utf8')

  /**
   * ⚠️ **UN QR NE SE RELIT PAS À L'ŒIL.** Une adresse recopiée en dur y
   * survivrait à un changement de domaine sans que personne ne s'en aperçoive :
   * le code continuerait d'afficher des carrés impeccables menant nulle part.
   * Il se DÉDUIT donc de `SITE_URL`, et la garde l'exige.
   */
  it('l’adresse se déduit de SITE_URL, elle ne s’y recopie pas', () => {
    expect(composant).toContain("import { SITE_URL } from '@/lib/site'")
    expect(composant).toMatch(/URL_INSTALLATION = `\$\{SITE_URL\}\/open`/)
    expect(composant, 'aucune adresse écrite en dur').not.toMatch(/https:\/\/www\.quantinvo/)
  })

  /**
   * ⚠️ **C'EST CETTE ADRESSE-LÀ QUI A ÉTÉ ÉPROUVÉE**, le 28 septembre 2026,
   * sur un iPhone où l'application n'était pas installée : le scan a mené à
   * Quantinvo puis à l'App Store. Le test lie le code livré à ce qui a été
   * vérifié sur un vrai téléphone — la seule preuve qui valait.
   */
  it('porte `/open`, et pas une fiche de boutique', async () => {
    const { URL_INSTALLATION } = await import('../components/QrInstallation')
    expect(URL_INSTALLATION).toBe('https://www.quantinvo.com/open')
    // Une fiche de boutique périmerait le jour où Google Play ouvre, et ne
    // servirait qu'à une plateforme sur deux.
    expect(URL_INSTALLATION).not.toContain('apps.apple.com')
    expect(URL_INSTALLATION).not.toContain('play.google.com')
  })

  /**
   * ⚠️ **SOMBRE SUR CLAIR, DANS LES DEUX THÈMES.** Un lecteur de QR attend des
   * modules sombres sur un fond clair ; peindre le code avec les jetons du
   * site le ferait s'inverser en thème sombre, et une partie des téléphones
   * décrocherait. La zone de silence de quatre modules en fait partie.
   */
  it('garde ses couleurs quel que soit le thème', () => {
    expect(composant, 'le fond du code est blanc, écrit en dur').toContain('fill="#FFFFFF"')
    expect(composant, 'les modules sont en encre, écrite en dur').toContain('fill="#14181A"')
    expect(composant, 'aucun jeton de thème sur le code').not.toMatch(/fill=\{?["']?var\(--/)
    expect(composant, 'la zone de silence de 4 modules').toMatch(/viewBox=\{`-4 -4/)
    // Et la carte qui le porte reste blanche elle aussi.
    expect(css).toMatch(/\.outils-installer-code\s*\{[^}]*background:\s*#ffffff/i)
  })
})

describe('⚠️ deux boutons pleine largeur ne se touchent pas', () => {
  const css = readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8')

  it('une suite de `.btn-block` prend un écart', () => {
    // Relevé par Julien sur « Regardez votre boîte mail » (10 octobre 2026) :
    // deux rectangles collés bord à bord se lisent comme un seul bloc coupé,
    // et la frontière entre les deux gestes disparaît au moment où il faut
    // choisir.
    expect(css, 'deux boutons pleine largeur empilés se touchent de nouveau')
      .toMatch(/\.btn-block \+ \.btn-block\s*\{[^}]*margin-top:\s*[1-9]/)
  })

  it('⚠️ et un bouton SEUL ne gagne rien', () => {
    // La règle porte sur la SUITE de deux. Posée sur `.btn-block` tout court,
    // elle décalerait tous les boutons pleine largeur du site — une correction
    // d'un écran qui en déplacerait vingt.
    const regle = /(^|\})\s*\.btn-block\s*\{([^}]*)\}/m.exec(css)?.[2] ?? ''
    expect(regle, 'la règle générale `.btn-block` s’est mise à écarter').not.toMatch(/margin/)
  })
})

describe('⚠️⚠️ la page a son propre jeton, et les cartes un trait', () => {
  const css = readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8')
  const bloc = (sel: string) =>
    new RegExp(`(^|\\})\\s*${sel.replace(/[.[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[2] ?? ''

  it('le fond de page ne se confond plus avec le fond des creux', () => {
    // Constat de Julien (10 octobre 2026) : « ce fond gris qui fait terne […]
    // on a un fond et des boutons de la même couleur presque ». La page valait
    // `--bg`, qui sert AUSSI aux champs, aux survols, aux en-têtes de tableau —
    // 64 usages, dont UN SEUL était la page.
    expect(bloc('body'), 'le fond de page est revenu sur le jeton des creux')
      .toMatch(/background:\s*var\(--page\)/)
    const clair = /:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
    expect(clair, 'le thème clair ne se lit plus').not.toBe('')
    const page = /--page:\s*([^;]+);/.exec(clair)?.[1]?.trim()
    const fond = /--bg:\s*([^;]+);/.exec(clair)?.[1]?.trim()
    expect(page, 'la page n’a plus de jeton en thème clair').toBeTruthy()
    expect(page, 'la page et les creux ont de nouveau la même couleur').not.toBe(fond)
  })

  it('⚠️ et aucune carte de page ne repart sans trait', () => {
    // ⚠️ LA LISTE EST CITÉE, et c'est assumé : ce sont les blocs MESURÉS comme
    // posés directement sur la page. Elles portaient `border: 0` et ne tenaient
    // que par l'écart avec le gris de la page ; `--shadow-card` vaut `none`
    // dans les deux thèmes, donc aucune ombre ne les séparait. Page blanche,
    // carte blanche, pas de trait : la carte n'existe plus.
    const cartes = ['.card', '.auth-card', '.panel', '.admin-section',
                    '.resume-bande', '.dash-card', '.dash-kpi', '.mag',
                    '.res-encadre', '.res-recap', '.res-prix-carte']
    const nues = cartes.filter((c) => {
      const b = bloc(c)
      if (!b.includes('background: var(--surface)')) return false
      // ⚠️ Pas de trait du tout compte autant qu'un `border: 0` explicite :
      // les cartes du tunnel On-Demand n'en déclaraient aucun.
      return /border:\s*0\s*;/.test(b) || !/border:\s*1px/.test(b)
    })
    expect(nues, `ces cartes sont redevenues invisibles sur une page blanche : ${nues.join(', ')}`)
      .toEqual([])
  })
})
