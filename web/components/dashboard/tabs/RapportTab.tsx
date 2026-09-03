'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AUDIT_STATUS_LABELS, getAllRapportRows, getRapportPage, getRapportResume,
  getSessionDetail, recomputeAudit,
  type RapportResume, type RapportTri, type SessionResultRow,
} from '@/lib/inventory'
import { downloadCsv, downloadXlsx } from '@/lib/report'
import { fmtQty, fmtSigned, money } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { Stat } from '@/components/ui/Stat'

type SortKey = Exclude<RapportTri, 'sku'>

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

/**
 * ⚠️ LE TABLEAU SE LIT PAR PAGES (3 septembre 2026).
 *
 * Avant, l'écran chargeait TOUTES les lignes — 400 000 sur un gros inventaire —
 * puis calculait les totaux, la recherche et le tri dans le navigateur. Le
 * serveur ne rendait plus la main (6,3 s mesurées, pour un plafond de 8 s) et
 * l'écran ne s'ouvrait plus du tout.
 *
 * Désormais : les totaux viennent d'un appel qui les calcule en base, la page
 * d'un autre qui cherche et trie en base. **L'export, lui, contient toujours
 * tout** — il parcourt les pages et assemble le fichier.
 */
const PAGE = 50

/** Le temps qu'on laisse à la frappe avant d'interroger le serveur. */
const DELAI_RECHERCHE_MS = 350

export function RapportTab({ sessionId, inventoryNumber, liveTick }: {
  sessionId: string
  inventoryNumber: string
  /** Horodatage du dernier rafraîchissement live, pour se recaler dessus. */
  liveTick: number
}) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [chargeantPage, setChargeantPage] = useState(false)
  const [resume, setResume] = useState<RapportResume | null>(null)
  const [rows, setRows] = useState<SessionResultRow[]>([])
  const [totalFiltre, setTotalFiltre] = useState(0)
  const [page, setPage] = useState(0)
  const [computedAt, setComputedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const [recherche, setRecherche] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'variance_value', dir: 1 })
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null)
  const [avance, setAvance] = useState<string | null>(null)
  const [askFormat, setAskFormat] = useState(false)
  const lastRunRef = useRef(0)

  // La frappe n'interroge pas le serveur à chaque caractère.
  useEffect(() => {
    const t = setTimeout(() => setRecherche(query), DELAI_RECHERCHE_MS)
    return () => clearTimeout(t)
  }, [query])

  // Changer de recherche ou de tri ramène à la première page : rester à la
  // page 12 d'une liste qui vient d'être refiltrée n'a pas de sens.
  useEffect(() => { setPage(0) }, [recherche, sort])

  /** Les totaux + le recalcul : le travail lourd, qu'on ne refait pas en tournant les pages. */
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true)
    else setLoading(true)
    lastRunRef.current = Date.now()
    try {
      await recomputeAudit(sessionId)
      setResume(await getRapportResume(sessionId))
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

  /** La page affichée. Elle se recharge au changement de page, de tri ou de recherche. */
  useEffect(() => {
    let vivant = true
    setChargeantPage(true)
    getRapportPage(sessionId, {
      recherche,
      tri: sort.key,
      sens: sort.dir === 1 ? 'asc' : 'desc',
      offset: page * PAGE,
      limite: PAGE,
    })
      .then(({ rows: r, total }) => {
        if (!vivant) return
        setRows(r)
        setTotalFiltre(total)
      })
      .catch((err) => { if (vivant) toast.error(friendlyError(err)) })
      .finally(() => { if (vivant) setChargeantPage(false) })
    return () => { vivant = false }
  }, [sessionId, recherche, sort, page, computedAt, toast])

  function toggleSort(key: SortKey) {
    setSort(s => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) } : { key, dir: 1 }))
  }

  const pages = Math.max(1, Math.ceil(totalFiltre / PAGE))
  const premier = totalFiltre === 0 ? 0 : page * PAGE + 1
  const dernier = Math.min(totalFiltre, (page + 1) * PAGE)

  const totals = useMemo(() => ({
    theoUnits: resume?.theorique ?? 0,
    countedUnits: resume?.compte ?? 0,
    varUnits: resume?.ecart_unites ?? 0,
    varValue: resume?.ecart_valeur ?? 0,
    unresolved: resume?.non_arbitres ?? 0,
  }), [resume])

  async function onExport(format: 'xlsx' | 'csv') {
    setExporting(format)
    setAvance('Préparation…')
    try {
      // ⚠️ Le fichier remis au client contient TOUT. C'est le seul endroit du
      // site où l'on redemande l'ensemble — par tranches, jamais d'un bloc.
      const suivi = (quoi: string) => (fait: number, total: number) =>
        setAvance(`${quoi} ${fait.toLocaleString('fr-FR')} / ${total.toLocaleString('fr-FR')}`)

      const tout = await getAllRapportRows(sessionId, suivi('Écarts'))
      const detail = await getSessionDetail(sessionId, suivi('Détail par zone'))

      if (format === 'csv') {
        const names = downloadCsv(inventoryNumber, tout, detail)
        toast.success(
          names.length > 1
            ? `${names.length} fichiers téléchargés : écarts et détail par zone.`
            : `${names[0]} téléchargé.`,
        )
      } else {
        const name = await downloadXlsx(inventoryNumber, tout, detail)
        toast.success(`${name} téléchargé (2 feuilles : Écarts, Détail par zone).`)
      }
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setExporting(null)
      setAvance(null)
    }
  }

  if (loading) return <SkeletonRows rows={5} />

  return (
    <div>
      <div className="dash-stats">
        <Stat label="Stock théorique" value={fmtQty(totals.theoUnits)} />
        <Stat label="Stock compté" value={fmtQty(totals.countedUnits)} />
        <Stat label="Écart total (unités)" value={fmtSigned(totals.varUnits)} tone={totals.varUnits < 0 ? 'neg' : 'pos'} />
        <Stat label="Écart total (valeur achat)" value={`${money(totals.varValue)} €`} tone={totals.varValue < 0 ? 'neg' : 'pos'} />
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
          disabled={(resume?.lignes ?? 0) === 0 || exporting !== null}
          onClick={() => setAskFormat(true)}
        >
          {exporting ? (avance ?? 'Préparation…') : 'Télécharger'}
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

      {(resume?.lignes ?? 0) === 0 ? (
        <EmptyState
          title="Aucun résultat"
          hint="Le rapport se remplit à mesure des comptages. Importez le stock théorique si vous voulez comparer au stock attendu."
        />
      ) : totalFiltre === 0 && !chargeantPage ? (
        <EmptyState title="Aucun article ne correspond" hint={`Rien ne correspond à « ${recherche} ».`} />
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
                {rows.map(r => {
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

          <div className="pagination">
            <span className="muted small">
              {premier.toLocaleString('fr-FR')}–{dernier.toLocaleString('fr-FR')} sur{' '}
              {totalFiltre.toLocaleString('fr-FR')}
              {recherche && ` (${(resume?.lignes ?? 0).toLocaleString('fr-FR')} au total)`}
              . Quantité retenue : arbitrage, sinon auditeur, sinon compteur.
            </span>
            {pages > 1 && (
              <div className="pagination-boutons">
                <button
                  type="button" className="btn btn-ghost btn-sm"
                  disabled={page === 0 || chargeantPage}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                >
                  Précédent
                </button>
                <span className="muted small">Page {page + 1} / {pages.toLocaleString('fr-FR')}</span>
                <button
                  type="button" className="btn btn-ghost btn-sm"
                  disabled={page + 1 >= pages || chargeantPage}
                  onClick={() => setPage(p => p + 1)}
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
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
