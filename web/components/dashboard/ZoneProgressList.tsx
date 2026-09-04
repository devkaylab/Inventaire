'use client'

import { useMemo } from 'react'
import { groupByName, type ZoneDashboardRow, type ZoneGroup } from '@/lib/zones'
import { nb } from '@/lib/format'
import { EmptyState } from '@/components/ui/EmptyState'

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

/**
 * Avancement par zone, sans les numéros de balises : un superviseur suit des
 * emplacements (« Surface de vente : 6/10 comptées »), pas des étiquettes.
 * Le nom de la zone ouvre le détail des balises pour qui en a besoin.
 */
export function ZoneProgressList({ zones, onOpenZone }: {
  zones: ZoneDashboardRow[]
  onOpenZone: (group: ZoneGroup) => void
}) {
  const groups = useMemo(() => groupByName(zones), [zones])

  if (zones.length === 0) {
    return (
      <EmptyState
        title="Aucune balise affectée"
        hint="Affectez une plage de balises à un emplacement depuis l'onglet « Set up » pour suivre l'avancement zone par zone."
      />
    )
  }

  return (
    <div className="zone-list">
      {groups.map(g => {
        const countPct = pct(g.counted, g.total)
        const auditPct = pct(g.audited, g.total)
        return (
          <button
            type="button"
            key={g.name}
            className="zone-progress"
            onClick={() => onOpenZone(g)}
            title={`Voir le détail des balises de « ${g.name} »`}
          >
            <div className="zone-progress-head">
              <span className="zone-name">{g.name}</span>
              <span className="zone-progress-arrow" aria-hidden="true">›</span>
            </div>

            <div className="zone-progress-bars">
              <div className="zone-progress-bar">
                <div className="dash-bar-legend">
                  <span>Comptées</span>
                  <strong className="num">{nb(g.counted)}/{nb(g.total)} · {countPct} %</strong>
                </div>
                <div className="dash-bar">
                  <div className="dash-bar-fill dash-bar-count" style={{ width: `${countPct}%` }} />
                </div>
              </div>
              <div className="zone-progress-bar">
                <div className="dash-bar-legend">
                  <span>Auditées</span>
                  <strong className="num">{nb(g.audited)}/{nb(g.total)} · {auditPct} %</strong>
                </div>
                <div className="dash-bar">
                  <div className="dash-bar-fill dash-bar-audit" style={{ width: `${auditPct}%` }} />
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
