/**
 * Les conditions générales publiées et acceptées, et l'adresse des magasins
 * déclarés (16 septembre 2026).
 *
 * ⚠️ Avant ce jour, l'article 3 des conditions décrivait une acceptation que le
 * produit ne recueillait nulle part, et l'article 9.5 (une licence pour le seul
 * magasin déclaré) se prouvait mal : on ne demandait que le NOM du magasin.
 * Ces gardes empêchent de revenir en arrière sur l'un ou l'autre.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { derniereDefinition } from './migrations'
import { blocs, passagePublie, VERSION_CONDITIONS } from '@/lib/conditions'
import { magasinVide, refusMagasin } from '@/lib/inscription'
import { PAGES_PUBLIQUES } from '@/lib/site'

const racine = path.resolve(__dirname, '../..')
const lire = (p: string) => readFileSync(path.join(racine, p), 'utf8')
/** Le code sans ses commentaires : ils expliquent, donc ils citent. */
const code = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const espaces = (s: string) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ')

describe('le texte publié', () => {
  const source = lire('docs/entreprise/cgv-quantinvo-brouillon.md')

  it('se tire du fichier du dépôt, sans ses notes internes', () => {
    const texte = passagePublie(source)
    expect(texte.startsWith('## 1. Identification')).toBe(true)
    expect(texte).not.toContain('Points à trancher')
    expect(texte).not.toContain('Statut')
  })

  it('porte la clause des magasins déclarés et l’archivage', () => {
    const texte = passagePublie(source)
    expect(texte).toContain('Usage limité aux Magasins déclarés')
    expect(texte).toContain('douze mois après la clôture')
    // L'annexe de sous-traitance est ÉCRITE, plus un renvoi à un fichier.
    expect(texte).toContain('A1.5')
  })

  it('refuse de se construire si une note interne traîne', () => {
    const fautif = source.replace('## 2. Définitions', '## 2. Définitions\n\n[à compléter]')
    expect(() => passagePublie(fautif)).toThrow()
  })

  it('se découpe en titres, paragraphes, listes et tableaux', () => {
    const b = blocs(passagePublie(source))
    expect(b.some((x) => x.type === 'titre')).toBe(true)
    expect(b.some((x) => x.type === 'liste')).toBe(true)
    expect(b.some((x) => x.type === 'tableau')).toBe(true)
  })

  it('la page LIT le fichier, elle ne le recopie pas', () => {
    const page = lire('web/app/conditions-generales/page.tsx')
    expect(page).toContain("'cgv-quantinvo-brouillon.md'")
    expect(page).toContain('passagePublie(')
  })

  it('figure au plan du site et au pied de page', () => {
    expect(PAGES_PUBLIQUES.map((p) => p.chemin)).toContain('/conditions-generales')
    expect(code(lire('web/components/SiteChrome.tsx'))).toContain('href="/conditions-generales"')
  })
})

describe('l’acceptation', () => {
  it('⚠️ la version du site est celle de la base', () => {
    const { corps } = derniereDefinition('version_conditions')
    expect(corps).toContain(`'${VERSION_CONDITIONS}'`)
  })

  it('⚠️ les trois dépôts refusent sans la version en vigueur', () => {
    for (const fn of ['finaliser_inscription', 'deposer_souscription', 'deposer_ajout_magasin']) {
      const c = espaces(derniereDefinition(fn).corps)
      expect(c, fn).toContain('p_cgv_version is distinct from public.version_conditions()')
      expect(c, fn).toContain('cgv_acceptees_le')
    }
  })

  it('les trois fonctions edge font suivre la version', () => {
    for (const f of ['inscription', 'subscribe-online', 'libre-service']) {
      expect(code(lire(`supabase/functions/${f}/index.ts`)), f).toContain("p_cgv_version: texte('cgvVersion')")
    }
  })

  it('⚠️ la case n’est jamais cochée d’avance', () => {
    const c = code(lire('web/components/AccepterConditions.tsx'))
    expect(c).toContain('type="checkbox"')
    expect(c).not.toContain('defaultChecked')
    for (const f of ['web/components/vitrine/PageInscription.tsx', 'web/components/vitrine/PageSouscrire.tsx', 'web/components/PayerEnLigne.tsx']) {
      expect(code(lire(f)), f).not.toMatch(/\[accepte, setAccepte\] = useState\(true\)/)
    }
  })

  it('⚠️ les trois gestes qui ouvrent une licence la montrent, et bloquent le paiement sans elle', () => {
    for (const f of ['web/components/vitrine/PageInscription.tsx', 'web/components/vitrine/PageSouscrire.tsx']) {
      const c = code(lire(f))
      expect(c, f).toContain('<AccepterConditions')
      expect(c, f).toMatch(/disabled=\{[^}]*!accepte\}/)
      expect(c, f).toContain('cgvVersion: VERSION_CONDITIONS')
    }
    const payer = code(lire('web/components/PayerEnLigne.tsx'))
    expect(payer).toContain('avecConditions && <AccepterConditions')
    expect(payer).toContain('(avecConditions && !accepte)')
    // L'ajout de magasin la demande ; le changement d'offre, non.
    expect(code(lire('web/app/magasins/page.tsx'))).toMatch(/action: 'magasin'[\s\S]{0,300}avecConditions/)
  })
})

describe('l’adresse du magasin déclaré', () => {
  it('l’inscription la demande avant d’aller plus loin', () => {
    const m = { ...magasinVide(), nom: 'Lyon', tranche: '2' }
    expect(refusMagasin(m)).toContain('adresse')
    expect(refusMagasin({ ...m, adresse: '12 rue de la Paix, 75002 Paris' })).toBeNull()
  })

  it('les trois dépôts l’exigent, et la création la reporte sur le magasin', () => {
    expect(espaces(derniereDefinition('finaliser_inscription').corps)).toContain("public.adresse_propre(v_el ->> 'address')")
    expect(espaces(derniereDefinition('deposer_souscription').corps)).toContain('public.adresse_propre(p_store_address)')
    expect(espaces(derniereDefinition('deposer_ajout_magasin').corps)).toContain('public.adresse_propre(p_address)')
    const f = espaces(derniereDefinition('fulfil_paid_request').corps)
    expect(f).toContain("public.adresse_propre(v_decl ->> 'address')")
    expect(f).toContain('v_sub, v_sto.address)')
  })

  it('la fiche du magasin l’affiche, et dit quand elle manque', () => {
    expect(espaces(derniereDefinition('ca_store_detail').corps)).toContain("'address', s.address")
    const fiche = code(lire('web/app/magasins/[storeId]/page.tsx'))
    expect(fiche).toContain("vide={t('Adresse non renseignée')}")
  })

  it('se modifie depuis la fiche, par l’administrateur, et se journalise avec l’adresse d’avant', () => {
    const c = espaces(derniereDefinition('ca_set_store_address').corps)
    expect(c).toContain('public.is_company_admin()')
    // La garde porte sur l'entreprise DU MAGASIN, jamais sur un paramètre.
    expect(c).toContain('where id = p_store_id and company_id = v_company')
    expect(c).toContain('public.adresse_propre(p_address)')
    expect(c).toContain("json_build_object('avant', v_avant")
    expect(code(lire('web/app/magasins/[storeId]/page.tsx'))).toContain("supabase.rpc('ca_set_store_address'")
  })

  it('les trois écrans la font suivre', () => {
    expect(code(lire('web/components/vitrine/PageInscription.tsx'))).toContain("address: (m.adresse ?? '').trim()")
    expect(code(lire('web/components/vitrine/PageSouscrire.tsx'))).toContain('storeAddress,')
    expect(code(lire('web/app/magasins/page.tsx'))).toContain('address: adresse')
  })
})
