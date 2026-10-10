import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DUREE_FERMETURE_MS } from '../components/ui/Modal'

/**
 * La fenêtre modale entre et sort en fondu — la garde (10 octobre 2026).
 *
 * Julien : « Je préfère que ce soit un pop up qui s'affiche, avec une
 * animation fade in et fade out quand on a terminé, un voile léger qui fait
 * une séparation entre le pop up et la page derrière. »
 *
 * ⚠️ Et un défaut d'affichage relevé au passage : deux cartes qui se suivaient
 * se touchaient. `.panel` ne porte de marge qu'au-dessus, `.admin-section`
 * qu'en dessous — entre les deux, zéro, et les deux fonds blancs se fondaient
 * en un seul bloc.
 */

const racine = path.resolve(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')
const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const css = lire('app/globals.css')
const modal = sansCommentaires(lire('components/ui/Modal.tsx'))

describe('⚠️ la durée du fondu est écrite deux fois : elles s’accordent', () => {
  it('le minuteur de fermeture et l’animation CSS disent la même chose', () => {
    // ⚠️ Trop court côté code : la fenêtre saute avant la fin du fondu.
    // Trop long : un voile mort reste à l'écran. Même piège que
    // `DUREE_LIEN_HEURES`, où l'e-mail promettait ce que le serveur ignorait.
    const regle = /\.modal-backdrop\.sortie\s*\{[^}]*animation:\s*voile-sort\s+([\d.]+)s/.exec(css)
    expect(regle, 'le voile n’a plus d’animation de sortie').not.toBeNull()
    const secondes = Number(regle![1])
    expect(secondes * 1000, 'le CSS et DUREE_FERMETURE_MS ont divergé')
      .toBe(DUREE_FERMETURE_MS)
  })
})

describe('⚠️ la fermeture passe par le fondu, jamais directement', () => {
  it('`onClose` part après le minuteur, pas au clic', () => {
    expect(modal, 'onClose est redevenu immédiat')
      .toMatch(/setTimeout\(onClose,\s*DUREE_FERMETURE_MS\)/)
  })

  it('⚠️ et le contenu peut fermer par le même chemin', () => {
    // Sans ça, un formulaire qui se referme après l'envoi appellerait
    // `onClose` en direct : la fenêtre sauterait au moment EXACT que Julien
    // décrivait — « fade out quand on a terminé ».
    expect(modal, 'le contenu ne reçoit plus la fermeture de la fenêtre')
      .toMatch(/children\(fermer\)/)
  })

  it('toutes les sorties empruntent ce chemin', () => {
    // Échap, la croix, le clic sur le voile. Une seule sortie, un seul
    // comportement — sinon l'une d'elles claque pendant que les autres fondent.
    expect(modal.match(/\bfermer\b/g)?.length ?? 0).toBeGreaterThanOrEqual(5)
    expect(modal, 'une sortie appelle encore onClose sans passer par le fondu')
      .not.toMatch(/onClick=\{onClose\}|onClose\(\)/)
  })
})

describe('⚠️ le voile sépare, et se tait pour qui le demande', () => {
  it('il est posé, et il entre en fondu', () => {
    expect(css).toMatch(/@keyframes voile-entre/)
    expect(css).toMatch(/@keyframes voile-sort/)
    const bloc = /\.modal-backdrop\s*\{[^}]*\}/.exec(css)?.[0] ?? ''
    expect(bloc, 'le voile n’assombrit plus la page').toMatch(/background:\s*rgba/)
    expect(bloc, 'le voile n’entre plus en fondu').toMatch(/animation:\s*voile-entre/)
  })

  it('⚠️ et « moins d’animation » est respecté', () => {
    // ⚠️ La feuille porte VINGT-SIX blocs de ce genre : en lire un seul, c'est
    // en lire un au hasard. On cherche dans tous.
    const blocs = css.split('@media (prefers-reduced-motion').slice(1).map((b) => b.slice(0, 400))
    expect(blocs.length, 'la feuille n’honore plus « moins d’animation »').toBeGreaterThan(0)
    expect(
      blocs.some((b) => b.includes('.modal-backdrop') && b.includes('animation: none')),
      'la préférence « moins d’animation » n’éteint plus la fenêtre',
    ).toBe(true)
  })
})

describe('⚠️ deux cartes qui se suivent ne se touchent pas', () => {
  it('une règle vise la succession, pas l’une des deux cartes', () => {
    // Chacune a une marge d'un seul côté : seules, elles ont raison ; à la
    // suite, elles fusionnent. C'est la SUCCESSION qu'on corrige.
    expect(css, 'les deux cartes se touchent de nouveau')
      .toMatch(/\.panel \+ \.admin-section[\s\S]{0,60}margin-top/)
  })
})

describe('⚠️ les formulaires d’ajout vivent dans une fenêtre', () => {
  const page = sansCommentaires(lire('app/equipe/page.tsx'))

  it('les deux rôles ouvrent une fenêtre, pas un panneau dans la page', () => {
    for (const composant of ['AjouterPersonne', 'AddCounter']) {
      const i = page.indexOf(`<${composant}`)
      expect(i, `${composant} ne se rend plus`).toBeGreaterThan(-1)
      const avant = page.slice(0, i)
      expect(avant.lastIndexOf('<Modal'), `${composant} n’est plus dans une fenêtre`)
        .toBeGreaterThan(avant.lastIndexOf('</Modal>'))
    }
  })

  it('⚠️ et aucun des deux ne garde sa carte ni son titre', () => {
    // La fenêtre les porte déjà : en garder une copie ferait deux titres l'un
    // sous l'autre, et une carte dans une carte.
    for (const f of ['components/dashboard/AddCounter.tsx', 'app/equipe/page.tsx']) {
      expect(sansCommentaires(lire(f)), `${f} rend encore son formulaire en carte`)
        .not.toMatch(/<form[^>]*className="panel"/)
    }
  })
})
