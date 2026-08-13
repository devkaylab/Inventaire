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
  usesZones, zones, totals, theoreticalQty, onSeeDetail,
}: {
  usesZones: boolean
  zones: ZoneDashboardRow[]
  totals: Totals
  /** Somme des quantités attendues ; 0 quand aucun stock théorique n'est importé. */
  theoreticalQty: number
  /** Renvoie au détail : les zones en mode balises, les fichiers sinon. */
  onSeeDetail: () => void
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
    // Mode classique : sans balise, le seul dénominateur qui parle au terrain
    // est le stock théorique attendu — un nombre de pièces, comparable à ce qui
    // est scanné. L'ancienne version rapportait le comptage au *nombre de
    // références* du référentiel, ce qui mélangeait deux unités : on pouvait
    // afficher « 80 % » avec la moitié des pièces manquantes.
    const pct = theoreticalQty > 0
      ? Math.min(100, Math.round((totals.counted / theoreticalQty) * 100))
      : 0
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

        <div className="dash-bar-row">
          <div className="dash-bar-legend">
            <span>Stock théorique attendu</span>
            <strong className="num">{fmtQty(theoreticalQty)}</strong>
          </div>
          {theoreticalQty > 0 ? (
            <>
              <div className="dash-bar">
                <div className="dash-bar-fill dash-bar-count" style={{ width: `${pct}%` }} />
              </div>
              <div className="dash-progress-sub small">
                {fmtQty(totals.counted)} / {fmtQty(theoreticalQty)} pièces attendues — {pct}%
              </div>
            </>
          ) : (
            // Un 0 sans explication laisse croire à une panne. C'est presque
            // toujours un fichier optionnel qu'on n'a pas chargé.
            <div className="dash-progress-sub small">
              Aucun stock théorique importé : l&apos;attendu vaut 0 et aucun écart ne peut être
              calculé.{' '}
              <button type="button" className="link-btn" onClick={onSeeDetail}>
                Importer le fichier
              </button>
            </div>
          )}
        </div>
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
          <button type="button" className="btn btn-ghost btn-sm" onClick={onSeeDetail}>
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
          <button type="button" className="link-btn" onClick={onSeeDetail}>
            Voir le détail des balises
          </button>
        </div>
      )}
    </aside>
  )
}
