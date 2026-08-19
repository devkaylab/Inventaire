'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AUDIT_STATUS_LABELS, getSessionDetail, getSessionResults, recomputeAudit,
  type SessionResultRow,
} from '@/lib/inventory'
import { downloadCsv, downloadXlsx } from '@/lib/report'
import { fmtQty, fmtSigned, money } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { Stat } from '@/components/ui/Stat'

type SortKey = 'label' | 'theoretical_qty' | 'counted_qty' | 'variance_units' | 'variance_value' | 'status'

/**
 * Le rapport ne se recalcule pas à chaque battement du tableau de bord.
 *
 * `recomputeAudit` réécrit `article_audit` : le rejouer toutes les 8 secondes,
 * pour chaque superviseur connecté, coûterait cher pour rien. Mais le laisser
 * figé pendant que la progression avance sous les yeux est trompeur — le
 * superviseur croit le rapport à jour alors qu'il date de son arrivée sur
 * l'onglet. On le raccroche donc au même signal, mais bridé, et surtout on
 * affiche l'heure du calcul : un chiffre daté ne ment pas.
 */
const REPORT_MIN_INTERVAL_MS = 20_000

export function RapportTab({ sessionId, inventoryNumber, liveTick }: {
  sessionId: string
  inventoryNumber: string
  /** Horodatage du dernier rafraîchissement live, pour se recaler dessus. */
  liveTick: number
}) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SessionResultRow[]>([])
  const [computedAt, setComputedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'variance_value', dir: 1 })
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null)
  const [askFormat, setAskFormat] = useState(false)
  const lastRunRef = useRef(0)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true)
    else setLoading(true)
    lastRunRef.current = Date.now()
    try {
      await recomputeAudit(sessionId)
      setRows(await getSessionResults(sessionId))
      setComputedAt(new Date())
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [sessionId, toast])

  useEffect(() => { void load() }, [load])

  // Se recale sur le battement live, sans descendre sous l'intervalle minimal.
  useEffect(() => {
    if (liveTick === 0) return
    if (Date.now() - lastRunRef.current < REPORT_MIN_INTERVAL_MS) return
    void load({ silent: true })
  }, [liveTick, load])

  const totals = useMemo(() => ({
    lines: rows.length,
    varUnits: rows.reduce((s, x) => s + Number(x.variance_units), 0),
    varValue: rows.reduce((s, x) => s + Number(x.variance_value), 0),
    shrink: rows.reduce((s, x) => s + Math.min(0, Number(x.variance_value)), 0),
    unresolved: rows.filter(r => r.status === 'failed').length,
  }), [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q === ''
      ? rows
      : rows.filter(r =>
        r.sku.toLowerCase().includes(q)
        || (r.ean ?? '').toLowerCase().includes(q)
        || r.label.toLowerCase().includes(q)
        || r.brand.toLowerCase().includes(q))

    return [...filtered].sort((a, b) => {
      const { key, dir } = sort
      if (key === 'label' || key === 'status') {
        return dir * String(a[key]).localeCompare(String(b[key]), 'fr')
      }
      return dir * (Number(a[key]) - Number(b[key]))
    })
  }, [rows, query, sort])

  function toggleSort(key: SortKey) {
    setSort(s => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) } : { key, dir: 1 }))
  }

  async function onExport(format: 'xlsx' | 'csv') {
    setExporting(format)
    try {
      if (format === 'csv') {
        // Le détail par balise est la requête la plus lourde : elle n'est
        // faite qu'à l'export, pour l'Excel comme pour le CSV — les deux
        // doivent contenir la même chose.
        const detail = await getSessionDetail(sessionId)
        const names = downloadCsv(inventoryNumber, rows, detail)
        toast.success(
          names.length > 1
            ? `${names.length} fichiers téléchargés : écarts et détail par zone.`
            : `${names[0]} téléchargé.`,
        )
      } else {
        // Le détail par balise n'est chargé qu'au moment de l'export : c'est la
        // requête la plus lourde et elle ne sert qu'au fichier.
        const detail = await getSessionDetail(sessionId)
        const name = await downloadXlsx(inventoryNumber, rows, detail)
        toast.success(`${name} téléchargé (2 feuilles : Écarts, Détail par zone).`)
      }
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setExporting(null)
    }
  }

  if (loading) return <SkeletonRows rows={5} />

  return (
    <div>
      <div className="dash-stats">
        <Stat label="Articles comptés" value={String(totals.lines)} />
        <Stat label="Écart (unités)" value={fmtSigned(totals.varUnits)} tone={totals.varUnits < 0 ? 'neg' : 'pos'} />
        <Stat label="Écart (valeur achat)" value={`${money(totals.varValue)} €`} tone={totals.varValue < 0 ? 'neg' : 'pos'} />
        <Stat label="Démarque" value={`${money(totals.shrink)} €`} tone="neg" sub="somme des écarts négatifs" />
      </div>

      {totals.unresolved > 0 && (
        <div className="banner banner-warn">
          {totals.unresolved} article{totals.unresolved > 1 ? 's présentent' : ' présente'} encore un écart
          non arbitré entre le comptage et l’audit. Sans arbitrage, c’est <strong>la quantité de
          l’auditeur</strong> qui part dans le rapport. Tranchez-les depuis l’onglet Écarts d’audit pour un
          rapport définitif.
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-grow">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un article, un SKU, un EAN…"
            aria-label="Rechercher dans le rapport"
          />
        </div>
        <button
          type="button" className="btn btn-primary"
          disabled={rows.length === 0 || exporting !== null}
          onClick={() => setAskFormat(true)}
        >
          {exporting ? 'Préparation…' : 'Télécharger'}
        </button>
      </div>

      <div className="report-freshness">
        <span className="muted small">
          {refreshing
            ? 'Recalcul en cours…'
            : computedAt
              ? `Chiffres calculés à ${computedAt.toLocaleTimeString('fr-FR')}`
              : 'Chiffres non calculés'}
        </span>
        <button type="button" className="link-btn" disabled={refreshing} onClick={() => void load({ silent: true })}>
          Actualiser
        </button>
      </div>

      {askFormat && (
        <Modal title="Format du téléchargement" onClose={() => setAskFormat(false)}>
          <div className="format-choice">
            <button type="button" className="format-option" onClick={() => { setAskFormat(false); void onExport('xlsx') }}>
              <strong>Excel (.xlsx)</strong>
              <span className="muted small">
                Deux feuilles : « Écarts » (une ligne par article) et « Détail par zone »
                (une ligne par balise, avec Compté par et Audité par).
              </span>
            </button>
            <button type="button" className="format-option" onClick={() => { setAskFormat(false); void onExport('csv') }}>
              <strong>CSV (2 fichiers)</strong>
              <span className="muted small">
                Le CSV ne connaît pas les feuilles : vous recevez les deux mêmes tableaux en
                deux fichiers, avec exactement les mêmes colonnes qu&apos;Excel.
              </span>
            </button>
          </div>
        </Modal>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="Aucun résultat"
          hint="Le rapport se remplit à mesure des comptages. Importez le stock théorique si vous voulez comparer au stock attendu."
        />
      ) : visible.length === 0 ? (
        <EmptyState title="Aucun article ne correspond" hint={`Rien ne correspond à « ${query} ».`} />
      ) : (
        <>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <Th label="Article" onClick={() => toggleSort('label')} active={sort.key === 'label'} dir={sort.dir} />
                  <Th label="Théorique" num onClick={() => toggleSort('theoretical_qty')} active={sort.key === 'theoretical_qty'} dir={sort.dir} />
                  <Th label="Compté" num onClick={() => toggleSort('counted_qty')} active={sort.key === 'counted_qty'} dir={sort.dir} />
                  <Th label="Écart" num onClick={() => toggleSort('variance_units')} active={sort.key === 'variance_units'} dir={sort.dir} />
                  <Th label="Valeur" num onClick={() => toggleSort('variance_value')} active={sort.key === 'variance_value'} dir={sort.dir} />
                  <Th label="Statut" onClick={() => toggleSort('status')} active={sort.key === 'status'} dir={sort.dir} />
                </tr>
              </thead>
              <tbody>
                {visible.map(r => {
                  const units = Number(r.variance_units)
                  const value = Number(r.variance_value)
                  return (
                    <tr key={r.sku}>
                      <td>
                        <div className="dash-art-label">{r.label || r.sku}</div>
                        <div className="muted small">{r.brand}{r.ean ? ` · ${r.ean}` : ''}</div>
                      </td>
                      <td className="num">{fmtQty(Number(r.theoretical_qty))}</td>
                      <td className="num">{fmtQty(Number(r.counted_qty))}</td>
                      <td className={`num ${units === 0 ? '' : units < 0 ? 'neg' : 'pos'}`}>{fmtSigned(units)}</td>
                      <td className={`num ${value < 0 ? 'neg' : ''}`}>{money(value)} €</td>
                      <td>
                        <span className={`dash-audit-badge dash-audit-badge-${r.status}`}>
                          {AUDIT_STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>
            {visible.length} ligne{visible.length > 1 ? 's' : ''} affichée{visible.length > 1 ? 's' : ''}
            {query && ` sur ${rows.length}`}. Quantité retenue : arbitrage, sinon auditeur, sinon compteur.
          </p>
        </>
      )}
    </div>
  )
}

function Th({ label, num, onClick, active, dir }: {
  label: string; num?: boolean; onClick: () => void; active: boolean; dir: 1 | -1
}) {
  return (
    <th
      className={`sortable${num ? ' num' : ''}`}
      onClick={onClick}
      aria-sort={active ? (dir === 1 ? 'ascending' : 'descending') : 'none'}
    >
      {label}{active ? (dir === 1 ? ' ↑' : ' ↓') : ''}
    </th>
  )
}
