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
// (/superviseur en est sorti le 21 août 2026 : le formulaire public est
// éteint, la page n'est plus qu'une explication.)
const POINTS_DE_COLLECTE = [
  '../app/inscription/page.tsx',
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

/**
 * La politique est servie par le site depuis le 2 septembre 2026.
 *
 * Décision de Julien : une communication commerciale porte une adresse du
 * domaine, pas celle d'un hébergeur de code.
 */
describe('la politique est servie par le site', () => {
  const page = lire('../app/confidentialite/page.tsx')
  const liens = lire('../lib/links.ts')

  it('⚠️ elle LIT le document, elle ne le recopie pas', () => {
    // Recopier une politique de confidentialité, c'est garantir que les deux
    // versions divergeront — et c'est le document où ça se paie le plus cher.
    expect(page).toContain("'..', 'docs', 'privacy.html'")
    // Aucun titre de section n'est réécrit dans la page : le corps est injecté.
    expect(page).toContain('dangerouslySetInnerHTML')
    expect(page).not.toContain('Qui décide de l’usage')
  })

  it('et une lecture ratée fait ÉCHOUER la construction', () => {
    // Mieux vaut un build rouge qu'une page de confidentialité vide en ligne.
    expect(page).toContain('throw new Error')
  })

  it('les liens du produit pointent vers le domaine', () => {
    expect(liens).toContain("'https://www.quantinvo.com/confidentialite'")
    const sansCommentaires = liens
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(sansCommentaires).not.toContain('devkaylab.github.io')
  })

  it('la page publique reste hors de la coquille connectée', () => {
    // Elle s'ouvre depuis un e-mail, souvent au téléphone — et l'espace
    // connecté se ferme sous 720 px.
    // ⚠️ Sur l'IMPORT, et sur le code sans ses commentaires : l'en-tête du
    // fichier explique justement pourquoi la page reste dehors, donc il cite
    // `AppShell`. Troisième fois aujourd'hui qu'une garde échoue sur sa propre
    // documentation.
    const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/import .*AppShell/)
    expect(code).toContain('legal-wrap')
  })
})
