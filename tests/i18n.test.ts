import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { en } from '../src/i18n/en'

// L'application parle anglais depuis le 10 septembre 2026, à la demande de
// Julien. La phrase française est la clé (`t('…')`), le dictionnaire rend
// l'anglais, et une clé inconnue s'affiche en français — jamais un trou.
// Ces gardes tiennent le contrat : tout ce que l'écran demande à `t()` doit
// avoir sa traduction, et les refus du serveur se lisent des deux côtés.

const here = path.dirname(fileURLToPath(import.meta.url))
const racine = path.join(here, '..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')

function fichiers(dossier: string): string[] {
  const out: string[] = []
  for (const nom of readdirSync(dossier)) {
    const p = path.join(dossier, nom)
    if (statSync(p).isDirectory()) out.push(...fichiers(p))
    else if (/\.tsx?$/.test(nom)) out.push(p)
  }
  return out
}

/** Les mêmes normalisations que `t()` : les espaces insécables valent une espace. */
const normaliser = (s: string) => s.replace(/[  ]/g, ' ')

/** Décode un littéral JS/TS tel qu'il est écrit dans la source. */
function decoder(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n')
}

/**
 * Toutes les clés passées en littéral à `t()` ou `tn()` (le singulier) dans
 * `src/`. Une clé calculée (`t(STATUS_LABELS[x])`) n'est pas vue ici : ses
 * valeurs sont ajoutées au dictionnaire à la main, et l'écran retombe sur le
 * français si l'une manque.
 */
function clesDemandees(): Map<string, string> {
  const motif = /(?<![\w.$])tn?\(\s*(['"])((?:\\.|(?!\1).)*?)\1/gs
  const cles = new Map<string, string>()
  for (const f of fichiers(path.join(racine, 'src'))) {
    if (f.includes(`${path.sep}i18n${path.sep}`) || f.endsWith(`lib${path.sep}i18n.ts`)) continue
    const texte = readFileSync(f, 'utf8')
    for (const m of texte.matchAll(motif)) {
      cles.set(normaliser(decoder(m[2])), path.relative(racine, f))
    }
  }
  return cles
}

describe('l’application en anglais', () => {
  const dictionnaire = new Map(Object.entries(en).map(([k, v]) => [normaliser(k), v]))

  it('toute phrase demandée par t() ou tn() a sa traduction', () => {
    const manquantes = [...clesDemandees()]
      .filter(([cle]) => !dictionnaire.has(cle))
      .map(([cle, f]) => `${f} : ${JSON.stringify(cle)}`)
    expect(manquantes, manquantes.join('\n')).toEqual([])
  })

  it('une clé de tn() porte ses deux formes, une clé de t() une seule', () => {
    const src = fichiers(path.join(racine, 'src'))
      .filter((f) => !f.includes(`${path.sep}i18n${path.sep}`))
      .map((f) => readFileSync(f, 'utf8')).join('\n')
    const pluriels = new Set<string>()
    for (const m of src.matchAll(/(?<![\w.$])tn\(\s*(['"])((?:\\.|(?!\1).)*?)\1/gs)) {
      pluriels.add(normaliser(decoder(m[2])))
    }
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

  it('les refus du serveur se traduisent pareil dans l’app et sur le site', () => {
    const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const app = sansCommentaires(lire('src/lib/erreursServeur.ts'))
    const web = sansCommentaires(lire('web/lib/erreursServeur.ts'))
    expect(app).toBe(web)
  })

  it('le message d’erreur passe par la traduction avant l’écran', () => {
    const errors = lire('src/lib/errors.ts')
    expect(errors).toContain("from '@/lib/erreursServeur'")
    expect(errors).toContain('traduireErreurServeur(')
  })

  it('la langue suit l’appareil, et se change depuis Mon compte', () => {
    const appareil = lire('src/lib/langueAppareil.ts')
    expect(appareil).toContain('expo-localization')
    expect(appareil).toContain('ui.langue.v1')
    const compte = lire('src/app/(compte)/account.tsx')
    expect(compte).toContain("'/(compte)/langue'")
    const layout = lire('src/app/(compte)/_layout.tsx')
    expect(layout).toContain('name="langue"')
    // Changer de langue remonte toute la pile : c'est la clé du Stack racine.
    expect(lire('src/app/_layout.tsx')).toMatch(/<Stack[^>]*key=\{langueCourante\}/)
  })
})
