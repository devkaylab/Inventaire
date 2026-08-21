'use client'

// Console d'administration Quantinvo — poste de pilotage.
//
// La page listait chaque entreprise en carte complète, et chacune lançait
// deux requêtes au chargement : à cinquante entreprises, cent requêtes, un
// mur illisible, et le risque de cliquer « Supprimer » sur la mauvaise
// ligne. Elle porte désormais ce qui demande une décision (demandes,
// suppressions, journal) et un aperçu cherchable des entreprises ; le détail
// d'une entreprise vit sur sa propre page.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard, signOut } from '@/hooks/useAuthGuard'
import { CompanyRequests } from '@/components/admin/CompanyRequests'
import { AuditLog } from '@/components/admin/AuditLog'

type CompanyOverview = {
  id: string
  name: string
  created_at: string
  store_count: number
  supervisor_count: number
  counter_count: number
  company_admin_count: number
  pending_invitations: number
  last_session_at: string | null
}
type DeletionRequest = {
  id: string; user_id: string; email: string | null
  full_name: string | null; role: string | null; created_at: string
}

function frDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR')
}

/** Sans accents ni casse : « Elysée » se trouve en tapant « elysee ». */
function normaliser(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function AdminPage() {
  const router = useRouter()
  const guard = useAuthGuard('admin')
  const [companies, setCompanies] = useState<CompanyOverview[]>([])
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [companyName, setCompanyName] = useState('')
  const [recherche, setRecherche] = useState('')
  const [busy, setBusy] = useState(false)

  const charger = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase.rpc('admin_list_companies_overview'),
      supabase.from('account_deletion_requests')
        .select('id,user_id,email,full_name,role,created_at')
        .eq('status', 'pending').order('created_at', { ascending: true }),
    ])
    setCompanies((c.data as CompanyOverview[]) ?? [])
    setRequests((r.data as DeletionRequest[]) ?? [])
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger()
  }, [guard.status, charger])

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim())
    if (!q) return companies
    return companies.filter((c) => normaliser(c.name).includes(q))
  }, [companies, recherche])

  async function creerEntreprise(e: React.FormEvent) {
    e.preventDefault()
    const nom = companyName.trim()
    if (!nom || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_create_company', { p_name: nom })
    setBusy(false)
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    setCompanyName('')
    charger()
  }

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
    <div className="admin">
      <div className="row">
        <Link href="/" className="brand"><Logo size={28} /><span>Quantinvo</span></Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/account" className="btn btn-ghost">Mon compte</Link>
          <button className="btn btn-ghost" onClick={async () => { await signOut(); router.replace('/login') }}>Déconnexion</button>
        </div>
      </div>

      <span className="pill">Administrateur</span>
      <h1 className="admin-title">Tableau de bord</h1>

      <section className="admin-section">
        <h2>Demandes d&apos;inscription — entreprises</h2>
        <CompanyRequests onCompanyCreated={charger} />
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Entreprises ({companies.length})</h2>
          <form className="inline-form" onSubmit={creerEntreprise}>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nom de l'entreprise" />
            <button className="btn btn-primary" disabled={busy}>Créer</button>
          </form>
        </div>

        {companies.length > 6 && (
          <div className="toolbar">
            <div className="toolbar-grow">
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher une entreprise…"
                aria-label="Rechercher une entreprise"
              />
            </div>
          </div>
        )}

        {companies.length === 0 ? (
          <p className="muted">Aucune entreprise. Créez-en une ci-dessus.</p>
        ) : visibles.length === 0 ? (
          <p className="muted">Aucune entreprise ne correspond à « {recherche} ».</p>
        ) : (
          <div className="acc-inv-list">
            {visibles.map((c) => (
              <Link key={c.id} href={`/admin/entreprise/${c.id}`} className="acc-inv-row">
                <div>
                  <div className="acc-inv-name">{c.name}</div>
                  <div className="muted small" style={{ marginTop: 2 }}>
                    {c.store_count} magasin{c.store_count > 1 ? 's' : ''}
                    {' · '}{c.supervisor_count} superviseur{c.supervisor_count > 1 ? 's' : ''}
                    {c.counter_count > 0 && ` · ${c.counter_count} compteur${c.counter_count > 1 ? 's' : ''}`}
                    {' · créée le '}{frDate(c.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {/* Ce qui demande attention se voit sans ouvrir la fiche. */}
                  {c.store_count === 0 && (
                    <span className="dash-badge dash-badge-counting"><span className="dash-dot" />Aucun magasin</span>
                  )}
                  {c.company_admin_count === 0 ? (
                    <span className="role-tag">Gérée par Quantinvo</span>
                  ) : (
                    <span className="dash-badge dash-badge-open"><span className="dash-dot" />Administrateur</span>
                  )}
                  {c.pending_invitations > 0 && (
                    <span className="role-tag">{c.pending_invitations} invitation{c.pending_invitations > 1 ? 's' : ''}</span>
                  )}
                  <span className="zone-progress-arrow">›</span>
                </div>
              </Link>
            ))}
          </div>
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
    </div>
  )
}
