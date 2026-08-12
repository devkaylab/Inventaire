'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { useAuthGuard, signOut } from '@/hooks/useAuthGuard'
import {
  getAccessibleSessions, groupByStore, STATUS_LABELS, type Session,
} from '@/lib/inventory'
import { fmtDate } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'

export default function DashboardPage() {
  const router = useRouter()
  const toast = useToast()
  const guard = useAuthGuard('supervisor')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (guard.status !== 'ready') return
    let active = true
    ;(async () => {
      try {
        const rows = await getAccessibleSessions()
        if (active) setSessions(rows)
      } catch (err) {
        if (active) toast.error(friendlyError(err))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [guard.status, toast])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter(s =>
      (s.name || '').toLowerCase().includes(q)
      || s.store_name.toLowerCase().includes(q)
      || s.inventory_number.toLowerCase().includes(q))
  }, [sessions, query])

  const groups = useMemo(() => groupByStore(filtered), [filtered])
  const activeCount = useMemo(() => sessions.filter(s => s.status !== 'closed').length, [sessions])
  const storeCount = useMemo(() => new Set(sessions.map(s => s.store_name)).size, [sessions])

  const onSignOut = useCallback(async () => {
    await signOut()
    router.replace('/login')
  }, [router])

  if (guard.status === 'loading') {
    return <div className="dash"><SkeletonRows rows={3} /></div>
  }

  return (
    <div className="dash">
      <div className="row">
        <Link href="/" className="brand"><Logo size={28} /><span>Quantinvo</span></Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/account" className="btn btn-ghost">Mon compte</Link>
          <button className="btn btn-ghost" onClick={onSignOut}>Déconnexion</button>
        </div>
      </div>

      <span className="pill">Superviseur</span>
      <div className="admin-section-head" style={{ marginTop: 8 }}>
        <h1 className="admin-title" style={{ margin: 0 }}>Mes inventaires</h1>
        <Link href="/dashboard/new" className="btn btn-primary">Nouvel inventaire</Link>
      </div>

      <div className="dash-kpis">
        <div className="dash-kpi">
          <div className="dash-kpi-value num">{storeCount}</div>
          <div className="dash-kpi-label">Magasin{storeCount > 1 ? 's' : ''}</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-value num">{activeCount}</div>
          <div className="dash-kpi-label">Inventaire{activeCount > 1 ? 's' : ''} en cours</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-value num">{sessions.length}</div>
          <div className="dash-kpi-label">Total</div>
        </div>
      </div>

      {sessions.length > 6 && (
        <div className="toolbar" style={{ marginTop: 20 }}>
          <div className="toolbar-grow">
            <input
              type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un inventaire, un magasin, un numéro…"
              aria-label="Rechercher un inventaire"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 24 }}><SkeletonRows rows={3} height={96} /></div>
      ) : sessions.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <EmptyState
            title="Aucun inventaire pour l’instant"
            hint="Vous verrez ici les inventaires que vous avez créés et ceux auxquels on vous a invité."
            action={<Link href="/dashboard/new" className="btn btn-primary">Créer mon premier inventaire</Link>}
          />
        </div>
      ) : groups.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <EmptyState title="Aucun résultat" hint={`Rien ne correspond à « ${query} ».`} />
        </div>
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
      <div className="dash-card-meta">
        <span className="num">{s.inventory_number}</span> · {fmtDate(s.created_at)}
      </div>
    </Link>
  )
}
