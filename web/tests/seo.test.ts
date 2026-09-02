// Ce que les moteurs et les assistants voient du site.
//
// Avant le 2 septembre 2026, le site n'avait NI `robots.txt`, NI plan du site,
// NI Open Graph, NI données structurées, et une seule balise titre pour toutes
// ses pages. Ces tests figent les fondations posées ce jour-là — leur intérêt
// n'est pas de vérifier que Next fonctionne, mais qu'une page publique ajoutée
// plus tard ne reste pas invisible, et qu'une page privée ne devienne pas
// visible.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const APP = path.resolve(__dirname, '../app')

const site = lire('../lib/site.ts')
const robots = lire('../app/robots.ts')
const layout = lire('../app/layout.tsx')
const structurees = lire('../components/DonneesStructurees.tsx')

/** Les segments de premier niveau qui portent réellement une page. */
function routes(): string[] {
  return readdirSync(APP, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(path.join(APP, d.name, 'page.tsx')))
    .map(d => d.name)
}

describe('le site est explorable', () => {
  it('l’origine canonique porte le www, comme le domaine', () => {
    // ⚠️ `quantinvo.com` redirige en 308 vers `www`. Déclarer l'origine sans
    // `www` ferait pointer les balises canoniques et le plan du site vers des
    // adresses qui redirigent — c'est ce qui dilue un référencement.
    expect(site).toContain("export const SITE_URL = 'https://www.quantinvo.com'")
    expect(lire('../lib/links.ts')).toContain('https://www.quantinvo.com/')
  })

  it('le plan du site ne cite que des pages qui existent', () => {
    const chemins = [...site.matchAll(/chemin: '([^']+)'/g)].map(m => m[1])
    expect(chemins.length).toBeGreaterThan(5)
    for (const c of chemins) {
      const attendu = c === '/'
        ? path.join(APP, 'page.tsx')
        : path.join(APP, c.replace(/^\//, ''), 'page.tsx')
      expect(existsSync(attendu), `${c} est au plan du site mais n’a pas de page`).toBe(true)
    }
  })

  it('toute page publique nouvelle entre au plan du site, ou est écartée nommément', () => {
    // ⚠️ C'est LE test utile de ce fichier. Une page publique ajoutée dans six
    // mois et oubliée du plan du site ne se verrait nulle part : ni erreur, ni
    // avertissement, juste une page que personne ne trouve. Ici, elle fait
    // échouer la suite tant que quelqu'un n'a pas tranché.
    const ECARTEES = new Set([
      // Étapes de parcours, arrivées par un lien personnel : rien à indexer.
      'bienvenue', 'reinitialisation', 'mot-de-passe-oublie', 'login',
      // Une page par prospect, derrière un jeton : l'indexer publierait des devis.
      'devis',
      // L'espace connecté — il ne s'ouvre même pas sous 720 px.
      'dashboard', 'inventaires', 'entreprise', 'equipe', 'magasins',
      'journal', 'messages', 'admin', 'outils', 'account',
      // Se met elle-même en noindex tant que l'éditeur n'est pas immatriculé.
      'mentions-legales',
    ])
    const auPlan = new Set(
      [...site.matchAll(/chemin: '\/([^']*)'/g)].map(m => m[1].split('/')[0]).filter(Boolean),
    )
    const orphelines = routes().filter(r => !ECARTEES.has(r) && !auPlan.has(r))
    expect(orphelines, `pages publiques absentes du plan du site : ${orphelines.join(', ')}`).toEqual([])
  })

  it('les pages à jeton et l’espace connecté sont fermés aux robots', () => {
    for (const chemin of ['/devis/', '/dashboard', '/admin', '/account', '/messages']) {
      expect(robots, `${chemin} doit être fermé`).toContain(`'${chemin}'`)
    }
    expect(robots).toContain('sitemap')
  })
})

describe('ce qu’un aperçu de partage affiche', () => {
  it('une base d’adresses absolue est déclarée', () => {
    // Sans `metadataBase`, Next rend l'adresse de l'image en relatif et aucun
    // aperçu ne peut la charger.
    expect(layout).toContain('metadataBase: new URL(SITE_URL)')
  })

  it('l’image de partage existe vraiment, à la bonne taille', () => {
    const og = path.resolve(__dirname, '../public/og.png')
    expect(existsSync(og), 'web/public/og.png manque — le générer par docs/entreprise/boutiques/produire.mjs').toBe(true)
    expect(layout).toContain('width: 1200, height: 630')
  })

  it('aucun titre de page ne répète la marque', () => {
    // ⚠️ Le gabarit du layout ajoute « — Quantinvo ». Les pages le portaient
    // aussi en dur : elles affichaient « Tarifs — Quantinvo — Quantinvo ».
    expect(layout).toContain("template: '%s — Quantinvo'")
    for (const r of routes()) {
      const f = path.join(APP, r, 'page.tsx')
      const t = readFileSync(f, 'utf8').match(/^\s*title: '([^']*)'/m)?.[1]
      if (!t) continue
      expect(t, `${r} répète la marque : le gabarit l’ajoute déjà`).not.toMatch(/— Quantinvo$/)
    }
  })
})

describe('les données structurées disent ce que la page dit', () => {
  it('les prix viennent de la grille, jamais recopiés', () => {
    // Les decks ont porté une grille remplacée pendant une semaine. Un
    // balisage périmé serait pire : il est lu par des machines.
    expect(structurees).toContain("import { OFFRES } from '@/lib/offres'")
    expect(structurees).toContain('offers: OFFRES.map')
    expect(structurees).not.toMatch(/price: \d{3,}/)
  })

  it('le JSON est échappé avant d’entrer dans le document', () => {
    expect(structurees).toContain("replace(/</g, '\\\\u003c')")
  })

  it('le prix est annoncé hors taxes, comme sur la page', () => {
    expect(structurees).toContain('valueAddedTaxIncluded: false')
  })

  it('l’éditeur et le site sont déclarés une fois, à la racine', () => {
    expect(layout).toContain('<OrganisationJsonLd />')
  })
})

describe('la suppression de compte a une adresse publique', () => {
  const page = lire('../app/suppression-compte/page.tsx')

  it('la page existe et reste hors de la coquille', () => {
    // ⚠️ Google Play l'exige : un lien web accessible SANS installer
    // l'application. Derrière une connexion, elle ne remplirait pas la
    // condition — la personne qui veut supprimer son compte est justement
    // celle qui n'arrive plus à entrer.
    expect(page).not.toContain('<AppShell')
    expect(page).not.toContain('useAuthGuard')
  })

  it('elle donne les deux chemins, et dit ce qui reste', () => {
    expect(page).toContain('Depuis l’application')
    expect(page).toContain('Par courrier électronique')
    // La politique de confidentialité dit la même chose en section 9 : les
    // comptages sont conservés par l'entreprise, détachés de l'identité.
    expect(page).toContain('détachés de votre')
    expect(lire('../../docs/privacy.html')).toContain('détachés de votre identité')
  })

  it('elle n’est pas fermée aux robots', () => {
    expect(robots).not.toContain('suppression-compte')
    expect(site).toContain("chemin: '/suppression-compte'")
  })
})
