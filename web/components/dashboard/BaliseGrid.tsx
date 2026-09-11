'use client'

import { useMemo, useState } from 'react'
import { groupByName, type ZoneDashboardRow } from '@/lib/zones'
import { EmptyState } from '@/components/ui/EmptyState'
import { t } from '@/lib/i18n'

type Filter = 'all' | 'todo' | 'counting' | 'counted' | 'audited'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'todo', label: 'À faire' },
  { key: 'counting', label: 'En cours' },
  { key: 'counted', label: 'Comptées' },
  { key: 'audited', label: 'Auditées' },
]

function matches(z: ZoneDashboardRow, f: Filter): boolean {
  switch (f) {
    case 'all': return true
    case 'todo': return z.count_status === 'pending'
    case 'counting': return z.count_status === 'open' || z.audit_status === 'open'
    case 'counted': return z.count_status === 'done'
    case 'audited': return z.audit_status === 'done'
  }
}

/**
 * Toutes les balises d'un coup d'œil, groupées par emplacement.
 * Chaque balise porte deux pastilles — comptage et audit — parce que les deux
 * cycles sont indépendants : une balise peut être comptée sans être auditée, et
 * l'inverse arrive aussi.
 */
export function BaliseGrid({ zones, onSelect, showGroupLabels = true }: {
  zones: ZoneDashboardRow[]
  onSelect?: (zone: ZoneDashboardRow) => void
  /** À couper quand la grille ne montre qu'une zone déjà titrée par l'appelant. */
  showGroupLabels?: boolean
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const groups = useMemo(() => groupByName(zones.filter(z => matches(z, filter))), [zones, filter])
  const byCode = useMemo(() => new Map(zones.map(z => [z.code, z])), [zones])

  if (zones.length === 0) {
    return (
      <EmptyState
        title={t('Aucune balise affectée')}
        hint={t("Renseignez les emplacements à inventorier depuis l'onglet « Set up » : une plage de balises par emplacement.")}
      />
    )
  }

  return (
    <div>
      <div className="toolbar">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="muted small">{t('Aucune balise dans ce filtre.')}</p>
      ) : groups.map(g => (
        <div key={g.name} style={{ marginBottom: 16 }}>
          {showGroupLabels && (
            <div className="dash-section-label" style={{ marginBottom: 6 }}>
              {g.name} — {g.counted}/{g.total} {t('comptées')} · {g.audited}/{g.total} {t('auditées')}
            </div>
          )}
          <div className="balise-grid">
            {g.codes.map(code => {
              const z = byCode.get(code)
              if (!z) return null
              const title =
                `${t('Balise')} ${z.code} · ${z.name ?? t('sans emplacement')}\n` +
                `${t('Comptage')} : ${t(STATUS_FR[z.count_status])} (${z.count_lines} ${t('réf.')})\n` +
                `${t('Audit')} : ${t(STATUS_FR[z.audit_status])} (${z.audit_lines} ${t('réf.')})`
              const content = (
                <>
                  <span className="num">{z.code}</span>
                  <span className="balise-dots">
                    <span className={`balise-dot balise-dot-count balise-dot-${z.count_status}`} />
                    <span className={`balise-dot balise-dot-audit balise-dot-${z.audit_status}`} />
                  </span>
                </>
              )
              return onSelect ? (
                <button key={code} type="button" className="balise-chip" title={title} onClick={() => onSelect(z)}>
                  {content}
                </button>
              ) : (
                <span key={code} className="balise-chip" title={title}>{content}</span>
              )
            })}
          </div>
        </div>
      ))}

      <div className="balise-legend">
        <span><span className="balise-dot balise-dot-count balise-dot-open" /> {t('en cours (pas encore clôturée)')}</span>
        <span><span className="balise-dot balise-dot-count balise-dot-done" /> {t('comptage terminé')}</span>
        <span><span className="balise-dot balise-dot-audit balise-dot-done" /> {t('audit terminé')}</span>
        <span><span className="balise-dot" /> {t('pas commencé')}</span>
      </div>
    </div>
  )
}

const STATUS_FR: Record<string, string> = {
  pending: 'pas commencé', open: 'en cours', done: 'terminé',
}
