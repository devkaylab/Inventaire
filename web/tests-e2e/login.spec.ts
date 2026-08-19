import { expect, test } from '@playwright/test'
import { mockSupabase, type Calls } from './supabase-mock'

const EMAIL = 'sup@example.test'
const REF = 'heabesqvlinzarqenymj'

async function seConnecter(page: import('@playwright/test').Page, remember = false) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(EMAIL)
  await page.getByLabel('Mot de passe').fill('un-mot-de-passe-long')
  if (remember) await page.getByLabel('Se souvenir de mon identifiant').check()
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test.describe('Connexion — durée de la session', () => {
  let calls: Calls

  test.beforeEach(async ({ page }) => {
    calls = await mockSupabase(page, { authenticated: false })
  })

  test('le jeton vit en sessionStorage, jamais en localStorage', async ({ page }) => {
    await seConnecter(page)

    // C'est la garantie « fermer le navigateur déconnecte » : un jeton en
    // localStorage survivrait à la fermeture, celui de sessionStorage non.
    const stockage = await page.evaluate((ref) => ({
      session: window.sessionStorage.getItem(`sb-${ref}-auth-token`),
      locale: Object.keys(window.localStorage).filter(k => k.startsWith(`sb-${ref}-`)),
    }), REF)
    expect(stockage.session).toBeTruthy()
    expect(stockage.locale).toEqual([])

    const token = calls.auth.find(a => a.path.startsWith('/token'))
    expect(token?.path).toContain('grant_type=password')
  })

  test('un ancien jeton localStorage est purgé au chargement', async ({ page }) => {
    await page.addInitScript((ref) => {
      window.localStorage.setItem(`sb-${ref}-auth-token`, '{"access_token":"vieux"}')
    }, REF)
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()

    const restant = await page.evaluate(
      (ref) => window.localStorage.getItem(`sb-${ref}-auth-token`), REF,
    )
    expect(restant).toBeNull()
  })

  test('la case mémorise l’identifiant, pas la session', async ({ page }) => {
    await seConnecter(page, true)

    // Simule la fermeture du navigateur : la session disparaît, pas le
    // localStorage.
    await page.evaluate(() => window.sessionStorage.clear())
    await page.goto('/login')

    await expect(page.getByLabel('E-mail')).toHaveValue(EMAIL)
    await expect(page.getByLabel('Se souvenir de mon identifiant')).toBeChecked()
  })

  test('sans la case, rien n’est mémorisé', async ({ page }) => {
    await seConnecter(page, false)
    await page.evaluate(() => window.sessionStorage.clear())
    await page.goto('/login')
    await expect(page.getByLabel('E-mail')).toHaveValue('')
  })
})

test.describe('Mot de passe oublié', () => {
  let calls: Calls

  test.beforeEach(async ({ page }) => {
    calls = await mockSupabase(page, { authenticated: false })
  })

  test('envoie le lien et répond la même chose quel que soit le compte', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click()
    await expect(page).toHaveURL(/\/mot-de-passe-oublie/)

    await page.getByLabel('E-mail').fill(EMAIL)
    await page.getByRole('button', { name: 'Envoyer le lien' }).click()

    // Message volontairement neutre : dire « aucun compte pour cette adresse »
    // rouvrirait l'oracle d'énumération fermé par le correctif M3.
    await expect(page.getByText('Si un compte existe')).toBeVisible()

    const recover = calls.auth.find(a => a.path.startsWith('/recover'))
    expect(recover?.body).toMatchObject({ email: EMAIL })
    expect(decodeURIComponent(recover?.path ?? '')).toContain('/reinitialisation')
  })

  test('le lien expiré est annoncé, avec le chemin pour en redemander un', async ({ page }) => {
    await page.goto('/reinitialisation')
    await expect(page.getByRole('heading', { name: 'Lien expiré' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: 'Demander un nouveau lien' })).toBeVisible()
  })
})

test.describe('Réinitialisation du mot de passe', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page) // session de récupération déjà ouverte
  })

  test('exige 12 caractères puis enregistre', async ({ page }) => {
    await page.goto('/reinitialisation')
    await expect(page.getByRole('heading', { name: 'Nouveau mot de passe' })).toBeVisible()

    await page.getByLabel('Nouveau mot de passe').fill('court')
    await page.getByLabel('Confirmer le mot de passe').fill('court')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.locator('.error')).toContainText('12 caractères')

    await page.getByLabel('Nouveau mot de passe').fill('un-mot-de-passe-long')
    await page.getByLabel('Confirmer le mot de passe').fill('un-mot-de-passe-long')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('heading', { name: 'Mot de passe modifié' })).toBeVisible()
  })
})
