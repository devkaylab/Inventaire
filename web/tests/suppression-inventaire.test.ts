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
const policies = lire('../../supabase/migrations/20260821250002_inventaire_cloture_rouvert_par_son_createur.sql')
const page = lire('../app/dashboard/page.tsx')
const menu = lire('../components/dashboard/SessionActionsMenu.tsx')

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

describe('un inventaire clôturé ne se rouvre que par son créateur', () => {
  // Règle posée par Julien le 21 août 2026 : un inventaire auquel on est
  // simplement invité ne se rouvre pas. La policy UPDATE acceptait n'importe
  // quel superviseur participant — un invité pouvait donc remettre en marche
  // un rapport déjà exporté.
  it('la ligne clôturée n’est modifiable que par son créateur ou l’administrateur', () => {
    expect(policies).toContain("status <> 'closed'")
    expect(policies).toContain('created_by = auth.uid()')
    expect(policies).toContain('public.is_company_admin(company_id)')
  })

  it('la suppression directe de la ligne n’est plus possible', () => {
    // Sans cela, un client contournait `delete_session` — et sa garde — en
    // supprimant la ligne, laissant comptages et articles orphelins.
    expect(policies).toContain('drop policy if exists sessions_supervisor_delete')
    expect(policies).not.toMatch(/create policy sessions_supervisor_delete/)
  })

  it('l’écran ne propose pas une réouverture que la base refusera', () => {
    expect(menu).toContain('canReopen')
    expect(menu).toContain('Lui seul peut le rouvrir')
  })
})

describe('mes inventaires et ceux auxquels je suis invité', () => {
  it('la liste sépare les deux', () => {
    expect(page).toContain('const miens = useMemo(')
    expect(page).toContain('const invites = useMemo(')
    expect(page).toContain('Inventaires invités')
  })

  it('le regroupement par magasin ne porte que sur les siens', () => {
    expect(page).toContain('groupByStore(miens)')
  })
})

describe('ajouter quelqu’un à un inventaire : on cherche, on ne saisit pas', () => {
  // Relevé par Julien le 21 août 2026 : l'onglet Équipe d'un inventaire
  // proposait un formulaire prénom / nom / e-mail appelant `invite-teammate`,
  // la fonction qui crée un compte pour l'entreprise. Ce n'était pas le geste
  // attendu — et surtout **personne n'était ajouté à l'inventaire**.
  const ajout = lire('../components/dashboard/AddSessionMember.tsx')
  const onglet = lire('../components/dashboard/tabs/EquipeTab.tsx')

  it('l’onglet d’un inventaire ne crée plus de compte d’entreprise', () => {
    expect(onglet).not.toContain('AddCounter')
    expect(onglet).toContain('AddSessionMember')
  })

  it('on choisit dans l’équipe du magasin, avec suggestions à la frappe', () => {
    expect(ajout).toContain('getStoreDirectory')
    expect(ajout).toContain('suggestions')
    expect(ajout).toContain('.slice(0, 8)')
  })

  it('l’ajout passe par la même fonction que l’app mobile', () => {
    expect(ajout).toContain('inviteToSession')
  })

  it('les personnes déjà présentes ne sont pas proposées', () => {
    // Les reproposer ferait découvrir le doublon au moment de l'envoi.
    expect(ajout).toContain('exclus.has(d.user_id)')
    expect(ajout).toContain('exclusMails.has')
  })

  it('« Mon équipe » garde son formulaire de création', () => {
    // C'est là que créer un compteur a un sens — ne pas confondre les deux.
    expect(lire('../app/equipe/page.tsx')).toContain('AddCounter')
  })
})
