'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useSessionData } from '@/hooks/useSessionData'
import { useSessionLive } from '@/hooks/useSessionLive'
import { STATUS_LABELS } from '@/lib/inventory'
import { relativeTime } from '@/lib/format'
import { ProgressRail } from '@/components/dashboard/ProgressRail'
import { MobileNav } from '@/components/dashboard/MobileNav'
import { SuiviTab } from '@/components/dashboard/tabs/SuiviTab'
import { SetupTab } from '@/components/dashboard/tabs/SetupTab'
import { EcartsTab } from '@/components/dashboard/tabs/EcartsTab'
import { RapportTab } from '@/components/dashboard/tabs/RapportTab'
import { EquipeTab } from '@/components/dashboard/tabs/EquipeTab'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

type Tab = 'suivi' | 'setup' | 'ecarts' | 'rapport' | 'equipe'

const TABS: { key: Tab; label: string }[] = [
  { key: 'suivi', label: 'Suivi' },
  { key: 'setup', label: 'Set up' },
  { key: 'ecarts', label: 'Écarts d’audit' },
  { key: 'rapport', label: 'Rapport' },
  { key: 'equipe', label: 'Équipe' },
]

const TAB_KEYS = new Set<string>(TABS.map(t => t.key))

// Les anciens onglets « Zones & balises » et « Fichiers » vivent désormais
// dans Set up : les liens enregistrés continuent d'arriver au bon endroit.
const LEGACY_TABS: Record<string, Tab> = { zones: 'setup', fichiers: 'setup' }

export default function SessionDashboardPage() {
  const router = useRouter()
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId

  const guard = useAuthGuard('supervisor')
  const data = useSessionData(sessionId)
  const [tab, setTab] = useState<Tab>('suivi')

  // L'onglet vit dans l'URL — lien profond, retour navigateur et rechargement
  // conservent la vue. On lit `location.search` plutôt que `useSearchParams`
  // pour éviter la frontière Suspense que Next impose au prérendu.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('tab')
    if (!initial) return
    if (TAB_KEYS.has(initial)) setTab(initial as Tab)
    else if (LEGACY_TABS[initial]) setTab(LEGACY_TABS[initial])
  }, [])

  const selectTab = useCallback((next: Tab) => {
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url.toString())
  }, [])

  const me = useMemo(
    () => (guard.status === 'ready'
      ? { id: guard.profile.id, full_name: guard.profile.full_name, role: guard.profile.role }
      : null),
    [guard],
  )

  const { refreshLive } = data
  const live = useSessionLive(sessionId, me, refreshLive, {
    // Un inventaire clôturé ne bouge plus : inutile de le sonder.
    enabled: data.session?.status !== 'closed',
  })

  useEffect(() => {
    if (data.notFound) router.replace('/dashboard')
  }, [data.notFound, router])

  if (guard.status === 'loading' || data.loading) {
    return (
      <div className="dash dash-wide">
        <div className="row"><span className="muted">Chargement de l’inventaire…</span></div>
        <SkeletonRows rows={5} height={72} />
      </div>
    )
  }

  if (data.error || !data.session) {
    return (
      <div className="dash dash-wide">
        <div className="row">
          <Link href="/dashboard" className="btn btn-ghost">← Tableau de bord</Link>
        </div>
        <EmptyState
          title="Cet inventaire n’est pas accessible"
          hint={data.error ?? "Vous n’en êtes ni le créateur ni un participant. Demandez au créateur de vous y inviter."}
          action={<Link href="/dashboard" className="btn btn-primary">Retour à mes inventaires</Link>}
        />
      </div>
    )
  }

  const session = data.session
  const closed = session.status === 'closed'
  const isCreator = session.created_by === guard.profile.id
  const visibleTabs = TABS

  return (
    <div className="dash dash-wide">
      <div className="row">
        <Link href="/" className="brand"><Logo size={28} /><span>Quantinvo</span></Link>
        {/* Sur mobile, ces liens rejoignent le menu burger avec les sections. */}
        <div className="dash-head-links">
          <Link href="/dashboard" className="btn btn-ghost">← Mes inventaires</Link>
          <Link href="/account" className="btn btn-ghost">Mon compte</Link>
        </div>
        <MobileNav tabs={TABS} active={tab} onSelect={k => selectTab(k as Tab)} />
      </div>

      <div className="dash-detail-head">
        <div>
          <h1 className="admin-title" style={{ margin: 0 }}>{session.name || session.store_name}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {session.store_name} · <span className="num">{session.inventory_number}</span>
          </p>
        </div>
        <div className="dash-detail-head-actions">
          <span className={`dash-badge dash-badge-${session.status}`}>
            <span className="dash-dot" />{STATUS_LABELS[session.status] ?? session.status}
          </span>
          {!closed && (
            <span className="live-status">
              <span className={`live-pulse${live.channelReady ? '' : ' live-pulse-off'}`} />
              {live.channelReady ? 'Temps réel actif' : 'Temps réel indisponible'}
            </span>
          )}
          <button
            type="button"
            className="refresh-btn"
            data-busy={live.refreshing}
            onClick={live.refresh}
            title="Actualiser maintenant"
          >
            <RefreshIcon />
            <span>{live.refreshing ? 'Actualisation…' : `Mis à jour ${relativeTime(new Date(live.lastRefreshAt).toISOString())}`}</span>
          </button>
        </div>
      </div>

      {closed && (
        <div className="banner banner-info">
          Cet inventaire est <strong>clôturé</strong> : aucun comptage ne peut plus y être enregistré,
          y compris depuis un téléphone resté ouvert sur la session. Les données sont conservées et le
          rapport reste téléchargeable. Vous pouvez le rouvrir depuis l’onglet Équipe.
        </div>
      )}

      <div className="dash-detail">
        <ProgressRail
          usesZones={session.uses_zones}
          zones={data.zones}
          totals={data.totals}
          theoreticalQty={data.importState.theoreticalQty}
          onOpenTab={selectTab}
        />

        <div className="dash-main">
          <div className="dash-tabs" role="tablist" aria-label="Sections de l’inventaire">
            {visibleTabs.map(t => (
              <button
                key={t.key}
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls={`panel-${t.key}`}
                className={`dash-tab${tab === t.key ? ' active' : ''}`}
                onClick={() => selectTab(t.key)}
                onKeyDown={e => {
                  const i = visibleTabs.findIndex(x => x.key === tab)
                  if (e.key === 'ArrowRight') selectTab(visibleTabs[(i + 1) % visibleTabs.length].key)
                  if (e.key === 'ArrowLeft') selectTab(visibleTabs[(i - 1 + visibleTabs.length) % visibleTabs.length].key)
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sur mobile la barre d'onglets n'existe pas : ce titre dit où on est. */}
          <div className="dash-mobile-title dash-section-label" aria-hidden="true">
            {TABS.find(t => t.key === tab)?.label}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'suivi' && (
              <SuiviTab
                session={session}
                zones={data.zones}
                presence={live.presence}
                recent={data.recent}
                unknownVersions={live.unknownVersions}
                totals={data.totals}
                readOnly={closed}
                onZonesChanged={data.refreshLive}
              />
            )}

            {tab === 'setup' && (
              <SetupTab
                sessionId={sessionId}
                status={session.status}
                readOnly={closed}
                importState={data.importState}
                usesZones={session.uses_zones}
                zones={data.zones}
                onChanged={data.refreshMeta}
                onZonesChanged={data.refreshLive}
              />
            )}

            {tab === 'ecarts' && (
              <EcartsTab
                sessionId={sessionId}
                zones={data.zones}
                readOnly={closed}
                onResolved={data.refreshLive}
              />
            )}

            {tab === 'rapport' && (
              <RapportTab
                sessionId={sessionId}
                inventoryNumber={session.inventory_number}
                liveTick={live.lastRefreshAt}
              />
            )}

            {tab === 'equipe' && (
              <EquipeTab
                session={session}
                members={data.members}
                invitations={data.invitations}
                isCreator={isCreator}
                onChanged={data.refreshMeta}
                onDeleted={() => router.replace('/dashboard')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}
