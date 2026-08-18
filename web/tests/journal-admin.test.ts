// Journal des actions d'administration (constat M4).
//
// Le principe tient en une phrase : la trace s'écrit dans la même transaction
// que l'action, donc une action d'administration réussie sans trace ne peut
// pas exister. Ces tests empêchent de désinstrumenter une fonction admin, de
// rouvrir l'écriture du journal aux clients, ou d'oublier sa purge.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260818000003_journal_actions_admin.sql')
const pageAdmin = lire('../app/admin/page.tsx')
const composant = lire('../components/admin/AuditLog.tsx')

// Les fonctions d'administration qui modifient des données. En ajouter une
// nouvelle sans la journaliser doit se voir : compléter cette liste ET la
// migration (ou une suivante).
const FONCTIONS_INSTRUMENTEES = [
  'admin_create_company',
  'admin_add_store',
  'admin_delete_company',
  'admin_delete_store',
  'admin_delete_user',
  'admin_assign_supervisor',
  'admin_unassign_supervisor',
  'admin_review_supervisor_request',
  'admin_quote_company_request',
  'admin_set_company_request_status',
  'admin_fulfil_company_request',
]

describe('journal des actions admin (migration)', () => {
  it('journalise chacune des fonctions d’administration', () => {
    for (const fn of FONCTIONS_INSTRUMENTEES) {
      const corps = migration.split(`function public.${fn}(`)[1]?.split('$function$;')[0] ?? ''
      expect(corps, `${fn} doit appeler log_admin_action`).toContain('log_admin_action')
    }
  })

  it('n’avale pas les erreurs d’écriture du journal', () => {
    // Un bloc d'exception autour de l'insertion permettrait des actions sans
    // trace. La fonction d'écriture doit rester sans gestionnaire d'erreur.
    const corps = migration.split('function public.log_admin_action(')[1]?.split('$function$;')[0] ?? ''
    expect(corps).not.toMatch(/exception\s+when/i)
  })

  it('interdit l’écriture du journal aux clients', () => {
    // Seule policy : la lecture pour les admins. Aucune policy insert/update/
    // delete, et la fonction d'écriture est révoquée aux rôles clients.
    expect(migration).toContain('for select to authenticated using (public.is_admin())')
    expect(migration).not.toMatch(/create policy .* for (insert|update|delete)/i)
    expect(migration).toMatch(/revoke execute on function public\.log_admin_action[\s\S]*?from public, anon, authenticated/)
  })

  it('purge le journal à un an', () => {
    const purge = migration.split('function public.purge_expired_data(')[1] ?? ''
    expect(purge).toContain("journal_admin_ttl    constant interval := interval '1 year'")
    expect(purge).toContain('delete from public.admin_audit_log')
  })
})

describe('journal des actions admin (écran)', () => {
  it('est affiché sur le tableau de bord administrateur', () => {
    expect(pageAdmin).toContain('AuditLog')
    expect(pageAdmin).toContain('Journal des actions')
  })

  it('lit via la RPC dédiée, jamais la table en direct', () => {
    expect(composant).toContain("rpc('admin_list_audit_log'")
    expect(composant).not.toContain(".from('admin_audit_log')")
  })

  it('annonce la durée de conservation', () => {
    expect(pageAdmin + composant).toContain('conservée un an')
  })
})
