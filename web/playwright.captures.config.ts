// Captures prises sur le serveur de développement DÉJÀ LANCÉ (port 3000).
//
// ⚠️ La config principale démarre le sien sur le port 3100, ce que Next 16
// REFUSE tant qu'un `next dev` tourne pour le même dossier : le run échoue sur
// « Process from config.webServer was not able to start ». C'est le cas normal
// quand on travaille — d'où cette config, qui ne démarre rien et se branche sur
// l'existant.
//
// Elle sert à refaire les captures des présentations (`docs/entreprise/deck/`) :
//
//   CHROMIUM_PATH="$HOME/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
//     npx playwright test -c playwright.captures.config.ts captures-publiques
//
// Le chemin du navigateur est explicite parce que la config principale vise
// celui d'une image Docker (`/opt/pw-browsers/chromium`), absent d'un Mac.
import { defineConfig, devices } from '@playwright/test'

const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: CHROMIUM } } },
  ],
})
