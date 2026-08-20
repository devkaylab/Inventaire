'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type SupervisorRequest = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  store_id: string
  store_name: string
  company_id: string
  company_name: string
  status: 'pending' | 'approved' | 'active' | 'rejected'
  admin_note: string
  created_at: string
}

const STATUS_LABEL: Record<SupervisorRequest['status'], string> = {
  pending: 'À valider',
  approved: 'Mot de passe à créer',
  active: 'Compte actif',
  rejected: 'Refusée',
}

/**
 * Traitement des demandes d'accès superviseur.
 *
 * Le code magasin ayant été résolu au dépôt, l'entreprise et le magasin sont
 * déjà affichés : rien à rechercher. La validation passe par l'edge function
 * `invite-supervisor`, qui envoie le lien de finalisation.
 *
 * À noter : le profil est créé dès l'invitation, pas à la création du mot de
 * passe — `handle_new_user` se déclenche sur l'INSERT dans `auth.users`, que
 * l'invitation provoque immédiatement. La personne ne peut simplement pas
 * encore se connecter. D'où l'état « Mot de passe à créer », qui décrit ce qui
 * manque et non l'absence de profil.
 */
export function SupervisorRequests() {
  const [rows, setRows] = useState<SupervisorRequest[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_supervisor_requests')
    setRows((data as SupervisorRequest[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  async function review(r: SupervisorRequest, approve: boolean) {
    if (!approve && !confirm(`Refuser la demande de ${r.first_name} ${r.last_name} ?`)) return
    setBusy(r.id)
    const { data, error } = await supabase.functions.invoke('invite-supervisor', {
      body: { requestId: r.id, approve },
    })
    setBusy(null)
    if (error || !data?.success) {
      alert('Erreur : ' + (data?.error ?? error?.message ?? 'inconnue'))
      await load()
      return
    }
    if (approve) {
      alert(`Demande validée. ${r.email} reçoit un e-mail pour créer son mot de passe.`)
    }
    await load()
  }

  if (rows.length === 0) {
    return <p className="muted">Aucune demande d&apos;accès superviseur.</p>
  }

  return (
    <div className="req-list">
      {rows.map((r) => (
        <div className="req-row req-row-block" key={r.id}>
          <div>
            <div className="req-name">
              {r.first_name} {r.last_name} <span className="pill">{STATUS_LABEL[r.status]}</span>
            </div>
            <div className="muted small">
              {r.email}{r.phone ? ` · ${r.phone}` : ''}
            </div>
            <div className="muted small">
              {r.company_name} — <strong>{r.store_name}</strong>
            </div>
          </div>

          {r.status === 'pending' && (
            <div className="req-actions">
              <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => review(r, true)}>
                Valider et inviter
              </button>
              <button className="btn btn-danger btn-sm" disabled={busy === r.id} onClick={() => review(r, false)}>
                Refuser
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
