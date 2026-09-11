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
import { fmtQty, nb, plural } from '@/lib/format'
import { t, tn } from '@/lib/i18n'

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
      {/* Cinq tuiles : la grille de quatre laisserait la cinquième seule sur
          une deuxième ligne. Voir `.dash-stats-5` dans globals.css. */}
      <div className="dash-stats dash-stats-5">
        <Stat
          label={t('Appareils connectés')}
          value={nb(live.devices)}
          tone={live.devices > 0 ? 'pos' : 'neutral'}
          sub={live.devices > 0 ? 'sur cet inventaire' : 'aucun appareil connecté'}
        />
        <Stat label={t('En comptage')} value={nb(live.counting)} />
        <Stat label={t('En audit')} value={nb(live.auditing)} />
        <Stat
          label={t('Pièces comptées')}
          value={fmtQty(totals.counted)}
          sub={plural(totals.audited, 'auditée', 'auditées')}
        />
        {/* Les pièces disent le volume, les références disent l'étendue :
            300 pièces sur 4 références n'est pas le même inventaire que
            300 pièces sur 250 références. */}
        <Stat
          label={t('Références comptées')}
          value={fmtQty(totals.countedSkus)}
          sub={plural(totals.auditedSkus, 'auditée', 'auditées')}
        />
      </div>

      {unknownVersions > 0 && (
        <div className="banner banner-warn">
          {tn("%{count} appareil utilise une version de l'application dont le format est inconnu : il n’est pas compté ci-dessus. Les scans, eux, remontent normalement.",
            "%{count} appareils utilisent une version de l'application dont le format est inconnu : ils ne sont pas comptés ci-dessus. Les scans, eux, remontent normalement.", unknownVersions)}
        </div>
      )}

      {session.uses_zones && (
        <>
          <div className="dash-section-label" style={{ margin: '4px 0 10px' }}>{t('Avancement par zone')}</div>
          <ZoneProgressList zones={zones} onOpenZone={g => setOpenZone(g.name)} />
        </>
      )}

      <div className="dash-section-label" style={{ margin: '28px 0 10px' }}>{t('Derniers scans')}</div>
      <ActivityFeed events={recent} zoneNames={zoneNames} />
    </div>
  )
}
