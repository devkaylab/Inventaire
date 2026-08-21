'use client'

// Tableau de bord Quantinvo — l'entreprise avant la console.
//
// Quantinvo est un business : la première chose à voir en se connectant,
// c'est combien de magasins sont sous licence (l'unité de facturation), et
// ce qui menace ce chiffre — un client sans magasin ne paie rien, un magasin
// qui ne compte plus est un client qui décroche.
//
// Le revenu n'est pas affiché : aucun prix n'est enregistré en base. Le
// montrer supposerait un tarif par magasin — une décision à prendre, pas un
// chiffre à inventer.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'

type CompanyRef = { id: string; name: string }
type IdleStore = { id: string; name: string; company_id: string; company_name: string; days: number | null }
type Overview = {
  companies: number
  stores: number
  sessions_month: number
  counts_month: number
  active_people_month: number
  companies_without_store: CompanyRef[]
  companies_without_admin: number
  idle_stores: IdleStore[]
  pending_deletions: number
}

const nb = (n: number) => n.toLocaleString('fr-FR')

export default function AdminPage() {
  const guard = useAuthGuard('admin')
  const [vue, setVue] = useState<Overview | null>(null)

  const charger = useCallback(async () => {
    const { data } = await supabase.rpc('admin_business_overview')
    if (data) setVue(data as Overview)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger()
  }, [guard.status, charger])

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const v = vue
  const rienASignaler = v
    && v.companies_without_store.length === 0
    && v.idle_stores.length === 0
    && v.companies_without_admin === 0
    && v.pending_deletions === 0

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <h1 className="page-title">Tableau de bord</h1>
      </div>

      {!v ? (
        <p className="muted">Chargement…</p>
      ) : (
        <>
          <div className="dash-kpis">
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(v.companies)}</div>
              <div className="dash-kpi-label">Entreprises clientes</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(v.stores)}</div>
              <div className="dash-kpi-label">Magasins sous licence</div>
              <div className="kpi-note">L&apos;unité de facturation</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(v.sessions_month)}</div>
              <div className="dash-kpi-label">Inventaires ce mois-ci</div>
            </div>
          </div>

          <div className="dash-sub">À traiter</div>
          {rienASignaler ? (
            <div className="empty-state empty-state-ok">
              <div className="empty-state-title">Rien à signaler</div>
              <p className="empty-state-hint">
                Chaque entreprise a au moins un magasin, tous comptent régulièrement, et aucune demande n&apos;attend.
              </p>
            </div>
          ) : (
            <div className="req-list">
              {v.companies_without_store.map((c) => (
                <div className="signal signal-alerte" key={`sans-magasin-${c.id}`}>
                  <div className="signal-txt">
                    <strong>{c.name}</strong> n&apos;a aucun magasin — donc aucune licence facturée.
                  </div>
                  <Link href={`/admin/entreprise/${c.id}`} className="btn btn-ghost btn-sm">Ouvrir la fiche</Link>
                </div>
              ))}
              {v.idle_stores.map((s) => (
                <div className="signal signal-alerte" key={`inactif-${s.id}`}>
                  <div className="signal-txt">
                    <strong>{s.name}</strong> ({s.company_name}) {s.days === null
                      ? 'n’a jamais lancé d’inventaire.'
                      : `n’a pas compté depuis ${s.days} jours.`}
                  </div>
                  <Link href={`/admin/entreprise/${s.company_id}`} className="btn btn-ghost btn-sm">Voir l&apos;entreprise</Link>
                </div>
              ))}
              {v.companies_without_admin > 0 && (
                <div className="signal">
                  <div className="signal-txt">
                    {v.companies_without_admin} entreprise{v.companies_without_admin > 1 ? 's' : ''} sur {v.companies} n&apos;{v.companies_without_admin > 1 ? 'ont' : 'a'} pas encore d&apos;administrateur.
                  </div>
                  <Link href="/admin/entreprises" className="btn btn-ghost btn-sm">Voir la liste</Link>
                </div>
              )}
              {v.pending_deletions > 0 && (
                <div className="signal">
                  <div className="signal-txt">
                    {v.pending_deletions} demande{v.pending_deletions > 1 ? 's' : ''} de suppression de compte en attente.
                  </div>
                  <Link href="/admin/console" className="btn btn-ghost btn-sm">Ouvrir la console</Link>
                </div>
              )}
            </div>
          )}

          <div className="dash-sub">Usage du mois</div>
          <div className="dash-kpis" style={{ marginTop: 0 }}>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(v.counts_month)}</div>
              <div className="dash-kpi-label">Articles comptés</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(v.active_people_month)}</div>
              <div className="dash-kpi-label">Personnes actives</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(v.sessions_month)}</div>
              <div className="dash-kpi-label">Inventaires lancés</div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
