'use client'

// Tableau de bord de l'entreprise — l'écran d'accueil de son administrateur.
//
// Il n'ouvre pas le site pour compter : compter est le travail de ses
// superviseurs. Il l'ouvre pour savoir où en est son entreprise, ce qui cloche,
// et qui a fait quoi. D'où l'ordre : les chiffres, un bloc par magasin — comme
// la fiche entreprise de la console Quantinvo —, puis les dernières lignes du
// journal.
//
// Le journal reste global en bas de page, et c'est un constat, pas un choix de
// mise en page : rien de ce que `company_audit_log` enregistre ne porte de
// magasin. Le ranger par magasin supposerait d'abord de l'écrire autrement.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { STATUS_LABELS } from '@/lib/inventory'
import {
  alertesMagasin, avancement, etatMagasin,
  type ApercuEntreprise, type SessionBloc, type StoreBloc,
} from '@/lib/entreprise'
import { libelleAction, type LigneJournal } from '@/lib/journal'

const nb = (n: number) => n.toLocaleString('fr-FR')

/** « il y a 4 jours », « à l'instant » — l'échelle qui compte ici est le jour. */
function depuis(iso: string | null): string {
  if (!iso) return 'jamais'
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 2) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  return `il y a ${j} jour${j > 1 ? 's' : ''}`
}

export default function EntreprisePage() {
  const guard = useAuthGuard('supervisor')
  const [vue, setVue] = useState<ApercuEntreprise | null>(null)
  const [journal, setJournal] = useState<LigneJournal[]>([])
  const [pret, setPret] = useState(false)

  const charger = useCallback(async () => {
    const [apercu, lignes] = await Promise.all([
      supabase.rpc('ca_company_overview'),
      supabase.rpc('ca_list_audit_log', { p_limit: 5 }),
    ])
    if (apercu.data) setVue(apercu.data as ApercuEntreprise)
    if (lignes.data) setJournal(lignes.data as LigneJournal[])
    setPret(true)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    // Un superviseur ordinaire n'a rien à faire ici : la RPC le refuserait de
    // toute façon, cette garde lui évite un écran en erreur.
    if (!guard.profile.is_company_admin) { window.location.replace('/dashboard'); return }
    charger()
  }, [guard, charger])

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const t = vue?.totals

  return (
    <AppShell profile={guard.profile} companyName={vue?.company.name}>
      <div className="app-head">
        <div>
          <h1 className="page-title">{vue?.company.name || 'Mon entreprise'}</h1>
          <p className="page-sub">Tableau de bord</p>
        </div>
      </div>

      {!pret ? (
        <p className="muted">Chargement…</p>
      ) : !t ? (
        <EmptyState
          title="Tableau de bord indisponible"
          hint="Rechargez la page dans un instant."
        />
      ) : (
        <>
          <div className="dash-kpis">
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(t.stores)}</div>
              <div className="dash-kpi-label">Magasins</div>
              {t.store_requests > 0 && (
                <div className="kpi-note">
                  {nb(t.store_requests)} demande{t.store_requests > 1 ? 's' : ''} en cours
                </div>
              )}
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(t.sessions_open)}</div>
              <div className="dash-kpi-label">Inventaires en cours</div>
              <div className="kpi-note">{nb(t.sessions_month)} lancé{t.sessions_month > 1 ? 's' : ''} ce mois</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(t.people)}</div>
              <div className="dash-kpi-label">Personnes</div>
              <div className="kpi-note">
                {nb(t.supervisors)} superviseur{t.supervisors > 1 ? 's' : ''} · {nb(t.counters)} compteur{t.counters > 1 ? 's' : ''}
              </div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(t.active_today)}</div>
              <div className="dash-kpi-label">Actives aujourd&apos;hui</div>
              <div className="kpi-note">
                {t.never_signed_in > 0
                  ? `${nb(t.never_signed_in)} compte${t.never_signed_in > 1 ? 's' : ''} jamais activé${t.never_signed_in > 1 ? 's' : ''}`
                  : 'Tous les comptes sont actifs'}
              </div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(t.pieces_month)}</div>
              <div className="dash-kpi-label">Pièces comptées ce mois</div>
            </div>
          </div>

          <div className="dash-sub">Magasin par magasin</div>
          {vue.stores.length === 0 ? (
            <EmptyState
              title="Votre entreprise n’a encore aucun magasin"
              hint="Demandez à Quantinvo d’en ajouter un depuis la page Magasins."
            />
          ) : (
            <div className="mag-liste">
              {vue.stores.map((s) => <BlocMagasin key={s.id} store={s} />)}
            </div>
          )}

          <div className="dash-sub">Activité récente</div>
          {journal.length === 0 ? (
            <p className="muted small">Aucune action enregistrée pour l’instant.</p>
          ) : (
            <div className="panel" style={{ marginTop: 0 }}>
              <div className="journal">
                {journal.map((l) => (
                  <div className="journal-l" key={l.id}>
                    <span className="journal-q">{depuis(l.created_at)}</span>
                    <span className="journal-a">{libelleAction(l, guard.profile.id)}</span>
                  </div>
                ))}
              </div>
              <Link href="/journal" className="link-btn" style={{ marginTop: 12, display: 'inline-block' }}>
                Voir tout le journal
              </Link>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}

function BlocMagasin({ store }: { store: StoreBloc }) {
  const alertes = alertesMagasin(store)
  const etat = etatMagasin(store)
  const ouverts = store.sessions.filter((s) => s.status !== 'closed')
  const clos = store.sessions.filter((s) => s.status === 'closed')

  return (
    <section className="mag">
      <header className="mag-tete">
        <span className="mag-nom">{store.name}</span>
        <code className="mag-code">{store.join_code}</code>
        <div className="mag-droite">
          {etat && (
            <span className={`dash-badge dash-badge-${etat.cle}`}>
              <span className="dash-dot" />{etat.libelle}
            </span>
          )}
          <Link href="/magasins" className="btn btn-ghost btn-sm">Ouvrir le magasin</Link>
        </div>
      </header>

      <div className="mag-corps">
        {alertes.length > 0 && (
          <div className="mag-part">
            <div className="mag-lab">Ce qui demande votre attention</div>
            {alertes.map((a) => (
              <div className="signal signal-alerte" key={a.cle}>
                <div className="signal-txt">
                  <strong>{a.titre}</strong>
                  <div className="muted small">{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mag-part">
          <div className="mag-lab">Inventaires</div>
          {store.sessions.length === 0 ? (
            <p className="muted small" style={{ margin: 0 }}>Aucun inventaire sur ce magasin.</p>
          ) : (
            <>
              {ouverts.map((s) => <LigneInventaire key={s.id} s={s} />)}
              {clos.map((s) => <LigneInventaire key={s.id} s={s} />)}
            </>
          )}
        </div>

        <div className="mag-part">
          <div className="mag-lab">Équipe</div>
          <div className="mag-equipe">
            {store.supervisors.length === 0 ? (
              <span className="jeton">Aucun superviseur affecté</span>
            ) : (
              store.supervisors.map((p) => (
                <span className="jeton" key={p.id}><b>{p.full_name || 'Sans nom'}</b> · superviseur</span>
              ))
            )}
            <span className="jeton"><b>{nb(store.counters)}</b> compteur{store.counters > 1 ? 's' : ''}</span>
            <span className="jeton">
              {store.counters_active > 0
                ? <><b>{nb(store.counters_active)}</b> actif{store.counters_active > 1 ? 's' : ''} ce mois</>
                : 'aucun actif ce mois'}
            </span>
            <Link href="/equipe" className="link-btn">Voir l&apos;équipe</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function LigneInventaire({ s }: { s: SessionBloc }) {
  const pct = avancement(s)
  const clos = s.status === 'closed'
  return (
    <div className="req-row">
      <div>
        <div className="req-name">
          {s.name}
          <span className={`dash-badge dash-badge-${s.status}`} style={{ marginLeft: 8 }}>
            <span className="dash-dot" />{STATUS_LABELS[s.status] ?? s.status}
          </span>
        </div>
        <div className="muted small">
          {clos
            ? <>clôturé {depuis(s.closed_at)} · {nb(s.pieces)} pièces</>
            : <>
                {s.members} personne{s.members > 1 ? 's' : ''} · {nb(s.pieces)} pièces ·
                {' '}dernier scan {depuis(s.last_count_at)}
              </>}
          {s.created_by_label && ` · créé par ${s.created_by_label}`}
        </div>
      </div>
      <div className="req-actions">
        {pct !== null && !clos && (
          <span className="mag-prog" title={`${nb(s.pieces)} sur ${nb(s.expected)} attendues`}>
            <i style={{ width: `${pct}%` }} />
          </span>
        )}
        <Link href={`/dashboard/${s.id}`} className="btn btn-ghost btn-sm">
          {clos ? 'Rapport' : 'Ouvrir'}
        </Link>
      </div>
    </div>
  )
}
