// Faux Supabase pour les tests de bout en bout.
//
// Le conteneur de développement n'a pas accès au réseau vers *.supabase.co :
// on intercepte donc les appels au niveau du navigateur et on répond depuis les
// fixtures. L'application testée est la vraie — mêmes composants, mêmes
// requêtes, mêmes rendus — seul le serveur est simulé.

import type { Page, Route } from '@playwright/test'
import * as F from './fixtures'

export const SUPABASE_URL = 'https://heabesqvlinzarqenymj.supabase.co'
const PROJECT_REF = 'heabesqvlinzarqenymj'

/** Journal des mutations, pour vérifier ce que l'interface a réellement envoyé. */
export type Calls = {
  rpc: { name: string; body: unknown }[]
  patches: { table: string; body: unknown }[]
  auth: { path: string; body: unknown }[]
}

type State = {
  zones: typeof F.ZONES
  audits: typeof F.AUDITS
  session: typeof F.SESSION
  importState: { articles: number; stock: number }
}

function json(route: Route, body: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', ...headers },
    body: JSON.stringify(body),
  })
}

/** PostgREST renvoie un objet (et non un tableau) quand le client demande
 *  `maybeSingle()` / `single()` via l'en-tête Accept. */
function respond(route: Route, rows: unknown[]) {
  const accept = route.request().headers()['accept'] ?? ''
  if (accept.includes('pgrst.object')) return json(route, rows[0] ?? null)
  return json(route, rows)
}

export async function mockSupabase(
  page: Page,
  { authenticated = true }: { authenticated?: boolean } = {},
): Promise<Calls> {
  const calls: Calls = { rpc: [], patches: [], auth: [] }
  const state: State = {
    zones: JSON.parse(JSON.stringify(F.ZONES)),
    audits: JSON.parse(JSON.stringify(F.AUDITS)),
    session: JSON.parse(JSON.stringify(F.SESSION)),
    importState: { ...F.IMPORT_STATE },
  }

  // Session d'authentification déposée directement dans le stockage de session
  // — c'est là que vit le jeton depuis que la session ne survit plus à la
  // fermeture du navigateur — supabase-js la relit sans appel réseau tant
  // qu'elle n'est pas expirée.
  await page.addInitScript(([ref, profile, withSession]) => {
    if (withSession) {
      const expires = Math.floor(Date.now() / 1000) + 3600
      window.sessionStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
        access_token: 'test-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: expires,
        refresh_token: 'test-refresh',
        user: {
          id: (profile as { id: string }).id,
          aud: 'authenticated',
          role: 'authenticated',
          email: 'sup@example.test',
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-01-01T00:00:00Z',
        },
      }))
    }
    window.localStorage.setItem('quantinvo-theme', 'dark')
  }, [PROJECT_REF, F.PROFILE, authenticated] as const)

  // Le service Realtime est injoignable ici : on coupe court pour que
  // l'interface bascule tout de suite sur son mode dégradé (« Temps réel
  // indisponible » + sondage), qui est justement un comportement à vérifier.
  await page.route(`${SUPABASE_URL}/realtime/**`, route => route.abort())

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS',
        },
      })
    }

    // ── Authentification ────────────────────────────────────────────────────
    if (path.startsWith('/auth/v1/')) {
      let body: unknown = null
      try { body = request.postDataJSON() } catch { /* corps vide */ }
      // La query fait partie de l'enregistrement : c'est elle qui porte
      // `grant_type` et `redirect_to`.
      calls.auth.push({ path: path.replace('/auth/v1', '') + url.search, body })

      // Connexion par mot de passe : gotrue renvoie la session complète.
      if (path.endsWith('/token')) {
        const expires = Math.floor(Date.now() / 1000) + 3600
        return json(route, {
          access_token: 'test-token', token_type: 'bearer',
          expires_in: 3600, expires_at: expires, refresh_token: 'test-refresh',
          user: {
            id: F.PROFILE.id, aud: 'authenticated', role: 'authenticated',
            email: 'sup@example.test', app_metadata: {}, user_metadata: {},
            created_at: '2026-01-01T00:00:00Z',
          },
        })
      }
      // Mot de passe oublié : 200 vide, que le compte existe ou non — comme
      // Supabase, qui ne divulgue rien à l'appelant.
      if (path.endsWith('/recover')) return json(route, {})
      if (path.endsWith('/user')) return json(route, { id: F.PROFILE.id, email: 'sup@example.test' })
      return json(route, {})
    }

    // ── RPC ─────────────────────────────────────────────────────────────────
    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.replace('/rest/v1/rpc/', '')
      let body: unknown = null
      try { body = request.postDataJSON() } catch { /* corps vide */ }
      calls.rpc.push({ name, body })

      switch (name) {
        case 'get_zone_dashboard': return json(route, state.zones)
        case 'get_session_activity': return json(route, F.activity())
        case 'get_session_results': return json(route, F.RESULTS)
        case 'get_session_detail': return json(route, F.DETAIL)
        case 'recompute_session_audit': return json(route, { success: true, failed: 2, pending: 1, total: 4 })
        case 'get_my_stores': return json(route, F.STORES)

        case 'resolve_audit': {
          const b = body as { p_sku: string; p_zone: string; p_final_qty: number }
          const line = state.audits.find(a => a.sku === b.p_sku && a.zone === b.p_zone)
          if (line) {
            line.status = 'resolved'
            line.final_qty = b.p_final_qty
            line.resolved_by = F.SUPERVISOR_ID
            line.updated_at = new Date().toISOString()
          }
          return json(route, { success: true })
        }

        case 'delete_audit_line': {
          const b = body as { p_sku: string; p_zone: string }
          state.audits = state.audits.filter(a => !(a.sku === b.p_sku && a.zone === b.p_zone))
          return json(route, { success: true })
        }

        case 'define_zone': {
          const b = body as { p_name: string; p_code_start: number; p_code_end: number }
          for (let c = b.p_code_start; c <= b.p_code_end; c++) {
            const code = String(c)
            const existing = state.zones.find(z => z.code === code)
            if (existing) existing.name = b.p_name
            else state.zones.push({
              id: `zone-${code}`, code, name: b.p_name,
              count_status: 'pending', audit_status: 'pending',
              count_units: 0, count_lines: 0, audit_units: 0, audit_lines: 0,
            })
          }
          return json(route, { success: true, created: b.p_code_end - b.p_code_start + 1, name: b.p_name })
        }

        case 'delete_zone': {
          const b = body as { p_name: string }
          const before = state.zones.length
          state.zones = state.zones.filter(z => z.name !== b.p_name)
          return json(route, { success: true, deleted: before - state.zones.length })
        }

        case 'set_balise': {
          const b = body as { p_code: string; p_mode: 'count' | 'audit'; p_open: boolean }
          const z = state.zones.find(x => x.code === b.p_code)
          if (z) {
            const next = b.p_open ? 'open' : 'done'
            if (b.p_mode === 'count') z.count_status = next
            else z.audit_status = next
          }
          return json(route, { success: true, code: b.p_code, mode: b.p_mode })
        }

        case 'create_session':
          return json(route, {
            success: true, session_id: F.SESSION_ID,
            inventory_number: 'INV-20260812-AAAA', security_code: 'ABCD12',
          })

        case 'delete_session': return json(route, { success: true })
        default: return json(route, {})
      }
    }

    // ── Tables ──────────────────────────────────────────────────────────────
    const table = path.replace('/rest/v1/', '')

    if (method === 'PATCH') {
      let body: unknown = null
      try { body = request.postDataJSON() } catch { /* corps vide */ }
      calls.patches.push({ table, body })
      if (table === 'inventory_sessions') Object.assign(state.session, body as object)
      if (table === 'article_audit') {
        const b = body as { status?: string; final_qty?: number | null }
        for (const a of state.audits) {
          if (a.status === 'resolved' && b.status) { a.status = b.status; a.final_qty = b.final_qty ?? null }
        }
      }
      return json(route, [])
    }

    if (method === 'DELETE') return json(route, [])
    if (method === 'POST') return json(route, [])

    // Comptage exact demandé via HEAD (état des imports).
    if (method === 'HEAD') {
      const n = table === 'articles' ? state.importState.articles : state.importState.stock
      return route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          // Sans cet en-tête, le navigateur refuse de laisser le client lire
          // `content-range` : le compte revient à null et l'écran affiche 0.
          // Supabase l'envoie en production ; le simulateur doit faire pareil.
          'access-control-expose-headers': 'content-range, content-length',
          'content-range': `0-${Math.max(0, n - 1)}/${n}`,
        },
        body: '',
      })
    }

    switch (table) {
      case 'profiles': return respond(route, [F.PROFILE])
      case 'inventory_sessions': return respond(route, [state.session])
      case 'session_members': return respond(route, F.MEMBERS)
      case 'session_invitations': return respond(route, [])
      case 'article_audit': return respond(route, state.audits)
      case 'articles': return respond(route, F.ARTICLES)
      case 'counts': {
        const select = url.searchParams.get('select') ?? ''
        // Deux usages distincts de la table : les totaux et le fil d'activité.
        if (select.includes('created_at')) return respond(route, F.recentCounts())
        return respond(route, F.COUNTS_TOTALS)
      }
      default: return respond(route, [])
    }
  })

  return calls
}
