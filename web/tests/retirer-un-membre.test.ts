// L'administrateur d'entreprise retire un membre (5 octobre 2026).
//
// Vérification demandée par Julien avant le pilote du Groupe Bon Marché : son
// administrateur « doit pouvoir faire la même chose qu'un superviseur
// concernant les inventaires ». Il le pouvait partout, sauf ici — c'était la
// DERNIÈRE fonction du produit à exiger d'être le créateur sans laisser passer
// l'administrateur d'entreprise.
//
// Il pouvait SUPPRIMER l'inventaire entier (`delete_session` a l'échappatoire)
// mais pas en retirer une personne : l'issue disponible était plus brutale que
// le geste demandé.
import { describe, expect, it } from 'vitest'
import { derniereDefinition, fichierDe } from './migrations'

const sansCommentaires = (s: string) => s.replace(/--.*$/gm, ' ')

describe('⚠️ retirer un membre : créateur OU administrateur d’entreprise', () => {
  const retirer = sansCommentaires(derniereDefinition('remove_session_member').corps)

  it('l’administrateur d’entreprise passe', () => {
    expect(retirer).toMatch(/v_creator = auth\.uid\(\) or public\.is_company_admin\(v_company\)/)
  })

  it('⚠️ et il le dit avec les MÊMES mots que la suppression', () => {
    // Deux règles d'accès qui disent la même chose de deux façons divergent à
    // la première correction portée sur une seule des deux.
    const supprimer = sansCommentaires(derniereDefinition('delete_session').corps)
    expect(supprimer).toContain('public.is_company_admin(')
    expect(retirer).toContain('public.is_company_admin(')
  })

  it('le créateur reste intouchable', () => {
    // Sans lui, l'inventaire n'a plus personne pour le clôturer.
    expect(retirer).toMatch(/if p_user_id = v_creator then/)
  })

  it('⚠️ la signature ne bouge pas — sinon il faudrait republier l’app', () => {
    // La règle vit en base : les téléphones déjà installés la prennent sans
    // passer par Apple. Ajouter un paramètre casserait cette propriété.
    const { fichier } = derniereDefinition('remove_session_member')
    expect(fichier).toBeTruthy()
    expect(retirer.length).toBeGreaterThan(0)
    const entete = derniereDefinition('remove_session_member').corps.slice(0, 200)
    expect(entete).toMatch(/remove_session_member\(p_session_id uuid, p_user_id uuid\)/)
  })

  it('la porte se referme sur anon', () => {
    // `create or replace` rend EXECUTE à PUBLIC : sans ce revoke, remplacer la
    // fonction ROUVRE la porte qu'une migration précédente avait fermée.
    expect(fichierDe('remove_session_member')).toMatch(
      /revoke all on function public\.remove_session_member\(uuid, uuid\) from public, anon/)
  })
})
