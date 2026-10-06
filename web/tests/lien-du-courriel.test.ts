// Le jeton d'un e-mail ne se consomme qu'au clic (5 octobre 2026).
//
// L'analyse des liens de Microsoft 365 ouvre chaque lien avant le
// destinataire. Un lien `/verify` (`action_link`) dans un e-mail est donc
// grillé avant d'être lu : Julia, samaritaine.com, a lu « Lien expiré » sur
// son invitation puis sur deux « mot de passe oublié ».
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { lienDuCourriel } from '../../supabase/functions/_shared/lienDuCourriel'

const racineFonctions = path.resolve(__dirname, '../../supabase/functions')
const lire = (p: string) => readFileSync(p, 'utf8')
const sansCommentairesTs = (ts: string) =>
  ts.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// La liste se déduit : toute fonction qui demande un lien à Supabase.
const fonctionsAvecLien = readdirSync(racineFonctions)
  .map((nom) => path.join(racineFonctions, nom, 'index.ts'))
  .filter((f) => existsSync(f))
  .filter((f) => sansCommentairesTs(lire(f)).includes('generateLink('))

describe('le lien d’un e-mail mène à notre page, pas à /verify', () => {
  it('la liste n’est pas vide', () => {
    expect(fonctionsAvecLien.length).toBeGreaterThanOrEqual(5)
  })

  it.each(fonctionsAvecLien.map((f) => [path.basename(path.dirname(f)), f]))('%s', (_nom, f) => {
    const code = sansCommentairesTs(lire(f))
    expect(code).not.toContain('action_link')
    expect(code).toContain('lienDuCourriel(')
    expect(code).toContain("import { lienDuCourriel } from '../_shared/lienDuCourriel.ts'")
  })

  it('le lien porte l’empreinte du jeton et son type', () => {
    const lien = lienDuCourriel(
      { hashed_token: 'abc', verification_type: 'recovery' },
      'https://www.quantinvo.com/reinitialisation',
    )
    expect(lien).toBe('https://www.quantinvo.com/reinitialisation?token_hash=abc&type=recovery')
    expect(lienDuCourriel({}, 'https://www.quantinvo.com/bienvenue')).toBeNull()
  })
})

describe('les pages ne consomment le jeton qu’au clic', () => {
  const pages = ['../app/bienvenue/page.tsx', '../app/reinitialisation/page.tsx']
  it.each(pages)('%s', (p) => {
    const code = sansCommentairesTs(lire(path.resolve(__dirname, p)))
    expect(code).toContain('lireJetonDuLien()')
    // `ouvrirLeLien` n'est appelé que depuis le bouton, jamais à l'arrivée.
    expect(code).toMatch(/async function continuer\(\)[\s\S]*?ouvrirLeLien\(/)
    expect(code).toContain('onClick={() => void continuer()}')
    expect(code.match(/ouvrirLeLien\(/g)?.length).toBe(1)
  })

  it('verifyOtp ne vit que dans lib/jetonDuLien.ts', () => {
    const lib = sansCommentairesTs(lire(path.resolve(__dirname, '../lib/jetonDuLien.ts')))
    expect(lib).toContain('verifyOtp({ token_hash')
  })
})
