'use client'

import { useMemo } from 'react'
import { fmtQty, plural } from '@/lib/format'
import type { ZoneDashboardRow } from '@/lib/zones'
import type { Totals } from '@/hooks/useSessionData'

/**
 * Colonne de progression. Deux barres, pas une : le comptage et l'audit sont
 * deux cycles indépendants, et le superviseur pilote les deux. Le détail par
 * zone vit dans l'onglet Suivi — le rail n'en garde qu'un total, pour ne pas
 * répéter la même liste à deux endroits de l'écran.
 */
export function ProgressRail({
  usesZones, zones, totals, theoreticalQty, onOpenTab,
}: {
  usesZones: boolean
  zones: ZoneDashboardRow[]
  totals: Totals
  /** Somme des quantités attendues ; 0 quand aucun stock théorique n'est importé. */
  theoreticalQty: number
  /** Renvoie vers un onglet : l'avancement dans Suivi, la préparation dans Set up. */
  onOpenTab: (tab: 'suivi' | 'setup') => void
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
              <button type="button" className="link-btn" onClick={() => onOpenTab('setup')}>
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
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenTab('setup')}>
            Renseigner les zones
          </button>
        </div>
      ) : stats.total - stats.counted === 0 ? (
        <div className="dash-ok">Toutes les balises ont été comptées.</div>
      ) : (
        <div className="dash-missing">
          <div className="dash-missing-row">
            <span>Reste à compter</span>
            <span className="dash-missing-count num">
              {plural(stats.total - stats.counted, 'balise')}
            </span>
          </div>
          <button type="button" className="link-btn" onClick={() => onOpenTab('suivi')}>
            Voir l&apos;avancement par zone
          </button>
        </div>
      )}
    </aside>
  )
}
