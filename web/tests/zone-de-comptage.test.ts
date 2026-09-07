// Zone de comptage : une question, puis UNE chose à la fois (7 septembre 2026).
//
// Le volet s'ouvrait sur « Créer des balises » — un paragraphe d'explication,
// trois étapes numérotées, un choix de numérotation, deux champs, un bouton —
// et l'affectation seulement en dessous. Quelqu'un dont les balises sont déjà
// collées traversait tout cela pour rien. Constat de Julien : « ne pas tout
// afficher en même temps, plus clair pour l'user ».
//
// Maquette validée avant codage :
// https://claude.ai/code/artifact/71d4ba82-021f-4174-b96b-a084c422e6c5
//
// ⚠️ Ces gardes ont leur jumelle côté application (`tests/zone-de-comptage.test.ts`) :
// c'est le même geste sur les deux surfaces, il doit se lire pareil.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateRange } from '../lib/zones'

const racine = path.join(__dirname, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

/** Le code sans ses commentaires — une garde d'absence se lirait elle-même. */
const code = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

const setup = lire('components/dashboard/tabs/SetupTab.tsx')
const planche = lire('components/BaliseSheetPanel.tsx')
const css = lire('app/globals.css')

/** Les requêtes média d'une largeur donnée : où elles commencent, et leur corps. */
function blocsMedia(largeur: string): { debut: number; corps: string }[] {
  const out: { debut: number; corps: string }[] = []
  let i = css.indexOf(`@media (max-width: ${largeur})`)
  while (i !== -1) {
    // On s'arrête à la première accolade qui referme le bloc, en comptant.
    let profondeur = 0
    let j = css.indexOf('{', i)
    const debut = j
    for (; j < css.length; j++) {
      if (css[j] === '{') profondeur++
      else if (css[j] === '}' && --profondeur === 0) break
    }
    out.push({ debut: i, corps: css.slice(debut, j) })
    i = css.indexOf(`@media (max-width: ${largeur})`, j)
  }
  return out
}

describe('la question passe devant', () => {
  it('⚠️ les trois états s’excluent — rien ne s’affiche en même temps', () => {
    const c = code(setup)
    for (const etat of ['question', 'creer', 'affecter']) {
      expect(c, `l’étape « ${etat} » n’a pas sa condition`)
        .toContain(`etape === '${etat}'`)
    }
    // La planche n'est plus posée d'office en tête de volet.
    expect(c, 'la création de balises s’affiche encore sans condition')
      .not.toContain('{!readOnly && <BaliseSheetPanel context="setup" />}')
  })

  it('⚠️ elle ne se pose que tant que RIEN n’est affecté', () => {
    // Leçon du bandeau de démarrage (28 août 2026) : une aide qui se rejoue
    // des semaines plus tard, à quelqu'un qui connaît le produit, cesse d'en
    // être une.
    const c = code(setup)
    expect(c).toContain('const dejaAffecte = groups.length > 0')
    expect(c).toContain("const etape = choix ?? (dejaAffecte ? 'affecter' : 'question')")
  })

  it('⚠️ la réponse ne se retient NULLE PART', () => {
    // L'inventaire répond tout seul : rien n'est stocké. Quelqu'un qui répond
    // « Non », télécharge sa planche et revient le lendemain retrouve la
    // question — et c'est juste, il peut maintenant répondre « Oui ».
    const c = code(setup)
    for (const persistance of ['localStorage', 'sessionStorage', 'document.cookie']) {
      expect(c, `${persistance} figerait une réponse qui doit rester vivante`)
        .not.toContain(persistance)
    }
  })

  it('⚠️ la question ne s’accompagne d’aucun état vide', () => {
    // « Indiquez une première plage de balises ci-dessus » désignerait deux
    // boutons qui ne demandent aucune plage.
    expect(code(setup)).toContain("(readOnly || etape === 'affecter') && (")
  })

  it('⚠️ un inventaire clôturé n’a ni question, ni formulaire, ni création', () => {
    // Les trois blocs sont sous `!readOnly` : il n'y a plus rien à faire là,
    // seule la liste des emplacements reste.
    const c = code(setup)
    for (const etat of ['question', 'creer', 'affecter']) {
      expect(c, `l’étape « ${etat} » s’affiche sur un inventaire clôturé`)
        .toContain(`{!readOnly && etape === '${etat}'`)
    }
  })

  it('⚠️ la création dit ce qui vient après, elle ne s’arrête pas au PDF', () => {
    const c = code(planche)
    expect(c).toContain('onAffecter')
    expect(c).toContain('Affecter mes balises')
    expect(c).toContain('Une fois les balises collées')
    // La troisième étape ne renvoie plus « juste en dessous » : l'affectation
    // n'est plus sous la carte, c'est l'écran suivant.
    expect(c, 'la troisième étape désigne encore un bloc qui n’est plus là')
      .not.toContain('juste en dessous')
  })

  it('⚠️ sur « Mon compte », la planche n’a NI retour NI suite', () => {
    // On y imprime des balises sans inventaire en vue : pas de question à
    // laquelle revenir, pas de plage à affecter. Les deux sorties sont
    // facultatives, et l'appel de `/account` ne les passe pas.
    expect(code(planche)).toMatch(/onRetour\?: \(\) => void/)
    expect(code(planche)).toMatch(/onAffecter\?: \(\) => void/)
    expect(code(lire('app/outils/page.tsx')))
      .toContain('<BaliseSheetPanel context="account" />')
  })
})

describe('une seule balise', () => {
  it('⚠️ la bascule remplace les deux champs par un seul', () => {
    const c = code(setup)
    expect(c).toContain('const [unique, setUnique] = useState(false)')
    expect(c).toContain('Une seule balise')
    expect(c).toContain('aria-checked={unique}')
    expect(c).toContain('role="switch"')
    // Le libellé du champ suit la bascule, et le second champ disparaît.
    expect(c).toContain("{unique ? 'Balise' : 'Balise début'}")
    expect(c).toContain('{!unique && (')
  })

  it('⚠️ côté serveur, une balise seule est une plage de UN', () => {
    // `define_zone` ne connaît que les plages, et n'a pas à connaître autre
    // chose : la bascule est une affaire d'écran. Rien en base ne change.
    const c = code(setup)
    expect(c).toContain('const fin = unique ? start : end')
    expect(c).toContain('defineZoneRange(sessionId, name.trim(), Number(start), Number(fin))')
    expect(c, 'aucune RPC nouvelle pour un cas qui n’en demande pas')
      .not.toMatch(/define_balise|define_zone_unique/)
  })

  it('⚠️ le message de saisie suit le champ qu’on a sous les yeux', () => {
    // « Indiquez la première et la dernière balise » devant un seul champ
    // ferait chercher le second.
    expect(validateRange('Réserve', '', '', true)).toBe('Indiquez le numéro de la balise.')
    expect(validateRange('Réserve', '', '', false))
      .toBe('Indiquez la première et la dernière balise de la plage.')
    // Et le reste des règles ne bouge pas : une balise seule passe.
    expect(validateRange('Réserve', '42', '42', true)).toBeNull()
    expect(validateRange('', '42', '42', true)).toContain("nom de l'emplacement")
  })

  it('⚠️ la rangée à un champ se casse aussi sur un écran étroit', () => {
    // ⚠️ MESURÉ AU NAVIGATEUR, ET LA PREMIÈRE VERSION DE CETTE GARDE N'A RIEN
    // VU. Elle vérifiait seulement que `.zone-form-unique` était citée dans
    // les requêtes média — ce qui était vrai, et ne suffisait pas : les deux
    // sélecteurs ont la MÊME spécificité, donc la déclaration posée plus bas
    // dans la feuille gagne à toutes les largeurs. À 760 px la rangée gardait
    // ses trois colonnes. C'est l'ORDRE qui tranche, pas la présence.
    //
    // Mesures après correction : 1280 → 3 colonnes, 850 → 2, 760 → 1.
    const declaration = css.indexOf('.zone-form-unique { grid-template-columns:')
    expect(declaration, 'la règle de base de .zone-form-unique a disparu').toBeGreaterThan(-1)

    for (const largeur of ['900px', '780px']) {
      const bloc = blocsMedia(largeur).find(b => b.corps.includes('.zone-form'))
      expect(bloc, `aucune règle de .zone-form sous ${largeur}`).toBeDefined()
      expect(bloc!.corps, `.zone-form-unique n'est pas citée avec sa base sous ${largeur}`)
        .toContain('.zone-form, .zone-form-unique')
      expect(declaration, `la règle de base est APRÈS la requête ${largeur} : elle la bat`)
        .toBeLessThan(bloc!.debut)
    }
  })

  it('⚠️ les boutons de la question ne se posent pas sur --surface-2', () => {
    // En thème clair `--surface-2` vaut #ffffff, donc exactement le fond du
    // volet : le bouton y disparaîtrait. Piège déjà payé cinq fois (champs du
    // 22 août, dates du rapport magasin, champ du panneau, en-tête du tableau
    // d'équipe). Pour un fond en retrait, c'est `--bg`.
    // ⚠️ La garde lit le CSS SANS ses commentaires : celui de ce bloc cite
    // `--surface-2` précisément pour dire qu'on ne s'en sert pas. Neuvième
    // variante du même piège sur ce dépôt.
    const cssNu = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
    const bloc = cssNu.slice(cssNu.indexOf('.zone-choix button {'), cssNu.indexOf('.zone-choix button:hover'))
    expect(bloc).toContain('background: var(--bg)')
    expect(bloc).not.toContain('--surface-2')
  })
})
