'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { CompanyRequests } from '@/components/admin/CompanyRequests'
import { SupervisorRequests } from '@/components/admin/SupervisorRequests'
import { AuditLog } from '@/components/admin/AuditLog'

type Company = { id: string; name: string; join_code: string; created_at: string }
type Store = { id: string; company_id: string; name: string; join_code: string }
type DeletionRequest = {
  id: string; user_id: string; email: string | null; full_name: string | null; role: string | null; created_at: string
}

function frDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR')
}

export default function AdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [companyName, setCompanyName] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    // Codes entreprise/magasin confidentiels : lecture via RPC admin (SECURITY DEFINER),
    // la clé publique ne peut plus lire la colonne join_code directement.
    const [c, s, r] = await Promise.all([
      supabase.rpc('admin_list_companies'),
      supabase.rpc('admin_list_stores'),
      supabase.from('account_deletion_requests').select('id,user_id,email,full_name,role,created_at').eq('status', 'pending').order('created_at', { ascending: true }),
    ])
    setCompanies((c.data as Company[]) ?? [])
    setStores((s.data as Store[]) ?? [])
    setRequests((r.data as DeletionRequest[]) ?? [])
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle()
      if (!prof?.is_admin) { router.replace('/account'); return }
      await load()
      if (active) setReady(true)
    })()
    return () => { active = false }
  }, [router])

  const storesByCompany = useMemo(() => {
    const map: Record<string, Store[]> = {}
    for (const s of stores) (map[s.company_id] ||= []).push(s)
    return map
  }, [stores])

  async function createCompany(e: React.FormEvent) {
    e.preventDefault()
    const name = companyName.trim()
    if (!name || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_create_company', { p_name: name })
    setBusy(false)
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    setCompanyName('')
    load()
  }

  async function addStore(companyId: string, name: string) {
    const { data, error } = await supabase.rpc('admin_add_store', { p_company_id: companyId, p_name: name })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    load()
  }

  async function deleteCompany(c: Company) {
    if (!confirm(`Supprimer définitivement « ${c.name} » ?\n\nTous ses inventaires et données seront supprimés, et ses membres détachés de l'entreprise. Cette action est irréversible.`)) return
    const { data, error } = await supabase.rpc('admin_delete_company', { p_company_id: c.id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    load()
  }

  async function deleteStore(s: Store) {
    if (!confirm(`Supprimer le magasin « ${s.name} » ?`)) return
    const { data, error } = await supabase.rpc('admin_delete_store', { p_store_id: s.id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    load()
  }

  async function processRequest(r: DeletionRequest) {
    const who = r.full_name || r.email || 'cet utilisateur'
    if (!confirm(`Supprimer définitivement le compte de ${who} ?\n\nSes contributions seront anonymisées et son compte supprimé. Cette action est irréversible.`)) return
    const { data, error } = await supabase.rpc('admin_delete_user', { p_user_id: r.user_id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    load()
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code)
  }

  if (!ready) return <div className="auth-wrap"><p className="muted">Chargement…</p></div>

  return (
    <div className="admin">
      <div className="row">
        <Link href="/" className="brand"><Logo size={28} /><span>Quantinvo</span></Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/account" className="btn btn-ghost">Mon compte</Link>
          <button className="btn btn-ghost" onClick={signOut}>Déconnexion</button>
        </div>
      </div>

      <span className="pill">Administrateur</span>
      <h1 className="admin-title">Tableau de bord</h1>

      <section className="admin-section">
        <h2>Demandes d&apos;inscription — entreprises</h2>
        <CompanyRequests onCompanyCreated={load} />
      </section>

      <section className="admin-section">
        <h2>Demandes d&apos;accès — superviseurs</h2>
        <SupervisorRequests />
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Entreprises</h2>
          <form className="inline-form" onSubmit={createCompany}>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nom de l'entreprise" />
            <button className="btn btn-primary" disabled={busy}>Créer</button>
          </form>
        </div>

        {companies.length === 0 ? (
          <p className="muted">Aucune entreprise. Créez-en une ci-dessus.</p>
        ) : (
          companies.map((c) => (
            <CompanyCard
              key={c.id}
              company={c}
              stores={storesByCompany[c.id] ?? []}
              onAddStore={addStore}
              onCopy={copy}
              onDeleteCompany={deleteCompany}
              onDeleteStore={deleteStore}
            />
          ))
        )}
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
                  <div className="muted small">{r.email} · {r.role === 'supervisor' ? 'Superviseur' : 'Membre'} · demandé le {frDate(r.created_at)}</div>
                </div>
                <button className="btn btn-danger" onClick={() => processRequest(r)}>Supprimer le compte</button>
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
    </div>
  )
}

type Supervisor = { id: string; full_name: string | null; role: string | null; is_company_admin: boolean | null; email: string | null }

function CompanyCard({
  company, stores, onAddStore, onCopy, onDeleteCompany, onDeleteStore,
}: {
  company: Company
  stores: Store[]
  onAddStore: (companyId: string, name: string) => void
  onCopy: (code: string) => void
  onDeleteCompany: (c: Company) => void
  onDeleteStore: (s: Store) => void
}) {
  const [name, setName] = useState('')
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  // store_id -> user_ids affectés
  const [assignments, setAssignments] = useState<Record<string, string[]>>({})

  const loadAssign = useCallback(async () => {
    const [m, a] = await Promise.all([
      supabase.rpc('admin_list_company_members', { p_company_id: company.id }),
      supabase.rpc('admin_list_store_supervisors', { p_company_id: company.id }),
    ])
    setSupervisors((m.data as Supervisor[]) ?? [])
    const map: Record<string, string[]> = {}
    for (const row of ((a.data as { store_id: string; user_id: string }[]) ?? [])) {
      (map[row.store_id] ||= []).push(row.user_id)
    }
    setAssignments(map)
  }, [company.id])

  useEffect(() => { loadAssign() }, [loadAssign])

  const supById = useMemo(() => {
    const m: Record<string, Supervisor> = {}
    for (const s of supervisors) m[s.id] = s
    return m
  }, [supervisors])

  async function assign(storeId: string, userId: string) {
    const { data, error } = await supabase.rpc('admin_assign_supervisor', { p_store_id: storeId, p_user_id: userId })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    loadAssign()
  }
  async function unassign(storeId: string, userId: string) {
    const { data, error } = await supabase.rpc('admin_unassign_supervisor', { p_store_id: storeId, p_user_id: userId })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    loadAssign()
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = name.trim()
    if (!v) return
    onAddStore(company.id, v)
    setName('')
  }

  return (
    <div className="panel company-card">
      <div className="company-head">
        <div>
          <h3>{company.name}</h3>
          <div className="code-row">
            Code : <code>{company.join_code}</code>
            <button className="link-btn" onClick={() => onCopy(company.join_code)}>Copier</button>
          </div>
        </div>
        <div className="company-head-right">
          <span className="muted small">{frDate(company.created_at)}</span>
          <button className="link-btn danger-link" onClick={() => onDeleteCompany(company)}>Supprimer</button>
        </div>
      </div>

      <div className="stores">
        <div className="stores-label">Administrateur d&apos;entreprise</div>
        <CompanyAdminBlock company={company} admins={supervisors.filter((m) => m.is_company_admin)} onChanged={loadAssign} />
      </div>

      <div className="stores">
        <div className="stores-label">Magasins ({stores.length})</div>
        {stores.length === 0 ? (
          <p className="muted small">Aucun magasin pour l&apos;instant.</p>
        ) : (
          <div className="store-blocks">
            {stores.map((s) => {
              const assigned = assignments[s.id] ?? []
              const assignedSet = new Set(assigned)
              const available = supervisors.filter((m) => !assignedSet.has(m.id))
              return (
                <div className="store-block" key={s.id}>
                  <div className="store-block-head">
                    <div>
                      <span className="store-block-name">{s.name}</span>
                      <div className="code-row">
                        Code magasin : <code>{s.join_code}</code>
                        <button className="link-btn" onClick={() => onCopy(s.join_code)}>Copier</button>
                      </div>
                    </div>
                    <button className="link-btn danger-link" onClick={() => onDeleteStore(s)}>Supprimer</button>
                  </div>
                  <div className="store-sup">
                    {assigned.length === 0 && <span className="muted small">Aucun superviseur affecté</span>}
                    {assigned.map((uid) => (
                      <span className="chip" key={uid}>
                        {supById[uid]?.full_name || 'Superviseur'}
                        <button className="chip-x" onClick={() => unassign(s.id, uid)} aria-label="Retirer">×</button>
                      </span>
                    ))}
                    {available.length > 0 && (
                      <select
                        className="store-sup-select"
                        value=""
                        onChange={(e) => { if (e.target.value) assign(s.id, e.target.value) }}
                      >
                        <option value="">+ Affecter un superviseur</option>
                        {available.map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name || 'Sans nom'}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <form className="inline-form" onSubmit={submit} style={{ marginTop: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouveau magasin" />
          <button className="btn btn-ghost">Ajouter</button>
        </form>
      </div>
    </div>
  )
}

/**
 * Nomination de l'administrateur d'entreprise — le client qui gère ensuite
 * lui-même ses superviseurs depuis « Mon équipe ».
 *
 * Deux issues côté serveur : un compte de l'entreprise existe pour cette
 * adresse et il est promu sur-le-champ ; sinon l'invitation part par e-mail
 * (edge function invite-company-admin, garde is_admin() revérifiée en base).
 */
function CompanyAdminBlock({
  company, admins, onChanged,
}: {
  company: Company
  admins: Supervisor[]
  onChanged: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('invite-company-admin', {
      body: { companyId: company.id, email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim() },
    })
    setBusy(false)
    if (error || !data?.success) {
      alert('Erreur : ' + (data?.error ?? error?.message ?? 'inconnue'))
      return
    }
    if (data.mode === 'promoted') {
      alert(`${data.full_name || 'Ce compte'} est maintenant administrateur de l'entreprise.`)
    } else {
      alert(`Invitation envoyée. ${data.email} reçoit un e-mail pour créer son mot de passe.`)
    }
    setFirstName(''); setLastName(''); setEmail('')
    onChanged()
  }

  async function revoke(a: Supervisor) {
    if (!confirm(`Retirer le rôle d'administrateur d'entreprise à ${a.full_name || 'ce compte'}${a.email ? ` (${a.email})` : ''} ?\n\nSon compte superviseur et ses magasins sont conservés.`)) return
    const { data, error } = await supabase.rpc('admin_revoke_company_admin', { p_user: a.id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    onChanged()
  }

  return (
    <div>
      <div className="chips" style={{ marginBottom: admins.length ? 12 : 8 }}>
        {admins.length === 0 && <span className="muted small">Aucun administrateur — l&apos;entreprise est gérée par Quantinvo.</span>}
        {admins.map((a) => (
          <span className="chip" key={a.id}>
            <span>
              {a.full_name || 'Sans nom'}
              {a.email && <span className="muted small" style={{ marginLeft: 6 }}>{a.email}</span>}
            </span>
            <button className="chip-x" onClick={() => revoke(a)} aria-label="Révoquer">×</button>
          </span>
        ))}
      </div>
      <form className="inline-form" onSubmit={invite} style={{ flexWrap: 'wrap' }}>
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" style={{ minWidth: 120 }} />
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" style={{ minWidth: 120 }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" style={{ minWidth: 200 }} />
        <button className="btn btn-ghost" disabled={busy || !email.trim()}>Nommer administrateur</button>
      </form>
      <p className="muted small" style={{ marginTop: 8 }}>
        Si un compte de l&apos;entreprise existe déjà pour cette adresse, il est promu directement — sinon la personne reçoit une invitation.
      </p>
    </div>
  )
}
