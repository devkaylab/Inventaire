import { expect, test, type Page } from '@playwright/test'
import { mockSupabase, type Calls } from './supabase-mock'
import { SESSION_ID } from './fixtures'

let calls: Calls

test.beforeEach(async ({ page }) => {
  calls = await mockSupabase(page)
})

async function openTab(page: Page, label: string) {
  await page.getByRole('tab', { name: label }).click()
}

async function gotoDashboard(page: Page, tab?: string) {
  await page.goto(`/dashboard/${SESSION_ID}${tab ? `?tab=${tab}` : ''}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

test.describe('Tableau de bord — profil de l’inventaire', () => {
  test('affiche l’en-tête, la progression et les cinq onglets', async ({ page }) => {
    await gotoDashboard(page)

    await expect(page.getByRole('heading', { name: 'Test' })).toBeVisible()
    await expect(page.getByText('INV-20260807-C255')).toBeVisible()

    // 3 balises comptées sur 10.
    await expect(page.getByText('30', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('des balises comptées')).toBeVisible()
    const rail = page.locator('.dash-progress')
    await expect(rail.locator('.dash-bar-legend', { hasText: 'Comptage' })).toContainText('3/10')
    await expect(rail.locator('.dash-bar-legend', { hasText: 'Audit' })).toContainText('2/10')
    // Le rail résume ce qui reste sans répéter la liste par zone du Suivi.
    await expect(rail.locator('.dash-missing-row')).toContainText('7 balises')

    for (const label of ['Suivi', 'Set up', 'Écarts d’audit', 'Rapport', 'Équipe']) {
      await expect(page.getByRole('tab', { name: label })).toBeVisible()
    }
    await expect(page.getByRole('tab')).toHaveCount(5)
  })

  test('l’onglet vit dans l’URL et survit au rechargement', async ({ page }) => {
    await gotoDashboard(page)
    await openTab(page, 'Rapport')
    await expect(page).toHaveURL(/tab=rapport/)

    await page.reload()
    await expect(page.getByRole('tab', { name: 'Rapport' })).toHaveAttribute('aria-selected', 'true')
  })

  test('les anciennes adresses zones et fichiers mènent à Set up', async ({ page }) => {
    await gotoDashboard(page, 'fichiers')
    await expect(page.getByRole('tab', { name: 'Set up' })).toHaveAttribute('aria-selected', 'true')

    await gotoDashboard(page, 'zones')
    await expect(page.getByRole('tab', { name: 'Set up' })).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('Suivi — qui compte quelle balise', () => {
  test('montre chaque personne, son mode et sa balise', async ({ page }) => {
    await gotoDashboard(page, 'suivi')

    const counter = page.locator('.person-row', { hasText: 'Compte Test Compteur' })
    await expect(counter).toBeVisible()
    await expect(counter).toContainText('balise 5373')
    await expect(counter.locator('.mode-badge')).toHaveText('Comptage')

    const supervisor = page.locator('.person-row', { hasText: 'Compte Test Sup' })
    await expect(supervisor).toContainText('balise 5372')
    await expect(supervisor.locator('.mode-badge')).toHaveText('Audit')
  })

  test('sans temps réel, ne prétend jamais que quelqu’un est « en ligne »', async ({ page }) => {
    // Le canal Realtime est coupé dans le harnais : la présence est vide et
    // seule l'activité déduite des comptages subsiste. C'est exactement la
    // situation d'un magasin sans réseau, et l'interface doit le dire.
    await gotoDashboard(page, 'suivi')

    await expect(page.getByText('Temps réel indisponible')).toBeVisible()
    await expect(page.locator('.person-row').first()).toContainText('dernier scan')
    await expect(page.locator('.person-state-online')).toHaveCount(0)
  })

  test('résume l’avancement par zone, sans numéro de balise', async ({ page }) => {
    await gotoDashboard(page, 'suivi')

    // La ligne de correction (quantité négative) doit rester visible.
    await expect(page.locator('.feed-row', { hasText: 'ABC1236' })).toContainText('-1')

    // Une seule zone dans le jeu de données : comptées 3/10 (30 %), auditées 2/10 (20 %).
    const row = page.locator('.zone-progress', { hasText: 'Surface de vente' })
    await expect(row.locator('.dash-bar-legend', { hasText: 'Comptées' })).toContainText('3/10 · 30 %')
    await expect(row.locator('.dash-bar-legend', { hasText: 'Auditées' })).toContainText('2/10 · 20 %')
    // Les numéros de balises n'apparaissent pas tant qu'on n'a pas ouvert le détail.
    await expect(page.locator('.balise-chip')).toHaveCount(0)
  })

  test('le nom de la zone ouvre le détail de ses balises', async ({ page }) => {
    await gotoDashboard(page, 'suivi')

    await page.locator('.zone-progress', { hasText: 'Surface de vente' }).click()
    await expect(page.locator('.balise-chip')).toHaveCount(10)
    await page.getByRole('button', { name: 'À faire' }).click()
    await expect(page.locator('.balise-chip')).toHaveCount(6)

    // Le retour ramène à la vue d'ensemble.
    await page.getByRole('button', { name: '← Suivi' }).click()
    await expect(page.locator('.zone-progress')).toBeVisible()
  })

  test('rouvre une balise restée ouverte depuis le détail de la zone', async ({ page }) => {
    await gotoDashboard(page, 'suivi')

    await page.locator('.zone-progress', { hasText: 'Surface de vente' }).click()
    await page.locator('.balise-chip', { hasText: '5371' }).last().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Balise 5371')

    await dialog.getByRole('button', { name: 'Rouvrir' }).first().click()
    await expect(page.locator('.toast-success')).toContainText('rouverte')

    const call = calls.rpc.find(c => c.name === 'set_balise')
    expect(call?.body).toMatchObject({ p_code: '5371', p_open: true })
  })
})

test.describe('Set up — balises', () => {
  test('affecte une plage à un emplacement', async ({ page }) => {
    await gotoDashboard(page, 'setup')

    await page.getByLabel('Emplacement').fill('Réserve')
    await page.getByLabel('Balise début').fill('20')
    await page.getByLabel('Balise fin').fill('24')
    await page.getByRole('button', { name: 'Affecter' }).click()

    await expect(page.locator('.toast-success')).toContainText('5 balises affectées')
    await expect(page.locator('.zone-card', { hasText: 'Réserve' })).toContainText('20 → 24')

    const call = calls.rpc.find(c => c.name === 'define_zone')
    expect(call?.body).toMatchObject({ p_name: 'Réserve', p_code_start: 20, p_code_end: 24 })
  })

  test('refuse une plage invalide avant d’appeler le serveur', async ({ page }) => {
    await gotoDashboard(page, 'setup')

    await page.getByLabel('Emplacement').fill('Réserve')
    await page.getByLabel('Balise début').fill('30')
    await page.getByLabel('Balise fin').fill('10')
    await page.getByRole('button', { name: 'Affecter' }).click()

    await expect(page.locator('.error')).toContainText('inférieure ou égale')
    expect(calls.rpc.filter(c => c.name === 'define_zone')).toHaveLength(0)
  })
})

test.describe('Écarts d’audit — comptage contre audit', () => {
  test('distingue les trois natures d’écart', async ({ page }) => {
    await gotoDashboard(page, 'ecarts')

    // Deux écarts de quantité (balise 5371) et un article trouvé à l'audit
    // sans avoir jamais été compté (balise 5372).
    await expect(page.locator('.dash-audit-row', { hasText: 'Tee-shirt coton' })).toContainText('Quantités différentes')
    await expect(page.locator('.dash-audit-row', { hasText: 'Casquette' })).toContainText("Trouvé à l'audit, jamais compté")

    const tee = page.locator('.dash-audit-row', { hasText: 'Tee-shirt coton' })
    await expect(tee).toContainText('-3')
  })

  test('la ligne déjà arbitrée est dans l’historique, pas dans les écarts', async ({ page }) => {
    await gotoDashboard(page, 'ecarts')

    await expect(page.locator('.dash-audit-list').first()).not.toContainText('Sweat capuche')
    await page.getByText('Écarts arbitrés').click()
    await expect(page.locator('.collapsible-body')).toContainText('Sweat capuche')
  })

  test('« Auditeur » retient la quantité de l’auditeur', async ({ page }) => {
    await gotoDashboard(page, 'ecarts')

    const row = page.locator('.dash-audit-row', { hasText: 'Tee-shirt coton' })
    await row.getByRole('button', { name: 'Auditeur' }).click()
    await expect(page.locator('.toast-success')).toBeVisible()

    const call = calls.rpc.find(c => c.name === 'resolve_audit')
    expect(call?.body).toMatchObject({ p_sku: 'ABC1234', p_zone: '5371', p_final_qty: 1 })
  })

  test('accepte une quantité saisie avec une virgule', async ({ page }) => {
    // Le défaut d'origine : parseFloat('1,5') valait 1 et l'arbitrage partait
    // silencieusement faux.
    await gotoDashboard(page, 'ecarts')

    const row = page.locator('.dash-audit-row', { hasText: 'Tee-shirt coton' })
    await row.getByLabel('Quantité retenue').fill('2,5')
    await row.getByRole('button', { name: 'Retenir' }).click()

    const call = calls.rpc.find(c => c.name === 'resolve_audit')
    expect(call?.body).toMatchObject({ p_final_qty: 2.5 })
  })

  test('bloque une saisie qui n’est pas un nombre', async ({ page }) => {
    await gotoDashboard(page, 'ecarts')

    const row = page.locator('.dash-audit-row', { hasText: 'Tee-shirt coton' })
    await row.getByLabel('Quantité retenue').fill('abc')
    await expect(row.getByRole('button', { name: 'Retenir' })).toBeDisabled()
    expect(calls.rpc.filter(c => c.name === 'resolve_audit')).toHaveLength(0)
  })
})

test.describe('Rapport', () => {
  test('affiche la synthèse, le statut et alerte sur les écarts non arbitrés', async ({ page }) => {
    await gotoDashboard(page, 'rapport')

    await expect(page.locator('.dash-stat', { hasText: 'Démarque' })).toContainText('-140,00 €')
    await expect(page.locator('.dash-stat', { hasText: 'Écart (valeur achat)' })).toContainText('-140,00 €')
    await expect(page.locator('.banner-warn')).toContainText('non arbitré')
    await expect(page.locator('.dash-audit-badge', { hasText: 'Écart de comptage' }).first()).toBeVisible()
  })

  test('filtre et trie le tableau', async ({ page }) => {
    await gotoDashboard(page, 'rapport')

    await page.getByPlaceholder('Rechercher un article').fill('casquette')
    await expect(page.locator('tbody tr')).toHaveCount(1)

    await page.getByPlaceholder('Rechercher un article').fill('')
    await page.getByRole('columnheader', { name: /Écart/ }).first().click()
    await expect(page.locator('tbody tr').first()).toContainText('Tee-shirt coton')
  })

  test('télécharge le rapport Excel avec les deux feuilles', async ({ page }) => {
    await gotoDashboard(page, 'rapport')

    await page.getByRole('button', { name: 'Télécharger' }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('dialog').getByRole('button', { name: 'Excel (.xlsx)' }).click()
    const file = await download

    expect(file.suggestedFilename()).toMatch(/^inventaire_INV-20260807-C255_\d{4}-\d{2}-\d{2}\.xlsx$/)
    // Le détail par balise n'est chargé qu'au moment de l'export.
    expect(calls.rpc.some(c => c.name === 'get_session_detail')).toBe(true)
  })

  test('télécharge aussi en CSV', async ({ page }) => {
    await gotoDashboard(page, 'rapport')

    await page.getByRole('button', { name: 'Télécharger' }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('dialog').getByRole('button', { name: 'CSV (2 fichiers)' }).click()
    expect((await download).suggestedFilename()).toMatch(/\.csv$/)
  })
})

test.describe('Set up — fichiers', () => {
  test('montre ce qui est déjà chargé et les colonnes acceptées', async ({ page }) => {
    await gotoDashboard(page, 'setup')

    await expect(page.getByText('Référentiel articles').first()).toBeVisible()
    await expect(page.getByText('références chargées')).toBeVisible()
    await expect(page.getByText('Code article, Référence, Réf').first()).toBeVisible()
  })

  test('prévient qu’un import remplace ce qui est déjà chargé', async ({ page }) => {
    await gotoDashboard(page, 'setup')

    await page.locator('.import-step', { hasText: 'Référentiel articles' })
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'catalogue.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('SKU;EAN;Marque;Libellé\nA1;3701;Nike;Tee-shirt\n'),
      })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Remplacer le référentiel articles')
    await expect(dialog).toContainText('21 ligne(s) sont déjà chargées')
    await expect(dialog).toContainText('Les comptages déjà enregistrés ne sont pas touchés')
  })
})

test.describe('Équipe et cycle de vie', () => {
  test('affiche identifiants, membres et rôles', async ({ page }) => {
    await gotoDashboard(page, 'equipe')

    await expect(page.locator('.cred-value', { hasText: 'INV-20260807-C255' })).toBeVisible()
    await expect(page.locator('.cred-value', { hasText: 'K7QP2M' })).toBeVisible()
    await expect(page.locator('.person-row', { hasText: 'Compte Test Sup' })).toContainText('Créateur')
    await expect(page.locator('.person-row', { hasText: 'Compte Test Compteur' })).toContainText('Compteur')
  })

  test('clôturer conserve les données et ne supprime rien', async ({ page }) => {
    await gotoDashboard(page, 'equipe')

    await page.getByRole('button', { name: 'Clôturer', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('lecture seule')
    await expect(dialog).toContainText('Toutes les données sont conservées')
    await dialog.getByRole('button', { name: 'Clôturer' }).click()

    // Une mise à jour du statut, pas un appel à delete_session.
    expect(calls.patches.find(p => p.table === 'inventory_sessions')?.body)
      .toMatchObject({ status: 'closed' })
    expect(calls.rpc.some(c => c.name === 'delete_session')).toBe(false)
  })

  test('la suppression définitive exige de recopier le numéro d’inventaire', async ({ page }) => {
    await gotoDashboard(page, 'equipe')

    await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('irréversible')

    const confirm = dialog.getByRole('button', { name: 'Supprimer définitivement' })
    await expect(confirm).toBeDisabled()

    await dialog.getByRole('textbox').fill('INV-20260807-C255')
    await expect(confirm).toBeEnabled()
  })

  test('une fois clôturé, le rapport reste téléchargeable et les actions disparaissent', async ({ page }) => {
    await gotoDashboard(page, 'equipe')
    await page.getByRole('button', { name: 'Clôturer', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Clôturer' }).click()
    await expect(page.locator('.toast-success')).toContainText('clôturé')

    await expect(page.locator('.banner-info')).toContainText('aucun comptage ne peut plus')
    await expect(page.getByRole('button', { name: 'Rouvrir' })).toBeVisible()

    await openTab(page, 'Écarts d’audit')
    await expect(page.getByRole('button', { name: 'Auditeur' })).toHaveCount(0)

    await openTab(page, 'Rapport')
    await expect(page.getByRole('button', { name: 'Télécharger', exact: true })).toBeEnabled()
  })
})

test.describe('Version mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('les sections passent dans un menu burger', async ({ page }) => {
    await gotoDashboard(page)

    // La barre d'onglets a cédé la place au bouton burger.
    await expect(page.getByRole('tab', { name: 'Suivi' })).toBeHidden()
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()

    const nav = page.locator('.mobile-nav')
    for (const label of ['Suivi', 'Set up', 'Écarts d’audit', 'Rapport', 'Équipe', 'Mes inventaires', 'Mon compte']) {
      await expect(nav.getByText(label)).toBeVisible()
    }

    // Choisir une section navigue et referme le menu.
    await nav.getByRole('button', { name: 'Écarts d’audit' }).click()
    await expect(page).toHaveURL(/tab=ecarts/)
    await expect(page.getByText('Écarts à traiter')).toBeVisible()
    await expect(page.locator('.mobile-nav')).toHaveCount(0)
  })

  test('le menu se referme sans choisir, par la croix ou le fond', async ({ page }) => {
    await gotoDashboard(page)

    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    await page.getByRole('button', { name: 'Fermer le menu' }).click()
    await expect(page.locator('.mobile-nav')).toHaveCount(0)

    await page.getByRole('button', { name: 'Ouvrir le menu' }).click()
    await page.locator('.mobile-nav-overlay').click({ position: { x: 10, y: 400 } })
    await expect(page.locator('.mobile-nav')).toHaveCount(0)
  })
})

test.describe('Création d’un inventaire', () => {
  test('crée puis enchaîne sur Set up', async ({ page }) => {
    await page.goto('/dashboard/new')

    await page.getByLabel('Nom de l’inventaire').fill('Inventaire annuel')
    await page.getByLabel('Magasin').selectOption('store-1')
    await page.getByRole('button', { name: 'Créer l’inventaire' }).click()

    await expect(page).toHaveURL(/tab=setup/)
    const call = calls.rpc.find(c => c.name === 'create_session')
    expect(call?.body).toMatchObject({ p_name: 'Inventaire annuel', p_store_id: 'store-1', p_uses_zones: true })
  })

  test('le mode classique enchaîne aussi sur Set up', async ({ page }) => {
    await page.goto('/dashboard/new')

    await page.getByLabel('Nom de l’inventaire').fill('Sans balise')
    await page.getByLabel('Magasin').selectOption('store-1')
    await page.getByLabel('Organisation du comptage').selectOption('classic')
    await page.getByRole('button', { name: 'Créer l’inventaire' }).click()

    await expect(page).toHaveURL(/tab=setup/)
  })
})
