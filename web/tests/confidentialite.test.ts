// L'information des personnes se perd facilement : un formulaire ajouté sans la
// mention, un prestataire ajouté sans être déclaré, et l'obligation n'est plus
// tenue sans que rien ne le signale. Ces tests figent les deux points relevés
// par l'audit du 13 août (constats E5 et E6).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { derniereDefinition } from './migrations'

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

describe('l’adresse publiée est celle du domaine', () => {
  // ⚠️ La politique publiait `devkaylab@gmail.com` comme adresse des demandes
  // RGPD — sur une page désormais liée depuis Google Play et depuis
  // l'application. Décision de Julien, 2 septembre 2026 : c'est
  // `contact@quantinvo.com` partout où un client la lit. La boîte est la même
  // (ImprovMX redirige), seule l'adresse affichée change.
  //
  // ⚠️ AGENTS.md garde la mention du Gmail : elle documente la redirection,
  // c'est un fait technique, pas une adresse publiée.
  const publics = [
    ['la politique de confidentialité', '../../docs/privacy.html'],
    ['les mentions légales', '../app/mentions-legales/page.tsx'],
    ['l’identité de l’éditeur', '../lib/legal.ts'],
    ['le modèle de devis', '../../docs/entreprise/modeles/devis.html'],
    ['le modèle de facture', '../../docs/entreprise/modeles/facture.html'],
    ['le générateur des modèles', '../../docs/entreprise/modeles/generer.py'],
  ] as const

  it.each(publics)('%s ne porte aucune adresse personnelle', (_, chemin) => {
    expect(lire(chemin)).not.toContain('devkaylab@gmail.com')
  })

  it('la politique donne bien une adresse de contact', () => {
    expect(lire('../../docs/privacy.html')).toContain('contact@quantinvo.com')
  })
})

/**
 * Ce que la purge fait, la politique le dit (5 septembre 2026)
 *
 * ⚠️ TROUVÉ EN RELISANT LA POLITIQUE, PAS PAR UN TEST — et c'est bien le
 * problème. Le parcours d'inscription a introduit deux traitements de données
 * personnelles : le brouillon (`inscriptions`) et le CODE de vérification
 * (`codes_email`), qui n'avait alors AUCUNE purge et gardait indéfiniment
 * l'adresse de qui avait seulement demandé un code.
 *
 * La section 7 énumère les durées et affirme qu'elles s'appliquent
 * automatiquement. Une politique qui en oublie une est aussi fausse qu'une
 * politique qui cache un manque. Cette garde ferme l'écart dans le sens qui
 * compte : **toute table purgée doit être déclarée**.
 */
describe('ce que la purge efface, la politique l’annonce', () => {
  const { corps } = derniereDefinition('purge_expired_data')
  // Le document mêle les deux apostrophes ; on compare le texte, pas sa
  // ponctuation.
  const apos = (t: string) => t.replace(/\u2019/g, "'")
  const politique = apos(readFileSync(path.join(__dirname, '../../docs/privacy.html'), 'utf8'))

  /** Les tables que la purge nettoie réellement, lues dans son corps. */
  const purgees = [...corps.matchAll(/delete from public\.(\w+)/g)].map((m) => m[1])

  /**
   * Ce que chaque table nettoyée doit avoir dit à la personne. Une table
   * ajoutée à la purge sans entrée ici fait échouer la suite : c'est le
   * rappel qu'il faut aller relire la section 7.
   */
  const declaree: Record<string, string> = {
    team_invitations: 'Invitations',
    session_invitations: 'Invitations',
    supervisor_requests: 'Demandes',
    company_requests: 'Demandes d’inscription d’une entreprise',
    account_deletion_requests: 'Demandes de suppression de compte',
    admin_audit_log: 'Journaux d’administration',
    company_audit_log: 'Journaux d’administration',
    store_requests: 'Demandes d’ajout ou de suppression de magasin',
    stripe_events_traites: '',   // technique : aucune donnée personnelle
    notifications: '',
    message_fils: '',
    appareils_actifs: '',        // aucun compte n'y est rattaché (constat E3)
    appareils_par_jour: '',
    submission_attempts: '',
    inscriptions: 'Inscription commencée et non terminée',
    codes_email: 'Code de vérification d’adresse',
  }

  it('déclare chaque table que la purge nettoie', () => {
    for (const t of new Set(purgees)) {
      expect(declaree, `\`${t}\` est purgée mais n’est pas classée ici — relisez la section 7`)
        .toHaveProperty(t)
      const attendu = declaree[t]
      if (!attendu) continue
      expect(politique, `la politique doit annoncer ce qui arrive à \`${t}\``)
        .toContain(apos(attendu))
    }
  })

  it('et les deux durées du parcours d’inscription y sont', () => {
    expect(corps).toContain("inscriptions_ttl     constant interval := interval '30 days'")
    expect(corps).toContain("codes_email_ttl      constant interval := interval '24 hours'")
    expect(politique).toContain('gardées 30 jours')
    expect(politique).toContain('supprimée au bout de 24 heures')
    // ⚠️ Le code n'est jamais conservé en clair, et la politique le dit — c'est
    // une promesse que `demander_code_email` tient par bcrypt.
    expect(politique).toContain('jamais conservé en clair')
  })
})
