'use client'

import { useMemo, useState } from 'react'
import type { PresencePayload } from '@/lib/presence'
import type { CountEvent } from '@/lib/activity'
import type { Session } from '@/lib/inventory'
import { UNNAMED, type ZoneDashboardRow } from '@/lib/zones'
import { summarizePresence } from '@/lib/presence-summary'
import { BaliseDetail } from '@/components/dashboard/BaliseDetail'
import { ZoneProgressList } from '@/components/dashboard/ZoneProgressList'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { Stat } from '@/components/ui/Stat'
import { fmtQty, plural } from '@/lib/format'

export function SuiviTab({
  session, zones, presence, recent, unknownVersions, totals, readOnly, onZonesChanged,
}: {
  session: Session
  zones: ZoneDashboardRow[]
  presence: Record<string, PresencePayload>
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

  // Combien de personnes travaillent, et dans quel mode — pas qui fait quoi.
  const live = useMemo(() => summarizePresence(presence), [presence])

  const zoneDetail = useMemo(
    () => (openZone == null ? null : zones.filter(z => (z.name ?? UNNAMED) === openZone)),
    [zones, openZone],
  )

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
        <Stat
          label="Appareils connectés"
          value={String(live.devices)}
          tone={live.devices > 0 ? 'pos' : 'neutral'}
          sub={live.devices > 0 ? 'sur cet inventaire' : 'aucun appareil connecté'}
        />
        <Stat label="En comptage" value={String(live.counting)} />
        <Stat label="En audit" value={String(live.auditing)} />
        <Stat
          label="Pièces comptées"
          value={fmtQty(totals.counted)}
          sub={`${fmtQty(totals.audited)} auditées`}
        />
      </div>

      {unknownVersions > 0 && (
        <div className="banner banner-warn">
          {plural(unknownVersions, 'appareil utilise', 'appareils utilisent')} une version de
          l&apos;application dont le format est inconnu : {unknownVersions === 1 ? 'il n’est' : 'ils ne sont'}{' '}
          pas {unknownVersions === 1 ? 'compté' : 'comptés'} ci-dessus. Les scans, eux, remontent normalement.
        </div>
      )}

      {session.uses_zones && (
        <>
          <div className="dash-section-label" style={{ margin: '4px 0 10px' }}>Avancement par zone</div>
          <ZoneProgressList zones={zones} onOpenZone={g => setOpenZone(g.name)} />
        </>
      )}

      <div className="dash-section-label" style={{ margin: '28px 0 10px' }}>Derniers scans</div>
      <ActivityFeed events={recent} zoneNames={zoneNames} />
    </div>
  )
}
