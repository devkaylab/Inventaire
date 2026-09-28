// Le parcours On-Demand n'écrit plus une taille de texte en dur.
//
// ⚠️ CETTE GARDE VIENT D'UN CONSTAT DE JULIEN, LE 28 SEPTEMBRE 2026 : « trop
// de tailles de police différentes, harmonise ». Le parcours en comptait
// TREIZE — 46, 38, 32, 23, 20, 17, 16, 15, 14,5, 14, 13, 12,5 et 11 px,
// relevées à l'écran. Aucune n'était fausse prise seule ; ensemble, elles ne
// disaient plus ce qui compte. Le montant à lui seul en avait trois, dans
// trois règles qui se recouvraient.
//
// Rien ne pouvait le signaler : une taille en dur est du CSS valide. Seul
// l'écran le voit, et seul quelqu'un qui compte s'en aperçoit.
//
// ⚠️ ELLE DÉDUIT SA LISTE : les marches sont celles que `:root` déclare, la
// région est celle que les deux commentaires de section bornent. Ajouter une
// marche à `:root` sans l'employer mord aussi — six marches qu'on rallonge en
// douce redeviennent treize.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8')

/** Le code sans ses commentaires : un exemple en commentaire n'est pas du CSS. */
const sansCommentaires = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '')

/** Les marches déclarées dans `:root`, dans l'ordre du fichier. */
function marches(): string[] {
  const racine = css.slice(css.indexOf(':root {'))
  return [...racine.slice(0, racine.indexOf('\n}')).matchAll(/--t-[a-z-]+(?=\s*:)/g)].map((m) => m[0])
}

/** La région du parcours On-Demand, bornée par ses deux titres de section. */
function regionOnDemand(): string {
  const bornes = [...css.matchAll(/\/\* ── ([^\n]*?) ─+/g)].map((m) => ({ i: m.index!, titre: m[1] }))
  const debut = bornes.findIndex((b) => b.titre.includes('Réserver un inventaire'))
  expect(debut, 'la section du tunnel On-Demand a changé de titre').toBeGreaterThanOrEqual(0)
  const fin = bornes.slice(debut + 1).find((b) => b.titre.includes('Mes inventaires à la demande'))
  expect(fin, 'la section qui suit le tunnel a changé de titre').toBeTruthy()
  return sansCommentaires(css.slice(bornes[debut].i, fin!.i))
}

describe('les tailles de texte du parcours On-Demand', () => {
  it('sont peu nombreuses — six marches, comme les rayons en ont quatre', () => {
    expect(marches().length).toBeLessThanOrEqual(6)
  })

  it('ne sont jamais écrites en dur dans le parcours', () => {
    const enDur = [...regionOnDemand().matchAll(/font-size:\s*([^;}]+)/g)]
      .map((m) => m[1].trim())
      .filter((v) => !/^var\(--t-[a-z-]+\)$/.test(v))
    expect(enDur, `tailles en dur : ${enDur.join(', ')}`).toEqual([])
  })

  it("ne citent que des marches qui existent", () => {
    const connues = new Set(marches())
    const citees = [...regionOnDemand().matchAll(/var\((--t-[a-z-]+)\)/g)].map((m) => m[1])
    const inconnues = [...new Set(citees)].filter((n) => !connues.has(n))
    expect(inconnues, `marches inconnues : ${inconnues.join(', ')}`).toEqual([])
  })

  it('servent toutes — une marche inutilisée est une marche de plus', () => {
    const region = regionOnDemand()
    const orphelines = marches().filter((n) => !region.includes(`var(${n})`))
    expect(orphelines, `marches déclarées et jamais employées : ${orphelines.join(', ')}`).toEqual([])
  })
})
