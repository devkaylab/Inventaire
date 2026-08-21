// Console d'administration : ce que le découpage ne doit pas défaire.
//
// La page listait chaque entreprise en carte complète, deux requêtes par
// entreprise au chargement. À cinquante entreprises : cent requêtes, un mur
// illisible, et le risque de supprimer la mauvaise ligne. Ces tests figent
// le découpage (aperçu ici, détail là) et les deux règles qui l'encadrent :
// aucun code confidentiel dans la liste, et la garde admin sur les deux RPC.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260821160001_admin_apercu_entreprises.sql')
const listeEntreprises = lire('../app/admin/entreprises/page.tsx')
const tableauDeBord = lire('../app/admin/page.tsx')
const fiche = lire('../app/admin/entreprise/[companyId]/page.tsx')

describe('aperçu des entreprises (migration)', () => {
  it('ne divulgue aucun code dans la liste', () => {
    // Le code d'entreprise ouvre l'accès : il n'a rien à faire dans une
    // liste survolée. Il n'est servi que par la fiche, une entreprise à la fois.
    const apercu = migration.split('function public.admin_list_companies_overview()')[1]
      ?.split('$$;')[0] ?? ''
    expect(apercu).not.toContain('join_code')
    expect(migration.split('function public.admin_company_detail(')[1] ?? '').toContain('join_code')
  })

  it('garde les deux fonctions derrière is_admin()', () => {
    for (const fn of ['admin_list_companies_overview()', 'admin_company_detail(']) {
      const corps = migration.split(`function public.${fn}`)[1]?.split('$$;')[0] ?? ''
      expect(corps, `${fn} doit vérifier is_admin`).toContain('is_admin()')
    }
  })

  it('ferme les deux fonctions à anon', () => {
    expect(migration).toMatch(/revoke all on function public\.admin_list_companies_overview\(\) from public, anon/)
    expect(migration).toMatch(/revoke all on function public\.admin_company_detail\(uuid\) from public, anon/)
  })
})

describe('la liste d’entreprises reste légère', () => {
  it('ne charge qu’un aperçu, jamais le détail de chaque entreprise', () => {
    expect(listeEntreprises).toContain("rpc('admin_list_companies_overview')")
    // Les appels par entreprise appartenaient à l'ancienne carte dépliée.
    expect(listeEntreprises).not.toContain("rpc('admin_list_company_members'")
    expect(listeEntreprises).not.toContain("rpc('admin_list_store_supervisors'")
    expect(listeEntreprises).not.toContain("rpc('admin_company_detail'")
    // Le tableau de bord ne charge pas la liste : il a ses propres chiffres.
    expect(tableauDeBord).toContain("rpc('admin_business_overview')")
    expect(tableauDeBord).not.toContain("rpc('admin_list_companies_overview')")
  })

  it('mène à la fiche de chaque entreprise', () => {
    expect(listeEntreprises).toContain('/admin/entreprise/')
  })

  it('n’affiche aucun code confidentiel', () => {
    expect(listeEntreprises).not.toContain('join_code')
  })
})

describe('la fiche d’une entreprise', () => {
  it('charge tout en une requête', () => {
    expect(fiche).toContain("rpc('admin_company_detail'")
  })

  it('exige le rôle administrateur', () => {
    expect(fiche).toContain("useAuthGuard('admin')")
  })

  it('demande confirmation avant les suppressions', () => {
    for (const bloc of ['admin_delete_company', 'admin_delete_store']) {
      const avant = fiche.slice(0, fiche.indexOf(bloc))
      expect(avant.lastIndexOf('confirm('), `${bloc} doit être confirmé`).toBeGreaterThan(-1)
    }
  })
})

describe('la recherche d’entreprise', () => {
  // Elle était masquée en dessous de sept entreprises : avec trois clients,
  // elle n'apparaissait jamais, et on la croyait absente.
  it('est toujours proposée dès qu’il y a une entreprise', () => {
    expect(listeEntreprises).toContain('companies.length > 0 &&')
    expect(listeEntreprises).not.toContain('companies.length > 6')
  })

  it('cherche sur un fragment, sans accents ni casse', () => {
    expect(listeEntreprises).toContain('normalize(\'NFD\')')
    expect(listeEntreprises).toContain('toLowerCase()')
    expect(listeEntreprises).toContain('nom.includes(mot)')
  })

  it('accepte plusieurs mots dans n’importe quel ordre', () => {
    expect(listeEntreprises).toContain('mots.every')
  })

  it('dit combien de lignes restent, et permet d’effacer', () => {
    expect(listeEntreprises).toContain('sur {companies.length}')
    expect(listeEntreprises).toContain('Effacer')
  })
})
