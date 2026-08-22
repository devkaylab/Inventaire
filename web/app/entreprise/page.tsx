'use client'

// Tableau de bord de l'entreprise — l'écran d'accueil de son administrateur.
//
// Il n'ouvre pas le site pour compter : compter est le travail de ses
// superviseurs. Il l'ouvre pour savoir où en est son entreprise et qui a fait
// quoi. D'où deux blocs seulement : les chiffres, puis l'activité récente.
//
// Les magasins ont quitté cet écran le 22 août 2026 (demande de Julien) : ils
// vivent sur la page Magasins, repliés, et chacun a sa fiche. Un tableau de
// bord qui déroule tout n'est plus un tableau de bord.
//
// L'activité vient du journal, qui reste global : rien de ce que
// `company_audit_log` enregistre ne porte de magasin, donc rien ne s'y range.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { type ApercuEntreprise } from '@/lib/entreprise'
import { libelleAction, type LigneJournal } from '@/lib/journal'
import { nb, relativeTime } from '@/lib/format'

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
          <div className="dash-kpis dash-kpis-5">
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(t.stores)}</div>
              <div className="dash-kpi-label">Magasins</div>
              {t.store_requests > 0 && (
                <div className="kpi-note">
                  {nb(t.store_requests)} demande{t.store_requests > 1 ? 's' : ''} en attente chez Quantinvo
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
              <div className="dash-kpi-label">Ont compté aujourd&apos;hui</div>
              <div className="kpi-note">
                {t.never_signed_in > 0
                  ? `${nb(t.never_signed_in)} ${t.never_signed_in > 1 ? 'personnes n’ont' : 'personne n’a'} pas encore choisi son mot de passe`
                  : 'Tout le monde s’est déjà connecté'}
              </div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(t.pieces_month)}</div>
              <div className="dash-kpi-label">Pièces comptées ce mois</div>
            </div>
          </div>

          <div className="dash-sub">Activité récente</div>
          {journal.length === 0 ? (
            <p className="muted small">Aucune action enregistrée pour l’instant.</p>
          ) : (
            <div className="panel" style={{ marginTop: 0 }}>
              <div className="journal">
                {journal.map((l) => (
                  <div className="journal-l" key={l.id}>
                    <span className="journal-q">{relativeTime(l.created_at)}</span>
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
