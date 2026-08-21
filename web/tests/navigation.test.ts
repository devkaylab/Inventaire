// Navigation de l'espace connecté — ce que la refonte ne doit pas défaire.
//
// Avant, chaque page portait ses propres boutons de sortie et « Mon compte »
// servait de carrefour : dix blocs empilés, les inventaires en double, le
// tableau de bord derrière un bouton au milieu de la page, et aucun retour
// au site public. Ces tests figent le remède.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const shell = lire('../components/AppShell.tsx')
const compte = lire('../app/account/page.tsx')

// Toutes les pages de l'espace connecté. En ajouter une sans la coquille
// doit se voir : elle n'aurait ni navigation, ni retour, ni déconnexion.
const PAGES_CONNECTEES = [
  '../app/dashboard/page.tsx',
  '../app/equipe/page.tsx',
  '../app/magasins/page.tsx',
  '../app/outils/page.tsx',
  '../app/account/page.tsx',
  '../app/admin/page.tsx',
  '../app/admin/entreprises/page.tsx',
  '../app/admin/console/page.tsx',
  '../app/admin/entreprise/[companyId]/page.tsx',
]

describe('la barre de navigation', () => {
  it('est posée sur chaque page de l’espace connecté', () => {
    for (const page of PAGES_CONNECTEES) {
      expect(lire(page), `${page} doit passer par AppShell`).toContain('<AppShell')
    }
  })

  it('ramène au site public', () => {
    // Le retour à l'accueil manquait partout : c'est le premier reproche.
    expect(shell).toContain('href="/"')
    expect(shell).toContain('retour au site')
  })

  it('porte le nom, l’entreprise ET le rôle, ensemble', () => {
    // « Entreprise C » seul ne dit pas ce qu'on y fait ; le rôle seul ne dit
    // pas où. Les deux se lisent sur la même ligne, sous le nom.
    expect(shell).toContain('who-name')
    expect(shell).toContain('who-co')
    expect(shell).toContain('companyName')
    expect(shell).toContain('roleCourt')
    expect(shell).toContain('appartenance')
    // L'administrateur Quantinvo n'a pas d'entreprise : c'est Quantinvo même.
    expect(shell).toContain("'Quantinvo'")
  })

  it('range le compte et la déconnexion sous l’avatar, pas dans les onglets', () => {
    expect(shell).toContain('who-menu')
    expect(shell).toContain('Se déconnecter')
    // « Mon compte » ne doit pas revenir dans la liste des onglets.
    const onglets = shell.split('export function ongletsPour')[1]?.split('\n}')[0] ?? ''
    expect(onglets).not.toContain("'/account'")
  })

  it('se referme au clic ailleurs et à Échap', () => {
    expect(shell).toContain("addEventListener('mousedown'")
    expect(shell).toContain("'Escape'")
  })
})

describe('les onglets suivent le rôle', () => {
  const onglets = shell.split('export function ongletsPour')[1]?.split('\n}\n')[0] ?? ''

  it('l’administrateur Quantinvo a ses trois écrans', () => {
    expect(onglets).toContain("'/admin'")
    expect(onglets).toContain("'/admin/entreprises'")
    expect(onglets).toContain("'/admin/console'")
  })

  it('le superviseur ouvre sur ses inventaires', () => {
    // Le premier onglet dit ce pour quoi on ouvre le site.
    const i = onglets.indexOf("'/dashboard'")
    const j = onglets.indexOf("'/equipe'")
    expect(i).toBeGreaterThan(-1)
    expect(i).toBeLessThan(j)
  })

  it('l’administrateur d’entreprise ouvre sur son équipe', () => {
    expect(onglets).toContain('is_company_admin')
  })
})

describe('« Mon compte » ne parle plus que de la personne', () => {
  it('ne porte plus les inventaires, les magasins ni l’équipe', () => {
    // C'étaient les doublons et le fourre-tout dénoncés : chacun a son écran.
    expect(compte).not.toContain('getMySessions')
    expect(compte).not.toContain('getMyStores')
    expect(compte).not.toContain('getTeamMembers')
    expect(compte).not.toContain('AddCounter')
    expect(compte).not.toContain('BaliseSheetPanel')
  })

  it('garde l’identité, la sécurité et les données', () => {
    expect(compte).toContain('Mes informations')
    expect(compte).toContain('MfaPanel')
    expect(compte).toContain('export_my_data')
  })

  it('permet de corriger son nom et de changer son mot de passe', () => {
    // Deux capacités que la maquette promettait et que le premier jet avait
    // laissées de côté : sans elles, changer de mot de passe imposait de se
    // déconnecter et de passer par « mot de passe oublié ».
    expect(compte).toContain('Modifier mon nom')
    expect(compte).toContain('Changer mon mot de passe')
    expect(compte).toContain('auth.updateUser')
    // Les règles de mot de passe viennent du module partagé, pas d'une
    // vérification réécrite ici.
    expect(compte).toContain('passwordError')
    expect(compte).toContain('PasswordRules')
    expect(compte).toContain('friendlyPasswordError')
  })
})

describe('le tarif des magasins', () => {
  const fiche = lire('../app/admin/entreprise/[companyId]/page.tsx')
  const migration = lire('../../supabase/migrations/20260821190001_tarif_par_magasin_et_revenu.sql')

  it('se pose par magasin, pas par entreprise', () => {
    // La licence est par magasin, au volume de stock : le tarif appartient
    // au magasin.
    expect(migration).toContain('alter table public.stores')
    expect(migration).toContain('annual_price_cents')
  })

  it('se modifie depuis la fiche de l’entreprise, par une RPC gardée', () => {
    expect(fiche).toContain("rpc('admin_set_store_price'")
    expect(migration).toMatch(/revoke all on function public\.admin_set_store_price\(uuid, integer\) from public, anon/)
  })

  it('journalise chaque changement de tarif', () => {
    // C'est de l'argent : la trace suit la même règle que les autres
    // actions d'administration.
    const corps = migration.split('function public.admin_set_store_price(')[1]?.split('$$;')[0] ?? ''
    expect(corps).toContain('log_admin_action')
    expect(corps).toContain('is_admin()')
  })
})

describe('les écrans déplacés', () => {
  it('les magasins et leurs codes ont leur page', () => {
    const magasins = lire('../app/magasins/page.tsx')
    expect(magasins).toContain('getMyStores')
    expect(magasins).toContain('join_code')
  })

  it('les balises rejoignent la boîte à outils, sans dupliquer leur logique', () => {
    const outils = lire('../app/outils/page.tsx')
    expect(outils).toContain('BaliseSheetPanel')
    // La série se calcule dans un seul module, partagé avec l'onglet Set up.
    expect(outils).not.toContain('BALISE_FORMATS')
  })

  it('l’équipe range les compteurs par magasin', () => {
    const equipe = lire('../app/equipe/page.tsx')
    expect(equipe).toContain("rpc('my_team_by_store')")
    expect(equipe).toContain('Compteurs · ')
  })
})

describe('le tableau de bord Quantinvo', () => {
  const tdb = lire('../app/admin/page.tsx')

  it('n’affiche pas deux fois le même chiffre', () => {
    // « Inventaires ce mois-ci » en tête et « Inventaires lancés » plus bas
    // donnaient le même nombre : c'est le doublon que la refonte combat.
    // Une occurrence pour le type, une pour le rendu — pas davantage.
    const occurrences = (tdb.match(/sessions_month/g) ?? []).length
    expect(occurrences, 'sessions_month ne doit être rendu qu’une fois').toBe(2)
    // Les magasins actifs restent visibles, en note de « Magasins sous
    // licence » plutôt qu'en tuile séparée : c'est la même famille d'idée.
    expect(tdb).toContain('active_stores_month')
    expect(tdb).toContain('compté ce mois')
  })

  it('ne calcule aucun montant dans la page : il vient de la base', () => {
    // Le revenu est affiché (décision du 21 août 2026), mais il doit sortir
    // de stores.annual_price_cents via admin_business_overview — jamais d'un
    // tarif écrit en dur ici, qui mentirait dès le premier client réel.
    const codeSeul = tdb
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    expect(tdb).toContain('arr_cents')
    // Le panier moyen (3 700 € depuis le regonflement fiscal du 21 août 2026)
    // vit dans admin_business_overview, jamais ici.
    expect(codeSeul).not.toMatch(/3\s?700/)
    expect(codeSeul).not.toMatch(/370000/)
    expect(codeSeul).not.toMatch(/14\s?800/)
  })

  it('annonce ce qui n’est qu’estimé', () => {
    // Un magasin sans tarif négocié compte pour le panier moyen : la carte
    // doit le dire, sinon le chiffre passe pour exact.
    expect(tdb).toContain('priced_stores')
    expect(tdb).toContain('estimé')
  })
})

describe('un superviseur gère vraiment son équipe', () => {
  // Reproche de Julien, 21 août 2026 : « comment un superviseur est-il
  // supposé gérer son équipe s'il ne peut pas retirer un membre ! » La
  // maquette montrait un « Retirer » sur chaque ligne ; le premier jet le
  // réservait à l'administrateur d'entreprise.
  const equipe = lire('../app/equipe/page.tsx')
  const migration = lire('../../supabase/migrations/20260821200001_superviseur_gere_son_equipe.sql')

  it('le bouton Retirer n’est réservé à personne', () => {
    const bloc = equipe.split('Compteurs · ')[1]?.split('Invitations en cours')[0] ?? ''
    expect(bloc).toContain('>Retirer</button>')
    expect(bloc, 'le retrait ne doit pas être conditionné au rôle').not.toContain('estAdmin &&')
  })

  it('le retrait vise UN magasin, pas tous', () => {
    // Un compteur présent dans deux magasins supervisés par deux personnes
    // ne doit pas disparaître des deux d'un seul clic.
    // La page passe par l'assistant appliquer(), qui enveloppe supabase.rpc.
    expect(equipe).toContain("'remove_counter_from_store'")
    expect(equipe).toContain('p_store_id: s.id')
  })

  it('un superviseur annule l’invitation qu’il a envoyée', () => {
    expect(equipe).toContain('cancel_my_invitation')
  })

  it('la base vérifie que le magasin est bien le sien', () => {
    const corps = migration.split('function public.remove_counter_from_store(')[1]?.split('$$;')[0] ?? ''
    expect(corps).toContain('store_supervisors')
    expect(corps).toContain('is_company_admin')
    expect(corps).toContain('Vous ne pouvez pas vous retirer vous-même')
    expect(corps).toContain('log_company_action')
  })

  it('l’annulation ne porte que sur ses propres invitations', () => {
    const corps = migration.split('function public.cancel_my_invitation(')[1]?.split('$$;')[0] ?? ''
    expect(corps).toContain('created_by = v_uid')
  })

  it('anon n’atteint ni l’un ni l’autre', () => {
    expect(migration).toMatch(/revoke all on function public\.remove_counter_from_store\(uuid, uuid\) from public, anon/)
    expect(migration).toMatch(/revoke all on function public\.cancel_my_invitation\(uuid\) from public, anon/)
  })
})
