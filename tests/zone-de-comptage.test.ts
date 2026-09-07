// Zone de comptage : une question, puis UNE chose à la fois (7 septembre 2026).
//
// L'écran s'ouvrait sur « Créer des balises » — une explication, trois étapes
// numérotées, un bouton d'impression — et l'affectation seulement en dessous.
// Quelqu'un dont les balises sont déjà collées traversait tout cela pour rien.
// Constat de Julien : « au lieu d'afficher le gros pavé de texte créer des
// balises directement, proposer une question "Ai-je mes balises ?" […] ne pas
// tout afficher en même temps, plus clair pour l'user. »
//
// Maquette validée avant codage :
// https://claude.ai/code/artifact/71d4ba82-021f-4174-b96b-a084c422e6c5
//
// ⚠️ Ces gardes ont leur jumelle côté site (`web/tests/zone-de-comptage.test.ts`) :
// c'est le même geste sur les deux surfaces, il doit se lire pareil.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const lire = (p: string) => readFileSync(path.join(here, '..', 'src', p), 'utf8')

/** Le code sans ses commentaires — une garde d'absence se lirait elle-même. */
const code = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')

const zones = lire('app/(supervisor)/[sessionId]/zones.tsx')
const createur = lire('components/BaliseCreator.tsx')

describe('la question passe devant', () => {
  it('⚠️ les trois états s’excluent — rien ne s’affiche en même temps', () => {
    // C'est toute la demande : une seule chose à l'écran. Trois blocs sous
    // trois conditions exclusives, jamais deux ouverts à la fois.
    const c = code(zones)
    for (const etat of ['question', 'creer', 'affecter']) {
      expect(c, `l’étape « ${etat} » n’a pas sa condition`)
        .toContain(`etape === '${etat}'`)
    }
    // La création n'est plus posée d'office en tête d'écran.
    expect(c, 'la création de balises s’affiche encore sans condition')
      .not.toMatch(/\{!closed && <BaliseCreator/)
  })

  it('⚠️ elle ne se pose que tant que RIEN n’est affecté', () => {
    // Leçon du bandeau de démarrage (28 août 2026) : une aide qui se rejoue
    // des semaines plus tard, à quelqu'un qui connaît le produit, cesse d'en
    // être une. Dès qu'un emplacement existe, la réponse est connue.
    const c = code(zones)
    expect(c).toContain('const dejaAffecte = groups.length > 0')
    expect(c).toContain("const etape = choix ?? (dejaAffecte ? 'affecter' : 'question')")
  })

  it('⚠️ la réponse ne se retient NULLE PART', () => {
    // L'inventaire répond tout seul. Quelqu'un qui répond « Non », imprime sa
    // planche et revient le lendemain retrouve la question — et c'est juste,
    // il peut maintenant répondre « Oui ». Un jalon ou un repère figerait cette
    // réponse pour de bon, sur un fait qui change.
    const c = code(zones)
    for (const persistance of ['poserJalon', 'AsyncStorage', 'useJalon', 'marquerRepereVu']) {
      expect(c, `${persistance} figerait une réponse qui doit rester vivante`)
        .not.toContain(persistance)
    }
  })

  it('⚠️ la question ne s’accompagne d’aucun état vide', () => {
    // « Aucun emplacement affecté. Indiquez une première plage ci-dessus »
    // désignerait deux boutons qui ne demandent aucune plage.
    expect(code(zones)).toContain("{groups.length === 0 && (closed || etape === 'affecter') && (")
  })

  it('⚠️ la création dit ce qui vient après, elle ne s’arrête pas au PDF', () => {
    // Imprimer n'est pas l'objectif, c'est l'avant-dernière étape. Sans cette
    // sortie on repart avec un PDF sans savoir qu'il reste à dire où les
    // balises sont collées.
    const c = code(createur)
    expect(c).toContain('onAffecter')
    expect(c).toContain('Affecter mes balises')
    expect(c).toContain('Une fois les balises collées')
    // Et la troisième étape ne renvoie plus « ci-dessous » : l'affectation
    // n'est plus sous la carte, c'est l'écran suivant.
    expect(c, 'la troisième étape désigne encore un bloc qui n’est plus là')
      .not.toContain('ci-dessous quelles balises')
  })

  it('⚠️ sur le profil, la création n’a NI retour NI suite', () => {
    // On y imprime des balises sans inventaire en vue : il n'y a pas de
    // question à laquelle revenir, ni de plage à affecter.
    expect(code(createur)).toContain("context === 'zones'")
    expect(code(zones)).toContain('onRetour={dejaAffecte ? undefined : () => setChoix(null)}')
  })
})

describe('une seule balise', () => {
  it('⚠️ la bascule remplace les deux champs par un seul', () => {
    const c = code(zones)
    expect(c).toContain('const [unique, setUnique] = useState(false)')
    expect(c).toContain('Une seule balise')
    expect(c).toContain('onValueChange={setUnique}')
    // Le libellé du champ suit la bascule.
    expect(c).toContain('Balise fin')
    expect(c).toMatch(/unique \? \(/)
  })

  it('⚠️ côté serveur, une balise seule est une plage de UN', () => {
    // `define_zone` ne connaît que les plages, et n'a pas à connaître autre
    // chose : la bascule est une affaire d'écran. Rien en base ne change.
    const c = code(zones)
    expect(c).toContain('unique ? s : parseInt(end, 10)')
    expect(c, 'aucune RPC nouvelle pour un cas qui n’en demande pas')
      .not.toMatch(/define_balise|define_zone_unique/)
  })

  it('⚠️ le message de saisie suit le champ qu’on a sous les yeux', () => {
    // « Saisissez une balise de début et de fin » devant un seul champ ferait
    // chercher le second.
    const c = code(zones)
    expect(c).toContain('Saisissez le numéro de la balise.')
    expect(c).toContain('Saisissez une balise de début et de fin.')
  })

  it('⚠️ les cartes de choix se touchent, donc elles sont rondes', () => {
    // La garde de `tests/ardoise-app.test.ts` le déduit du nom du style ; on
    // le fige aussi ici, parce que c'est une règle de dessin qu'on pourrait
    // défaire en « harmonisant » avec les blocs voisins.
    expect(code(zones)).toMatch(/choix: \{[^}]*borderRadius: Radius\.bouton/)
  })
})
