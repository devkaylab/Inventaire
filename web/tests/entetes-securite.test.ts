// Les en-têtes de sécurité se perdent d'une ligne à l'autre : une règle
// assouplie « le temps de déboguer », et la protection disparaît sans que rien
// ne le signale. Ces tests figent ce que l'audit a demandé (constat M1).
import { describe, expect, it } from 'vitest'
// @ts-expect-error — configuration Next en JavaScript, sans types.
import nextConfig from '../next.config.mjs'

const entetes = async () => {
  const regles = await nextConfig.headers()
  expect(regles).toHaveLength(1)
  expect(regles[0].source).toBe('/:path*')     // toutes les pages, sans exception
  return Object.fromEntries(regles[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]))
}

describe('en-têtes de sécurité', () => {
  it('couvre les six en-têtes attendus', async () => {
    const h = await entetes()
    for (const cle of [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
    ]) {
      expect(h[cle], `${cle} manquant`).toBeTruthy()
    }
  })

  it('interdit l’encadrement de la page', async () => {
    const h = await entetes()
    expect(h['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(h['X-Frame-Options']).toBe('DENY')
  })

  it('n’autorise le réseau que vers soi-même et Supabase', async () => {
    const connect = (await entetes())['Content-Security-Policy']
      .split(';').map(d => d.trim()).find(d => d.startsWith('connect-src'))
    expect(connect).toBeDefined()
    expect(connect).toMatch(/supabase\.co/)
    expect(connect).toMatch(/wss:/)          // le temps réel passe par WebSocket
    expect(connect).not.toMatch(/\*/)        // jamais de joker
  })

  it('ferme les vecteurs qui n’ont aucune raison d’être ouverts', async () => {
    const csp = (await entetes())['Content-Security-Policy']
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })

  it('n’autorise aucun script d’un autre domaine', async () => {
    const script = (await entetes())['Content-Security-Policy']
      .split(';').map(d => d.trim()).find(d => d.startsWith('script-src'))
    // `unsafe-inline` est assumé (hydratation Next, script de thème) ; en
    // revanche aucune origine externe, et jamais `unsafe-eval`.
    expect(script).not.toMatch(/https?:\/\//)
    expect(script).not.toContain('unsafe-eval')
  })

  it('déclare que le site n’utilise ni caméra, ni micro, ni géolocalisation', async () => {
    const h = await entetes()
    for (const capacite of ['camera=()', 'microphone=()', 'geolocation=()']) {
      expect(h['Permissions-Policy']).toContain(capacite)
    }
  })
})
