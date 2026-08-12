'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AUDIT_STATUS_LABELS, getSessionDetail, getSessionResults, recomputeAudit,
  type SessionResultRow,
} from '@/lib/inventory'
import { downloadCsv, downloadXlsx } from '@/lib/report'
import { fmtQty, fmtSigned, money } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { Stat } from '@/components/ui/Stat'

type SortKey = 'label' | 'theoretical_qty' | 'counted_qty' | 'variance_units' | 'variance_value' | 'status'

export function RapportTab({ sessionId, inventoryNumber }: {
  sessionId: string
  inventoryNumber: string
}) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<SessionResultRow[]>([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'variance_value', dir: 1 })
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await recomputeAudit(sessionId)
      setRows(await getSessionResults(sessionId))
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [sessionId, toast])

  useEffect(() => { void load() }, [load])

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
        const name = downloadCsv(inventoryNumber, rows)
        toast.success(`${name} téléchargé.`)
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
          l’auditeur</strong> qui part dans le rapport. Tranchez-les depuis l’onglet Écarts pour un
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
          onClick={() => onExport('xlsx')}
        >
          {exporting === 'xlsx' ? 'Préparation…' : 'Télécharger Excel'}
        </button>
        <button
          type="button" className="btn btn-ghost"
          disabled={rows.length === 0 || exporting !== null}
          onClick={() => onExport('csv')}
        >
          {exporting === 'csv' ? 'Préparation…' : 'CSV'}
        </button>
      </div>

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
