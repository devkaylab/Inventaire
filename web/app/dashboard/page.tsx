'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyCompany } from '@/lib/account'
import {
  deleteSession, getAccessibleSessions, groupByStore, STATUS_LABELS, type Session,
} from '@/lib/inventory'
import { fmtDate } from '@/lib/format'
import { friendlyError } from '@/lib/errors'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

export default function DashboardPage() {
  const toast = useToast()
  const guard = useAuthGuard('supervisor')
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const confirm = useConfirm()
  const [selection, setSelection] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (guard.status !== 'ready') return
    getMyCompany().then((c) => setCompanyName(c?.name ?? null)).catch(() => {})
    let active = true
    ;(async () => {
      try {
        const rows = await getAccessibleSessions()
        if (active) setSessions(rows)
      } catch (err) {
        if (active) toast.error(friendlyError(err))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [guard.status, toast])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter(s =>
      (s.name || '').toLowerCase().includes(q)
      || s.store_name.toLowerCase().includes(q)
      || s.inventory_number.toLowerCase().includes(q))
  }, [sessions, query])

  // Deux listes, pas une : ce qu'on a créé, et ce à quoi on a été invité.
  // Un inventaire invité ne se rouvre pas et ne se supprime pas — le dire par
  // la mise en page évite de le découvrir au moment du refus.
  //
  // Sauf pour l'administrateur d'entreprise : depuis le 22 août 2026 il voit
  // tous les inventaires de son entreprise et les gère tous. La distinction
  // « les miens / ceux où l'on m'a invité » n'a plus d'objet pour lui — ce sont
  // ceux de son entreprise, rangés par magasin.
  const profileIdListe = guard.status === 'ready' ? guard.profile.id : null
  const adminEntreprise = guard.status === 'ready' && !!guard.profile.is_company_admin
  const miens = useMemo(
    () => (adminEntreprise
      ? filtered
      : filtered.filter(s => !!profileIdListe && s.created_by === profileIdListe)),
    [filtered, profileIdListe, adminEntreprise],
  )
  const invites = useMemo(
    () => (adminEntreprise
      ? []
      : filtered.filter(s => !profileIdListe || s.created_by !== profileIdListe)),
    [filtered, profileIdListe, adminEntreprise],
  )
  const groups = useMemo(() => groupByStore(miens), [miens])

  // Qui peut supprimer : le créateur de l'inventaire, et l'administrateur de
  // l'entreprise pour tous les siens. Même règle que la base depuis la
  // migration `20260821250001` — la case n'apparaît pas ailleurs, plutôt que
  // de laisser découvrir le refus après coup.
  const profileId = profileIdListe
  const peutSupprimer = useCallback(
    (s: Session) => adminEntreprise || (!!profileId && s.created_by === profileId),
    [adminEntreprise, profileId],
  )

  // « Tout sélectionner » ne prend que ce qui est à l'écran, filtre de
  // recherche compris : un « tout » qui déborde de ce qu'on voit est le
  // meilleur moyen d'effacer autre chose que ce qu'on croyait.
  const selectionnables = useMemo(() => filtered.filter(peutSupprimer), [filtered, peutSupprimer])
  const selectionnes = useMemo(
    () => selectionnables.filter(s => selection.includes(s.id)),
    [selectionnables, selection],
  )
  const toutSelectionne = selectionnables.length > 0 && selectionnes.length === selectionnables.length

  function basculer(id: string) {
    setSelection(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  function basculerTout() {
    setSelection(toutSelectionne ? [] : selectionnables.map(s => s.id))
  }

  /**
   * Suppression, d'une tuile ou d'une sélection.
   *
   * Il n'existe pas de suppression groupée en base : on appelle
   * `delete_session` une fois par inventaire et on **rend compte des échecs**
   * plutôt que d'annoncer un succès global. Sur dix inventaires, un refus ne
   * doit pas passer inaperçu.
   */
  async function supprimer(cibles: Session[]) {
    if (cibles.length === 0 || busy) return
    const ouverts = cibles.filter(s => s.status !== 'closed').length
    const ok = await confirm({
      title: cibles.length === 1
        ? 'Supprimer définitivement cet inventaire ?'
        : `Supprimer définitivement ${cibles.length} inventaires ?`,
      message: 'Cette action est irréversible et ne peut pas être annulée.',
      details: [
        ...cibles.slice(0, 8).map(s => `${s.name || s.store_name} — ${s.store_name}`),
        ...(cibles.length > 8 ? [`… et ${cibles.length - 8} autres`] : []),
        'Comptages, stock théorique, audits, membres et référentiel articles seront effacés.',
        ...(ouverts > 0
          ? [ouverts === 1 ? 'Dont 1 inventaire encore en cours.' : `Dont ${ouverts} inventaires encore en cours.`]
          : []),
      ],
      confirmLabel: cibles.length === 1 ? 'Supprimer définitivement' : `Supprimer les ${cibles.length}`,
      tone: 'danger',
      requireText: cibles.length === 1 ? cibles[0].inventory_number : undefined,
    })
    if (!ok) return

    setBusy(true)
    const echecs: string[] = []
    let faits = 0
    for (const s of cibles) {
      try {
        const r = await deleteSession(s.id)
        if (r.success) faits += 1
        else echecs.push(`${s.name || s.store_name} : ${r.error ?? 'refus du serveur'}`)
      } catch (err) {
        echecs.push(`${s.name || s.store_name} : ${friendlyError(err)}`)
      }
    }
    setBusy(false)

    const restants = new Set(echecs.map(e => e.split(' : ')[0]))
    setSessions(prev => prev.filter(s => !cibles.some(c => c.id === s.id) || restants.has(s.name || s.store_name)))
    setSelection([])

    if (echecs.length === 0) {
      toast.success(faits === 1 ? 'Inventaire supprimé.' : `${faits} inventaires supprimés.`)
    } else if (faits === 0) {
      toast.error(echecs[0])
    } else {
      toast.error(`${faits} supprimés, ${echecs.length} refusés. ${echecs[0]}`)
    }
  }
  const activeCount = useMemo(() => sessions.filter(s => s.status !== 'closed').length, [sessions])
  const storeCount = useMemo(() => new Set(sessions.map(s => s.store_name)).size, [sessions])

  if (guard.status === 'loading') {
    return <div className="dash"><SkeletonRows rows={3} /></div>
  }

  return (
    <AppShell profile={guard.profile} companyName={companyName}>
      <div className="app-head">
        <h1 className="page-title">Inventaires</h1>
        <div className="app-head-actions">
          {selectionnables.length > 0 && (
            <label className="select-all">
              <input
                type="checkbox"
                checked={toutSelectionne}
                ref={el => { if (el) el.indeterminate = selectionnes.length > 0 && !toutSelectionne }}
                onChange={basculerTout}
              />
              Tout sélectionner
            </label>
          )}
          <Link href="/dashboard/new" className="btn btn-primary">Nouvel inventaire</Link>
        </div>
      </div>

      {selectionnes.length > 0 && (
        <div className="select-bar" role="region" aria-label="Sélection">
          <span className="select-bar-count">
            {selectionnes.length === 1
              ? '1 inventaire sélectionné'
              : `${selectionnes.length} inventaires sélectionnés`}
          </span>
          <button type="button" className="select-bar-ghost" onClick={() => setSelection([])}>
            Tout désélectionner
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={() => supprimer(selectionnes)}
          >
            {busy ? 'Suppression…' : `Supprimer (${selectionnes.length})`}
          </button>
        </div>
      )}

      <div className="dash-kpis">
        <div className="dash-kpi">
          <div className="dash-kpi-value num">{storeCount}</div>
          <div className="dash-kpi-label">Magasin{storeCount > 1 ? 's' : ''}</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-value num">{activeCount}</div>
          <div className="dash-kpi-label">Inventaire{activeCount > 1 ? 's' : ''} en cours</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-value num">{sessions.length}</div>
          <div className="dash-kpi-label">Total</div>
        </div>
      </div>

      {sessions.length > 6 && (
        <div className="toolbar" style={{ marginTop: 20 }}>
          <div className="toolbar-grow">
            <input
              type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher un inventaire, un magasin, un numéro…"
              aria-label="Rechercher un inventaire"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 24 }}><SkeletonRows rows={3} height={96} /></div>
      ) : sessions.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <EmptyState
            title="Aucun inventaire pour l’instant"
            hint="Vous verrez ici les inventaires que vous avez créés, et plus bas ceux auxquels on vous a invité."
            action={<Link href="/dashboard/new" className="btn btn-primary">Créer mon premier inventaire</Link>}
          />
        </div>
      ) : groups.length === 0 && invites.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <EmptyState title="Aucun résultat" hint={`Rien ne correspond à « ${query} ».`} />
        </div>
      ) : (
        groups.map(({ store, sessions: list }) => {
          const active = list.filter(s => s.status !== 'closed')
          const past = list.filter(s => s.status === 'closed')
          return (
            <section className="dash-store" key={store}>
              <h2 className="dash-store-name">{store}</h2>

              {active.length > 0 && (
                <div className="dash-grid">
                  {active.map(s => (
                    <SessionCard
                      key={s.id} s={s} live
                      deletable={peutSupprimer(s)}
                      selected={selection.includes(s.id)}
                      onToggle={() => basculer(s.id)}
                      onDelete={() => supprimer([s])}
                    />
                  ))}
                </div>
              )}
              {past.length > 0 && (
                <>
                  <div className="dash-sub">Clôturés</div>
                  <div className="dash-grid">
                    {past.map(s => (
                      <SessionCard
                        key={s.id} s={s}
                        deletable={peutSupprimer(s)}
                        selected={selection.includes(s.id)}
                        onToggle={() => basculer(s.id)}
                        onDelete={() => supprimer([s])}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          )
        })
      )}

      {!loading && invites.length > 0 && (
        <section className="dash-store">
          <h2 className="dash-store-name">Inventaires invités</h2>
          <p className="muted small" style={{ margin: '-4px 0 12px' }}>
            Vous participez à ces inventaires sans les avoir créés. Vous pouvez y compter et
            consulter le rapport ; leur clôture définitive et leur réouverture appartiennent à
            leur créateur.
          </p>
          <div className="dash-grid">
            {invites.map(s => (
              <SessionCard
                key={s.id} s={s}
                live={s.status !== 'closed'}
                deletable={peutSupprimer(s)}
                selected={selection.includes(s.id)}
                onToggle={() => basculer(s.id)}
                onDelete={() => supprimer([s])}
              />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  )
}

function SessionCard({ s, live, deletable, selected, onToggle, onDelete }: {
  s: Session
  live?: boolean
  deletable: boolean
  selected: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  // La tuile entière est un lien : la case et la corbeille doivent retenir le
  // clic, sinon cocher ouvrirait l'inventaire.
  function retenir(e: React.MouseEvent, action: () => void) {
    e.preventDefault()
    e.stopPropagation()
    action()
  }

  return (
    <Link
      href={`/dashboard/${s.id}`}
      className={`dash-card${live ? ' dash-card-live' : ''}${selected ? ' dash-card-selected' : ''}`}
    >
      <div className="dash-card-head">
        {deletable && (
          <input
            type="checkbox"
            className="dash-card-check"
            checked={selected}
            aria-label={`Sélectionner ${s.name || s.store_name}`}
            onClick={e => retenir(e, onToggle)}
            onChange={() => {}}
          />
        )}
        <span className={`dash-badge dash-badge-${s.status}`}>
          <span className="dash-dot" />{STATUS_LABELS[s.status] ?? s.status}
        </span>
        {s.uses_zones && <span className="dash-tag">Zones</span>}
        {deletable && (
          <button
            type="button"
            className="dash-card-trash"
            aria-label={`Supprimer ${s.name || s.store_name}`}
            title="Supprimer cet inventaire"
            onClick={e => retenir(e, onDelete)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
            </svg>
          </button>
        )}
      </div>
      {live && <div className="dash-live-label">Inventaire en cours</div>}
      <div className="dash-card-title">{s.name || s.store_name}</div>
      <div className="dash-card-meta">
        <span className="num">{s.inventory_number}</span> · {fmtDate(s.created_at)}
      </div>
    </Link>
  )
}
