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

describe('demande superviseur', () => {
  it('n’exploite plus le nom du magasin renvoyé par la base', () => {
    expect(superviseur).not.toContain('store_name')
  })

  it('annonce la prise en compte sans confirmer la validité du code', () => {
    expect(superviseur).toContain('Si ce code correspond à un magasin')
  })

  it('donne un repère de délai, seul recours contre une faute de frappe', () => {
    // Sans lui, une erreur de code laisse la personne attendre indéfiniment.
    expect(superviseur).toMatch(/48\s*heures/)
  })

  it('oriente vers la connexion sans révéler l’existence du compte', () => {
    // La phrase est inconditionnelle : elle ne dit pas si ce compte existe.
    expect(superviseur).toContain('si vous avez déjà un compte')
  })

  it('passe par la fonction edge, et retombe sur la base si elle manque', () => {
    // L'edge apporte l'explication par e-mail ; le repli garantit que la
    // demande passe quand même, avec la même réponse uniforme.
    expect(superviseur).toContain("invoke('submit-supervisor-request'")
    expect(superviseur).toContain("rpc('submit_supervisor_request'")
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
