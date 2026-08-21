'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { getMySessions, getMyStores, STATUS_LABELS, type Session, type Store } from '@/lib/inventory'
import {
  getMyCompany, getTeamInvitations, getTeamMembers,
  type Company, type TeamInvitation, type TeamMember,
} from '@/lib/account'
import { AddCounter } from '@/components/dashboard/AddCounter'
import { MfaPanel } from '@/components/MfaPanel'

type ProfileInfo = { full_name: string | null; role: string | null; is_admin: boolean | null; is_company_admin: boolean | null }

export default function AccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string>('')
  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [mySessions, setMySessions] = useState<Session[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  // Rechargement de l'équipe après l'ajout d'un compteur.
  async function reloadTeam() {
    try {
      const [m, i] = await Promise.all([getTeamMembers(), getTeamInvitations()])
      setMembers(m)
      setInvitations(i)
    } catch { /* RLS ou migration : on garde l'affichage courant */ }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      setEmail(session.user.email ?? '')
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, is_admin, is_company_admin')
        .eq('id', session.user.id)
        .maybeSingle()
      const prof = data as ProfileInfo | null
      if (prof?.role === 'supervisor' && !prof.is_admin) {
        // Chaque bloc est indépendant : une migration en retard sur l'un ne
        // doit pas vider toute la page.
        const [s, c, st, m, i] = await Promise.all([
          getMySessions(session.user.id).catch(() => [] as Session[]),
          getMyCompany().catch(() => null),
          getMyStores().catch(() => [] as Store[]),
          getTeamMembers().catch(() => [] as TeamMember[]),
          getTeamInvitations().catch(() => [] as TeamInvitation[]),
        ])
        if (active) {
          setMySessions(s); setCompany(c); setStores(st); setMembers(m); setInvitations(i)
        }
      }
      if (active) {
        setProfile(prof)
        setLoading(false)
      }
    })()
    return () => { active = false }
  }, [router])

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch { /* sélection manuelle */ }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const [exporting, setExporting] = useState(false)
  // Droit d'accès et de portabilité (articles 15 et 20 du RGPD) : la base
  // assemble l'export, le navigateur le remet en fichier — rien ne transite
  // par un serveur tiers.
  async function downloadMyData() {
    if (exporting) return
    setExporting(true)
    const { data, error } = await supabase.rpc('export_my_data')
    setExporting(false)
    if (error || !data) {
      alert('Export impossible pour le moment. Réessayez dans un instant.')
      return
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quantinvo-mes-donnees.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const isAdmin = !!profile?.is_admin
  const isSupervisor = profile?.role === 'supervisor' && !isAdmin
  const active = mySessions.filter(s => s.status !== 'closed')

  return (
    <div className="account">
      <div className="row">
        <Link href="/" className="brand"><Logo size={28} /><span>Quantinvo</span></Link>
        <button className="btn btn-ghost" onClick={signOut}>Déconnexion</button>
      </div>

      <span className="pill">
        {isAdmin
          ? 'Administrateur'
          : profile?.is_company_admin
            ? 'Administrateur d\u2019entreprise'
            : profile?.role === 'supervisor' ? 'Superviseur' : 'Membre'}
      </span>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.6px', marginTop: 12 }}>
        Bonjour {profile?.full_name || ''}
      </h1>
      <p className="muted" style={{ marginTop: 4 }}>{email}</p>

      {!isAdmin && profile?.is_company_admin && (
        <div className="panel">
          <h3>Mon équipe</h3>
          <p>Vous administrez les accès de votre entreprise&nbsp;: invitez vos superviseurs et affectez-les à vos magasins.</p>
          <Link href="/equipe" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
            Gérer mon équipe
          </Link>
        </div>
      )}

      {isAdmin ? (
        <div className="panel">
          <h3>Espace administrateur</h3>
          <p>Gérez vos entreprises, vos magasins et les demandes de suppression de compte.</p>
          <Link href="/admin" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
            Ouvrir le tableau de bord
          </Link>
        </div>
      ) : isSupervisor ? (
        <>
          <div className="panel">
            <h3>Entreprise</h3>
            <div className="acc-kv"><span>Entreprise</span><strong>{company?.name ?? '—'}</strong></div>
            <div className="acc-kv"><span>Balises générées</span><strong>{company?.balise_count ?? 0}</strong></div>
            <p className="muted small" style={{ marginTop: 10 }}>
              La génération et l&apos;impression des balises se font depuis l&apos;application mobile.
            </p>
          </div>

          <div className="panel">
            <h3>Mes magasins</h3>
            {stores.length === 0 ? (
              <p style={{ marginTop: 8 }}>
                Vous n&apos;êtes affecté à aucun magasin. Contactez l&apos;administrateur Quantinvo.
              </p>
            ) : (
              <div className="acc-inv-list" style={{ marginTop: 12 }}>
                {stores.map(s => (
                  <div className="acc-inv-row" key={s.id}>
                    <div>
                      <div className="acc-inv-name">{s.name}</div>
                      <div className="cred-value" style={{ marginTop: 2 }}>{s.join_code ?? '—'}</div>
                    </div>
                    {s.join_code && (
                      <button type="button" className="link-btn" onClick={() => copyCode(s.join_code!)}>
                        {copied === s.join_code ? 'Copié' : 'Copier'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="muted small" style={{ marginTop: 10 }}>
              Le code magasin sert aux demandes d&apos;accès superviseur sur le site. Il est
              confidentiel : ne le communiquez jamais aux compteurs.
            </p>
          </div>

          {active.length > 0 && (
            <div className="panel">
              <h3>Inventaires en cours</h3>
              <div className="acc-inv-list" style={{ marginTop: 12 }}>
                {active.map(s => (
                  <Link key={s.id} href={`/dashboard/${s.id}`} className="acc-inv-row acc-inv-live">
                    <div>
                      <div className="acc-inv-live-label">Inventaire en cours</div>
                      <div className="acc-inv-name">{s.name || s.inventory_number}</div>
                      <div className="muted small">{s.store_name}</div>
                    </div>
                    <span className={`dash-badge dash-badge-${s.status}`}><span className="dash-dot" />{STATUS_LABELS[s.status]}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h3>Mes inventaires</h3>
              <Link href="/dashboard" className="btn btn-primary">Ouvrir le tableau de bord</Link>
            </div>
            {mySessions.length === 0 ? (
              <p style={{ marginTop: 8 }}>
                Vous n&apos;avez pas encore créé d&apos;inventaire.{' '}
                <Link href="/dashboard/new" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  Créez-en un depuis le site
                </Link>{' '}
                ou depuis l&apos;application mobile Quantinvo.
              </p>
            ) : (
              <div className="acc-inv-list" style={{ marginTop: 12 }}>
                {mySessions.map(s => (
                  <Link key={s.id} href={`/dashboard/${s.id}`} className="acc-inv-row">
                    <div>
                      <div className="acc-inv-name">{s.name || s.store_name}</div>
                      <div className="muted small">{s.store_name} · {s.inventory_number}</div>
                    </div>
                    <span className={`dash-badge dash-badge-${s.status}`}><span className="dash-dot" />{STATUS_LABELS[s.status]}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h3>Équipe ({members.length})</h3>
              <AddCounter onAdded={reloadTeam} />
            </div>

            {members.length === 0 ? (
              <p style={{ marginTop: 8 }}>Aucun membre pour l&apos;instant.</p>
            ) : (
              <div className="people-list" style={{ marginTop: 12 }}>
                {members.map(m => (
                  <div className="person-row" key={m.id}>
                    <div className="person-avatar" aria-hidden="true">
                      {(m.full_name?.trim()[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="person-main">
                      <div className="person-name">
                        {m.full_name || 'Sans nom'}
                        <span className="role-tag">{m.role === 'supervisor' ? 'Superviseur' : 'Compteur'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {invitations.length > 0 && (
              <>
                <div className="dash-section-label" style={{ margin: '18px 0 8px' }}>
                  En attente de création de compte ({invitations.length})
                </div>
                <div className="people-list">
                  {invitations.map(i => (
                    <div className="person-row" key={i.id}>
                      <div className="person-avatar" aria-hidden="true">
                        {(i.full_name?.trim()[0] ?? i.email[0]).toUpperCase()}
                      </div>
                      <div className="person-main">
                        <div className="person-name">{i.full_name || i.email}</div>
                        <div className="muted small">{i.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="panel">
          <h3>Votre espace</h3>
          <p>
            Le suivi de vos inventaires en ligne arrive bientôt. En attendant, utilisez l&apos;application mobile Quantinvo.
          </p>
        </div>
      )}

      <MfaPanel />

      <div className="panel">
        <h3>Mes données</h3>
        <p className="muted small">
          Téléchargez une copie des données associées à votre compte — profil, inventaires,
          invitations, demandes — dans un format lisible et réutilisable
          (articles 15 et 20 du RGPD).
        </p>
        <button className="btn btn-ghost" onClick={downloadMyData} disabled={exporting} style={{ marginTop: 12 }}>
          {exporting ? 'Préparation…' : 'Télécharger mes données'}
        </button>
      </div>
    </div>
  )
}
