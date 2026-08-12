import { defineConfig, devices } from '@playwright/test'

// Le navigateur est pré-installé dans l'image ; on le désigne explicitement
// plutôt que de laisser Playwright chercher la révision correspondant à sa
// propre version (et tenter un téléchargement).
const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: CHROMIUM } },
    },
  ],
  webServer: {
    command: 'npx next dev -p 3100',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
