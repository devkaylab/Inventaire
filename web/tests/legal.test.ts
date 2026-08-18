// La page de mentions légales ne doit jamais être annoncée tant qu'elle est
// incomplète : c'est `mentionsCompletes()` qui commande le lien du pied de page
// et le `noindex`. Ces tests verrouillent cette règle, et vérifient que ce qui
// reste à remplir est toujours accompagné de l'indication permettant de le
// faire — sans quoi la page resterait bloquée sans qu'on sache pourquoi.
import { describe, expect, it } from 'vitest'
import { EDITEUR, HEBERGEUR, mentionsCompletes, mentionsManquantes, type Mention } from '@/lib/legal'

const complet: Mention[] = [
  { libelle: 'Éditeur', valeur: 'Devkaylab', requis: true },
  { libelle: 'Adresse', valeur: '1 rue de l’Exemple, 75000 Paris', requis: true },
]

describe('complétude des mentions', () => {
  it('accepte un jeu entièrement renseigné', () => {
    expect(mentionsManquantes([complet])).toEqual([])
    expect(mentionsCompletes([complet])).toBe(true)
  })

  it('signale une mention requise vide, et la nomme', () => {
    const sans = [[...complet, { libelle: 'Téléphone', valeur: null, requis: true }]]
    expect(mentionsManquantes(sans)).toEqual(['Téléphone'])
    expect(mentionsCompletes(sans)).toBe(false)
  })

  it('ne bloque pas sur une mention facultative', () => {
    const sans = [[...complet, { libelle: 'Capital social', valeur: null, requis: false }]]
    expect(mentionsCompletes(sans)).toBe(true)
  })

  it('traite une valeur vide ou blanche comme absente', () => {
    for (const valeur of ['', '   ']) {
      expect(mentionsCompletes([[{ libelle: 'Adresse', valeur, requis: true }]])).toBe(false)
    }
  })
})

describe('données publiées', () => {
  it('explique comment remplir chaque mention encore vide', () => {
    const orphelines = [...EDITEUR, ...HEBERGEUR]
      .filter(m => !m.valeur?.trim() && !m.aide)
      .map(m => m.libelle)
    expect(orphelines, 'ces mentions sont vides et sans indication').toEqual([])
  })
})
