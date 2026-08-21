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
    const occurrences = (tdb.match(/sessions_month/g) ?? []).length
    expect(occurrences, 'sessions_month ne doit être affiché qu’une fois').toBe(2) // type + rendu
    expect(tdb).toContain('active_stores_month')
    expect(tdb).toContain('Magasins actifs ce mois')
  })

  it('ne montre aucun montant tant qu’aucun prix n’existe en base', () => {
    // La maquette affichait un revenu calculé de tête. Sans tarif enregistré,
    // l'afficher reviendrait à l'inventer à chaque chargement.
    // On n'examine que le code, pas les commentaires — ceux-ci expliquent
    // justement pourquoi le montant est absent.
    const codeSeul = tdb
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n')
    expect(codeSeul).not.toMatch(/€/)
    expect(codeSeul).not.toMatch(/revenu/i)
  })
})
