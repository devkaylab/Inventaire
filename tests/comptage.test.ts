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
    const differe = ouverture.indexOf('const terminee = allowCreate || videe ? null : rangeeTerminee(code)')
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
    // ⚠️ **DEUX APPELS, ET DEUX SEULEMENT** — amendé le 8 septembre 2026,
    // pas affaibli. Ce que la garde défend n'a pas bougé : aucune écriture ne
    // court-circuite `materialiserOuverture`. Le second appel est celui
    // d'`annulerComptage`, qui DÉFAIT — il n'ouvre rien, et si aucune ligne
    // n'a été posée sa boucle ne tourne pas. Le faire passer par `enregistrer`
    // matérialiserait l'ouverture qu'on est justement en train d'annuler.
    const appelsDirects = scanner.match(/await onArticleResolved\(/g) ?? []
    expect(appelsDirects).toHaveLength(2)
    for (const fn of ['async function enregistrer', 'async function annulerComptage']) {
      const corps = scanner.slice(scanner.indexOf(fn), scanner.indexOf(fn) + 3200)
      expect(corps).toContain('await onArticleResolved(')
    }
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
  /**
   * ⚠️ **AMENDÉ LE 8 SEPTEMBRE 2026, PAS AFFAIBLI.** Le retour pose désormais
   * les trois issues (Julien : « annuler le compte/audit ou clôturer, avec un
   * troisième bouton ignorer »). Ce que la garde défend est intact : le
   * troisième bouton fait **rester**, il ne laisse pas partir en abandonnant
   * une balise ouverte — c'est l'impasse du 29 août.
   */
  it('le retour pose les trois issues, et n’en invente aucune', () => {
    expect(scanner).toContain('usePreventRemove(!!activeBalise && !sortieAutorisee')
    expect(scanner).toContain('void sortirDuComptage().then((partir) => {')
    expect(scanner).toContain('if (!partir) return')
    const sortie = scanner.slice(scanner.indexOf('async function sortirDuComptage'))
    const corps = sortie.slice(0, sortie.indexOf('\n  }\n'))
    // Les deux gestes réutilisent leur propre confirmation : deux dérivent.
    expect(corps).toContain('return closeBalise()')
    expect(corps).toContain('return annulerComptage()')
    // « Ignorer » RESTE sur l'écran — il ne laisse pas partir sans choisir.
    expect(corps).toContain('return false')
    expect(scanner).not.toContain("titre: 'Quitter le comptage ?'")
  })
})

/**
 * ⚠️ **UNE SEULE CARTE POUR ROUVRIR, QUEL QUE SOIT LE CHEMIN** (Julien,
 * 8 septembre 2026). Elle se pose au scan, à la saisie du numéro et depuis le
 * rang « Rouvrir » : rouvrir un rayon est le même acte, et trois questions
 * différentes pour un même acte apprennent à répondre sans lire.
 *
 * Le 7 septembre le scan n'en posait aucune ; le 25 août la liste avait la
 * sienne. Les deux ont fusionné.
 */
describe('rouvrir un rayon : une seule carte', () => {
  const scanner = lire('../src/components/scanner.tsx')

  it('le rang « Rouvrir » passe par la carte, il n’a plus la sienne', () => {
    expect(scanner).toContain('onPress={() => { void rouvrirDepuisListe(item) }}')
    const fonction = scanner.slice(scanner.indexOf('async function rouvrirDepuisListe'))
    const corps = fonction.slice(0, fonction.indexOf('\n  }\n'))
    expect(corps).toContain('await openBaliseCode(z.code, false)')
    // ⚠️ Plus de `sansAvertir` — il servait à NE PAS poser la carte depuis ce
    // rang. La garde porte sur la signature, pas sur les appels : `allowCreate`
    // s'y passe aussi en quatrième position d'un `true` légitime (l'ajout
    // d'une balise hors plage).
    expect(scanner).toContain(
      'code: string, closePrev: boolean, allowCreate = false,\n  ) {',
    )
  })

  it('la carte se pose avant toute écriture', () => {
    const fonction = scanner.slice(scanner.indexOf('async function openBaliseCode'))
    const carte = fonction.indexOf('const choix = await demanderChoix(')
    expect(carte).toBeGreaterThan(0)
    expect(carte).toBeLessThan(fonction.indexOf('await setBalise(sessionId, code'))
  })

  it('elle offre compléter, recompter à zéro, et ne pas ouvrir', () => {
    const fonction = scanner.slice(scanner.indexOf('async function openBaliseCode'))
    const carte = fonction.slice(fonction.indexOf('const choix = await demanderChoix('))
    expect(carte).toContain("action: compte ? t('Compléter le comptage') : t('Compléter l’audit')")
    expect(carte).toContain("alternative: compte ? t('Recompter à zéro') : t('Refaire l’audit à zéro')")
    expect(carte).toContain("annuler: t('Ne pas ouvrir')")
  })

  /**
   * ⚠️ Compléter à l'aveugle, c'est rescanner ce qui est déjà compté — donc
   * doubler, ce qu'un journal en ajout pur ne rattrape pas tout seul.
   */
  it('« Compléter » montre ce qui est déjà là', () => {
    const fonction = scanner.slice(scanner.indexOf('async function openBaliseCode'))
    expect(fonction).toContain('montrerListe = true')
    expect(fonction).toContain('if (montrerListe) setFeuilleScans(true)')
  })

  /**
   * Une balise terminée SANS aucune pièce : rien à compléter, rien à effacer.
   * La carte à trois choix n'aurait rien à proposer, mais rouvrir reste un
   * geste et il se confirme.
   */
  it('un rayon vide clôturé garde la question courte', () => {
    const fonction = scanner.slice(scanner.indexOf('async function openBaliseCode'))
    expect(fonction).toContain('if (rangeeTerminee(code) && !(await confirmerReouverture(code))) return')
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
    expect(scanner).toContain("titre: t('Clôturer la balise %{code} ?', { code: active.code })")
    expect(scanner).toContain("action: t('Clôturer')")
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
    const question = cloture.indexOf("titre: t('Clôturer la balise %{code} ?'")
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
    const bloc = scanner.split("t('Clôturer la balise %{code} ?'")[1]?.slice(0, 900) ?? ''
    expect(bloc).toContain("ton: 'danger'")
    expect(bloc).toContain("surtitre: t('Confirmation')")
  })
})

/**
 * ⚠️ La douchette valide sur son suffixe « Entrée », et rien d'autre.
 *
 * Une temporisation de « fin de rafale » a été écrite le 31 août 2026 sur un
 * diagnostic faux : le champ gardait son texte, j'en avais conclu que le scan
 * n'était pas soumis — il l'était, la base le disait. Elle a été retirée le
 * jour même, parce qu'elle **couperait un code en deux** dès qu'une douchette
 * marque un temps au milieu de sa transmission, et fabriquerait un article
 * inconnu à partir d'un code valide. Ne pas la réintroduire sans preuve qu'un
 * suffixe manque vraiment.
 */
describe('la douchette valide sur son suffixe, et rien d’autre', () => {
  const scanner = lire('../src/components/scanner.tsx')

  it('aucune validation par minuterie', () => {
    const frappe = scanner.slice(scanner.indexOf('function frappeDouchette'))
    const corps = frappe.slice(0, frappe.indexOf('\n  }'))
    expect(corps).not.toContain('setTimeout')
    expect(scanner).toContain('onSubmitEditing={handleHardwareSubmit}')
  })

  it('un suffixe reçu comme caractère vaut quand même validation', () => {
    // Certaines douchettes envoient CR dans le texte plutôt qu'en touche.
    const frappe = scanner.slice(scanner.indexOf('function frappeDouchette'))
    expect(frappe.slice(0, frappe.indexOf('\n  }'))).toMatch(/test\(t\)[\s\S]*handleHardwareSubmit/)
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
    const corps = vider.slice(0, vider.indexOf('\n  }'))
    expect(corps).toContain('setHwSeq(n => n + 1)')
    expect(corps).toContain("hwBufRef.current = ''")
    // Et toute validation passe par là, avant même le garde du champ vide.
    const submit = scanner.slice(scanner.indexOf('async function handleHardwareSubmit'))
    expect(submit.slice(0, submit.indexOf('if (!brut.trim())'))).toContain('viderChampDouchette()')
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

/**
 * « Article inconnu » sans réseau.
 *
 * Constat de Julien, 1er septembre 2026, capture à l'appui sur les deux
 * plateformes : saisir un article absent du référentiel en réserve répondait
 * « fetch failed » (`UnknownHostException` sur Android, « The Internet
 * connection appears to be offline » sur iOS). L'écran de scan appelait
 * `queries.insertArticle` en direct — la seule écriture du comptage restée
 * hors de la couche hors ligne.
 */
describe('« Article inconnu » passe par la couche hors ligne', () => {
  const scanner = lire('../src/components/scanner.tsx')
  const sansCommentaires = scanner.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('importe insertArticle depuis offlineSync, jamais depuis queries', () => {
    // ⚠️ Sur le code SEUL : le commentaire du fichier raconte le défaut, donc
    // cite les deux modules.
    const depuisQueries = sansCommentaires.match(/import \{([^}]*)\} from '@\/lib\/queries'/)
    expect(depuisQueries).not.toBeNull()
    expect(depuisQueries![1]).not.toContain('insertArticle')
    expect(sansCommentaires).toMatch(/import \{[^}]*insertArticle[^}]*\} from '@\/lib\/offlineSync'/)
  })

  it('donne à la modale la balise ouverte, pour que l’article parte avec ses comptages', () => {
    expect(sansCommentaires).toContain('zone={activeBalise?.code ?? null}')
    expect(sansCommentaires).toMatch(/unit_purchase_price: 0,\s*\}, zone\)/)
  })

  it('n’écrit aucun prix d’achat depuis le comptage', () => {
    // La borne serveur (`articles_insert_member`) exige `unit_purchase_price =
    // 0` : un compteur constate une présence, pas une valeur. Un champ prix
    // ajouté ici serait refusé en 42501, sans rien pour l'expliquer à l'écran.
    expect(sansCommentaires).toContain('unit_purchase_price: 0')
  })
})

/**
 * Le serveur laisse un compteur créer cet article — il ne le laissait pas.
 *
 * Avant la migration du 2 septembre 2026, `articles` n'avait qu'une policy
 * d'écriture, réservée aux superviseurs : un compteur recevait `42501`, **même
 * en ligne**. La fonctionnalité était donc inatteignable pour le rôle à qui
 * elle est destinée, et le hors ligne n'a fait que déplacer l'échec.
 */
describe('un compteur peut créer l’article qu’il scanne', () => {
  const migration = lire(
    '../supabase/migrations/20260902100001_article_inconnu_par_le_compteur.sql',
  )
  const sql = migration.replace(/^--.*$/gm, '')

  it('ouvre l’INSERT seulement — le fichier du superviseur ne se récrit pas', () => {
    expect(sql).toContain('FOR INSERT')
    expect(sql).not.toMatch(/FOR (ALL|UPDATE|DELETE)/)
  })

  it('exige l’appartenance à l’inventaire et un inventaire ouvert', () => {
    expect(sql).toContain('session_members')
    expect(sql).toContain("s.status <> 'closed'")
  })

  it('interdit d’y poser un prix d’achat', () => {
    expect(sql).toContain('unit_purchase_price = 0')
  })
})

/**
 * La liste des scans d'une balise, sans réseau.
 *
 * Deux défauts trouvés en relisant le hors ligne le 2 septembre 2026, sur
 * l'écran même où « Article inconnu » échouait :
 *
 *  1. la liste venait du serveur seul — vide en réserve, alors que ce sont ses
 *     lignes que les boutons « + / − » corrigent ;
 *  2. l'échec ne vidait rien : passer de la balise A à la balise B laissait les
 *     scans de A affichés sous B, et un « − » posé là écrivait une correction
 *     négative dans B pour un article compté en A.
 */
describe('la liste des scans se reconstruit hors ligne', () => {
  const scanner = lire('../src/components/scanner.tsx')
  const employe = lire('../src/app/(employee)/[sessionId]/scan.tsx')
  const superviseur = lire('../src/app/(supervisor)/[sessionId]/scan.tsx')
  const sync = lire('../src/lib/offlineSync.ts')
  const nu = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('aucun écran n’appelle plus getMyScanEntries en direct', () => {
    for (const f of [scanner, employe, superviseur]) expect(nu(f)).not.toContain('getMyScanEntries')
  })

  it('un échec vide la liste au lieu de garder celle de la balise précédente', () => {
    expect(nu(scanner)).toContain('.catch(() => { if (!cancelled) setRecentScans([]) })')
  })

  it('la file d’attente complète la réponse du serveur, en ligne comme hors ligne', () => {
    const corps = sync.slice(sync.indexOf('export async function getScanEntries'))
    const bloc = corps.slice(0, corps.indexOf('\nexport '))
    expect(bloc).toContain('off.pendingCounts(sessionId)')
    // Les lignes en attente sont lues quoi qu'il arrive : elles ne sont pas
    // dans la branche `if (!offline)`.
    expect(bloc.indexOf('off.pendingCounts')).toBeGreaterThan(bloc.indexOf('if (!offline)'))
    expect(bloc).toMatch(/return \[\.\.\.agg\.values\(\)\]\.filter\(\(e\) => e\.qty > 0\)/)
  })

  it('les deux écrans de scan lisent la fiche d’inventaire depuis le cache', () => {
    // ⚠️ Le superviseur compte lui aussi : sur `@/lib/queries`, `getSession`
    // rendait null hors ligne et l'écran (`if (!session) return null`) restait
    // blanc.
    for (const f of [employe, superviseur]) {
      expect(nu(f)).toMatch(/import \{[^}]*getSession[^}]*\} from '@\/lib\/offlineSync'/)
      const q = nu(f).match(/import \{([^}]*)\} from '@\/lib\/queries'/)
      if (q) expect(q[1]).not.toContain('getSession')
    }
  })
})

/**
 * Revenir du comptage montre ce qu'on vient de compter.
 *
 * Constaté sur le Pixel le 7 septembre 2026 : deux pièces scannées, retour sur
 * la fiche de l'inventaire, « 0 pièce comptée ». Les pièces étaient en base —
 * c'est le cache de la requête, chargée au montage. Or les deux fiches restent
 * MONTÉES sous l'écran de scan (`router.push`), donc rien ne les relit.
 */
describe('revenir du comptage rafraîchit la progression', () => {
  const hook = lire('../src/hooks/useRetourSurEcran.ts')

  /**
   * ⚠️ La liste des écrans se DÉDUIT, elle ne se cite pas.
   *
   * On retient ceux qui ouvrent l'écran de scan : ce sont exactement ceux qui
   * restent montés dessous, donc ceux qui peuvent afficher un total périmé.
   * Un troisième écran qui mènerait au comptage demain se signalera de
   * lui-même — une garde qui nommerait les deux fiches d'aujourd'hui ne
   * protégerait que celles-là.
   */
  const ecransQuiMenentAuScan = ['(supervisor)/[sessionId]/index.tsx', '(employee)/[sessionId]/index.tsx']
    .filter((f) => /router\.push\(`?\/?\(?\w*\)?[^)]*scan/.test(lire(`../src/app/${f}`)))

  it('⚠️ chaque écran qui ouvre le comptage se relit au retour', () => {
    expect(ecransQuiMenentAuScan.length, 'aucun écran ne mène au scan : la détection est cassée')
      .toBeGreaterThan(0)
    for (const f of ecransQuiMenentAuScan) {
      expect(lire(`../src/app/${f}`), `${f} garde son total d’avant le comptage`)
        .toContain('useRetourSurEcran(')
    }
  })

  it('⚠️ mais PAS au premier affichage', () => {
    // `useFocusEffect` se déclenche aussi au montage : sans ce garde-fou,
    // chaque ouverture d'écran ferait deux allers-retours au serveur pour la
    // même réponse.
    //
    // ⚠️ La garde lit le hook SANS ses commentaires — celui du fichier cite
    // « premier passage » pour l'expliquer — et surtout elle vérifie que les
    // deux repères EXISTENT avant de comparer leurs positions : un
    // `indexOf` rend -1 sur ce qui a disparu, et -1 est inférieur à tout.
    // C'est ce qui a laissé passer le premier sabotage.
    const nu = hook.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
    const corps = nu.slice(nu.indexOf('useFocusEffect('))
    const saut = corps.indexOf('premierPassage.current = false')
    const appel = corps.indexOf('faire()')
    expect(saut, 'le premier passage n’est plus consommé : chaque écran recharge deux fois')
      .toBeGreaterThan(-1)
    expect(appel, 'le hook n’appelle plus rien').toBeGreaterThan(-1)
    expect(saut).toBeLessThan(appel)
    // Et il rend la main avant, sinon le premier passage déclenche quand même.
    expect(corps.slice(saut, appel)).toContain('return')
  })

  it('⚠️ la fiche du superviseur rejoue son rafraîchissement, sans seconde liste de clés', () => {
    // Deux énumérations du même trio de requêtes divergeraient au premier
    // onglet ajouté.
    expect(lire('../src/app/(supervisor)/[sessionId]/index.tsx'))
      .toContain('useRetourSurEcran(manualRefresh)')
  })
})

/**
 * « Annuler » — la sortie qui n'enregistre rien.
 *
 * Demande de Julien, 8 septembre 2026 : *« ajouter un bouton annuler qui
 * n'enregistre rien, qui n'efface rien »*. L'écran n'offrait qu'une sortie —
 * clôturer —, et clôturer ANNONCE un rayon fini. Quelqu'un qui ouvre la
 * mauvaise balise n'avait donc aucun geste juste.
 */
describe('annuler un comptage', () => {
  const scanner = lire('../src/components/scanner.tsx')
  const corps = scanner.slice(
    scanner.indexOf('async function annulerComptage'),
    scanner.indexOf('  // ── Clôture la zone ouverte'),
  )
  /**
   * ⚠️ **SANS LES COMMENTAIRES.** Quatorzième fois sur ce dépôt : la fonction
   * EXPLIQUE qu'elle n'appelle pas `viderBalise` — donc elle écrit le mot, et
   * la garde d'absence se lit elle-même.
   */
  const nu = corps.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  it('le bandeau n’a plus de bouton — il annonce, il n’agit pas', () => {
    // ⚠️ Doublon retiré le 8 septembre : le même geste à deux endroits de
    // l'écran, l'un compact en haut et l'autre pleine largeur en bas, fait
    // douter qu'il s'agisse du même.
    const bandeau = scanner.slice(
      scanner.indexOf('Zone ouverte · '),
      scanner.indexOf('styles.zoneBannerIdle'),
    )
    expect(bandeau).not.toContain('closeBalise()')
    expect(bandeau).not.toContain('Clôturer')
  })

  it('les deux sorties vivent en pied, et « Annuler » ne pèse pas autant', () => {
    expect(scanner).toContain("t('Clôturer la balise %{code}', { code: activeBalise.code })")
    expect(scanner).toMatch(/\{baliseMode === 'count' \? t\('Annuler le comptage'\) : t\('Annuler l’audit'\)\}/)
    // ⚠️ En contour : deux aplats côte à côte se disputent le regard, et c'est
    // le geste normal — clôturer — qui perdrait.
    const style = scanner.slice(scanner.indexOf('cancelFooterBtn: {'))
    expect(style.slice(0, 300)).toContain('borderWidth: 1')
    expect(style.slice(0, 300)).not.toContain('backgroundColor')
  })

  /**
   * ⚠️ **LA BORNE QUE JULIEN A POSÉE LUI-MÊME** : *« on ne touche jamais au
   * comptage d'avant ni à celui d'un collègue »*. C'est ce qui sépare
   * « Annuler » de « Recompter à zéro ».
   */
  it('ne défait que ce que CET appareil a écrit depuis l’ouverture', () => {
    expect(corps).toContain('const aDefaire = scansSessionRef.current')
    // Le suivi s'alimente dans `enregistrer` — le passage obligé de toute
    // écriture — et se vide à chaque ouverture comme à chaque fermeture.
    expect(scanner).toContain('scansSessionRef.current.push({ article, qty })')
    expect(scanner.match(/scansSessionRef\.current = \[\]/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
    // Jamais `viderBalise` : celle-là efface pour toute l'équipe.
    expect(nu).not.toContain('viderBalise')
  })

  it('écrit des lignes négatives, il ne supprime pas', () => {
    // `counts` est un journal en ajout pur : une correction y est une ligne de
    // plus. C'est déjà ce qu'écrit le « − » de la liste.
    expect(corps).toContain('await onArticleResolved(e.article, -e.qty, active.code)')
  })

  /**
   * ⚠️ **LA ZONE D'ABORD, LES LIGNES ENSUITE.** `annulerBalise` part en direct
   * (pas de file d'attente, comme `viderBalise`) : sans réseau elle échoue, et
   * dans cet ordre rien n'a encore été touché. L'ordre inverse laisserait un
   * comptage à moitié défait dans une balise restée ouverte.
   */
  it('remet la zone avant de défaire les lignes', () => {
    const zone = corps.indexOf('await annulerBalise(sessionId, active.code')
    const lignes = corps.indexOf('await onArticleResolved(e.article, -e.qty')
    expect(zone).toBeGreaterThan(0)
    expect(zone).toBeLessThan(lignes)
  })

  /**
   * ⚠️ **PAS TOUJOURS « À FAIRE ».** Une balise qu'on rouvrait pour compléter
   * doit REDEVENIR TERMINÉE : la remettre à faire la décompterait, et c'est le
   * défaut du 25 août. Seule une balise qui était à faire redevient à faire.
   */
  it('ramène la balise à l’état qu’elle avait à l’ouverture', () => {
    expect(scanner).toContain("etatAvantRef = useRef<'pending' | 'done'>('pending')")
    expect(corps).toContain("const revientA = etatAvantRef.current")
    expect(corps).toContain("revientA === 'done'")
    expect(corps).toContain('await setBalise(sessionId, active.code, baliseModeRef.current, false)')
    // Une ouverture différée jamais matérialisée n'a rien écrit côté serveur.
    expect(corps).toContain('if (!ouvertureDiffereeRef.current) {')
  })

  it('et il se confirme, comme la clôture', () => {
    expect(corps).toContain("t('Annuler le comptage de la balise %{code} ?'")
    expect(corps).toContain("ton: 'danger'")
    expect(corps).toContain('Rien ne sera enregistré')
    // Le refus dit « Continuer » : deux « Annuler » dans la même carte ne se
    // distinguent pas l'un de l'autre.
    expect(corps).toContain("annuler: t('Continuer')")
    expect(corps.indexOf('await demander(')).toBeLessThan(zoneOuLignes(corps))
  })
})

/** La première écriture d'`annulerComptage`, quelle qu'elle soit. */
function zoneOuLignes(corps: string): number {
  return Math.min(
    ...['await annulerBalise(', 'await setBalise(', 'await onArticleResolved(']
      .map((m) => corps.indexOf(m))
      .filter((i) => i > 0),
  )
}
