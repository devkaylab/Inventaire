// L'espace de l'administrateur d'entreprise (22 août 2026).
//
// Julien : « il voit tout et tout le monde dans son entreprise, il sait qui
// fait quoi, il gère les membres quel que soit le niveau, les magasins et les
// inventaires. C'est le maître ; au-dessus de lui il y a l'admin Quantinvo. »
//
// Ces tests figent les trois manques comblés — la lecture des inventaires, la
// vue d'ensemble, le journal — et les deux garde-fous qui les entourent : rien
// ne s'ouvre à un superviseur ordinaire, et la vue d'ensemble ne recalcule pas
// l'avancement inventaire par inventaire (la leçon de tenue en charge).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { alertesMagasin, avancement, etatMagasin, joursDepuis, SEUILS, type StoreBloc } from '../lib/entreprise'
import { libelleAction, ACTIONS, type LigneJournal } from '../lib/journal'
import { homePathForRole } from '../lib/auth'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260822160001_espace_admin_entreprise.sql')
const shell = lire('../components/AppShell.tsx')
const pageEntreprise = lire('../app/entreprise/page.tsx')
const pageJournal = lire('../app/journal/page.tsx')
const pageDashboard = lire('../app/dashboard/page.tsx')

const corpsDe = (fn: string) => migration.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''

describe('il voit les inventaires de son entreprise', () => {
  it('l’ouverture passe par le point de contrôle unique', () => {
    // `is_session_participant` garde la policy de lecture ET
    // `can_access_session` : comptages, zones, audits, rapports, membres en
    // dépendent. Une ligne ici ouvre tout, de façon cohérente ; la disperser
    // dans quinze policies garantissait l'oubli.
    const corps = corpsDe('is_session_participant')
    expect(corps).toContain('public.is_company_admin(s.company_id)')
    expect(corps).toContain('s.company_id = public.get_my_company()')
  })

  it('les droits de la fonction gardée sont reposés', () => {
    expect(migration).toMatch(/revoke all on function public\.is_session_participant\(uuid\) from public, anon/)
    expect(migration).toMatch(/grant execute on function public\.is_session_participant\(uuid\) to authenticated/)
  })

  it('sa liste d’inventaires ne se coupe plus en deux', () => {
    // « Les miens / ceux où l'on m'a invité » n'a pas de sens pour lui : ce
    // sont ceux de son entreprise.
    expect(pageDashboard).toContain('adminEntreprise')
    const miens = pageDashboard.split('const miens = useMemo(')[1]?.split('const invites')[0] ?? ''
    expect(miens).toContain('adminEntreprise')
  })
})

describe('la vue d’ensemble', () => {
  it('est réservée à l’administrateur d’entreprise', () => {
    for (const fn of ['ca_company_overview', 'ca_list_audit_log']) {
      expect(corpsDe(fn), fn).toContain('public.is_company_admin()')
    }
    expect(migration).toMatch(/revoke all on function public\.ca_company_overview\(\) from public, anon/)
    expect(migration).toMatch(/revoke all on function public\.ca_list_audit_log\(integer\) from public, anon/)
  })

  it('ne recalcule pas l’avancement inventaire par inventaire', () => {
    // C'est le motif retiré pour la tenue en charge le 21 août : reparcourir
    // zones et balises à chaque ouverture de page. On rend les pièces et
    // l'attendu, l'écran en tire une proportion.
    const corps = corpsDe('ca_company_overview')
    expect(corps).not.toContain('get_zone_dashboard')
    expect(corps).toContain("'pieces'")
    expect(corps).toContain("'expected'")
  })

  it('n’affiche pas l’administrateur comme superviseur de chaque magasin', () => {
    // Il les supervise tous depuis le matin : le répéter sur chaque bloc ne
    // dirait rien de qui tient réellement le magasin.
    expect(corpsDe('ca_company_overview')).toContain('not p.is_company_admin')
  })

  it('le journal est borné, même si l’appelant demande tout', () => {
    expect(corpsDe('ca_list_audit_log')).toContain('least(greatest(coalesce(p_limit, 100), 1), 500)')
  })

  it('l’équipe répond à « qui fait quoi »', () => {
    const corps = corpsDe('ca_list_team')
    expect(corps).toContain("'last_count_at'")
    expect(corps).toContain("'sessions_counted'")
  })
})

describe('les alertes d’un magasin', () => {
  const base: StoreBloc = {
    id: 'm1', name: 'Magasin', join_code: 'ABC123',
    supervisors: [], counters: 3, counters_active: 1,
    last_session_at: null, sessions: [],
  }
  const maintenant = Date.parse('2026-08-22T12:00:00Z')
  const ilYA = (j: number) => new Date(maintenant - j * 86_400_000).toISOString()
  const session = (p: Partial<StoreBloc['sessions'][0]>) => ({
    id: 's1', name: 'Inventaire', inventory_number: 'INV-1', status: 'counting' as const,
    uses_zones: false, created_at: ilYA(1), closed_at: null, created_by_label: null,
    members: 2, pieces: 10, expected: 0, last_count_at: ilYA(0), ...p,
  })

  it('un magasin qui tourne n’en produit aucune', () => {
    // C'est ce silence qui donne du poids aux autres.
    const store = { ...base, last_session_at: ilYA(2), sessions: [session({})] }
    expect(alertesMagasin(store, maintenant)).toEqual([])
  })

  it('signale un inventaire qui traîne', () => {
    const store = { ...base, last_session_at: ilYA(9), sessions: [session({ created_at: ilYA(9) })] }
    const cles = alertesMagasin(store, maintenant).map((a) => a.titre)
    expect(cles.some((t) => t.includes(`${SEUILS.inventaireOuvert}`) || t.includes('9 jours'))).toBe(true)
  })

  it('signale un inventaire à l’arrêt', () => {
    const store = { ...base, last_session_at: ilYA(4), sessions: [session({ created_at: ilYA(4), last_count_at: ilYA(4) })] }
    expect(alertesMagasin(store, maintenant).some((a) => a.titre.startsWith('Aucun scan depuis 4'))).toBe(true)
  })

  it('ne crie pas sur un inventaire ouvert il y a une heure', () => {
    // Sans scan, mais créé à l'instant : il n'y a rien à signaler.
    const store = { ...base, last_session_at: ilYA(0), sessions: [session({ created_at: ilYA(0), last_count_at: null })] }
    expect(alertesMagasin(store, maintenant)).toEqual([])
  })

  it('signale un magasin qui n’a jamais compté, et un magasin dormant', () => {
    expect(alertesMagasin(base, maintenant)[0].titre).toContain('jamais lancé')
    const dormant = { ...base, last_session_at: ilYA(120), sessions: [] }
    // `sessions` vide mais `last_session_at` renseigné : les inventaires
    // clôturés anciens ne remontent pas, seule la date reste.
    expect(alertesMagasin(dormant, maintenant).some((a) => a.titre.includes('120'))).toBe(true)
  })

  it('l’état du magasin se lit sur son inventaire ouvert', () => {
    expect(etatMagasin(base)).toBeNull()
    expect(etatMagasin({ ...base, sessions: [session({ status: 'counting' })] })?.cle).toBe('counting')
  })

  it('l’avancement n’est donné que s’il est honnête', () => {
    expect(avancement(session({ expected: 0, pieces: 50 }))).toBeNull()
    expect(avancement(session({ expected: 200, pieces: 50 }))).toBe(25)
    // Un surplus ne dépasse pas 100 % : la barre resterait dans sa gouttière.
    expect(avancement(session({ expected: 100, pieces: 250 }))).toBe(100)
  })

  it('joursDepuis encaisse une date absente ou illisible', () => {
    expect(joursDepuis(null)).toBeNull()
    expect(joursDepuis('pas une date')).toBeNull()
  })
})

describe('le journal se lit en français', () => {
  const ligne = (p: Partial<LigneJournal>): LigneJournal => ({
    id: 1, created_at: '2026-08-22T12:00:00Z', actor_id: 'moi', actor_label: 'Julien',
    action: 'acces_retires', target_label: 'Marc', details: {}, ...p,
  })

  it('dit « Vous » quand c’est la personne qui lit, et le conjugue', () => {
    // La première version écrivait « Vous a retiré » : les libellés sont donc
    // des participes, l'auxiliaire est choisi ici.
    expect(libelleAction(ligne({}), 'moi')).toBe('Vous avez retiré tous les accès de Marc')
    expect(libelleAction(ligne({}), 'quelqu’un')).toBe('Julien a retiré tous les accès de Marc')
  })

  it('reste lisible sur une action inconnue', () => {
    // Une action ajoutée en base et pas ici doit se voir, pas se taire.
    const phrase = libelleAction(ligne({ action: 'action_inedite' }), null)
    expect(phrase).toContain('action_inedite')
  })

  it('couvre toutes les actions écrites par les fonctions ca_*', () => {
    // Le garde-fou : ajouter un `log_company_action` sans son libellé se voit.
    const ecrites = [...lire('../../supabase/migrations/20260820190003_fonctions_admin_entreprise.sql')
      .matchAll(/log_company_action\([^,]+,\s*'([a-z_]+)'/g)].map((m) => m[1])
    const magasins = [...lire('../../supabase/migrations/20260822130001_demande_ajout_magasin.sql')
      .matchAll(/log_company_action\([^,]+,\s*'([a-z_]+)'/g)].map((m) => m[1])
    for (const action of new Set([...ecrites, ...magasins])) {
      expect(ACTIONS[action], `${action} n'a pas de libellé`).toBeDefined()
    }
  })
})

describe('ses écrans', () => {
  it('il atterrit sur son entreprise, pas sur les inventaires', () => {
    expect(homePathForRole({ role: 'supervisor', is_admin: false, is_company_admin: true })).toBe('/entreprise')
    expect(homePathForRole({ role: 'supervisor', is_admin: false, is_company_admin: false })).toBe('/dashboard')
    expect(homePathForRole({ role: 'supervisor', is_admin: true, is_company_admin: true })).toBe('/admin')
  })

  it('sa barre est celle d’une console', () => {
    const branche = shell.split('if (profile.is_company_admin)')[1]?.split(']')[0] ?? ''
    for (const href of ["'/entreprise'", "'/magasins'", "'/equipe'", "'/dashboard'", "'/journal'"]) {
      expect(branche, href).toContain(href)
    }
  })

  it('les deux nouveaux écrans refusent un superviseur ordinaire', () => {
    // Les RPC le refuseraient de toute façon ; la garde lui évite un écran en
    // erreur.
    for (const page of [pageEntreprise, pageJournal]) {
      expect(page).toContain('guard.profile.is_company_admin')
      expect(page).toContain("window.location.replace('/dashboard')")
    }
  })

  it('passent par les RPC gardées, jamais les tables en direct', () => {
    expect(pageEntreprise).toContain("rpc('ca_company_overview')")
    expect(pageEntreprise).toContain("rpc('ca_list_audit_log'")
    expect(pageJournal).toContain("rpc('ca_list_audit_log'")
    for (const page of [pageEntreprise, pageJournal]) {
      expect(page).not.toContain(".from('company_audit_log')")
      expect(page).not.toContain(".from('inventory_sessions')")
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Second passage, le même jour : « réduire la taille des tuiles pour que ça
// tienne sur une ligne, liste magasins collapsable nom magasin en en-tête et
// placer cette section dans page Magasins, bouton ouvrir le magasin mène à
// page du magasin en question — son profil — où on trouve son code, ses
// membres, ses inventaires, place activités récentes sous tableau de bord.
// La page magasins de l'admin entreprise doit s'inspirer de la page
// entreprises de l'admin Quantinvo. »

describe('le tableau de bord ne porte plus les magasins', () => {
  const pageMagasins = lire('../app/magasins/page.tsx')
  const fiche = lire('../app/magasins/[storeId]/page.tsx')
  const corps = lire('../components/magasin/CorpsMagasin.tsx')
  const css = lire('../app/globals.css')
  const migrationFiche = lire('../../supabase/migrations/20260822170001_fiche_magasin.sql')

  it('il ne reste que les chiffres et l’activité', () => {
    expect(pageEntreprise).toContain('Activité récente')
    expect(pageEntreprise).not.toContain('Magasin par magasin')
    expect(pageEntreprise).not.toContain('CorpsMagasin')
  })

  it('les cinq indicateurs tiennent sur une ligne', () => {
    expect(pageEntreprise).toContain('dash-kpis dash-kpis-5')
    expect(css).toContain('.dash-kpis-5 { grid-template-columns: repeat(5, minmax(0, 1fr))')
  })

  it('les magasins sont des volets, repliés, nom en en-tête', () => {
    // La règle du composant : tout part replié, et l'en-tête dit ce qu'il y a
    // dedans — sinon on n'aurait fait que déplacer le mur.
    expect(pageMagasins).toContain('<Volet')
    expect(pageMagasins).toContain('titre={store.name}')
    expect(pageMagasins).toContain('resume={resumeMagasin(store)}')
    expect(pageMagasins).not.toMatch(/<Volet[\s\S]{0,200}\bopen\b/)
  })

  it('la page s’inspire de la liste des entreprises de la console', () => {
    // Recherche par fragments et compte dans le titre, comme /admin/entreprises.
    expect(pageMagasins).toContain('normaliser')
    expect(pageMagasins).toContain('mots.every((mot) => nom.includes(mot))')
    expect(pageMagasins).toContain('Magasins{estAdmin && magasins.length > 0')
  })

  it('un superviseur ordinaire garde sa liste de codes', () => {
    // La page a deux lectures : elle ne doit pas devenir la console de tout le
    // monde. Un superviseur vient y relever un code.
    expect(pageMagasins).toContain('getMyStores')
    expect(pageMagasins).toContain('Copier le code')
  })
})

describe('la fiche d’un magasin', () => {
  const fiche = lire('../app/magasins/[storeId]/page.tsx')
  const corps = lire('../components/magasin/CorpsMagasin.tsx')
  const migrationFiche = lire('../../supabase/migrations/20260822170001_fiche_magasin.sql')
  const corpsSql = migrationFiche.split('function public.ca_store_detail(')[1]?.split('$$;')[0] ?? ''

  it('« Ouvrir le magasin » y mène', () => {
    expect(corps).toContain('href={`/magasins/${store.id}`}')
    expect(corps).toContain('Ouvrir le magasin')
  })

  it('porte le code, les membres et les inventaires', () => {
    expect(fiche).toContain('Code d&apos;accès')
    expect(fiche).toContain('Membres (')
    expect(fiche).toContain('Inventaires (')
    expect(fiche).toContain("rpc('ca_store_detail'")
  })

  it('la garde porte sur l’entreprise du magasin visé', () => {
    // Jamais sur un paramètre fourni par l'appelant : c'est la règle de toutes
    // les fonctions qui prennent un identifiant.
    expect(corpsSql).toContain('select company_id into v_company from public.stores where id = p_store_id')
    expect(corpsSql).toContain('public.is_company_admin(v_company)')
    expect(migrationFiche).toMatch(/revoke all on function public\.ca_store_detail\(uuid\) from public, anon/)
  })

  it('l’activité d’un compteur y est celle de ce magasin', () => {
    // Quelqu'un qui compte beaucoup ailleurs n'est pas actif ici pour autant.
    expect(corpsSql).toContain('s2.store_id = p_store_id')
    expect(corpsSql).toContain('s3.store_id = p_store_id')
  })

  it('elle refuse un superviseur ordinaire', () => {
    expect(fiche).toContain('guard.profile.is_company_admin')
    expect(fiche).toContain("window.location.replace('/magasins')")
  })
})
