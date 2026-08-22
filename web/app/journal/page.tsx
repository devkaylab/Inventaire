'use client'

// Journal de l'entreprise — « qui a fait quoi ».
//
// La table `company_audit_log` se remplit à chaque action depuis le 20 août
// 2026 : la trace s'écrit dans la même transaction que l'action, donc une
// action réussie sans trace ne peut pas exister. Il lui manquait son écran.
//
// Aucune écriture ici, et aucune n'est possible : la table n'a qu'une policy
// de lecture, et la RPC est gardée par `is_company_admin()`.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { getMyCompany, type Company } from '@/lib/account'
import { libelleAction, type LigneJournal } from '@/lib/journal'

/** « 22/08 à 14:02 » — la date d'un journal se lit à la minute. */
function quand(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function JournalPage() {
  const guard = useAuthGuard('supervisor')
  const [lignes, setLignes] = useState<LigneJournal[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [query, setQuery] = useState('')
  const [pret, setPret] = useState(false)

  const charger = useCallback(async () => {
    const [j, c] = await Promise.all([
      supabase.rpc('ca_list_audit_log', { p_limit: 200 }),
      getMyCompany().catch(() => null),
    ])
    if (j.data) setLignes(j.data as LigneJournal[])
    setCompany(c)
    setPret(true)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    if (!guard.profile.is_company_admin) { window.location.replace('/dashboard'); return }
    charger()
  }, [guard, charger])

  const moi = guard.status === 'ready' ? guard.profile.id : null

  const filtrees = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return lignes
    return lignes.filter((l) =>
      libelleAction(l, moi).toLowerCase().includes(q)
      || (l.actor_label || '').toLowerCase().includes(q)
      || (l.target_label || '').toLowerCase().includes(q))
  }, [lignes, query, moi])

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <div>
          <h1 className="page-title">Journal</h1>
          <p className="page-sub">Qui a fait quoi dans votre entreprise</p>
        </div>
        <div className="toolbar" style={{ marginTop: 0 }}>
          <div className="toolbar-grow">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une personne, un magasin…"
              aria-label="Rechercher dans le journal"
            />
          </div>
        </div>
      </div>

      {!pret ? (
        <p className="muted">Chargement…</p>
      ) : lignes.length === 0 ? (
        <EmptyState
          title="Aucune action enregistrée"
          hint="Les invitations, retraits d’accès, suppressions de comptes et demandes de magasin s’inscriront ici."
        />
      ) : filtrees.length === 0 ? (
        <EmptyState title="Aucun résultat" hint={`Rien ne correspond à « ${query} ».`} />
      ) : (
        <div className="panel" style={{ marginTop: 0 }}>
          <div className="journal">
            {filtrees.map((l) => (
              <div className="journal-l" key={l.id}>
                <span className="journal-q">{quand(l.created_at)}</span>
                <span className="journal-a">{libelleAction(l, moi)}</span>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>
            Les 200 dernières actions. Le journal est conservé un an, puis effacé.
          </p>
        </div>
      )}
    </AppShell>
  )
}
