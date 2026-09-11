'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AUDIT_STATUS_LABELS, getAllRapportRows, getRapportPage, getRapportResume,
  getSessionDetail, recomputeAudit,
  type RapportResume, type RapportTri, type SessionResultRow,
} from '@/lib/inventory'
import { downloadCsv, downloadXlsx } from '@/lib/report'
import { fmtQty, fmtSigned, money, nb } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Pagination, useRetourEnHaut } from '@/components/ui/Pagination'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { Stat } from '@/components/ui/Stat'
import { locale, t, tn } from '@/lib/i18n'

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
  /** Le haut du tableau : on y revient à chaque changement de page. */
  const hautDuTableau = useRetourEnHaut(page)

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
    setAvance(t('Préparation…'))
    try {
      const suivi = (quoi: string) => (fait: number, total: number) =>
        setAvance(`${quoi} ${nb(fait)} / ${nb(total)}`)

      const tout = await getAllRapportRows(sessionId, suivi(t('Écarts')))
      const detail = await getSessionDetail(sessionId, suivi(t('Détail par zone')))

      if (format === 'csv') {
        const names = downloadCsv(inventoryNumber, tout, detail)
        toast.success(
          names.length > 1
            ? t('%{n} fichiers téléchargés : écarts et détail par zone.', { n: names.length })
            : t('%{fichier} téléchargé.', { fichier: names[0] }),
        )
      } else {
        const name = await downloadXlsx(inventoryNumber, tout, detail)
        toast.success(t('%{fichier} téléchargé (2 feuilles : Écarts, Détail par zone).', { fichier: name }))
      }
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setExporting(null)
      setAvance(null)
    }
  }

  // ⚠️ L'ATTENTE SE DIT, ET LES TUILES NE MENTENT JAMAIS PAR ZÉRO.
  // Constat de Julien le 3 septembre 2026 : le recalcul prend plusieurs
  // secondes sur un gros inventaire, rien ne l'indiquait, et un « 0 écart »
  // s'affichait pendant ce temps — on peut crier victoire sur un chiffre qui
  // n'a pas encore été calculé. Une ossature muette ne suffit pas : elle
  // ressemble à une page vide.
  if (loading) {
    return (
      <div>
        <p className="chargement-note" role="status">
          {t('Calcul du rapport en cours… Sur un inventaire de plusieurs dizaines de milliers de références, comptez quelques secondes.')}
        </p>
        <SkeletonRows rows={5} />
      </div>
    )
  }

  return (
    /* ⚠️ `registre` : la piste des surfaces qui font foi. Voir le bloc du même
       nom dans globals.css — c'est la GRAMMAIRE du document (filets, nombres
       en chasse fixe, pas de boîtes), pas sa palette. Ce qui engage garde le
       langage d'Ardoise. */
    <div className="registre">
      {/* L'en-tête du DOCUMENT, qui ne répète pas celui de la page : la page
          nomme l'inventaire, le document nomme la pièce et l'heure à laquelle
          elle est arrêtée. C'est ce qui a remplacé `.report-freshness`. */}
      <div className="registre-entete">
        <h2 className="registre-titre">{t('Rapport d’inventaire')}</h2>
        <div className="registre-arrete">
          <span>
            {refreshing
              ? t('Recalcul en cours…')
              : computedAt
                ? t('Arrêté à %{heure}', { heure: computedAt.toLocaleTimeString(locale()) })
                : t('Chiffres non calculés')}
          </span>
          <button type="button" className="link-btn" disabled={refreshing} onClick={() => void load({ silent: true })}>
            {t('Actualiser')}
          </button>
        </div>
      </div>

      {/* ⚠️ Sans résumé, on écrit « — », jamais « 0 » : un zéro se lit comme un
          résultat, et celui-là serait faux. */}
      <div className="dash-stats">
        <Stat label={t('Stock théorique')} value={resume ? fmtQty(totals.theoUnits) : '—'} />
        <Stat label={t('Stock compté')} value={resume ? fmtQty(totals.countedUnits) : '—'} />
        <Stat
          label={t('Écart total (unités)')}
          value={resume ? fmtSigned(totals.varUnits) : '—'}
          tone={!resume ? 'neutral' : totals.varUnits < 0 ? 'neg' : 'pos'}
        />
        <Stat
          label={t('Écart total (valeur achat)')}
          value={resume ? `${money(totals.varValue)} €` : '—'}
          tone={!resume ? 'neutral' : totals.varValue < 0 ? 'neg' : 'pos'}
        />
      </div>

      {!resume && (
        <div className="banner banner-warn">
          {t('Les totaux n’ont pas pu être calculés — le serveur a mis trop de temps à répondre. Rien n’est perdu, les comptages sont intacts :')}{' '}
          <button type="button" className="link-btn" disabled={refreshing} onClick={() => void load({ silent: true })}>
            {t('réessayer')}
          </button>.
        </div>
      )}

      {totals.unresolved > 0 && (
        <div className="banner banner-warn">
          {tn('%{count} article présente encore un écart non arbitré entre le comptage et l’audit. Sans arbitrage, c’est ', '%{count} articles présentent encore un écart non arbitré entre le comptage et l’audit. Sans arbitrage, c’est ', totals.unresolved)}<strong>{t('la quantité de l’auditeur')}</strong>{t(' qui part dans le rapport. Tranchez-les depuis l’onglet Écarts d’audit pour un rapport définitif.')}
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-grow">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('Rechercher un article, un SKU, un EAN…')}
            aria-label={t('Rechercher dans le rapport')}
          />
        </div>
        <button
          type="button" className="btn btn-primary"
          disabled={(resume?.lignes ?? 0) === 0 || exporting !== null}
          onClick={() => setAskFormat(true)}
        >
          {exporting ? (avance ?? t('Préparation…')) : t('Télécharger')}
        </button>
      </div>

      {askFormat && (
        <Modal title={t('Format du téléchargement')} onClose={() => setAskFormat(false)}>
          <div className="format-choice">
            <button type="button" className="format-option" onClick={() => { setAskFormat(false); void onExport('xlsx') }}>
              <strong>Excel (.xlsx)</strong>
              <span className="muted small">
                {t('Deux feuilles : « Écarts » (une ligne par article) et « Détail par zone » (une ligne par balise, avec Compté par et Audité par).')}
              </span>
            </button>
            <button type="button" className="format-option" onClick={() => { setAskFormat(false); void onExport('csv') }}>
              <strong>{t('CSV (2 fichiers)')}</strong>
              <span className="muted small">
                {t("Le CSV ne connaît pas les feuilles : vous recevez les deux mêmes tableaux en deux fichiers, avec exactement les mêmes colonnes qu'Excel.")}
              </span>
            </button>
          </div>
        </Modal>
      )}

      {(resume?.lignes ?? 0) === 0 ? (
        <EmptyState
          title={t('Aucun résultat')}
          hint={t('Le rapport se remplit à mesure des comptages. Importez le stock théorique si vous voulez comparer au stock attendu.')}
        />
      ) : totalFiltre === 0 && !chargeantPage ? (
        <EmptyState title={t('Aucun article ne correspond')} hint={t('Rien ne correspond à « %{q} ».', { q: recherche })} />
      ) : (
        <>
          {/* Les boutons sont AUSSI en tête : sur un écran de 14 pouces,
              cinquante lignes passent sous le pli et ceux du bas ne se
              voient pas. */}
          <div ref={hautDuTableau} />
          <Pagination page={page} pages={pages} chargement={chargeantPage} onPage={setPage}>
            <span className="muted small">
              {nb(premier)}–{nb(dernier)} {t('sur')}{' '}
              {nb(totalFiltre)}
              {chargeantPage && ` · ${t('chargement…')}`}
            </span>
          </Pagination>

          <div className="dash-table-wrap" style={{ opacity: chargeantPage ? 0.55 : 1 }}>
            <table className="dash-table">
              <thead>
                <tr>
                  <Th label={t('Article')} onClick={() => toggleSort('label')} active={sort.key === 'label'} dir={sort.dir} />
                  <Th label={t('Théorique')} num onClick={() => toggleSort('theoretical_qty')} active={sort.key === 'theoretical_qty'} dir={sort.dir} />
                  <Th label={t('Compté')} num onClick={() => toggleSort('counted_qty')} active={sort.key === 'counted_qty'} dir={sort.dir} />
                  <Th label={t('Écart')} num onClick={() => toggleSort('variance_units')} active={sort.key === 'variance_units'} dir={sort.dir} />
                  <Th label={t('Valeur (€)')} num onClick={() => toggleSort('variance_value')} active={sort.key === 'variance_value'} dir={sort.dir} />
                  <Th label={t('Statut')} onClick={() => toggleSort('status')} active={sort.key === 'status'} dir={sort.dir} />
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
                        <div className="muted small dash-art-code">{r.brand}{r.ean ? ` · ${r.ean}` : ''}</div>
                      </td>
                      <td className="num">{fmtQty(Number(r.theoretical_qty))}</td>
                      <td className="num">{fmtQty(Number(r.counted_qty))}</td>
                      <td className={`num ${units === 0 ? '' : units < 0 ? 'neg' : 'pos'}`}>{fmtSigned(units)}</td>
                      <td className={`num ${value < 0 ? 'neg' : ''}`}>{money(value)}</td>
                      <td>
                        <span className={`dash-audit-badge dash-audit-badge-${r.status}`}>
                          {t(AUDIT_STATUS_LABELS[r.status] ?? r.status)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination page={page} pages={pages} chargement={chargeantPage} onPage={setPage}>
            <span className="muted small">
              {nb(premier)}–{nb(dernier)} {t('sur')}{' '}
              {nb(totalFiltre)}
              {recherche && ` (${t('%{n} au total', { n: nb(resume?.lignes ?? 0) })})`}
              . {t('Quantité retenue : arbitrage, sinon auditeur, sinon compteur.')}
            </span>
          </Pagination>
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
