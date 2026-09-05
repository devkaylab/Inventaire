// Journal des actions d'administration (constat M4).
//
// Le principe tient en une phrase : la trace s'écrit dans la même transaction
// que l'action, donc une action d'administration réussie sans trace ne peut
// pas exister. Ces tests empêchent de désinstrumenter une fonction admin, de
// rouvrir l'écriture du journal aux clients, ou d'oublier sa purge.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ACTIONS } from '../lib/journal'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260818000003_journal_actions_admin.sql')
// Le journal a suivi les demandes sur l'écran Console (21 août 2026).
const pageAdmin = lire('../app/admin/console/page.tsx')
const composant = lire('../components/admin/AuditLog.tsx')

// Les fonctions d'administration qui modifient des données. En ajouter une
// nouvelle sans la journaliser doit se voir : compléter cette liste ET la
// migration (ou une suivante).
// (admin_review_supervisor_request en est sortie le 21 août 2026 : le
// parcours public superviseur est éteint, la fonction supprimée.)
const FONCTIONS_INSTRUMENTEES = [
  'admin_create_company',
  'admin_add_store',
  'admin_delete_company',
  'admin_delete_store',
  'admin_delete_user',
  'admin_assign_supervisor',
  'admin_unassign_supervisor',
  'admin_quote_company_request',
  'admin_set_company_request_status',
  'admin_fulfil_company_request',
  'admin_rename_company',
  'admin_rename_store',
  'admin_delete_company_request',
]

describe('journal des actions admin (migration)', () => {
  it('journalise chacune des fonctions d’administration', () => {
    // ⚠️ On balaie **toutes** les migrations, pas seulement celle qui a créé le
    // journal : une fonction `admin_*` écrite plus tard vit dans son propre
    // fichier, et la chercher ici seulement la laissait passer sans trace
    // (constat du 23 août 2026, sur `admin_rename_company`).
    const dossier = path.resolve(__dirname, '../../supabase/migrations')
    const toutes = readdirSync(dossier)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(path.join(dossier, f), 'utf8'))
    for (const fn of FONCTIONS_INSTRUMENTEES) {
      const corps = toutes
        .filter((m) => m.includes(`function public.${fn}(`))
        .map((m) => m.split(`function public.${fn}(`)[1]?.split(/\$function\$;|\$\$;/)[0] ?? '')
      expect(corps.length, `${fn} n'est définie dans aucune migration`).toBeGreaterThan(0)
      expect(
        corps.some((c) => c.includes('log_admin_action')),
        `${fn} doit appeler log_admin_action`,
      ).toBe(true)
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

  it('⚠️ et cette purge est réellement planifiée', () => {
    // Elle a existé sept semaines sans que rien ne l'appelle : `pg_cron`
    // n'était pas installé, son corps n'avait jamais tourné, et les durées
    // annoncées dans la politique de confidentialité n'étaient pas tenues.
    // Constat n°5 de la revue de sécurité du 28 août 2026, migration
    // 20260828180001. Une durée de conservation qui ne s'exécute pas n'est pas
    // une durée de conservation.
    const dossier = path.resolve(__dirname, '../../supabase/migrations')
    const toutes = readdirSync(dossier)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(path.join(dossier, f), 'utf8'))
      .join('\n')
    expect(toutes).toContain('create extension if not exists pg_cron')
    expect(toutes).toMatch(/cron\.schedule\(\s*'purge-donnees-expirees'/)
    expect(toutes).toContain('select public.purge_expired_data()')
  })
})

describe('journal des actions admin (écran)', () => {
  it('est affiché sur l’écran Console', () => {
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

/**
 * ⚠️ TOUTE ACTION JOURNALISÉE A SON LIBELLÉ — et la garde DÉDUIT la liste.
 *
 * `compteur_retire_du_magasin` s'est affichée en clair sur le journal réel
 * pendant deux semaines (« Test Sup sans inv — compteur_retire_du_magasin —
 * Julien Compteur »), vue le 5 septembre 2026 en regardant la page en
 * production. Elle est écrite par `remove_counter_from_store`, pas par une
 * fonction `ca_*` : la garde qui existait ne balayait que les `ca_*`, donc elle
 * passait entre les mailles.
 *
 * Celle-ci lit TOUTES les migrations et retient chaque action réellement
 * inscrite au journal d'entreprise. La prochaine se signalera d'elle-même.
 */
describe('le journal d’entreprise se lit en français', () => {
  it('⚠️ chaque action écrite en base a son libellé', () => {
    const dossier = path.resolve(__dirname, '../../supabase/migrations')
    const actions = new Set<string>()
    for (const f of readdirSync(dossier).filter((n) => n.endsWith('.sql'))) {
      const sql = readFileSync(path.join(dossier, f), 'utf8')
      for (const m of sql.matchAll(/log_company_action\(\s*[a-z_.]+\s*,\s*'([a-z_]+)'/g)) {
        actions.add(m[1])
      }
    }
    expect(actions.size, 'le balayage doit trouver des actions').toBeGreaterThan(8)
    const sansLibelle = [...actions].filter((a) => !ACTIONS[a])
    expect(sansLibelle, `ces actions s’afficheraient en mot technique : ${sansLibelle.join(', ')}`)
      .toEqual([])
  })
})
