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
})
