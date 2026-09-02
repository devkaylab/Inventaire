// Les ventes en cours, d'un bout à l'autre (22 août 2026).
//
// Julien, une fois le devis envoyé : « où passent les infos sur mon compte
// admin ? Je vois rien ». Le tableau de bord ne voyait que `pending`, la
// fiche entreprise perdait une demande dès qu'elle était devisée, et
// l'acceptation ne remontait que par une variable jamais posée.
//
// Ce que ces tests gardent : chaque étape a un tour, un état et un geste ;
// la RPC rend tout ce qui n'est pas terminé dans les deux tables ; et l'avis
// d'acceptation part sans variable à poser.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { derniereDefinition } from './migrations'
import {
  SEUILS_VENTE, type VenteEnCours, alerteDensite, enAttenteCents, lienVente, lireVente, trierVentes,
} from '../lib/pipeline'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260822240001_pipeline_ventes.sql')
const pageAdmin = lire('../app/admin/page.tsx')
const ficheEntreprise = lire('../app/admin/entreprise/[companyId]/page.tsx')
const edgeAccept = lire('../../supabase/functions/accept-quote/index.ts')

const le = (j: string) => new Date(`2026-08-${j}T10:00:00Z`)
const base: VenteEnCours = {
  kind: 'company', id: 'a', company_id: null, company_name: 'ACME', label: 'ACME',
  detail: '3 magasins', contact: 'Marie Durand', status: 'pending',
  quote_reference: '', quote_amount_cents: null, created_at: le('20').toISOString(),
  quote_sent_at: null, quote_expires_at: null, accepted_at: null, paid_at: null,
}

describe('à chaque étape, qui attend quoi', () => {
  it('une demande sans devis nous attend, et traîne après deux jours', () => {
    expect(lireVente(base, le('20')).tour).toBe('nous')
    expect(lireVente(base, le('20')).retard).toBe(false)
    expect(lireVente(base, le('22')).retard).toBe(true)
    expect(lireVente(base, le('22')).geste).toBe('Établir le devis')
  })

  it('un devis envoyé attend le client — puis nous, passé le seuil', () => {
    const v: VenteEnCours = {
      ...base, status: 'quoted', quote_reference: 'DEV-1',
      quote_sent_at: le('20').toISOString(), quote_expires_at: le('30').toISOString(),
    }
    expect(lireVente(v, le('22')).tour).toBe('client')
    expect(lireVente(v, le('22')).retard).toBe(false)
    const tard = lireVente(v, le(String(20 + SEUILS_VENTE.relancerApres)))
    expect(tard.tour).toBe('nous')
    expect(tard.geste).toBe('Relancer')
  })

  it('un devis expiré sans réponse nous revient', () => {
    const v: VenteEnCours = {
      ...base, status: 'quoted', quote_reference: 'DEV-1',
      quote_sent_at: le('01').toISOString(), quote_expires_at: le('20').toISOString(),
    }
    const l = lireVente(v, le('23'))
    expect(l.tour).toBe('nous')
    expect(l.retard).toBe(true)
    expect(l.etat).toContain('expiré')
  })

  it('accepté = le client paie chez Stripe ; on le relance passé le seuil', () => {
    // Plus de « Facturer » : le paiement passe par Stripe dès l'accord.
    const acc = lireVente({ ...base, status: 'accepted', accepted_at: le('21').toISOString() }, le('21'))
    expect(acc.tour).toBe('client')
    expect(acc.etat).toContain('en attente du paiement')
    const tard = lireVente({ ...base, status: 'accepted', accepted_at: le('10').toISOString() }, le('21'))
    expect(tard.tour).toBe('nous')
    expect(tard.geste).toBe('Relancer')
  })

  it('payé sans créé, c’est un webhook qui n’est pas passé : à nous', () => {
    // Le webhook crée dans la foulée du paiement. Ce cas ne devrait jamais
    // durer ; s'il dure, le bouton de création manuelle reste là.
    const paye = lireVente({ ...base, status: 'paid', paid_at: le('21').toISOString() }, le('21'))
    expect(paye.tour).toBe('nous')
    expect(paye.geste).toBe('Créer l’entreprise')
    const mag = lireVente({ ...base, kind: 'store', status: 'paid', paid_at: le('21').toISOString() }, le('21'))
    expect(mag.geste).toBe('Créer le magasin')
  })

  it('une suppression de magasin n’a qu’une étape, à nous', () => {
    const l = lireVente({ ...base, kind: 'store_removal' }, le('20'))
    expect(l.tour).toBe('nous')
    expect(l.geste).toBe('Traiter')
  })

  it('ce qui nous attend passe avant ce qui attend le client, le plus ancien d’abord', () => {
    const attendClient: VenteEnCours = {
      ...base, id: 'c', status: 'quoted', created_at: le('10').toISOString(),
      quote_sent_at: le('21').toISOString(), quote_expires_at: le('30').toISOString(),
    }
    const recent: VenteEnCours = { ...base, id: 'r', created_at: le('22').toISOString() }
    const ancien: VenteEnCours = { ...base, id: 'o', created_at: le('19').toISOString() }
    expect(trierVentes([attendClient, recent, ancien], le('22')).map((v) => v.id)).toEqual(['o', 'r', 'c'])
  })

  it('le lien mène là où le geste se fait', () => {
    expect(lienVente(base)).toBe('/admin/console')
    expect(lienVente({ ...base, kind: 'store', company_id: 'xyz' })).toBe('/admin/entreprise/xyz')
  })

  it('le revenu en attente ne compte que les devis pas encore encaissés', () => {
    const ventes: VenteEnCours[] = [
      { ...base, status: 'quoted', quote_amount_cents: 100 },
      { ...base, status: 'accepted', quote_amount_cents: 10 },
      { ...base, status: 'paid', quote_amount_cents: 1 },
      { ...base, kind: 'store_removal', status: 'pending', quote_amount_cents: 1000 },
    ]
    expect(enAttenteCents(ventes)).toBe(110)
  })

  it('et il se lit à l’année, pas à l’échéance', () => {
    // ⚠️ 2 septembre 2026 : un devis mensuel se règle par douzièmes. Sommer les
    // échéances afficherait 1 200 € pour une affaire qui en vaut 14 400 — un
    // indicateur de revenu qui divise par douze n'est plus un indicateur.
    // Le calcul vit en base (`annuel_du_devis`), parce que le rythme seul ne
    // suffit pas : la souscription en ligne écrit un montant déjà annuel sur
    // une demande mensuelle.
    const ventes: VenteEnCours[] = [
      { ...base, status: 'quoted', quote_amount_cents: 120_000, billing_period: 'monthly', annual_cents: 1_275_000 },
    ]
    expect(enAttenteCents(ventes)).toBe(1_275_000)
    // Sans le calcul de la base — une demande d'avant la bascule — on retombe
    // sur le montant du devis, qui est annuel.
    expect(enAttenteCents([{ ...base, status: 'quoted', quote_amount_cents: 660_000 }])).toBe(660_000)
  })
})

describe('la base et les écrans', () => {
  // ⚠️ La définition qui FAIT FOI, pas un fichier nommé en dur : `admin_pipeline`
  // a été réécrite le 2 septembre 2026 (appareils, rythme, montant annuel).
  const corps = (fn: string) => derniereDefinition(fn).corps

  it('admin_pipeline rend tout ce qui n’est pas terminé, dans les deux tables', () => {
    const c = corps('admin_pipeline')
    expect(c).toContain('from public.company_requests')
    expect(c).toContain('from public.store_requests')
    expect(c.match(/status in \('pending', 'quoted', 'accepted', 'paid'\)/g)?.length).toBe(2)
  })

  it('la fiche entreprise ne perd plus une demande devisée', () => {
    // L'ancienne règle — `pending` ou traité depuis 90 jours — laissait tomber
    // `quoted`, `accepted` et `paid`, qui n'ont pas de handled_at.
    // Sans la parenthèse fermante : la liste de la console porte aussi
    // `declined` depuis le 22 août au soir, et l'assertion vise l'intention —
    // « en cours » veut dire « pas terminé », jamais « pending ».
    expect(corps('admin_list_store_requests')).toContain("r.status in ('pending', 'quoted', 'accepted', 'paid'")
    expect(ficheEntreprise).toContain('demandes.filter(enCours)')
  })

  it('le tableau de bord lit admin_pipeline et sépare les deux tours', () => {
    expect(pageAdmin).toContain("rpc('admin_pipeline')")
    expect(pageAdmin).toContain('Ventes en cours')
    expect(pageAdmin).toContain("lireVente(x).tour === 'nous'")
  })

  it('l’avis d’acceptation part aux administrateurs sans variable à poser', () => {
    expect(corps('admin_notify_emails')).toContain('p.is_admin')
    expect(migration).toContain('revoke all on function public.admin_notify_emails() from public, anon, authenticated')
    expect(edgeAccept).toContain("rpc('admin_notify_emails')")
  })
})

describe('le stock déclaré qui surprend remonte sur la ligne', () => {
  // Julien : « un grand magasin mettrait un stock théorique à 1 000 pièces
  // pour une surface de 10 000 m² = fraudeur ». Le repère doit se voir avant
  // d'envoyer le devis, pas après avoir ouvert la fiche.
  const magasinGeneraliste = { ...base, ape: '47.19Z' }

  it('signale 1 000 pièces sur 10 000 m², et nomme le magasin', () => {
    const v: VenteEnCours = { ...magasinGeneraliste, stores: [{ name: 'Grand Magasin', units: 1000, sqm: 10000 }] }
    const a = alerteDensite(v)
    expect(a).not.toBeNull()
    expect(a).toContain('Grand Magasin')
    expect(a).toContain('très faible')
    // Jamais le mot « fraude » : deux déclarations de la même personne ne se
    // contrôlent pas l'une l'autre, c'est un appel à passer.
    expect(a!.toLowerCase()).not.toContain('fraud')
  })

  it('se tait sur une densité plausible, ou quand un chiffre manque', () => {
    expect(alerteDensite({ ...magasinGeneraliste, stores: [{ name: 'A', units: 120_000, sqm: 1200 }] })).toBeNull()
    expect(alerteDensite({ ...magasinGeneraliste, stores: [{ name: 'A', units: 1000, sqm: null }] })).toBeNull()
    expect(alerteDensite({ ...base, kind: 'store_removal', stores: [{ name: 'A', units: 1, sqm: 10000 }] })).toBeNull()
  })

  it('dit quand le secteur est inconnu, pour qu’un silence ne vaille pas vérification', () => {
    const v: VenteEnCours = { ...base, ape: null, stores: [{ name: 'A', units: 10, sqm: 10000 }] }
    expect(alerteDensite(v)).toContain('secteur inconnu')
  })

  it('vaut aussi pour un ajout de magasin, que la RPC remonte comme un magasin déclaré', () => {
    const v: VenteEnCours = { ...base, kind: 'store', stores: [{ name: 'Annexe', units: 50, sqm: 5000 }] }
    expect(alerteDensite(v)).toContain('Annexe')
    expect(migration + lire('../../supabase/migrations/20260822260001_pipeline_densite.sql'))
      .toContain("json_build_object('name', s.store_name, 'units', s.units, 'sqm', s.sqm)")
  })

  it('passe en tête du tableau de bord tant que le devis n’est pas parti', () => {
    const douteux: VenteEnCours = { ...magasinGeneraliste, id: 'd', created_at: le('22').toISOString(), stores: [{ name: 'X', units: 1000, sqm: 10000 }] }
    const ancien: VenteEnCours = { ...base, id: 'o', created_at: le('10').toISOString() }
    expect(trierVentes([ancien, douteux], le('22')).map((v) => v.id)).toEqual(['d', 'o'])
    expect(pageAdmin).toContain('alerteDensite(vente)')
  })
})
