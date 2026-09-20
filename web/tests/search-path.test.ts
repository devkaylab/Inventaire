// Toute fonction fixe son `search_path`.
//
// ⚠️ CETTE GARDE VIENT D'UN OUBLI RÉEL, LE 20 SEPTEMBRE 2026. Trois fonctions
// du chantier On-Demand — `transition_mission_permise`,
// `missions_verifier_transition`, `missions_figer_le_prix` — étaient parties
// sans `set search_path`. Ni la relecture, ni l'analyseur de syntaxe, ni le
// rejeu sur réplique ne l'ont vu : c'est le contrôle de sécurité de Supabase
// qui l'a signalé APRÈS application, `function_search_path_mutable`.
//
// Elles n'étaient pas exploitables — aucune ne lit de table sans la qualifier.
// Mais les 190 fonctions de Quantinvo OS fixent toutes leur `search_path`, et
// une exception non écrite finit par être recopiée par la suivante.
//
// ⚠️ ELLE LIT LA DÉFINITION QUI FAIT FOI (`derniereDefinition`), pas un nom de
// migration en dur : une fonction corrigée plus tard doit compter comme
// corrigée, et une fonction RÉÉCRITE plus tard sans `search_path` doit mordre.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition, dossierMigrations } from './migrations'

const sansCommentaires = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')

/** Toutes les fonctions que le dépôt définit — déduites, pas citées. */
function toutesLesFonctions(): string[] {
  const noms = new Set<string>()
  for (const f of readdirSync(dossierMigrations).filter((x) => x.endsWith('.sql'))) {
    const sql = sansCommentaires(readFileSync(path.join(dossierMigrations, f), 'utf8'))
    for (const m of sql.matchAll(/create (?:or replace )?function public\.(\w+)\s*\(/gi)) {
      noms.add(m[1])
    }
  }
  return [...noms].sort()
}

describe('search_path', () => {
  const fonctions = toutesLesFonctions()

  it('le dépôt définit bien des fonctions', () => {
    // Sans cette borne, la garde passerait sur une liste vide.
    expect(fonctions.length).toBeGreaterThan(150)
  })

  it('chaque fonction fixe son search_path', () => {
    const sans: string[] = []
    for (const fn of fonctions) {
      const { fichier, corps } = derniereDefinition(fn)
      // L'en-tête seul : `set search_path` doit être une CLAUSE de la
      // fonction, pas un `set search_path` écrit dans son corps — ce dernier
      // ne protège pas, il s'exécute trop tard.
      const entete = sansCommentaires(corps.split(/\bas\s+\$/i)[0] ?? '')
      if (!/set\s+search_path\s*(=|to)/i.test(entete)) sans.push(`${fn}() — ${fichier}`)
    }
    expect(sans, `Fonctions sans search_path :\n${sans.join('\n')}`).toEqual([])
  })
})
