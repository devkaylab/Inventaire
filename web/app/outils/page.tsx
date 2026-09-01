'use client'

// Boîte à outils — ce dont un superviseur a besoin en dehors d'un
// inventaire : imprimer ses balises, ses modèles de fichiers, et la prise
// en main de l'application mobile.
//
// Le panneau de balises est le même composant que dans l'onglet Set up
// d'un inventaire : on ne duplique pas la logique de série.

import { useCallback, useEffect, useState } from 'react'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { BaliseSheetPanel } from '@/components/BaliseSheetPanel'
import { getMyCompany, type Company } from '@/lib/account'
import { ModelesPanel } from '@/components/ModelesPanel'
import Link from 'next/link'

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

      <ModelesPanel />

      <div className="panel">
        <h3>Prise en main de l&apos;application</h3>
        <p>
          Les deux parcours de l&apos;application mobile, écran par écran — pour le revoir, ou
          le montrer à une nouvelle recrue.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/outils/prise-en-main" className="btn btn-sm">Ouvrir le guide</Link>
        </div>
      </div>
    </AppShell>
  )
}
