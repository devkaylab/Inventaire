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
   * ⚠️ **Retour clôture la balise, comme les deux boutons « Clôturer ».**
   * Demande de Julien, répétée le 29 août 2026. Deux fois j'ai fait une
   * question « Quitter le comptage ? » qui laissait la balise OUVERTE — or une
   * balise ouverte disparaît de l'écran : la liste « Revenir sur une balise »
   * ne montre que les clôturées, et ses pièces sont introuvables sans
   * rescanner l'étiquette. Partir sans clôturer n'est pas une sortie, c'est
   * une impasse.
   */
  it('le retour clôture la balise ouverte, avec la confirmation de la clôture', () => {
    expect(scanner).toContain('usePreventRemove(!!activeBalise && !sortieAutorisee')
    expect(scanner).toContain('void closeBalise().then((cloturee) => {')
    expect(scanner).toContain('if (!cloturee) return')
    // Une seule confirmation de clôture, réutilisée : deux dérivent.
    expect(scanner).not.toContain("titre: 'Quitter le comptage ?'")
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
    expect(scanner).toContain('usePreventRemove(!!activeBalise && !sortieAutorisee')
    expect(scanner).not.toContain("addListener('beforeRemove'")
  })

  /**
   * ⚠️ **Pas de question quand rien n'est ouvert.** En phase balise il n'y a
   * rien à clôturer, donc rien à confirmer : « le bouton retour depuis le scan
   * des balises n'a pas besoin d'un pop up » (Julien, 29 août 2026). Une carte
   * qui s'ouvre pour ne rien décider apprend à répondre sans lire.
   */
  it('ne demande rien quand aucune balise n’est ouverte', () => {
    expect(scanner).toContain('usePreventRemove(!!activeBalise && !sortieAutorisee')
  })

  it('la clôture garde sa confirmation, rouge et nommée', () => {
    expect(scanner).toContain("titre: `Clôturer la balise ${active.code} ?`")
    expect(scanner).toContain("action: 'Clôturer'")
    expect(scanner).toContain("ton: 'danger'")
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

/**
 * Le mode douchette ne dépend plus du suffixe « Entrée ».
 *
 * Constat de Julien le 31 août 2026 sur le Pixel : le code s'inscrivait
 * entièrement dans le champ **et y restait** — jamais validé, aucun article
 * compté. Le redressement de clavier n'y était pour rien (la chaîne reçue se
 * redresse correctement) : c'est le suffixe de la douchette qui n'arrivait
 * pas. Vérifié sur l'appareil, `KEYCODE_ENTER` comme `KEYCODE_NUMPAD_ENTER`
 * déclenchent bien `onSubmitEditing` — Android n'est pas en cause.
 */
describe('la douchette valide même sans suffixe', () => {
  const scanner = lire('../src/components/scanner.tsx')

  it('le champ passe par la mesure de rafale, pas par une affectation nue', () => {
    expect(scanner).toContain('onChangeText={frappeDouchette}')
    expect(scanner).not.toContain('onChangeText={t => { hwBufRef.current = t }}')
    // ⚠️ La fin de rafale DOUBLE le suffixe, elle ne le remplace pas : quand
    // Entrée arrive, elle tombe bien avant la temporisation.
    expect(scanner).toContain('onSubmitEditing={handleHardwareSubmit}')
  })

  it('les deux seuils protègent la saisie au clavier', () => {
    // Aucun doigt ne tient 35 ms d'écart moyen sur quatre caractères — c'est
    // ce qui permet de promettre « la saisie au clavier fonctionne aussi ».
    expect(scanner).toMatch(/RAFALE_ECART_MAX\s*=\s*35\b/)
    expect(scanner).toMatch(/RAFALE_MIN\s*=\s*4\b/)
    const corps = scanner.slice(scanner.indexOf('hwMinuterieRef.current = setTimeout'))
    expect(corps).toContain('code.length >= RAFALE_MIN && moyen <= RAFALE_ECART_MAX')
  })

  it('un suffixe reçu comme caractère vaut validation', () => {
    // Certaines douchettes envoient CR dans le texte plutôt qu'en touche.
    const frappe = scanner.slice(scanner.indexOf('function frappeDouchette'))
    expect(frappe.slice(0, frappe.indexOf('hwMinuterieRef.current = setTimeout')))
      .toMatch(/test\(t\)[\s\S]*handleHardwareSubmit/)
  })

  it('une rafale ne survit ni à la validation, ni au mode, ni à l’écran', () => {
    // La validation vide le champ, et vider le champ oublie la rafale.
    const submit = scanner.slice(scanner.indexOf('async function handleHardwareSubmit'))
    expect(submit.slice(0, submit.indexOf('if (!brut.trim())'))).toContain('viderChampDouchette()')
    const vider = scanner.slice(scanner.indexOf('function viderChampDouchette'))
    expect(vider.slice(0, vider.indexOf('function oublierRafale'))).toContain('oublierRafale()')
    expect(scanner).toContain('useEffect(() => () => oublierRafale(), [])')
    const mode = scanner.slice(scanner.indexOf("hwBufRef.current = ''"))
    expect(mode.slice(0, mode.indexOf('if (mode !=='))).toContain('oublierRafale()')
  })
})

/**
 * Le champ de capture se vide vraiment, et il dit ce qui est passé.
 *
 * Constat de Julien le 31 août 2026, sur les deux systèmes : après un scan
 * **pourtant enregistré** (ABC1235 compté à 13:00:13, vérifié en base), le
 * code brut restait affiché — donc on croit que le scan a échoué, et le scan
 * suivant se colle au précédent et fabrique un article inconnu à partir de
 * deux codes valides. Le champ n'ayant aucun clavier logiciel, il n'existait
 * aucun moyen de l'effacer à la main.
 */
describe('le champ de la douchette se vide et se relit', () => {
  const scanner = lire('../src/components/scanner.tsx')

  it('se vide par REMONTAGE, pas seulement par clear()', () => {
    // ⚠️ `clear()` ne tient pas : une vue neuve part de defaultValue="".
    expect(scanner).toContain('key={`hw-${hwSeq}`}')
    const vider = scanner.slice(scanner.indexOf('function viderChampDouchette'))
    const corps = vider.slice(0, vider.indexOf('function oublierRafale'))
    expect(corps).toContain('setHwSeq(n => n + 1)')
    expect(corps).toContain("hwBufRef.current = ''")
  })

  it('offre une sortie à la main — il n’y a pas de clavier logiciel', () => {
    expect(scanner).toContain('onPress={viderChampDouchette}')
    expect(scanner).toContain('Effacer le champ')
  })

  it('confirme le dernier scan en clair sous le champ', () => {
    // Le champ montre la FRAPPE BRUTE (des symboles) : sans cette ligne, un
    // scan réussi ressemble à un scan raté.
    const bloc = scanner.slice(scanner.indexOf('key={`hw-${hwSeq}`}'))
    expect(bloc.slice(0, bloc.indexOf('</View>'))).toContain('dernierScan')
  })

  it('ne reprend pas le focus derrière « Article inconnu »', () => {
    // Sinon le scan suivant se colle au code déjà saisi dans la feuille.
    const submit = scanner.slice(scanner.indexOf('async function handleHardwareSubmit'))
    expect(submit.slice(0, submit.indexOf('\n  }')))
      .toContain('if (illisibleRef.current === null) hwInputRef.current?.focus()')
    expect(scanner).toContain('autoFocus={illisibleCode === null}')
  })
})
