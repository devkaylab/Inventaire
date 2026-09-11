import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '@/i18n/en'
import { ERREURS_SERVEUR, PREFIXES, traduireErreurServeur } from '@/lib/erreursServeur'

// L'espace connecté du site parle anglais depuis le 10 septembre 2026 ; la
// vitrine, les e-mails, les PDF et les exports restent en français. Même
// contrat que l'application (`tests/i18n.test.ts` à la racine) : la phrase
// française est la clé, et une clé inconnue s'affiche en français.

const racine = path.resolve(__dirname, '..')
const depot = path.resolve(racine, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

function fichiers(dossier: string, ext = /\.tsx?$/): string[] {
  const out: string[] = []
  for (const nom of readdirSync(dossier)) {
    const p = path.join(dossier, nom)
    if (statSync(p).isDirectory()) { if (!['node_modules', '.next'].includes(nom)) out.push(...fichiers(p, ext)) }
    else if (ext.test(nom)) out.push(p)
  }
  return out
}

const normaliser = (s: string) => s.replace(/[  ]/g, ' ')
function decoder(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n')
}

function clesDemandees(): Map<string, string> {
  const motif = /(?<![\w.$])tn?\(\s*(['"])((?:\\.|(?!\1).)*?)\1/gs
  const cles = new Map<string, string>()
  for (const f of [...fichiers(path.join(racine, 'app')), ...fichiers(path.join(racine, 'components')), ...fichiers(path.join(racine, 'lib'))]) {
    if (f.endsWith(`lib${path.sep}i18n.tsx`)) continue
    const texte = readFileSync(f, 'utf8')
    for (const m of texte.matchAll(motif)) cles.set(normaliser(decoder(m[2])), path.relative(racine, f))
  }
  return cles
}

describe('l’espace connecté en anglais', () => {
  const dictionnaire = new Map(Object.entries(en).map(([k, v]) => [normaliser(k), v]))

  it('toute phrase demandée par t() ou tn() a sa traduction', () => {
    const manquantes = [...clesDemandees()]
      .filter(([cle]) => !dictionnaire.has(cle))
      .map(([cle, f]) => `${f} : ${JSON.stringify(cle)}`)
    expect(manquantes, manquantes.join('\n')).toEqual([])
  })

  it('une clé de tn() porte ses deux formes', () => {
    const src = [...fichiers(path.join(racine, 'app')), ...fichiers(path.join(racine, 'components')), ...fichiers(path.join(racine, 'lib'))]
      .map((f) => readFileSync(f, 'utf8')).join('\n')
    const pluriels = new Set<string>()
    for (const m of src.matchAll(/(?<![\w.$])tn\(\s*(['"])((?:\\.|(?!\1).)*?)\1/gs)) pluriels.add(normaliser(decoder(m[2])))
    const sansPluriel = [...pluriels].filter((k) => typeof dictionnaire.get(k) === 'string')
    expect(sansPluriel, `tn() attend { one, other } pour : ${sansPluriel.join(' · ')}`).toEqual([])
  })

  it('aucune traduction n’est vide, et chaque %{variable} traverse', () => {
    const defauts: string[] = []
    for (const [cle, val] of Object.entries(en)) {
      const formes = typeof val === 'string' ? [val] : [val.one, val.other]
      const vars = new Set([...cle.matchAll(/%\{(\w+)\}/g)].map((m) => m[1]))
      for (const forme of formes) {
        if (!forme.trim()) defauts.push(`vide : ${cle}`)
        for (const v of vars) if (!forme.includes(`%{${v}}`)) defauts.push(`%{${v}} perdu : ${cle}`)
      }
    }
    expect(defauts, defauts.join('\n')).toEqual([])
  })

  it('la langue se choisit sur le site (toggle) et dans Mon compte, et suit le navigateur par défaut', () => {
    const i18n = lire('lib/i18n.tsx')
    expect(i18n).toContain('navigator.language')
    expect(i18n).toContain('qlang')
    expect(lire('components/AppShell.tsx')).toContain('<LangueToggle')
    expect(lire('app/login/page.tsx')).toContain('<LangueToggle')
    expect(lire('app/account/page.tsx')).toContain('langue-choix')
    expect(lire('app/layout.tsx')).toContain('<LangueProvider')
  })

  it('les textes légaux restent en français, et le disent en anglais', () => {
    const note = lire('components/NoteVersionFrancaise.tsx')
    expect(note).toContain("langue === 'fr'")
    expect(note).toContain('la version française fait foi')
    expect(lire('app/mentions-legales/page.tsx')).toContain('<NoteVersionFrancaise />')
    expect(lire('app/confidentialite/page.tsx')).toContain('<NoteVersionFrancaise />')
  })

  it('le message d’erreur passe par la traduction avant l’écran', () => {
    const errors = lire('lib/errors.ts')
    expect(errors).toContain("from '@/lib/erreursServeur'")
    expect(errors).toContain('traduireErreurServeur(')
    expect(traduireErreurServeur('Accès refusé')).toBe('Access denied')
    expect(traduireErreurServeur('Accès refusé [42501]')).toBe('Access denied [42501]')
    expect(traduireErreurServeur('Une phrase inconnue')).toBe('Une phrase inconnue')
  })

  it('tout refus écrit par une fonction SQL a sa traduction', () => {
    // Les fonctions répondent `'error', 'Phrase'` : chaque phrase littérale
    // doit être connue, ou commencer par un préfixe (message concaténé).
    const refus = new Set<string>()
    const dossier = path.join(depot, 'supabase', 'migrations')
    for (const f of fichiers(dossier, /\.sql$/)) {
      const sql = readFileSync(f, 'utf8')
      for (const m of sql.matchAll(/'error'\s*,\s*'((?:[^']|'')+)'/g)) refus.add(m[1].replace(/''/g, "'"))
    }
    expect(refus.size).toBeGreaterThan(100)
    const inconnues = [...refus].filter((r) => !(r in ERREURS_SERVEUR) && !PREFIXES.some(([debut]) => r.startsWith(debut) || debut.startsWith(r)))
    expect(inconnues, inconnues.join('\n')).toEqual([])
  })
})
