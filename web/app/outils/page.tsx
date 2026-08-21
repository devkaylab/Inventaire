'use client'

// Boîte à outils — ce dont un superviseur a besoin en dehors d'un
// inventaire : imprimer ses balises, et retrouver la prise en main de
// l'application quand elle existera.
//
// Le panneau de balises est le même composant que dans l'onglet Set up
// d'un inventaire : on ne duplique pas la logique de série.

import { useCallback, useEffect, useState } from 'react'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { BaliseSheetPanel } from '@/components/BaliseSheetPanel'
import { getMyCompany, type Company } from '@/lib/account'

export default function OutilsPage() {
  const guard = useAuthGuard('supervisor')
  const [company, setCompany] = useState<Company | null>(null)

  const charger = useCallback(async () => {
    setCompany(await getMyCompany().catch(() => null))
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger()
  }, [guard.status, charger])

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <h1 className="page-title">Boîte à outils</h1>
      </div>

      <BaliseSheetPanel context="account" />

      <div className="panel">
        <h3>Prise en main de l&apos;application</h3>
        <p>
          Le parcours de découverte de l&apos;application mobile — à retrouver ici quand il sera
          prêt, pour le refaire ou le montrer à une nouvelle recrue.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled>Revoir la prise en main</button>
          <span className="dash-badge dash-badge-counting"><span className="dash-dot" />Bientôt</span>
        </div>
      </div>
    </AppShell>
  )
}
