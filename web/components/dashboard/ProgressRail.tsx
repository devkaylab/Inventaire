'use client'

import { useMemo } from 'react'
import { fmtQty, plural } from '@/lib/format'
import { missingByZone, type ZoneDashboardRow } from '@/lib/zones'
import type { Totals } from '@/hooks/useSessionData'

/**
 * Colonne de progression. Deux barres, pas une : le comptage et l'audit sont
 * deux cycles indépendants, et le superviseur pilote les deux. L'ancienne
 * version n'affichait la barre que pour le comptage et laissait l'audit en
 * texte, ce qui le faisait passer pour un détail.
 */
export function ProgressRail({
  usesZones, zones, totals, articleCount, onSeeZones,
}: {
  usesZones: boolean
  zones: ZoneDashboardRow[]
  totals: Totals
  articleCount: number
  onSeeZones: () => void
}) {
  const stats = useMemo(() => {
    const total = zones.length
    const counted = zones.filter(z => z.count_status === 'done').length
    const audited = zones.filter(z => z.audit_status === 'done').length
    const countOpen = zones.filter(z => z.count_status === 'open').length
    const auditOpen = zones.filter(z => z.audit_status === 'open').length
    return {
      total, counted, audited, countOpen, auditOpen,
      countPct: total > 0 ? Math.round((counted / total) * 100) : 0,
      auditPct: total > 0 ? Math.round((audited / total) * 100) : 0,
    }
  }, [zones])

  const missing = useMemo(() => missingByZone(zones), [zones])

  if (!usesZones) {
    // Mode classique : sans balise il n'existe aucun dénominateur de
    // progression. On montre donc ce qui est mesurable — le volume scanné et sa
    // couverture du référentiel — plutôt que deux nombres nus.
    const coverage = articleCount > 0 ? Math.round((totals.countedSkus / articleCount) * 100) : 0
    return (
      <aside className="dash-progress panel">
        <div className="dash-section-label">Progression</div>
        <div className="dash-big num">{fmtQty(totals.counted)}</div>
        <div className="dash-progress-sub">
          {totals.counted > 1 ? 'pièces scannées' : 'pièce scannée'} en comptage
        </div>

        <div className="dash-bar-row">
          <div className="dash-bar-legend">
            <span>Audit</span>
            <strong className="num">{fmtQty(totals.audited)}</strong>
          </div>
          <div className="dash-progress-sub small">
            {plural(totals.auditedSkus, 'article audité', 'articles audités')}
          </div>
        </div>

        {articleCount > 0 && (
          <div className="dash-bar-row">
            <div className="dash-bar-legend">
              <span>Couverture du référentiel</span>
              <strong className="num">{coverage}%</strong>
            </div>
            <div className="dash-bar">
              <div className="dash-bar-fill dash-bar-count" style={{ width: `${coverage}%` }} />
            </div>
            <div className="dash-progress-sub small">
              {totals.countedSkus} / {articleCount} références vues au moins une fois
            </div>
          </div>
        )}
      </aside>
    )
  }

  return (
    <aside className="dash-progress panel">
      <div className="dash-section-label">Progression</div>
      <div className="dash-big num">{stats.countPct}<span className="dash-big-unit">%</span></div>
      <div className="dash-progress-sub">des balises comptées</div>

      <div className="dash-bar-row">
        <div className="dash-bar-legend">
          <span>Comptage</span>
          <strong className="num">{stats.counted}/{stats.total}</strong>
        </div>
        <div className="dash-bar">
          <div className="dash-bar-fill dash-bar-count" style={{ width: `${stats.countPct}%` }} />
        </div>
        {stats.countOpen > 0 && (
          <div className="dash-progress-sub small">{plural(stats.countOpen, 'balise en cours')}</div>
        )}
      </div>

      <div className="dash-bar-row">
        <div className="dash-bar-legend">
          <span>Audit</span>
          <strong className="num">{stats.audited}/{stats.total}</strong>
        </div>
        <div className="dash-bar">
          <div className="dash-bar-fill dash-bar-audit" style={{ width: `${stats.auditPct}%` }} />
        </div>
        {stats.auditOpen > 0 && (
          <div className="dash-progress-sub small">{plural(stats.auditOpen, 'balise en cours')}</div>
        )}
      </div>

      {stats.total === 0 ? (
        <div className="dash-missing">
          <p className="muted small">
            Aucune balise affectée. Renseignez les emplacements à inventorier pour suivre l&apos;avancement.
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onSeeZones}>
            Renseigner les zones
          </button>
        </div>
      ) : missing.length === 0 ? (
        <div className="dash-ok">Toutes les balises ont été comptées.</div>
      ) : (
        <div className="dash-missing">
          <div className="dash-section-label">Reste à compter</div>
          {missing.map(g => (
            <div className="dash-missing-row" key={g.name}>
              <span>{g.name}</span>
              <span className="dash-missing-count num">{g.codes.length}</span>
            </div>
          ))}
          <button type="button" className="link-btn" onClick={onSeeZones}>
            Voir le détail des balises
          </button>
        </div>
      )}
    </aside>
  )
}
