'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'

type Company = { id: string; name: string; join_code: string; created_at: string }
type Store = { id: string; company_id: string; name: string }
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
    const [c, s, r] = await Promise.all([
      supabase.from('companies').select('id,name,join_code,created_at').order('created_at', { ascending: false }),
      supabase.from('stores').select('id,company_id,name').order('name', { ascending: true }),
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
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    setCompanyName('')
    load()
  }

  async function addStore(companyId: string, name: string) {
    const { data, error } = await supabase.rpc('admin_add_store', { p_company_id: companyId, p_name: name })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    load()
  }

  async function deleteCompany(c: Company) {
    if (!confirm(`Supprimer définitivement « ${c.name} » ?\n\nTous ses inventaires et données seront supprimés, et ses membres détachés de l'entreprise. Cette action est irréversible.`)) return
    const { data, error } = await supabase.rpc('admin_delete_company', { p_company_id: c.id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    load()
  }

  async function deleteStore(s: Store) {
    if (!confirm(`Supprimer le magasin « ${s.name} » ?`)) return
    const { data, error } = await supabase.rpc('admin_delete_store', { p_store_id: s.id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    load()
  }

  async function processRequest(r: DeletionRequest) {
    const who = r.full_name || r.email || 'cet utilisateur'
    if (!confirm(`Supprimer définitivement le compte de ${who} ?\n\nSes contributions seront anonymisées et son compte supprimé. Cette action est irréversible.`)) return
    const { data, error } = await supabase.rpc('admin_delete_user', { p_user_id: r.user_id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
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
    </div>
  )
}

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
            Code : <code>{company.join_code}</code>
            <button className="link-btn" onClick={() => onCopy(company.join_code)}>Copier</button>
          </div>
        </div>
        <div className="company-head-right">
          <span className="muted small">{frDate(company.created_at)}</span>
          <button className="link-btn danger-link" onClick={() => onDeleteCompany(company)}>Supprimer</button>
        </div>
      </div>

      <div className="stores">
        <div className="stores-label">Magasins ({stores.length})</div>
        {stores.length === 0 ? (
          <p className="muted small">Aucun magasin pour l'instant.</p>
        ) : (
          <div className="chips">
            {stores.map((s) => (
              <span className="chip" key={s.id}>
                {s.name}
                <button className="chip-x" onClick={() => onDeleteStore(s)} aria-label={`Supprimer ${s.name}`}>×</button>
              </span>
            ))}
          </div>
        )}
        <form className="inline-form" onSubmit={submit}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouveau magasin" />
          <button className="btn btn-ghost">Ajouter</button>
        </form>
      </div>
    </div>
  )
}
