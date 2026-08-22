'use client'

// Tableau de bord Quantinvo — l'entreprise avant la console.
//
// Quantinvo est un business : la première chose à voir en se connectant,
// c'est combien de magasins sont sous licence (l'unité de facturation), et
// ce qui menace ce chiffre — un client sans magasin ne paie rien, un magasin
// qui ne compte plus est un client qui décroche.
//
// Le revenu vient de la base, jamais d'une constante écrite ici : chaque
// magasin porte son tarif annuel (stores.annual_price_cents). Ceux qui n'en
// ont pas encore sont estimés au panier moyen, et la carte le dit — un
// chiffre approché doit s'annoncer comme tel.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import {
  type VenteEnCours, enAttenteCents, lienVente, lireVente, trierVentes,
} from '@/lib/pipeline'

type CompanyRef = { id: string; name: string }
type IdleStore = { id: string; name: string; company_id: string; company_name: string; days: number | null }
type Overview = {
  companies: number
  companies_new_month: number
  stores: number
  arr_cents: number
  priced_stores: number
  default_price_cents: number
  active_stores_month: number
  sessions_month: number
  counts_month: number
  active_people_month: number
  companies_without_store: CompanyRef[]
  companies_without_admin: number
  idle_stores: IdleStore[]
  pending_deletions: number
}

const nb = (n: number) => n.toLocaleString('fr-FR')
/** Un montant se lit en euros entiers : les centimes n'aident personne ici. */
const euros = (cents: number) =>
  Math.round(cents / 100).toLocaleString('fr-FR') + ' €'

/**
 * Une vente en cours, sur une ligne : qui, à quelle étape, et le geste.
 *
 * La couleur dit à qui est le tour — alerte quand ça nous attend ou que ça
 * traîne, neutre quand la balle est chez le client.
 */
function LigneVente({ vente }: { vente: VenteEnCours }) {
  const l = lireVente(vente)
  const quoi = vente.kind === 'company'
    ? 'Inscription'
    : vente.kind === 'store_removal' ? 'Suppression de magasin' : 'Ajout de magasin'
  return (
    <div className={`signal${l.tour === 'nous' || l.retard ? ' signal-alerte' : ''}`}>
      <div className="signal-txt">
        <strong>{vente.label}</strong>
        <span className="muted"> · {quoi}{vente.kind !== 'company' ? ` · ${vente.detail}` : ` · ${vente.detail}`}</span>
        <div className="muted small">
          {l.etat}
          {vente.quote_amount_cents != null && vente.status !== 'pending' && ` · ${euros(vente.quote_amount_cents)}`}
          {vente.contact && ` · ${vente.contact}`}
        </div>
      </div>
      <Link href={lienVente(vente)} className={`btn btn-sm ${l.tour === 'nous' ? 'btn-primary' : 'btn-ghost'}`}>
        {l.geste}
      </Link>
    </div>
  )
}

export default function AdminPage() {
  const guard = useAuthGuard('admin')
  const [vue, setVue] = useState<Overview | null>(null)
  const [ventes, setVentes] = useState<VenteEnCours[]>([])

  const charger = useCallback(async () => {
    // Deux appels plutôt qu'un : `admin_business_overview` est une vue
    // d'affaires, `admin_pipeline` la file de ce qui attend — inscriptions et
    // demandes de magasin, à toutes leurs étapes, pas seulement « pending ».
    const [apercu, pipe] = await Promise.all([
      supabase.rpc('admin_business_overview'),
      supabase.rpc('admin_pipeline'),
    ])
    if (apercu.data) setVue(apercu.data as Overview)
    if (pipe.data) setVentes(trierVentes(pipe.data as VenteEnCours[]))
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

  const aNous = ventes.filter((x) => lireVente(x).tour === 'nous')
  const auClient = ventes.filter((x) => lireVente(x).tour === 'client')
  const attente = enAttenteCents(ventes)

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
              {v.companies_new_month > 0 && (
                <div className="kpi-note">+{nb(v.companies_new_month)} ce mois-ci</div>
              )}
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(v.stores)}</div>
              <div className="dash-kpi-label">Magasins sous licence</div>
              <div className="kpi-note">
                L&apos;unité de facturation
                {v.stores > 0 && ` · ${nb(v.active_stores_month)} ${v.active_stores_month > 1 ? 'ont' : 'a'} compté ce mois`}
              </div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value dash-kpi-argent">{euros(v.arr_cents)}</div>
              <div className="dash-kpi-label">Revenu annuel récurrent</div>
              <div className="kpi-note">
                {v.stores === 0
                  ? 'Aucun magasin sous licence'
                  : v.priced_stores === v.stores
                    ? `${euros(Math.round(v.arr_cents / v.stores))} en moyenne par magasin`
                    : `${nb(v.stores - v.priced_stores)} magasin${v.stores - v.priced_stores > 1 ? 's' : ''} estimé${v.stores - v.priced_stores > 1 ? 's' : ''} à ${euros(v.default_price_cents)}`}
              </div>
            </div>
          </div>

          {/* Les ventes en cours, d'un bout à l'autre : inscriptions et
              demandes de magasin, à toutes leurs étapes. Ce qui nous attend
              d'abord, ce qui attend le client ensuite — du revenu en route,
              il passe avant les alertes d'usage. */}
          <div className="dash-sub">
            Ventes en cours
            {attente > 0 && <span className="dash-sub-note"> · {euros(attente)} de devis en attente</span>}
          </div>
          {ventes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Aucune vente en cours</div>
              <p className="empty-state-hint">
                Les demandes d&apos;inscription et d&apos;ajout de magasin apparaissent ici dès qu&apos;elles arrivent, et y restent jusqu&apos;à la création.
              </p>
            </div>
          ) : (
            <div className="req-list">
              {aNous.map((x) => <LigneVente key={`${x.kind}-${x.id}`} vente={x} />)}
              {auClient.length > 0 && aNous.length > 0 && (
                <div className="muted small" style={{ marginTop: 4 }}>En attente du client</div>
              )}
              {auClient.map((x) => <LigneVente key={`${x.kind}-${x.id}`} vente={x} />)}
            </div>
          )}

          <div className="dash-sub">À traiter</div>
          {rienASignaler ? (
            <div className="empty-state empty-state-ok">
              <div className="empty-state-title">Rien à signaler</div>
              <p className="empty-state-hint">
                Chaque entreprise a au moins un magasin, et tous comptent régulièrement.
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
              <div className="dash-kpi-value">{nb(v.sessions_month)}</div>
              <div className="dash-kpi-label">Inventaires lancés</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(v.counts_month)}</div>
              <div className="dash-kpi-label">Articles comptés</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-value">{nb(v.active_people_month)}</div>
              <div className="dash-kpi-label">Personnes actives</div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
