'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export type CompanyRequest = {
  id: string
  company_name: string
  contact_first_name: string
  contact_last_name: string
  contact_email: string
  contact_phone: string
  store_count: number
  message: string
  status: 'pending' | 'quoted' | 'accepted' | 'paid' | 'created' | 'rejected'
  quote_reference: string
  quote_amount_cents: number | null
  admin_note: string
  company_id: string | null
  created_at: string
}

const STATUS_LABEL: Record<CompanyRequest['status'], string> = {
  pending: 'À traiter',
  quoted: 'Devis envoyé',
  accepted: 'Devis accepté',
  paid: 'Facture encaissée',
  created: 'Entreprise créée',
  rejected: 'Refusée',
}

function euros(cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

/**
 * Traitement des demandes d'inscription d'entreprise.
 *
 * L'ordre des étapes est imposé par la base (`admin_set_company_request_status`
 * refuse les transitions hors séquence) : on ne peut pas encaisser un devis qui
 * n'a pas été accepté, ni créer l'entreprise avant encaissement. Cet écran ne
 * fait donc qu'exposer l'action suivante, jamais un choix libre.
 */
export function CompanyRequests({ onCompanyCreated }: { onCompanyCreated: () => void }) {
  const [rows, setRows] = useState<CompanyRequest[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_company_requests')
    setRows((data as CompanyRequest[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  // `supabase.rpc` renvoie un builder « thenable », pas une vraie Promise :
  // on le type en PromiseLike pour pouvoir l'attendre sans le dénaturer.
  type RpcResult = { error: { message?: string } | null; data: { success?: boolean; error?: string } | null }

  async function run(id: string, fn: () => PromiseLike<RpcResult>) {
    setBusy(id)
    const { error, data } = await fn()
    setBusy(null)
    if (error || !data?.success) {
      alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue'))
      return false
    }
    await load()
    return true
  }

  async function quote(r: CompanyRequest) {
    const reference = prompt(`Référence du devis pour « ${r.company_name} » :`, r.quote_reference || '')
    if (reference === null) return
    const amount = prompt('Montant TTC en euros :', r.quote_amount_cents ? String(r.quote_amount_cents / 100) : '')
    if (amount === null) return
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!Number.isFinite(cents) || cents < 0) { alert('Montant invalide.'); return }
    await run(r.id, () =>
      supabase.rpc('admin_quote_company_request', {
        p_id: r.id, p_reference: reference, p_amount_cents: cents, p_note: '',
      }),
    )
  }

  async function setStatus(r: CompanyRequest, status: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    await run(r.id, () =>
      supabase.rpc('admin_set_company_request_status', { p_id: r.id, p_status: status, p_note: '' }),
    )
  }

  async function fulfil(r: CompanyRequest) {
    const raw = prompt(
      `Créer « ${r.company_name} » et ses ${r.store_count} magasin(s).\n\n` +
        'Noms des magasins, séparés par une virgule (laissez vide pour « Magasin 1 », « Magasin 2 »…) :',
      '',
    )
    if (raw === null) return
    const names = raw.split(',').map((s) => s.trim()).filter(Boolean)

    setBusy(r.id)
    const { data, error } = await supabase.rpc('admin_fulfil_company_request', {
      p_id: r.id,
      p_store_names: names.length > 0 ? names : null,
    })
    setBusy(null)
    if (error || !data?.success) {
      alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue'))
      return
    }
    const stores = (data.stores as { name: string; join_code: string }[]) ?? []
    alert(
      `Entreprise créée.\n\nCode entreprise : ${data.company_code}\n\n` +
        stores.map((s) => `${s.name} : ${s.join_code}`).join('\n') +
        '\n\nTransmettez les codes magasin à l’administrateur de l’entreprise : chaque demande de superviseur devra être accompagnée du code de son magasin.',
    )
    await load()
    onCompanyCreated()
  }

  if (rows.length === 0) {
    return <p className="muted">Aucune demande d&apos;inscription d&apos;entreprise.</p>
  }

  return (
    <div className="req-list">
      {rows.map((r) => (
        <div className="req-row req-row-block" key={r.id}>
          <div>
            <div className="req-name">
              {r.company_name} <span className="pill">{STATUS_LABEL[r.status]}</span>
            </div>
            <div className="muted small">
              {r.contact_first_name} {r.contact_last_name} · {r.contact_email}
              {r.contact_phone ? ` · ${r.contact_phone}` : ''} · {r.store_count} magasin{r.store_count > 1 ? 's' : ''}
            </div>
            {r.quote_reference && (
              <div className="muted small">Devis {r.quote_reference} — {euros(r.quote_amount_cents)}</div>
            )}
            {r.message && <div className="muted small">« {r.message} »</div>}
          </div>

          <div className="req-actions">
            {r.status === 'pending' && (
              <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => quote(r)}>
                Émettre un devis
              </button>
            )}
            {r.status === 'quoted' && (
              <>
                <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => quote(r)}>
                  Modifier le devis
                </button>
                <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => setStatus(r, 'accepted')}>
                  Devis accepté
                </button>
              </>
            )}
            {r.status === 'accepted' && (
              <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => setStatus(r, 'paid')}>
                Facture encaissée
              </button>
            )}
            {r.status === 'paid' && (
              <button className="btn btn-success btn-sm" disabled={busy === r.id} onClick={() => fulfil(r)}>
                Créer l&apos;entreprise et les magasins
              </button>
            )}
            {r.status !== 'created' && r.status !== 'rejected' && (
              <button
                className="btn btn-danger btn-sm"
                disabled={busy === r.id}
                onClick={() => setStatus(r, 'rejected', `Refuser la demande de « ${r.company_name} » ?`)}
              >
                Refuser
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
