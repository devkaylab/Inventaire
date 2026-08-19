// L'information des personnes se perd facilement : un formulaire ajouté sans la
// mention, un prestataire ajouté sans être déclaré, et l'obligation n'est plus
// tenue sans que rien ne le signale. Ces tests figent les deux points relevés
// par l'audit du 13 août (constats E5 et E6).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')

// Tout formulaire collectant des données personnelles auprès d'une personne
// non encore connectée.
const POINTS_DE_COLLECTE = [
  '../app/inscription/page.tsx',
  '../app/superviseur/page.tsx',
  '../app/bienvenue/page.tsx',
  '../app/mot-de-passe-oublie/page.tsx',
]

describe('information au point de collecte', () => {
  it.each(POINTS_DE_COLLECTE)('%s affiche la mention', (page) => {
    const source = lire(page)
    expect(source).toContain('<MentionCollecte')
    expect(source).toContain("from '@/components/MentionCollecte'")
  })

  it('la mention renvoie à la politique et cite le recours CNIL', () => {
    const source = lire('../components/MentionCollecte.tsx')
    expect(source).toContain('PRIVACY_URL')
    expect(source).toContain('CNIL')
  })
})

describe('politique de confidentialité', () => {
  const politique = lire('../../docs/privacy.html')

  it('déclare chaque destinataire des données', () => {
    // Omettre un prestataire est précisément ce que l'audit a relevé.
    for (const prestataire of ['Supabase', 'Vercel', 'Resend', 'Expo']) {
      expect(politique, `${prestataire} n'est pas déclaré`).toContain(prestataire)
    }
  })

  it('traite les transferts hors UE, les durées et le recours à la CNIL', () => {
    for (const mention of [
      'Transferts hors de l’Union européenne'.replace('’', "'"),
      'Durées de conservation',
      'CNIL',
      'cnil.fr',
    ]) {
      expect(politique, `mention absente : ${mention}`).toContain(mention)
    }
  })

  it('décrit l’activité en direct, et dit qu’elle ne nomme personne', () => {
    // Le suivi était nominatif jusqu'au 19 août 2026 ; il est désormais
    // agrégé (constat E3). Si le produit revenait à un suivi individuel, la
    // politique devrait le redire — ce test tomberait d'abord.
    expect(politique).toContain('Activité en direct')
    expect(politique).toContain('agrégés')
    expect(politique).toMatch(/Aucun nom n['’]y figure/)
  })
})
