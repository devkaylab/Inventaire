'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyCompany } from '@/lib/account'
import { useSessionData, type LiveScope } from '@/hooks/useSessionData'
import { useSessionLive } from '@/hooks/useSessionLive'
import { STATUS_LABELS } from '@/lib/inventory'
import { relativeTime } from '@/lib/format'
import { ProgressRail } from '@/components/dashboard/ProgressRail'
import { SessionInfo } from '@/components/dashboard/SessionInfo'
import { SessionActionsMenu } from '@/components/dashboard/SessionActionsMenu'
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

// Ce que chaque section a réellement besoin de voir se rafraîchir. Recalculer
// l'avancement par zone et les totaux fait reparcourir à la base tous les
// comptages de l'inventaire : le faire pour une section qui n'en montre rien
// est du travail perdu, multiplié par le nombre de superviseurs connectés.
//
// Le Rapport est en `aucun` mais reste vivant : il recharge le sien à chaque
// battement, et c'est bien ce qui est affiché à l'écran.
const LIVE_SCOPES: Record<Tab, LiveScope> = {
  suivi: 'suivi',
  setup: 'zones',
  ecarts: 'zones',
  rapport: 'aucun',
  equipe: 'aucun',
}

// Les anciens onglets « Zones & balises » et « Fichiers » vivent désormais
// dans Set up : les liens enregistrés continuent d'arriver au bon endroit.
const LEGACY_TABS: Record<string, Tab> = { zones: 'setup', fichiers: 'setup' }

export default function SessionDashboardPage() {
  const router = useRouter()
  const params = useParams<{ sessionId: string }>()
  const sessionId = params.sessionId

  const guard = useAuthGuard('supervisor')
  const [tab, setTab] = useState<Tab>('suivi')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const data = useSessionData(sessionId, LIVE_SCOPES[tab])

  // La barre de navigation lit l'entreprise sous le nom de la personne :
  // même barre que les autres pages, donc même chargement.
  useEffect(() => {
    if (guard.status !== 'ready') return
    getMyCompany().then(c => setCompanyName(c?.name ?? null)).catch(() => {})
  }, [guard.status])

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

  const { refreshLive } = data
  const live = useSessionLive(sessionId, guard.status === 'ready', refreshLive, {
    // Un inventaire clôturé ne bouge plus : inutile de le sonder.
    enabled: data.session?.status !== 'closed',
  })

  useEffect(() => {
    if (data.notFound) router.replace('/dashboard')
  }, [data.notFound, router])

  // Changer de section est un geste, pas un automatisme : on recharge tout de
  // suite, sans passer par la limite d'une minute. Sans cela, arriver sur Suivi
  // après un moment passé sur le Rapport montrerait un avancement figé — les
  // rafraîchissements joués pendant ce temps n'avaient rien rechargé.
  // Extrait de `live` plutôt que lu dessus : la présence change à chaque
  // battement, donc dépendre de l'objet entier rechargerait l'inventaire à
  // chaque appareil qui se signale. La fonction, elle, est stable.
  const { refresh: rechargerMaintenant } = live
  const sectionPrecedente = useRef(tab)
  useEffect(() => {
    if (sectionPrecedente.current === tab) return
    sectionPrecedente.current = tab
    rechargerMaintenant()
  }, [tab, rechargerMaintenant])

  if (guard.status === 'loading') {
    return (
      <div className="dash">
        <span className="muted">Chargement de l’inventaire…</span>
        <SkeletonRows rows={5} height={72} />
      </div>
    )
  }

  // Dès que le profil est connu, la barre est là : l'inventaire se charge
  // sous une navigation déjà en place, plutôt qu'après elle.
  if (data.loading) {
    return (
      <AppShell profile={guard.profile} companyName={companyName}>
        <p className="muted" style={{ marginBottom: 16 }}>Chargement de l’inventaire…</p>
        <SkeletonRows rows={5} height={72} />
      </AppShell>
    )
  }

  if (data.error || !data.session) {
    return (
      <AppShell profile={guard.profile} companyName={companyName}>
        <EmptyState
          title="Cet inventaire n’est pas accessible"
          hint={data.error ?? "Vous n’en êtes ni le créateur ni un participant. Demandez au créateur de vous y inviter."}
          action={<Link href="/dashboard" className="btn btn-primary">Retour à mes inventaires</Link>}
        />
      </AppShell>
    )
  }

  const session = data.session
  const closed = session.status === 'closed'
  const isCreator = session.created_by === guard.profile.id || !!guard.profile.is_company_admin
  const visibleTabs = TABS

  return (
    <AppShell profile={guard.profile} companyName={companyName}>
      {/* Même en-tête que les autres pages de l'espace connecté : `app-head`
          et `page-title`. Cet écran avait gardé les siens, hérités du temps
          où il vivait hors de la coquille. */}
      <div className="app-head">
        <div>
          <h1 className="page-title">{session.name || session.store_name}</h1>
          <p className="page-sub">
            {session.store_name} · <span className="num">{session.inventory_number}</span>
          </p>
        </div>
        <div className="app-head-actions">
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
          <SessionActionsMenu
            session={session}
            isCreator={isCreator}
            canReopen={isCreator || !!guard.profile.is_company_admin}
            onChanged={data.refreshMeta}
            onDeleted={() => router.replace('/dashboard')}
          />
        </div>
      </div>

      {closed && (
        <div className="banner banner-info">
          Cet inventaire est <strong>clôturé</strong> : aucun comptage ne peut plus y être enregistré,
          y compris depuis un téléphone resté ouvert sur la session. Les données sont conservées et le
          rapport reste téléchargeable.{' '}
          {isCreator || guard.profile.is_company_admin
            ? 'Vous pouvez le rouvrir depuis le menu « ••• » en haut de page.'
            : 'Seul son créateur peut le rouvrir.'}
        </div>
      )}

      <div className="dash-detail">
        <div className="dash-rail">
          <ProgressRail
            usesZones={session.uses_zones}
            zones={data.zones}
            totals={data.totals}
            theoreticalQty={data.importState.theoreticalQty}
            onOpenTab={selectTab}
          />
          <SessionInfo session={session} />
        </div>

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

          {/* Sur mobile la barre d'onglets n'existe pas : ce titre dit où on
              est, et le burger à côté mène aux autres sections. */}
          <div className="dash-mobile-bar">
            <div className="dash-mobile-title dash-section-label" aria-hidden="true">
              {TABS.find(t => t.key === tab)?.label}
            </div>
            <MobileNav tabs={TABS} active={tab} onSelect={k => selectTab(k as Tab)} />
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
                onOpenSuivi={() => selectTab('suivi')}
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
                currentUserId={guard.profile.id}
                onChanged={data.refreshMeta}
                onDeleted={() => router.replace('/dashboard')}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
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
