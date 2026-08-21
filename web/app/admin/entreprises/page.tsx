'use client'

// Entreprises clientes — la liste, et rien d'autre.
//
// Elle listait chaque entreprise en carte complète, et chacune lançait deux
// requêtes au chargement : à cinquante entreprises, cent requêtes et un mur
// illisible. Elle ne charge plus qu'un aperçu, en une requête, et le détail
// d'une entreprise vit sur sa propre fiche.
//
// C'est le cœur du métier de Quantinvo : ces entreprises ont leur entrée de
// navigation, au même rang que le tableau de bord — pas une rubrique de
// console.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'

type CompanyOverview = {
  id: string
  name: string
  created_at: string
  store_count: number
  supervisor_count: number
  counter_count: number
  company_admin_count: number
  pending_invitations: number
  last_session_at: string | null
}

function frDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR')
}

/** Sans accents ni casse : « Élysée » se trouve en tapant « elysee ». */
function normaliser(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function AdminEntreprisesPage() {
  const guard = useAuthGuard('admin')
  const [companies, setCompanies] = useState<CompanyOverview[]>([])
  const [companyName, setCompanyName] = useState('')
  const [recherche, setRecherche] = useState('')
  const [busy, setBusy] = useState(false)

  const charger = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_companies_overview')
    setCompanies((data as CompanyOverview[]) ?? [])
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger()
  }, [guard.status, charger])

  // Recherche par fragments : chaque mot saisi doit se retrouver dans le nom,
  // dans n'importe quel ordre. « retail paris » trouve « Paris Retail Group ».
  const visibles = useMemo(() => {
    const mots = normaliser(recherche).split(/\s+/).filter(Boolean)
    if (mots.length === 0) return companies
    return companies.filter((c) => {
      const nom = normaliser(c.name)
      return mots.every((mot) => nom.includes(mot))
    })
  }, [companies, recherche])

  async function creerEntreprise(e: React.FormEvent) {
    e.preventDefault()
    const nom = companyName.trim()
    if (!nom || busy) return
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_create_company', { p_name: nom })
    setBusy(false)
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    setCompanyName('')
    charger()
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <h1 className="page-title">Entreprises ({companies.length})</h1>
        <form className="inline-form" onSubmit={creerEntreprise}>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nom de l'entreprise" />
          <button className="btn btn-primary" disabled={busy}>Créer</button>
        </form>
      </div>

      {companies.length > 0 && (
        <div className="toolbar">
          <div className="toolbar-grow">
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une entreprise par son nom…"
              aria-label="Rechercher une entreprise"
            />
          </div>
          {recherche.trim() !== '' && (
            <>
              <span className="muted small" aria-live="polite">
                {visibles.length} sur {companies.length}
              </span>
              <button type="button" className="link-btn" onClick={() => setRecherche('')}>
                Effacer
              </button>
            </>
          )}
        </div>
      )}

      {companies.length === 0 ? (
        <p className="muted">Aucune entreprise. Créez-en une ci-dessus.</p>
      ) : visibles.length === 0 ? (
        <p className="muted">Aucune entreprise ne correspond à « {recherche} ».</p>
      ) : (
        <div className="acc-inv-list">
          {visibles.map((c) => (
            <Link key={c.id} href={`/admin/entreprise/${c.id}`} className="acc-inv-row">
              <div>
                <div className="acc-inv-name">{c.name}</div>
                <div className="muted small" style={{ marginTop: 2 }}>
                  {c.store_count} magasin{c.store_count > 1 ? 's' : ''}
                  {' · '}{c.supervisor_count} superviseur{c.supervisor_count > 1 ? 's' : ''}
                  {c.counter_count > 0 && ` · ${c.counter_count} compteur${c.counter_count > 1 ? 's' : ''}`}
                  {' · créée le '}{frDate(c.created_at)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {/* Ce qui demande attention se voit sans ouvrir la fiche. */}
                {c.store_count === 0 && (
                  <span className="dash-badge dash-badge-counting"><span className="dash-dot" />Aucun magasin</span>
                )}
                {c.company_admin_count === 0 ? (
                  <span className="role-tag">Gérée par Quantinvo</span>
                ) : (
                  <span className="dash-badge dash-badge-open"><span className="dash-dot" />Administrateur</span>
                )}
                {c.pending_invitations > 0 && (
                  <span className="role-tag">{c.pending_invitations} invitation{c.pending_invitations > 1 ? 's' : ''}</span>
                )}
                <span className="zone-progress-arrow">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}
