// Demander l'ajout d'un magasin (22 août 2026).
//
// Ce que ces tests empêchent de défaire : la règle qui fait tenir tout le
// modèle économique — **une demande ne crée pas de magasin**, Quantinvo reste
// seul à créer, parce que la licence se facture par magasin. Plus les gardes
// habituelles : anon dehors, écriture par fonction seulement, journal des deux
// côtés, et la durée de conservation.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260822130001_demande_ajout_magasin.sql')
const pageMagasins = lire('../app/magasins/page.tsx')
const pageAdmin = lire('../app/admin/page.tsx')
const ficheEntreprise = lire('../app/admin/entreprise/[companyId]/page.tsx')

const corpsDe = (fn: string) => migration.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''

describe('la demande ne crée pas le magasin', () => {
  it('ca_request_store n’insère que dans store_requests', () => {
    // Le jour où cette fonction insérerait dans `stores`, un client
    // s'ajouterait une licence tout seul.
    const corps = corpsDe('ca_request_store')
    expect(corps).toContain('insert into public.store_requests')
    expect(corps).not.toMatch(/insert into public\.stores\b/)
  })

  it('seul l’administrateur Quantinvo crée, et par le chemin existant', () => {
    const corps = corpsDe('admin_fulfil_store_request')
    expect(corps).toContain('if not public.is_admin() then')
    // Réutiliser admin_add_store plutôt que recopier la génération du code :
    // deux chemins de création divergeraient.
    expect(corps).toContain('public.admin_add_store(v_req.company_id, v_req.store_name)')
    expect(corps).not.toContain('gen_store_code')
  })

  it('une demande déjà traitée ne se rejoue pas', () => {
    expect(corpsDe('admin_fulfil_store_request')).toContain("if v_req.status <> 'pending' then")
    expect(corpsDe('admin_reject_store_request')).toContain("where id = p_id and status = 'pending'")
  })
})

describe('qui demande, qui refuse', () => {
  it('la demande est réservée à l’administrateur d’entreprise', () => {
    for (const fn of ['ca_request_store', 'ca_list_store_requests', 'ca_cancel_store_request']) {
      expect(corpsDe(fn), `${fn} doit vérifier is_company_admin`).toContain('public.is_company_admin()')
    }
  })

  it('les deux doublons sont refusés à la saisie', () => {
    const corps = corpsDe('ca_request_store')
    expect(corps).toContain('from public.stores s')
    expect(corps).toContain("r.status = 'pending'")
  })

  it('une demande traitée ne s’annule plus', () => {
    // Elle est devenue une trace, pas un brouillon.
    expect(corpsDe('ca_cancel_store_request')).toContain("status = 'pending'")
  })
})

describe('gardes de base', () => {
  it('aucune écriture directe sur la table', () => {
    expect(migration).toContain('alter table public.store_requests enable row level security')
    expect(migration).not.toMatch(/create policy [\s\S]*?for (insert|update|delete)/i)
    expect(migration).toContain('for select using (public.is_admin() or public.is_company_admin(company_id))')
  })

  it('anon n’exécute aucune des six fonctions', () => {
    for (const sig of [
      'ca_request_store\\(text, text\\)',
      'ca_list_store_requests\\(\\)',
      'ca_cancel_store_request\\(uuid\\)',
      'admin_list_store_requests\\(\\)',
      'admin_fulfil_store_request\\(uuid\\)',
      'admin_reject_store_request\\(uuid, text\\)',
    ]) {
      expect(migration, sig).toMatch(new RegExp(`revoke all on function public\\.${sig} from public, anon`))
    }
  })

  it('journalise des deux côtés', () => {
    // Côté entreprise, la demande et son annulation ; côté Quantinvo, la
    // création et le refus. Même principe que M4 : la trace s'écrit dans la
    // même transaction que l'action.
    expect(corpsDe('ca_request_store')).toContain("log_company_action(v_company, 'magasin_demande'")
    expect(corpsDe('ca_cancel_store_request')).toContain("log_company_action(v_company, 'magasin_demande_annulee'")
    expect(corpsDe('admin_fulfil_store_request')).toContain('log_admin_action')
    expect(corpsDe('admin_reject_store_request')).toContain('log_admin_action')
  })

  it('purge les demandes traitées à un an', () => {
    const purge = migration.split('function public.purge_expired_data(')[1] ?? ''
    expect(purge).toContain("demandes_mag_ttl     constant interval := interval '1 year'")
    expect(purge).toContain('delete from public.store_requests')
    // Une demande encore en attente ne se purge jamais : elle attend.
    expect(purge).toContain('handled_at is not null')
    expect(migration).toMatch(/grant execute on function public\.purge_expired_data\(\) to service_role/)
  })
})

describe('écrans', () => {
  it('le bouton n’existe que pour l’administrateur d’entreprise', () => {
    expect(pageMagasins).toContain('estAdmin && <DemandesMagasin />')
    expect(pageMagasins).toContain('is_company_admin')
  })

  it('passe par les RPC gardées, jamais la table en direct', () => {
    expect(pageMagasins).toContain("rpc('ca_request_store'")
    expect(pageMagasins).toContain("rpc('ca_list_store_requests')")
    expect(pageMagasins).toContain("rpc('ca_cancel_store_request'")
    expect(pageMagasins).not.toContain(".from('store_requests')")
    expect(ficheEntreprise).not.toContain(".from('store_requests')")
  })

  it('ne renvoie pas l’administrateur à lui-même quand il n’a aucun magasin', () => {
    // Piège déjà rencontré côté mobile : « contactez l'administrateur de votre
    // entreprise » écrit à l'administrateur de l'entreprise.
    const vide = pageMagasins.split('empty-state-hint')[1]?.split('</p>')[0] ?? ''
    expect(vide).toContain('estAdmin')
    expect(vide).toContain('/equipe')
  })

  it('la demande remonte dans « À traiter » et sur la fiche', () => {
    expect(pageAdmin).toContain("rpc('admin_list_store_requests')")
    expect(pageAdmin).toContain('demandes.length === 0')
    expect(ficheEntreprise).toContain("'admin_fulfil_store_request'")
    expect(ficheEntreprise).toContain("'admin_reject_store_request'")
  })
})
