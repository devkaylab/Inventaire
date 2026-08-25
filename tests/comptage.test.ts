import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')

/**
 * Quitter le comptage avec une balise ouverte.
 *
 * Le défaut d'origine (25 août 2026, inventaire « Fwee ») : ouvrir une balise
 * déjà comptée la repasse en « en cours » et efface sa date de clôture, et rien
 * ne la refermait au retour. Il suffisait donc de **regarder** une balise finie
 * pour que l'inventaire la déclare non comptée — les pièces, elles, n'avaient
 * pas bougé (`counts` est en ajout pur).
 */
/**
 * Consulter une balise finie ne l'ouvre pas.
 *
 * Le garde-fou du retour ne suffit pas à lui seul : il suppose une sortie
 * propre. Une application tuée, un téléphone à plat ou une panne au mauvais
 * moment laisseraient la balise ouverte, donc décomptée. La seule garantie est
 * de **ne rien écrire tant que rien n'est compté**.
 */
describe('consulter une balise finie ne l’ouvre pas', () => {
  const scanner = lire('../src/components/scanner.tsx')

  it('ouvre en local et sort avant d’appeler set_balise', () => {
    const ouverture = scanner.slice(scanner.indexOf('async function openBaliseCode'))
    const differe = ouverture.indexOf('const terminee = allowCreate ? null : rangeeTerminee(code)')
    const appel = ouverture.indexOf('await setBalise(sessionId, code, baliseModeRef.current, true, allowCreate)')
    expect(differe).toBeGreaterThan(0)
    // ⚠️ L'ordre EST la garantie : la branche différée doit précéder l'appel,
    // et rendre la main (`return`) avant lui.
    expect(differe).toBeLessThan(appel)
    expect(ouverture.slice(differe, appel)).toContain('return')
  })

  it('ne rend l’ouverture réelle qu’en écrivant un comptage', () => {
    // Tout ce qui écrit passe par `enregistrer`, qui matérialise d'abord.
    expect(scanner).toContain('async function enregistrer(')
    expect(scanner).toContain('await materialiserOuverture()')
    // Plus aucune écriture ne court-circuite ce passage obligé.
    const appelsDirects = scanner.match(/await onArticleResolved\(/g) ?? []
    expect(appelsDirects).toHaveLength(1) // le seul, à l'intérieur d'`enregistrer`
  })

  it('ne referme pas ce qui n’a jamais été ouvert', () => {
    // Rappeler `set_balise` déplacerait la date de clôture d'origine.
    const cloture = scanner.slice(scanner.indexOf('async function closeBalise'))
    expect(cloture.indexOf('if (ouvertureDiffereeRef.current)'))
      .toBeLessThan(cloture.indexOf('await setBalise('))
  })

  it('une balise seulement consultée ne pose pas la question au retour', () => {
    expect(scanner).toContain('!!activeBalise && !ouvertureDifferee && !sortieAutorisee')
  })
})

/**
 * « Rouvrir » depuis la liste demande confirmation (Julien, 25 août 2026).
 * Un rang se touche du pouce en faisant défiler, et l'écran qui s'ouvre a la
 * caméra vive avec le scan automatique.
 */
describe('rouvrir depuis la liste demande confirmation', () => {
  const scanner = lire('../src/components/scanner.tsx')

  it('passe par la question et n’ouvre qu’après un oui', () => {
    expect(scanner).toContain('onPress={() => { void rouvrirDepuisListe(item) }}')
    const fonction = scanner.slice(scanner.indexOf('async function rouvrirDepuisListe'))
    const question = fonction.indexOf('titre: `Rouvrir la balise ${z.code} ?`')
    const ouverture = fonction.indexOf('if (ok) await openBaliseCode(')
    expect(question).toBeGreaterThan(0)
    expect(question).toBeLessThan(ouverture)
  })

  it('ne rejoue pas l’avertissement long du scan', () => {
    // Deux questions de nature différente : celle-ci demande une intention,
    // l'autre apprend un fait. `sansAvertir` reste vrai depuis ce rang.
    expect(scanner).toContain('await openBaliseCode(z.code, false, false, true)')
  })
})

describe('quitter le comptage avec une balise ouverte', () => {
  const scanner = lire('../src/components/scanner.tsx')

  it('retient le retour avec usePreventRemove, pas avec beforeRemove', () => {
    // ⚠️ `beforeRemove` ne retient pas cette pile : l'écran part quand même et
    // la question s'affiche par-dessus l'écran d'arrivée. Essayé, constaté au
    // simulateur, et le runtime le dit lui-même dans son alerte.
    expect(scanner).toContain('usePreventRemove(!!activeBalise')
    expect(scanner).not.toContain("addListener('beforeRemove'")
  })

  it('rattrape le retour accidentel : le bouton plein garde sur l’écran', () => {
    // ⚠️ Amendé le 25 août 2026 au soir : la question du retour ne décide plus
    // d'une clôture (la clôture a sa propre confirmation, voir plus bas) —
    // elle rattrape un retour touché par erreur, et la réponse voulue est
    // donc « Rester », en bouton plein.
    expect(scanner).toContain("titre: 'Quitter le comptage ?'")
    expect(scanner).toContain("action: 'Rester'")
    expect(scanner).toContain("annuler: 'Quitter'")
  })

  it('clôturer est confirmé, en nommant ce qui a été compté', () => {
    // « prevent from closing by accident » — les boutons de clôture sont à
    // portée du pouce pendant qu'on scanne, et une clôture de travers annonce
    // un rayon fini qui ne l'est pas. Le chiffre est le seul moyen de voir
    // qu'on n'est pas sur la bonne balise.
    const cloture = scanner.slice(scanner.indexOf('async function closeBalise'))
    const question = cloture.indexOf('titre: `Clôturer la balise ${active.code} ?`')
    const appel = cloture.indexOf('await setBalise(')
    expect(question).toBeGreaterThan(0)
    expect(question).toBeLessThan(appel)
    expect(cloture.slice(0, appel)).toContain('if (!ok) return')
  })

  it('libère la sortie au rendu suivant, sinon la garde la reprend au vol', () => {
    expect(scanner).toContain('setSortieAutorisee(() => data.action)')
    expect(scanner).toContain('if (sortieAutorisee) navigation.dispatch(sortieAutorisee)')
  })

  /**
   * ⚠️ `usePreventRemove` n'est pas exporté par expo-router : il vit dans la
   * copie de react-navigation qu'il embarque. Si une mise à jour déplace ce
   * fichier, la garde du retour sauterait **en silence** — d'où ce test.
   */
  it('le hook interne de retenue existe toujours', () => {
    const chemin = path.resolve(
      __dirname,
      '../node_modules/expo-router/build/react-navigation/core/usePreventRemove.js',
    )
    expect(existsSync(chemin)).toBe(true)
  })

  /**
   * `closeBalise(silencieux)` ne doit jamais être branché nu sur un `onPress` :
   * React Native passe l'événement tactile en premier argument, qui vaut vrai —
   * la clôture au doigt perdrait sa célébration. Attrapé par le typage, gardé
   * ici parce qu'un `onPress={closeBalise}` se réécrit vite.
   */
  it('ne branche jamais closeBalise nu sur un onPress', () => {
    expect(scanner).not.toContain('onPress={closeBalise}')
  })
})
