import { test } from '@playwright/test'

// Captures des pages PUBLIQUES, pour illustrer les présentations
// (`docs/entreprise/deck/`). Elles n'ont besoin d'aucune session ni d'aucun
// faux Supabase : ces pages s'ouvrent sans compte.
//
// Lancer avec : npx playwright test captures-publiques
//
// ⚠️ Le thème clair est imposé : la charte « Papier » des decks est sur fond
// blanc, une capture sombre y ferait un trou noir au milieu de la page.

// ⚠️ Deux éléments flottants n'ont rien à faire dans un livrable client :
// l'indicateur de développement de Next (la pastille « N ») et le bouton de
// thème du site. Ils sont masqués à la capture, pas retirés du produit.
const MASQUE = `
  nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }
  .theme-toggle, [aria-label*="thème"], [aria-label*="theme"] { display: none !important; }
`

const PAGES = [
  { nom: 'tarifs', url: '/tarifs', attendre: '.tarifs-grille' },
  { nom: 'souscrire', url: '/souscrire?offre=advanced', attendre: '.souscrire' },
  { nom: 'accueil', url: '/', attendre: 'main' },
  { nom: 'pourquoi', url: '/pourquoi-nous-choisir', attendre: 'main' },
]

test.describe('captures publiques', () => {
  test('desktop', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('quantinvo-theme', 'light'))
    await page.setViewportSize({ width: 1440, height: 1100 })
    for (const p of PAGES) {
      await page.goto(p.url)
      await page.waitForSelector(p.attendre)
      await page.addStyleTag({ content: MASQUE })
      await page.waitForTimeout(900)
      await page.screenshot({ path: `screenshots/light-desktop-${p.nom}.png`, fullPage: true })
    }
  })

  // Le hub de téléchargement ne montre ses badges de boutique que sur un
  // téléphone : sur un poste il propose l'espace web. C'est cette version-là
  // qu'il faut au dossier DSI, d'où le user-agent mobile.
  test('telechargement, vu d’un telephone', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    const page = await ctx.newPage()
    await page.addInitScript(() => window.localStorage.setItem('quantinvo-theme', 'light'))
    await page.goto('/open')
    await page.waitForSelector('.auth-card')
    await page.addStyleTag({ content: MASQUE })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: 'screenshots/light-mobile-telechargement.png' })
    await ctx.close()
  })
})
