// Formulaires publics : ce que l'écran ne doit plus savoir (constat M3).
//
// La fonction publique répond désormais la même chose quel que soit le cas —
// code magasin inconnu, compte déjà existant, demande en cours, création. Le
// nom du magasin a disparu de la réponse, parce qu'il confirmait à lui seul la
// validité du code. Ces tests empêchent de le réintroduire côté écran, et
// figent la formulation conditionnelle qui rend la réponse uniforme tenable.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const superviseur = lire('../app/superviseur/page.tsx')

describe('parcours public superviseur — éteint le 21 août 2026', () => {
  // Les accès superviseur sont ouverts par l'administrateur de l'entreprise
  // (/equipe). La page subsiste en explication : l'application mobile
  // installée partage encore cette adresse, la supprimer ferait un 404.
  it('ne collecte plus rien', () => {
    expect(superviseur).not.toContain('<form')
    expect(superviseur).not.toContain('MentionCollecte')
  })

  it('n’appelle plus aucune fonction de dépôt', () => {
    // C'est l'extinction de la surface publique : ni edge, ni RPC. Les
    // objets de base sont supprimés dans un second temps, une fois ce code
    // déployé — règle du projet, jamais l'inverse.
    expect(superviseur).not.toContain("invoke('submit-supervisor-request'")
    expect(superviseur).not.toContain("rpc('submit_supervisor_request'")
    expect(superviseur).not.toContain('supabase')
  })

  it('oriente vers l’administrateur de l’entreprise', () => {
    expect(superviseur).toContain('administrateur')
    expect(superviseur).toContain('Mon équipe')
  })
})

describe('explication par e-mail (fonction edge)', () => {
  const edge = lire('../../supabase/functions/submit-supervisor-request/index.ts')

  it('ne renvoie jamais le nom du magasin', () => {
    // Le nom confirmerait la validité du code, par un autre canal.
    expect(edge).not.toContain('store_name')
  })

  it('traite « code inconnu » et « demande créée » dans la même branche', () => {
    // Deux messages distincts rouvriraient l'oracle : qui essaie des codes
    // utilise sa propre adresse et lirait la réponse.
    expect(edge).not.toContain("case 'unknown_store'")
    expect(edge).not.toContain("case 'created'")
  })

  it('limite le débit avant tout travail', () => {
    const avantDepot = edge.slice(0, edge.indexOf('submit_supervisor_request_detailed'))
    expect(avantDepot).toContain('rate_limit_ok')
  })
})
