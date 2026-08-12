'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import { getMySessions, STATUS_LABELS, type Session } from '@/lib/inventory'

type ProfileInfo = { full_name: string | null; role: string | null; is_admin: boolean | null }

export default function AccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string>('')
  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [mySessions, setMySessions] = useState<Session[]>([])

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
        .select('full_name, role, is_admin')
        .eq('id', session.user.id)
        .maybeSingle()
      const prof = data as ProfileInfo | null
      if (prof?.role === 'supervisor' && !prof.is_admin) {
        try { if (active) setMySessions(await getMySessions(session.user.id)) } catch { /* migration en attente */ }
      }
      if (active) {
        setProfile(prof)
        setLoading(false)
      }
    })()
    return () => { active = false }
  }, [router])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
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

      <span className="pill">{isAdmin ? 'Administrateur' : profile?.role === 'supervisor' ? 'Superviseur' : 'Membre'}</span>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.6px', marginTop: 12 }}>
        Bonjour {profile?.full_name || ''}
      </h1>
      <p className="muted" style={{ marginTop: 4 }}>{email}</p>

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
        </>
      ) : (
        <div className="panel">
          <h3>Votre espace</h3>
          <p>
            Le suivi de vos inventaires en ligne arrive bientôt. En attendant, utilisez l&apos;application mobile Quantinvo.
          </p>
        </div>
      )}
    </div>
  )
}
