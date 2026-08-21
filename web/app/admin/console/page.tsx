'use client'

// Console — ce qui demande une décision, et la trace de ce qui a été fait.
//
// Les entreprises clientes ont leur propre écran : ici ne restent que les
// demandes à traiter (inscriptions d'entreprise, suppressions de compte) et
// le journal des actions d'administration.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { CompanyRequests } from '@/components/admin/CompanyRequests'
import { AuditLog } from '@/components/admin/AuditLog'

type DeletionRequest = {
  id: string; user_id: string; email: string | null
  full_name: string | null; role: string | null; created_at: string
}

function frDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR')
}

export default function AdminConsolePage() {
  const guard = useAuthGuard('admin')
  const [requests, setRequests] = useState<DeletionRequest[]>([])

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from('account_deletion_requests')
      .select('id,user_id,email,full_name,role,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    setRequests((data as DeletionRequest[]) ?? [])
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger()
  }, [guard.status, charger])

  async function traiterSuppression(r: DeletionRequest) {
    const qui = r.full_name || r.email || 'cet utilisateur'
    if (!confirm(`Supprimer définitivement le compte de ${qui} ?\n\nSes contributions seront anonymisées et son compte supprimé. Cette action est irréversible.`)) return
    const { data, error } = await supabase.rpc('admin_delete_user', { p_user_id: r.user_id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    charger()
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <h1 className="page-title">Console</h1>
      </div>

      <section className="admin-section" style={{ marginTop: 0 }}>
        <h2>Demandes d&apos;inscription — entreprises</h2>
        <CompanyRequests onCompanyCreated={charger} />
      </section>

      <section className="admin-section">
        <h2>Demandes de suppression de compte</h2>
        {requests.length === 0 ? (
          <p className="muted">Aucune demande en attente.</p>
        ) : (
          <div className="req-list">
            {requests.map((r) => (
              <div className="req-row" key={r.id}>
                <div>
                  <div className="req-name">{r.full_name || 'Sans nom'}</div>
                  <div className="muted small">
                    {r.email} · {r.role === 'supervisor' ? 'Superviseur' : 'Membre'} · demandé le {frDate(r.created_at)}
                  </div>
                </div>
                <button className="btn btn-danger" onClick={() => traiterSuppression(r)}>Supprimer le compte</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Journal des actions</h2>
        <p className="muted small" style={{ marginTop: -8, marginBottom: 14 }}>
          Chaque action d&apos;administration est enregistrée automatiquement et conservée un an.
        </p>
        <AuditLog />
      </section>
    </AppShell>
  )
}
