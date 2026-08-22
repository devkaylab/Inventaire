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
import {
  SEUILS_VENTE, type VenteEnCours, enAttenteCents, lienVente, lireVente, trierVentes,
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

  it('accepté = à facturer, encaissé = à créer', () => {
    const acc = lireVente({ ...base, status: 'accepted', accepted_at: le('21').toISOString() }, le('21'))
    expect(acc.tour).toBe('nous')
    expect(acc.geste).toBe('Facturer')
    const paye = lireVente({ ...base, status: 'paid', paid_at: le('21').toISOString() }, le('21'))
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
})

describe('la base et les écrans', () => {
  const corps = (fn: string) => migration.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''

  it('admin_pipeline rend tout ce qui n’est pas terminé, dans les deux tables', () => {
    const c = corps('admin_pipeline')
    expect(c).toContain('from public.company_requests')
    expect(c).toContain('from public.store_requests')
    expect(c.match(/status in \('pending', 'quoted', 'accepted', 'paid'\)/g)?.length).toBe(2)
  })

  it('la fiche entreprise ne perd plus une demande devisée', () => {
    // L'ancienne règle — `pending` ou traité depuis 90 jours — laissait tomber
    // `quoted`, `accepted` et `paid`, qui n'ont pas de handled_at.
    expect(corps('admin_list_store_requests')).toContain("r.status in ('pending', 'quoted', 'accepted', 'paid')")
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
