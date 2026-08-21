import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Supprimer un inventaire efface comptages, stock théorique, audits, membres et
// référentiel. C'est le geste le plus destructeur du produit, et la liste des
// inventaires en offre désormais un raccourci — corbeille par tuile, et
// sélection multiple. Ces gardes figent qui a le droit, et ce que « tout
// sélectionner » recouvre.

const here = path.dirname(fileURLToPath(import.meta.url))
const lire = (p: string) => readFileSync(path.join(here, p), 'utf8')

const migration = lire('../../supabase/migrations/20260821250001_suppression_inventaire_createur_ou_admin_entreprise.sql')
const page = lire('../app/dashboard/page.tsx')

describe('qui peut supprimer un inventaire', () => {
  it('la base ne se contente plus d’un participant', () => {
    // `can_access_session` acceptait n'importe quel superviseur participant :
    // le bouton était caché aux autres côté navigateur, la fonction ne l'était
    // pas. Ne pas revenir à cette garde.
    expect(migration).not.toMatch(/if not public\.can_access_session/)
  })

  it('la base accepte le créateur, ou l’administrateur de l’entreprise', () => {
    expect(migration).toContain('v_created_by = auth.uid()')
    expect(migration).toContain('public.is_company_admin(v_company)')
  })

  it('le créateur rétrogradé en compteur perd le droit avec le rôle', () => {
    expect(migration).toContain("public.get_my_role(), '') = 'supervisor'")
  })

  it('les droits d’exécution sont reposés — `create or replace` peut les rendre à PUBLIC', () => {
    expect(migration).toContain('revoke all on function public.delete_session(uuid) from public')
    expect(migration).toContain('grant execute on function public.delete_session(uuid) to authenticated')
    expect(migration).not.toMatch(/grant execute on function public\.delete_session\(uuid\) to anon/)
  })

  it('l’écran applique la même règle que la base', () => {
    expect(page).toContain('adminEntreprise || (!!profileId && s.created_by === profileId)')
  })
})

describe('sélection multiple', () => {
  it('« tout sélectionner » ne prend que ce qui est à l’écran', () => {
    // `filtered` est la liste après recherche. Sur `sessions`, un « tout »
    // déborderait de ce que la personne voit — le meilleur moyen d'effacer
    // autre chose que ce qu'on croyait.
    expect(page).toContain('const selectionnables = useMemo(() => filtered.filter(peutSupprimer)')
  })

  it('la case et la corbeille n’apparaissent que sur ce qu’on peut supprimer', () => {
    expect(page).toMatch(/deletable && \(\s*\n\s*<input/)
    expect(page).toMatch(/deletable && \(\s*\n\s*<button/)
  })

  it('la confirmation nomme les inventaires et signale ceux en cours', () => {
    expect(page).toContain('cibles.slice(0, 8).map')
    expect(page).toContain('inventaires encore en cours')
  })

  it('les échecs sont rapportés, pas noyés dans un succès global', () => {
    // Pas de RPC de suppression groupée : on appelle `delete_session` une fois
    // par inventaire. Sur dix, un refus ne doit pas passer inaperçu.
    expect(page).toContain('const echecs: string[] = []')
    expect(page).toMatch(/toast\.error\(`\$\{faits\} supprimés, \$\{echecs\.length\} refusés/)
  })

  it('la tuile étant un lien, la case retient le clic', () => {
    expect(page).toContain('e.preventDefault()')
    expect(page).toContain('e.stopPropagation()')
  })
})
