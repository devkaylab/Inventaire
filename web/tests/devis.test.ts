// Le devis part tout seul, et s'accepte en ligne (22 août 2026).
//
// Ce que ces tests empêchent de défaire :
//   · la grille du site et celle des fonctions edge ne doivent pas diverger —
//     le devis affiché en console et le PDF envoyé sont le même document ;
//   · l'acceptation **ne crée rien** : la création d'entreprise reste derrière
//     l'encaissement, c'est elle qui rendra la bascule Stripe indolore ;
//   · la lecture publique par jeton ne rend jamais d'adresse e-mail ;
//   · la page du devis reste hors de la coquille (elle s'ouvre au téléphone).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GRILLE_CENTIMES, lignesProposees, referenceProposee, totalProposeCents } from '../lib/devis'
import { elementsDevis } from '../../supabase/functions/_shared/devis'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260822220001_devis_envoye_et_accepte.sql')
const partage = lire('../../supabase/functions/_shared/devis.ts')
const edgeEnvoi = lire('../../supabase/functions/admin-send-quote/index.ts')
const edgeAccept = lire('../../supabase/functions/accept-quote/index.ts')
const edgePdf = lire('../../supabase/functions/quote-pdf/index.ts')
const pageDevis = lire('../app/devis/[token]/page.tsx')
const console_ = lire('../components/admin/CompanyRequests.tsx')

const corpsDe = (fn: string) => migration.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''

describe('les lignes proposées', () => {
  const stores = [
    { name: 'Lyon Part-Dieu', units: 180_000, sqm: 1200 },
    { name: 'Paris Centre', units: 42_000, sqm: 400 },
    { name: 'Annecy', units: 8_500, sqm: 150 },
  ]

  it('place chaque magasin dans sa tranche et totalise', () => {
    const lignes = lignesProposees(stores, 3)
    expect(lignes.map((l) => l.tranche)).toEqual(['Grande surface', 'Magasin', 'Boutique'])
    expect(totalProposeCents(lignes).cents).toBe(660_000 + 420_000 + 210_000)
  })

  it('garde le magasin sans volume, sans le chiffrer', () => {
    // L'escamoter ferait un devis incomplet sans le dire.
    const lignes = lignesProposees([{ name: 'Nouveau magasin' }], 1)
    expect(lignes).toHaveLength(1)
    expect(lignes[0].prixCents).toBeNull()
    expect(totalProposeCents(lignes).cents).toBe(0)
  })

  it('ne compte pas un magasin sur devis comme gratuit', () => {
    const lignes = lignesProposees([{ name: 'Hyper', units: 3_000_000 }], 1)
    expect(lignes[0].prixCents).toBeNull()
    expect(totalProposeCents(lignes)).toEqual({ cents: 0, surDevis: 1 })
  })

  it('retombe sur le nombre de magasins déclaré quand rien n’est détaillé', () => {
    // Les demandes d'avant le 21 août 2026 n'ont pas de magasins détaillés.
    expect(lignesProposees(null, 2).map((l) => l.libelle)).toEqual(['Magasin 1', 'Magasin 2'])
  })

  it('propose une référence stable pour une même demande', () => {
    const a = referenceProposee(2026, 'abc-def')
    expect(a).toBe(referenceProposee(2026, 'abc-def'))
    expect(a).toMatch(/^DEV-2026-\d{4}$/)
    expect(a).not.toBe(referenceProposee(2026, 'autre-demande'))
  })
})

describe('la grille du site et celle des fonctions edge', () => {
  it('sont les mêmes, tranche par tranche', () => {
    // Duplication volontaire (npm d'un côté, esm.sh de l'autre) : ce test est
    // ce qui l'empêche de devenir une divergence.
    const edge = [...partage.matchAll(/\{ max: ([\w_]+), profil: '([^']+)', prixCents: ([\w_]+) \}/g)].map((m) => ({
      max: m[1] === 'null' ? null : Number(m[1].replace(/_/g, '')),
      profil: m[2],
      prixCents: m[3] === 'null' ? null : Number(m[3].replace(/_/g, '')),
    }))
    expect(edge).toHaveLength(GRILLE_CENTIMES.length)
    expect(edge).toEqual(GRILLE_CENTIMES.map((t) => ({ max: t.max, profil: t.profil, prixCents: t.prixCents })))
  })
})

describe('la mise en page du devis', () => {
  const devis = {
    reference: 'DEV-2026-0007',
    entreprise: 'ACME Retail',
    contact: 'Marie Durand',
    siren: '123456789',
    lignes: lignesProposees([{ name: 'Lyon', units: 180_000 }], 1),
    totalCents: 660_000,
    emisLe: new Date('2026-08-22T10:00:00Z'),
    expireLe: new Date('2026-09-21T10:00:00Z'),
  }

  it('porte la référence, le total et les dates', () => {
    const textes = elementsDevis(devis).filter((e) => e.type === 'texte').map((e) => (e as { texte: string }).texte)
    expect(textes).toContain('DEV-2026-0007')
    expect(textes).toContain('ACME Retail')
    const plat = textes.map((t) => t.replace(/[\s\u202f\u00a0]/g, ' '))
    expect(plat.some((t) => t.includes('6 600,00'))).toBe(true)
    expect(plat.some((t) => t.includes('22/08/2026'))).toBe(true)
    expect(plat.some((t) => t.includes('21/09/2026'))).toBe(true)
  })

  it('tient sur une page, quel que soit le nombre de magasins', () => {
    // Un devis de trois pages ne se lit pas mieux, et la ligne de total doit
    // rester sous les yeux.
    const beaucoup = { ...devis, lignes: lignesProposees(Array.from({ length: 40 }, (_, i) => ({ name: `M${i}`, units: 5000 })), 40) }
    const els = elementsDevis(beaucoup)
    const yMax = Math.max(...els.map((e) => (e.type === 'trait' ? e.y2 : e.type === 'bloc' ? e.y + e.hauteur : e.y)))
    expect(yMax).toBeLessThanOrEqual(297)
    const textes = els.filter((e) => e.type === 'texte').map((e) => (e as { texte: string }).texte)
    expect(textes.some((t) => t.includes('autres magasins'))).toBe(true)
  })
})

describe('envoyer, lire et accepter', () => {
  it('un nouvel envoi change le jeton', () => {
    // Renvoyer un devis doit invalider l'ancien lien, qui porterait un montant
    // périmé.
    const corps = corpsDe('admin_quote_company_request')
    expect(corps).toContain('v_token := gen_random_uuid()')
    expect(corps).toContain('quote_token = v_token')
  })

  it('la lecture publique ne rend aucune adresse e-mail', () => {
    // Un lien transféré ne doit rien apprendre de plus que le devis lui-même.
    const corps = corpsDe('quote_by_token')
    expect(corps).not.toContain('contact_email')
    expect(corps).toContain("'company_name'")
  })

  it('l’acceptation pose une date, elle ne crée rien', () => {
    const corps = corpsDe('accept_quote_by_token')
    expect(corps).toContain("status = 'accepted'")
    expect(corps).not.toMatch(/insert into public\.(companies|stores)\b/)
    // Un devis périmé est refusé : le prix a pu changer entre-temps.
    expect(corps).toContain('quote_expires_at < now()')
    // Surface publique : la limitation de débit vaut aussi ici.
    expect(corps).toContain('rate_limit_ok')
    // Un second clic n'est pas une erreur.
    expect(corps).toContain("'already', true")
  })

  it('la création d’entreprise reste derrière l’encaissement', () => {
    // C'est ce point qui rendra la bascule Stripe indolore : le webhook n'aura
    // qu'à jouer accepted → paid.
    const fulfil = lire('../../supabase/migrations/20260813000004_onboarding_rpcs.sql')
    expect(fulfil).toContain("v_req.status <> 'paid'")
  })

  it('les trois fonctions edge gardent leur place', () => {
    // L'envoi est authentifié (jeton administrateur) ; la lecture du PDF et
    // l'acceptation sont publiques, protégées par le jeton du lien.
    expect(edgeEnvoi).toContain("caller.rpc('admin_quote_company_request'")
    expect(edgeEnvoi).toContain('Authorization: authHeader')
    expect(edgeEnvoi).toContain('attachments')
    expect(edgeAccept).toContain("rpc('accept_quote_by_token'")
    expect(edgePdf).toContain("rpc('quote_by_token'")
    // Le PDF vient du même module que celui de l'envoi.
    for (const src of [edgeEnvoi, edgePdf]) expect(src).toContain("from '../_shared/devisPdf.ts'")
  })

  it('le montant envoyé est celui saisi, jamais recalculé', () => {
    // La grille propose, l'administrateur dispose : un devis se négocie.
    expect(edgeEnvoi).toContain('totalCents: amountCents')
    expect(edgeEnvoi).not.toContain('totalProposeCents')
  })

  it('la console retombe sur la RPC si l’envoi ne répond pas', () => {
    expect(console_).toContain("functions.invoke('admin-send-quote'")
    expect(console_).toContain("supabase.rpc('admin_quote_company_request'")
    expect(console_).toContain("le client n'a rien reçu")
  })

  it('la page du devis reste hors de la coquille', () => {
    // Le lien arrive par e-mail, donc s'ouvre sur un téléphone : la porte des
    // 720 px de l'espace connecté n'a pas cours ici.
    expect(pageDevis).not.toContain('<AppShell')
    expect(pageDevis).toContain("rpc('quote_by_token'")
    expect(pageDevis).toContain("functions.invoke('accept-quote'")
  })
})
