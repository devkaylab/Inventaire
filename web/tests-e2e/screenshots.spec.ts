import { test } from '@playwright/test'
import { mockSupabase } from './supabase-mock'
import { SESSION_ID } from './fixtures'

// Captures de contrôle : chaque onglet, dans les deux thèmes, à trois largeurs.
// Ce n'est pas une comparaison automatique — c'est de quoi regarder le résultat.
// Lancer avec : npx playwright test screenshots

const TABS = ['suivi', 'setup', 'ecarts', 'rapport', 'equipe']
const THEMES = ['dark', 'light'] as const
const SIZES = [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'tablet', width: 900, height: 1200 },
  { name: 'mobile', width: 390, height: 1400 },
]

test.describe('captures', () => {
  for (const theme of THEMES) {
    for (const size of SIZES) {
      test(`${theme} ${size.name}`, async ({ page }) => {
        await mockSupabase(page)
        await page.addInitScript(t => window.localStorage.setItem('quantinvo-theme', t), theme)
        await page.setViewportSize({ width: size.width, height: size.height })

        for (const tab of TABS) {
          await page.goto(`/dashboard/${SESSION_ID}?tab=${tab}`)
          await page.waitForSelector('.dash-tabs')
          // Laisse retomber les états de chargement des onglets qui recalculent.
          await page.waitForTimeout(900)
          await page.screenshot({
            path: `screenshots/${theme}-${size.name}-${tab}.png`,
            fullPage: true,
          })
        }

        await page.goto('/dashboard')
        await page.waitForSelector('.dash-kpis')
        await page.screenshot({ path: `screenshots/${theme}-${size.name}-liste.png`, fullPage: true })

        await page.goto('/dashboard/new')
        await page.waitForSelector('form')
        await page.screenshot({ path: `screenshots/${theme}-${size.name}-creation.png`, fullPage: true })
      })
    }
  }
})
