// Administrateur d'entreprise — tests de garde.
//
// Ce que ces tests empêchent de défaire : le verrou anti-élévation sur le
// nouveau drapeau, l'exigence de double authentification dans la garde,
// la policy d'invitations restreinte aux compteurs (le trou d'élévation
// fermé par la migration 2), la journalisation de chaque écriture, et la
// purge du journal d'entreprise.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const m1 = lire('../../supabase/migrations/20260820190001_admin_entreprise_drapeau.sql')
const m2 = lire('../../supabase/migrations/20260820190002_invitations_avec_role.sql')
const m3 = lire('../../supabase/migrations/20260820190003_fonctions_admin_entreprise.sql')
const m4 = lire('../../supabase/migrations/20260820190004_admin_gere_admin_entreprise.sql')
const pageEquipe = lire('../app/equipe/page.tsx')
const pageAdmin = lire('../app/admin/page.tsx')

describe('le drapeau et sa garde (migration 1)', () => {
  it('le verrou anti-élévation fige le nouveau drapeau', () => {
    const corps = m1.split('profiles_pin_privileged_columns()')[1] ?? ''
    expect(corps).toContain('new.is_company_admin := old.is_company_admin')
    // SECURITY INVOKER obligatoire : en DEFINER, current_user vaudrait le
    // propriétaire et le garde-fou ne s'appliquerait jamais.
    expect(corps.split('$$;')[0]).not.toMatch(/security definer/i)
  })

  it('la garde exige aal2 dès qu’un facteur TOTP vérifié existe', () => {
    const corps = m2 + m1.split('function public.is_company_admin(')[1]
    expect(corps).toContain("coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'")
    expect(corps).toContain('auth.mfa_factors')
    expect(corps).toContain("f.status = 'verified'")
  })

  it('anon ne peut pas exécuter la garde', () => {
    expect(m1).toMatch(/revoke all on function public\.is_company_admin\(uuid\) from public, anon/)
  })
})

describe('invitations avec rôle (migration 2)', () => {
  it('restreint la policy des superviseurs aux invitations de compteurs', () => {
    // Sans cette restriction, un superviseur écrirait lui-même une invitation
    // 'company_admin' que handle_new_user honorerait : élévation de privilège.
    const policy = m2.split('create policy team_invitations_supervisor')[1]?.split(';')[0] ?? ''
    expect(policy).toContain("using ((get_my_role() = 'supervisor') and (company_id = get_my_company()) and (role = 'employee'))")
    expect(policy).toContain("with check ((get_my_role() = 'supervisor') and (company_id = get_my_company()) and (role = 'employee'))")
  })

  it('traite les invitations privilégiées avant celles d’inventaire', () => {
    const corps = m2.split('function public.handle_new_user(')[1] ?? ''
    const privilegiee = corps.indexOf("v_team.role in ('supervisor', 'company_admin')")
    const session = corps.indexOf('v_session_count > 0')
    expect(privilegiee).toBeGreaterThan(-1)
    expect(session).toBeGreaterThan(privilegiee)
  })

  it('repose les droits après create or replace', () => {
    expect(m2).toMatch(/revoke all on function public\.handle_new_user\(\) from public, anon, authenticated/)
  })
})

describe('fonctions de l’administrateur d’entreprise (migration 3)', () => {
  const ECRITURES = ['ca_invite_supervisor', 'ca_set_supervisor_stores', 'ca_remove_supervisor', 'ca_cancel_invitation']

  it('chaque écriture est gardée et journalisée', () => {
    for (const fn of ECRITURES) {
      const corps = m3.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''
      expect(corps, `${fn} doit vérifier is_company_admin`).toContain('is_company_admin()')
      expect(corps, `${fn} doit appeler log_company_action`).toContain('log_company_action')
    }
  })

  it('n’avale pas les erreurs d’écriture du journal', () => {
    const corps = m3.split('function public.log_company_action(')[1]?.split('$$;')[0] ?? ''
    expect(corps).not.toMatch(/exception\s+when/i)
  })

  it('interdit l’écriture du journal aux clients', () => {
    expect(m3).toContain('create policy company_audit_log_select')
    expect(m3).not.toMatch(/create policy .* on public\.company_audit_log[\s\S]*?for (insert|update|delete)/i)
    expect(m3).toMatch(/revoke all on function public\.log_company_action[\s\S]*?from public, anon, authenticated/)
  })

  it('cloisonne : chaque fonction relit l’entreprise de l’appelant, jamais un paramètre', () => {
    for (const fn of ECRITURES) {
      const corps = m3.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''
      expect(corps, `${fn} doit déduire l'entreprise de l'appelant`)
        .toContain('select company_id into v_company from public.profiles where id = auth.uid()')
    }
  })

  it('purge le journal d’entreprise à un an', () => {
    const purge = m3.split('function public.purge_expired_data(')[1] ?? ''
    expect(purge).toContain("journal_entrep_ttl   constant interval := interval '1 year'")
    expect(purge).toContain('delete from public.company_audit_log')
  })

  it('anon n’exécute aucune fonction du chantier', () => {
    for (const fn of [...ECRITURES, 'ca_list_team']) {
      expect(m3, `${fn} doit être révoquée à anon`).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`))
    }
  })
})

describe('nomination par Quantinvo (migration 4)', () => {
  it('les deux fonctions admin sont journalisées', () => {
    for (const fn of ['admin_invite_company_admin', 'admin_revoke_company_admin']) {
      const corps = m4.split(`function public.${fn}(`)[1]?.split('$$;')[0] ?? ''
      expect(corps, `${fn} doit appeler log_admin_action`).toContain('log_admin_action')
      expect(corps, `${fn} doit vérifier is_admin`).toContain('is_admin()')
    }
  })
})

describe('écrans', () => {
  it('« Mon équipe » ne passe que par les RPC gardées', () => {
    expect(pageEquipe).toContain("rpc('ca_list_team')")
    expect(pageEquipe).toContain("functions.invoke('ca-invite-supervisor'")
    expect(pageEquipe).not.toContain(".from('team_invitations')")
    expect(pageEquipe).not.toContain(".from('store_supervisors')")
  })

  it('« Mon équipe » pousse la double authentification', () => {
    expect(pageEquipe).toContain('listFactors')
    expect(pageEquipe).toContain('double')
  })

  it('/admin nomme par l’edge function, jamais en direct', () => {
    expect(pageAdmin).toContain("functions.invoke('invite-company-admin'")
    expect(pageAdmin).toContain("rpc('admin_revoke_company_admin'")
  })
})
