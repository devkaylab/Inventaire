'use client'

import { useMemo, useState } from 'react'
import { mergePeople } from '@/lib/merge'
import type { PresencePayload } from '@/lib/presence'
import type { ActivityRow, CountEvent } from '@/lib/activity'
import type { Member, Session } from '@/lib/inventory'
import { UNNAMED, type ZoneDashboardRow } from '@/lib/zones'
import { PeopleList } from '@/components/dashboard/PeopleList'
import { BaliseDetail } from '@/components/dashboard/BaliseDetail'
import { ZoneProgressList } from '@/components/dashboard/ZoneProgressList'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { Stat } from '@/components/ui/Stat'
import { fmtQty } from '@/lib/format'

export function SuiviTab({
  session, zones, members, presence, activity, recent, unknownVersions, totals,
  readOnly, onZonesChanged,
}: {
  session: Session
  zones: ZoneDashboardRow[]
  members: Member[]
  presence: Record<string, PresencePayload>
  activity: ActivityRow[]
  recent: CountEvent[]
  unknownVersions: number
  totals: { counted: number; audited: number; countedSkus: number; auditedSkus: number }
  readOnly: boolean
  onZonesChanged: () => Promise<void> | void
}) {
  // Zone dépliée : le Suivi ne montre que l'avancement par zone, les numéros
  // de balises n'apparaissent qu'en cliquant sur un emplacement.
  const [openZone, setOpenZone] = useState<string | null>(null)

  const zoneNames = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const z of zones) m[z.code] = z.name
    return m
  }, [zones])

  const people = useMemo(() => mergePeople({
    members, createdBy: session.created_by, presence, activity, zoneNames,
  }), [members, session.created_by, presence, activity, zoneNames])

  const names = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of people) m[p.userId] = p.name
    return m
  }, [people])

  const zoneDetail = useMemo(
    () => (openZone == null ? null : zones.filter(z => (z.name ?? UNNAMED) === openZone)),
    [zones, openZone],
  )

  const online = people.filter(p => p.tier === 'online').length
  const recentCount = people.filter(p => p.tier === 'recent').length

  if (openZone != null && zoneDetail != null) {
    const counted = zoneDetail.filter(z => z.count_status === 'done').length
    const audited = zoneDetail.filter(z => z.audit_status === 'done').length
    return (
      <div>
        <div className="zone-detail-head">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpenZone(null)}>
            ← Suivi
          </button>
          <div>
            <div className="zone-name">{openZone}</div>
            <div className="muted small">
              <span className="num">{counted}/{zoneDetail.length}</span> comptées ·{' '}
              <span className="num">{audited}/{zoneDetail.length}</span> auditées
            </div>
          </div>
        </div>
        <BaliseDetail
          sessionId={session.id}
          zones={zoneDetail}
          readOnly={readOnly}
          onChanged={onZonesChanged}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="dash-stats">
        <Stat label="En ligne" value={String(online)} tone={online > 0 ? 'pos' : 'neutral'} />
        <Stat label="Actifs récemment" value={String(recentCount)} sub="dernier scan < 10 min" />
        <Stat label="Pièces comptées" value={fmtQty(totals.counted)} />
        <Stat label="Pièces auditées" value={fmtQty(totals.audited)} />
      </div>

      {unknownVersions > 0 && (
        <div className="banner banner-warn">
          {unknownVersions === 1
            ? "Une personne utilise une version de l'application dont le format de présence est inconnu : son statut « en ligne » ne peut pas être affiché."
            : `${unknownVersions} personnes utilisent une version de l'application dont le format de présence est inconnu : leur statut « en ligne » ne peut pas être affiché.`}
          {' '}Leur activité reste visible ci-dessous, déduite de leurs scans.
        </div>
      )}

      <div className="dash-section-label" style={{ marginBottom: 10 }}>Sur l&apos;inventaire</div>
      <PeopleList people={people} />

      {session.uses_zones && (
        <>
          <div className="dash-section-label" style={{ margin: '28px 0 10px' }}>Avancement par zone</div>
          <ZoneProgressList zones={zones} onOpenZone={g => setOpenZone(g.name)} />
        </>
      )}

      <div className="dash-section-label" style={{ margin: '28px 0 10px' }}>Derniers scans</div>
      <ActivityFeed events={recent} names={names} zoneNames={zoneNames} />
    </div>
  )
}
