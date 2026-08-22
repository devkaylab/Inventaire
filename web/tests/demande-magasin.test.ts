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
const m1 = lire('../../supabase/migrations/20260822130001_demande_ajout_magasin.sql')
// Le formulaire est passé à celui de /inscription le même jour : la demande
// porte le volume de stock, sans quoi Quantinvo ne peut pas deviser.
const m2 = lire('../../supabase/migrations/20260822140001_demande_magasin_volume.sql')
const migration = m1 + '\n' + m2
const pageMagasins = lire('../app/magasins/page.tsx')
const pageInscription = lire('../app/inscription/page.tsx')
const pageAdmin = lire('../app/admin/page.tsx')
const ficheEntreprise = lire('../app/admin/entreprise/[companyId]/page.tsx')

/** La définition qui fait foi : la plus récente. */
const corpsDe = (fn: string) => {
  for (const src of [m2, m1]) {
    const corps = src.split(`function public.${fn}(`)[1]?.split('$$;')[0]
    if (corps) return corps
  }
  return ''
}

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
      'ca_request_store\\(text, text, integer, integer\\)',
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
    // Deux pièges successifs. « Contactez l'administrateur de votre
    // entreprise » s'adressait à l'administrateur de l'entreprise ; puis
    // « affectez-vous un magasin » est devenu faux le 22 août 2026, quand
    // l'administrateur s'est mis à les avoir tous : s'il n'en voit aucun,
    // c'est que son entreprise n'en a aucun.
    const vide = pageMagasins.split('className="empty-state"')[1]?.split('</div>\n          ) : (')[0] ?? ''
    expect(vide).toContain('estAdmin')
    expect(vide).toContain('Votre entreprise n’a encore aucun magasin')
    expect(vide).toContain('Contactez l&apos;administrateur de votre entreprise')
    expect(pageMagasins).not.toContain('Affectez-vous un magasin')
  })

  it('la demande remonte dans « À traiter » et sur la fiche', () => {
    expect(pageAdmin).toContain("rpc('admin_list_store_requests')")
    expect(pageAdmin).toContain('demandes.length === 0')
    expect(ficheEntreprise).toContain("'admin_fulfil_store_request'")
    expect(ficheEntreprise).toContain("'admin_reject_store_request'")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Le formulaire de demande est celui de l'inscription (22 août 2026).
//
// Julien, capture à l'appui : « c'est ça qu'il faut comme formulaire de
// demande ». Le premier jet ne demandait qu'un nom — or la licence se tarife
// au volume de stock : une demande sans stock est un aller-retour de plus.

describe('le formulaire porte le volume', () => {
  it('le stock est exigé, la surface non', () => {
    const corps = corpsDe('ca_request_store')
    expect(corps).toContain('if p_units is null or p_units <= 0 then')
    expect(corps).not.toMatch(/if p_sqm is null[\s\S]{0,60}return json_build_object\('success', false/)
  })

  it('ne laisse pas cohabiter deux signatures', () => {
    // Postgres garderait les deux fonctions, et un appel à deux arguments
    // deviendrait ambigu.
    expect(m2).toContain('drop function if exists public.ca_request_store(text, text)')
  })

  it('les deux écrans partagent la même carte de saisie', () => {
    // Une seule définition : les libellés, les unités et la tranche affichée
    // ne doivent pas diverger entre l'inscription et la demande.
    for (const page of [pageMagasins, pageInscription]) {
      expect(page).toContain("from '@/components/MagasinSaisie'")
      expect(page).toContain('<MagasinSaisie')
    }
  })

  it('la demande transporte le stock et la surface', () => {
    expect(pageMagasins).toContain('p_units')
    expect(pageMagasins).toContain('p_sqm')
    for (const fn of ['ca_list_store_requests', 'admin_list_store_requests']) {
      expect(corpsDe(fn), fn).toContain("'units', r.units")
    }
  })

  it('la console affiche la tranche, le client la voit à la frappe', () => {
    // Le prix se lit là où l'on devise. Le recoupement stock / surface, lui,
    // ne sort pas de la console : il indiquerait au client quel chiffre
    // ajuster pour changer de tranche.
    expect(ficheEntreprise).toContain('trancheDe')
    expect(ficheEntreprise).toContain('densite')
    expect(pageMagasins).not.toContain('densite')
    expect(lire('../components/MagasinSaisie.tsx')).toContain('trancheDe')
  })
})
