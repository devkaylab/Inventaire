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

  /**
   * ⚠️ **La question se pose TOUJOURS.** Elle ne visait au départ que la balise
   * réellement ouverte : consulter sans compter ne change rien. Mais son but
   * n'est pas de protéger une donnée, c'est de rattraper un retour touché par
   * erreur — et un doigt qui glisse se trompe autant dans un cas que dans
   * l'autre. Demande de Julien le 29 août 2026 : « le but est d'éviter les
   * mauvaises manips ». Ne pas la reconditionner.
   */
  it('la question du retour ne dépend plus de l’état de la balise', () => {
    expect(scanner).toContain('usePreventRemove(!sortieAutorisee')
    // Le texte, lui, s'adapte : une balise ouverte restera ouverte.
    expect(scanner).toContain('const ouverte = !!activeBaliseRef.current && !ouvertureDiffereeRef.current')
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
    expect(scanner).toContain('usePreventRemove(!sortieAutorisee')
    expect(scanner).not.toContain("addListener('beforeRemove'")
  })

  /**
   * ⚠️ **La question du retour a la MÊME forme que celle de la clôture** :
   * « Annuler » à gauche, l'action à droite en bouton plein. Une carte où le
   * bouton plein annule et l'autre agit inverse le geste d'un écran à l'autre —
   * on finit par appuyer à droite sans lire. Demande de Julien le 29 août
   * 2026, après avoir vu les deux cartes se contredire : « je veux le même pop
   * up, pas un différent ».
   *
   * Le 25 août, la même question portait « Rester » en bouton plein ; c'était
   * cohérent isolément, et faux à côté de la clôture.
   */
  it('la question du retour a la même forme que celle de la clôture', () => {
    expect(scanner).toContain("titre: 'Quitter le comptage ?'")
    expect(scanner).toContain("action: 'Quitter'")
    expect(scanner).toContain("annuler: 'Annuler'")
    // La clôture, elle, n'a pas bougé.
    expect(scanner).toContain("action: 'Clôturer'")
    expect(scanner).toContain("annuler: 'Annuler'")
  })

  /**
   * ⚠️ **`getAvailableLensesAsync` rend le nom LOCALISÉ, pas l'identifiant.**
   * Côté natif, `availableLenses.map { $0.localizedName }`, et `selectedLens`
   * est comparé au même nom. Une liste écrite en identifiants ne correspond
   * jamais — et sans objectif sélectionné, expo-camera retombe sur
   * `builtInWideAngleCamera`, qui ne fait pas le point sous une dizaine de
   * centimètres. C'était la cause de « le close-up ne marche plus ».
   */
  it('l’objectif se choisit par son nom localisé, pas par un identifiant', () => {
    // ⚠️ Sur le CODE SEUL : les commentaires citent les identifiants pour
    // expliquer le défaut, c'est leur place. La garde porte sur ce qui
    // s'exécute.
    const code = scanner
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toContain('builtInTripleCamera')
    expect(code).not.toContain('builtInDualWideCamera')
    // Toujours pas l'ultra grand-angle seul : son champ à 0,5× rendrait les
    // codes minuscules à distance normale.
    expect(code).not.toContain('builtInUltraWideCamera')
    expect(code).toContain("sansAccent(l).includes('triple')")
    expect(code).toContain('/dual|double/')
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

  /**
   * La confirmation porte le rouge du bouton qui l'a ouverte : un geste et sa
   * confirmation de couleurs différentes donnent l'impression que la carte
   * propose autre chose que ce qu'on vient de toucher.
   *
   * ⚠️ Mais le surtitre reste « Confirmation ». Le défaut du ton `danger` est
   * « Action définitive », et clôturer ne l'est pas — la phrase juste au-dessus
   * dit qu'on pourra y revenir. Retirer cette ligne rendrait la carte menteuse.
   */
  it('la confirmation de clôture est rouge, sans se dire définitive', () => {
    const bloc = scanner.split('Clôturer la balise ${active.code} ?')[1]?.slice(0, 700) ?? ''
    expect(bloc).toContain("ton: 'danger'")
    expect(bloc).toContain("surtitre: 'Confirmation'")
  })
})
