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
        // ⚠️ Le navigateur de Playwright est en anglais, et le site suit la
        // langue de l'appareil depuis le 11 septembre 2026 : sans ce cookie,
        // toutes les captures sortent en anglais. Elles servent aux decks,
        // qui sont en français.
        await page.context().addCookies([
          { name: 'qlang', value: 'fr', url: 'http://127.0.0.1:3100' },
        ])
        await page.setViewportSize({ width: size.width, height: size.height })

        for (const tab of TABS) {
          await page.goto(`/dashboard/${SESSION_ID}?tab=${tab}`)
          // `.dash-tabs` est masqué sur mobile (menu burger) : on attend le
          // conteneur, présent à toutes les largeurs.
          await page.waitForSelector('.dash-main')
          // Laisse retomber les états de chargement des onglets qui recalculent.
          await page.waitForTimeout(900)
          await page.screenshot({
            path: `screenshots/${theme}-${size.name}-${tab}.png`,
            fullPage: true,
          })
        }

        await page.goto('/dashboard')
        await page.waitForSelector('.tb-kpis')
        await page.screenshot({ path: `screenshots/${theme}-${size.name}-tableau-de-bord.png`, fullPage: true })

        await page.goto('/inventaires')
        // La rangée de tuiles s'appelle `.resume-bande` depuis la refonte des
        // pages connectées du 5 septembre 2026 ; `.dash-kpis` n'existe plus.
        await page.waitForSelector('.resume-bande')
        await page.screenshot({ path: `screenshots/${theme}-${size.name}-liste.png`, fullPage: true })

        await page.goto('/dashboard/new')
        await page.waitForSelector('form')
        await page.screenshot({ path: `screenshots/${theme}-${size.name}-creation.png`, fullPage: true })
      })
    }
  }
})
