'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'
import {
  getAccessibleSessions, groupByStore, STATUS_LABELS, type Session,
} from '@/lib/inventory'

export default function DashboardPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('role,is_admin').eq('id', session.user.id).maybeSingle()
      if (prof?.role !== 'supervisor') { router.replace('/account'); return }
      const rows = await getAccessibleSessions()
      if (active) { setSessions(rows); setReady(true) }
    })()
    return () => { active = false }
  }, [router])

  const groups = useMemo(() => groupByStore(sessions), [sessions])
  const activeCount = useMemo(() => sessions.filter(s => s.status !== 'closed').length, [sessions])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (!ready) return <div className="auth-wrap"><p className="muted">Chargement…</p></div>

  return (
    <div className="dash">
      <div className="row">
        <Link href="/" className="brand"><Logo size={28} /><span>Quantinvo</span></Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/account" className="btn btn-ghost">Mon compte</Link>
          <button className="btn btn-ghost" onClick={signOut}>Déconnexion</button>
        </div>
      </div>

      <span className="pill">Superviseur</span>
      <h1 className="admin-title">Tableau de bord</h1>

      <div className="dash-kpis">
        <div className="dash-kpi">
          <div className="dash-kpi-value">{groups.length}</div>
          <div className="dash-kpi-label">Magasin{groups.length > 1 ? 's' : ''}</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-value">{activeCount}</div>
          <div className="dash-kpi-label">Inventaire{activeCount > 1 ? 's' : ''} en cours</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-value">{sessions.length}</div>
          <div className="dash-kpi-label">Total</div>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="muted" style={{ marginTop: 24 }}>
          Aucun inventaire pour l'instant. Vos magasins affectés et leurs inventaires apparaîtront ici.
        </p>
      ) : (
        groups.map(({ store, sessions: list }) => {
          const active = list.filter(s => s.status !== 'closed')
          const past = list.filter(s => s.status === 'closed')
          return (
            <section className="dash-store" key={store}>
              <h2 className="dash-store-name">{store}</h2>

              {active.length > 0 && (
                <div className="dash-grid">
                  {active.map(s => <SessionCard key={s.id} s={s} live />)}
                </div>
              )}
              {past.length > 0 && (
                <>
                  <div className="dash-sub">Clôturés</div>
                  <div className="dash-grid">
                    {past.map(s => <SessionCard key={s.id} s={s} />)}
                  </div>
                </>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

function SessionCard({ s, live }: { s: Session; live?: boolean }) {
  return (
    <Link href={`/dashboard/${s.id}`} className={`dash-card${live ? ' dash-card-live' : ''}`}>
      <div className="dash-card-head">
        <span className={`dash-badge dash-badge-${s.status}`}>
          <span className="dash-dot" />{STATUS_LABELS[s.status] ?? s.status}
        </span>
        {s.uses_zones && <span className="dash-tag">Zones</span>}
      </div>
      {live && <div className="dash-live-label">Inventaire en cours</div>}
      <div className="dash-card-title">{s.name || s.store_name}</div>
      <div className="dash-card-meta">{s.inventory_number} · {new Date(s.created_at).toLocaleDateString('fr-FR')}</div>
    </Link>
  )
}
