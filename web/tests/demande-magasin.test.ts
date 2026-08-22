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
// Une demande aboutie sort de l'écran du client, et le demandeur est prévenu
// par e-mail (22 août 2026, second passage).
const m4 = lire('../../supabase/migrations/20260822200001_demandes_abouties_et_notifications.sql')
const migration = m1 + '\n' + m2 + '\n' + m4
const pageMagasins = lire('../app/magasins/page.tsx')
const pageInscription = lire('../app/inscription/page.tsx')
const pageAdmin = lire('../app/admin/page.tsx')
const ficheEntreprise = lire('../app/admin/entreprise/[companyId]/page.tsx')

/** La définition qui fait foi : la plus récente. */
const corpsDe = (fn: string) => {
  for (const src of [m4, m2, m1]) {
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
    // La page s'est scindée en deux lectures le 22 août : l'administrateur voit
    // ses magasins en volets et la demande, un superviseur ne voit que ses
    // codes. Le bloc de demande vit donc dans la seule branche `estAdmin`.
    const branche = pageMagasins.split(') : estAdmin ? (')[1]?.split('      ) : stores.length === 0 ?')[0] ?? ''
    expect(branche).toContain('<DemandesMagasin />')
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
    // Deux états vides distincts depuis la scission de la page : celui de
    // l'administrateur parle de son entreprise, celui du superviseur de son
    // affectation. Aucun ne renvoie l'administrateur à lui-même.
    expect(pageMagasins).toContain('Votre entreprise n’a encore aucun magasin')
    expect(pageMagasins).toContain('Contactez l&apos;administrateur de votre entreprise')
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

  it('le prix ne se lit que dans la console, jamais côté client', () => {
    // Décision de Julien, 22 août 2026. La carte de saisie montrait la tranche
    // et son tarif à la frappe, et /inscription totalisait le tout : cela
    // disait au prospect, pendant qu'il déclarait un stock invérifiable, de
    // combien le baisser pour payer moins. Même motif que le recoupement
    // stock / surface, qui ne sort pas non plus de la console.
    expect(ficheEntreprise).toContain('trancheDe')
    expect(ficheEntreprise).toContain('densite')

    const saisie = lire('../components/MagasinSaisie.tsx')
    for (const [nom, source] of [
      ['la carte de saisie', saisie],
      ['la demande de magasin', pageMagasins],
      ['le formulaire d’inscription', pageInscription],
    ] as const) {
      expect(source, `${nom} ne calcule pas de tranche`).not.toContain('trancheDe')
      expect(source, `${nom} ne totalise pas de licences`).not.toContain('totalAnnuel')
      expect(source, `${nom} ne recoupe pas la densité`).not.toContain('densite')
    }

    // Et aucun montant de la grille écrit en dur pour contourner les fonctions.
    for (const montant of ['2 100', '4 200', '6 600', '10 200', '14 400']) {
      expect(pageInscription, `${montant} € sur /inscription`).not.toContain(montant)
      expect(saisie, `${montant} € dans la carte de saisie`).not.toContain(montant)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Demander la suppression d'un magasin (22 août 2026).
//
// Symétrique de l'ajout, et pour la même raison : la licence se facture par
// magasin, donc Quantinvo reste seul à supprimer comme il est seul à créer.

describe('demander la suppression d’un magasin', () => {
  const m3 = lire('../../supabase/migrations/20260822180001_demande_suppression_magasin.sql')
  const corpsM3 = (fn: string) => m3.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''
  const fiche = lire('../app/magasins/[storeId]/page.tsx')

  it('la demande ne supprime rien', () => {
    // Le jour où cette fonction toucherait à `stores`, un client fermerait un
    // magasin — et une licence — tout seul.
    const corps = corpsM3('ca_request_store_removal')
    expect(corps).toContain('insert into public.store_requests')
    expect(corps).not.toMatch(/delete from public\.stores/)
    expect(corps).toContain("'remove'")
  })

  it('la garde porte sur l’entreprise du magasin visé', () => {
    const corps = corpsM3('ca_request_store_removal')
    expect(corps).toContain('select s.company_id, s.name into v_company, v_name')
    expect(corps).toContain('public.is_company_admin(v_company)')
  })

  it('une seule demande de suppression à la fois par magasin', () => {
    expect(corpsM3('ca_request_store_removal')).toContain("r.kind = 'remove' and r.status = 'pending'")
  })

  it('seul Quantinvo l’honore, par le chemin de suppression existant', () => {
    const corps = corpsM3('admin_fulfil_store_removal')
    expect(corps).toContain('if not public.is_admin() then')
    expect(corps).toContain('public.admin_delete_store(v_req.store_id)')
    expect(corps).toContain("if v_req.kind <> 'remove' then")
    expect(corps).toContain("if v_req.status <> 'pending' then")
  })

  it('supprimer un magasin emporte ses inventaires — et ne casse plus', () => {
    // `inventory_sessions.store_id` référence `stores` en NO ACTION : la
    // suppression échouait sur une violation de contrainte dès que le magasin
    // avait connu un inventaire. Le bouton de la console était cassé pour tout
    // magasin ayant servi.
    const corps = corpsM3('admin_delete_store')
    expect(corps).toContain('delete from public.inventory_sessions where store_id = p_store_id')
    expect(corps).toContain('log_admin_action')
    // Et l'écran le dit avant, plutôt que de le faire découvrir après.
    const console = lire('../app/admin/entreprise/[companyId]/page.tsx')
    expect(console).toContain('Ses inventaires et tous leurs comptages seront effacés')
  })

  it('« créé » ne se dit pas d’une suppression', () => {
    expect(m3).toContain("check (status in ('pending', 'created', 'removed', 'rejected'))")
    expect(m3).toContain("status = 'removed'")
  })

  it('le bouton vit sur la fiche du magasin, et s’annule', () => {
    expect(fiche).toContain("rpc('ca_request_store_removal'")
    expect(fiche).toContain('Demander la suppression')
    expect(fiche).toContain("rpc('ca_cancel_store_request'")
    // Ce que la suppression emportera se lit dans la confirmation, pas après.
    expect(fiche).toContain('effacera définitivement ses inventaires et leurs comptages')
  })

  it('les deux genres se distinguent partout où ils s’affichent', () => {
    for (const page of [
      lire('../app/magasins/page.tsx'),
      lire('../app/admin/page.tsx'),
      lire('../app/admin/entreprise/[companyId]/page.tsx'),
    ]) {
      expect(page).toContain("kind")
      expect(page).toContain("'remove'")
    }
  })
})


describe('une demande aboutie quitte l’écran, et se dit par e-mail', () => {
  const edgeDemande = lire('../../supabase/functions/ca-request-store/index.ts')
  const edgeCreation = lire('../../supabase/functions/admin-fulfil-store-request/index.ts')

  it('la liste du client ne garde que ce sur quoi il peut agir', () => {
    // Constat de Julien : « Alltricks — Magasin créé » restait affiché sous
    // « Demandes de magasin », alors que le magasin était créé puis supprimé.
    // Une demande aboutie n'est plus une demande.
    const corps = corpsDe('ca_list_store_requests')
    expect(corps).toContain("r.status = 'pending'")
    expect(corps).toContain("r.status = 'rejected'")
    // L'ancienne règle montrait tout ce qui avait été traité depuis 30 jours,
    // statut compris : c'est elle qui affichait « Magasin créé ».
    expect(corps).not.toMatch(/or r\.handled_at > now\(\) - interval '30 days'/)
  })

  it('la trace reste en base et dans la console', () => {
    // On cesse d'afficher, on n'efface pas : la console Quantinvo garde 90
    // jours, et la purge à un an ne bouge pas.
    expect(corpsDe('admin_list_store_requests')).toContain("interval '90 days'")
    expect(corpsDe('ca_list_store_requests')).not.toContain('delete from')
  })

  it('les deux e-mails passent par des fonctions edge, avec le jeton de l’appelant', () => {
    // Ni l'une ni l'autre n'ajoute de droit : la garde reste celle de la RPC
    // (is_company_admin / is_admin, double authentification comprise). Une
    // création appelée en service_role contournerait tout.
    expect(edgeDemande).toContain("caller.rpc('ca_request_store'")
    expect(edgeCreation).toContain("caller.rpc('admin_fulfil_store_request'")
    for (const src of [edgeDemande, edgeCreation]) {
      expect(src).toContain('Authorization: authHeader')
      expect(src).not.toMatch(/createClient\(url, serviceKey\)/)
      expect(src).toContain('emailQuantinvo')
    }
  })

  it('le code d’accès du magasin ne part jamais par e-mail', () => {
    // Il ouvre l'entrée dans le magasin. L'e-mail renvoie vers la fiche, où il
    // se lit derrière une session.
    expect(edgeCreation).not.toContain('join_code')
    expect(corpsDe('admin_fulfil_store_request')).not.toMatch(/'join_code',/)
  })

  it('un e-mail qui ne part pas n’annule ni la demande ni le magasin', () => {
    // La ligne est déjà écrite quand on envoie : un échec Resend doit se dire,
    // pas faire croire que rien n'a été fait.
    expect(edgeDemande).toContain('sansAccuse')
    expect(edgeDemande).toContain('success: true, requested: true, emailed: false')
    expect(edgeCreation).toContain('sansAvis')
    expect(edgeCreation).toContain('emailed: false')
  })

  it('les deux écrans retombent sur la RPC si l’edge est injoignable', () => {
    expect(pageMagasins).toContain("functions.invoke('ca-request-store'")
    expect(pageMagasins).toContain("supabase.rpc('ca_request_store'")
    expect(ficheEntreprise).toContain("functions.invoke('admin-fulfil-store-request'")
    expect(ficheEntreprise).toContain("appel('admin_fulfil_store_request'")
  })
})
