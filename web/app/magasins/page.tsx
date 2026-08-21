'use client'

// Magasins — les magasins d'un superviseur, leurs codes d'accès.
//
// Ce bloc vivait au milieu de « Mon compte », entre les inventaires et
// l'équipe. Il a son écran : on y vient pour relever un code, pas en
// passant.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyStores, type Store } from '@/lib/inventory'
import { getMyCompany, type Company } from '@/lib/account'

export default function MagasinsPage() {
  const guard = useAuthGuard('supervisor')
  const [stores, setStores] = useState<Store[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [copie, setCopie] = useState<string | null>(null)
  const [pret, setPret] = useState(false)

  const charger = useCallback(async () => {
    const [s, c] = await Promise.all([
      getMyStores().catch(() => [] as Store[]),
      getMyCompany().catch(() => null),
    ])
    setStores(s)
    setCompany(c)
    setPret(true)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger()
  }, [guard.status, charger])

  async function copier(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopie(code)
      setTimeout(() => setCopie(null), 2000)
    } catch { /* sélection manuelle */ }
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <h1 className="page-title">Magasins</h1>
      </div>

      {!pret ? (
        <p className="muted">Chargement…</p>
      ) : stores.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">Vous n&apos;êtes affecté à aucun magasin</div>
          <p className="empty-state-hint">
            Contactez l&apos;administrateur de votre entreprise, ou Quantinvo si elle n&apos;en a pas encore.
          </p>
        </div>
      ) : (
        <>
          <div className="banner banner-info">
            Le code d&apos;un magasin ouvre l&apos;accès à ses inventaires&nbsp;: transmettez-le à une personne, jamais à un groupe.
          </div>
          <div className="acc-inv-list">
            {stores.map((s) => (
              <div className="acc-inv-row" key={s.id}>
                <div>
                  <div className="acc-inv-name">{s.name}</div>
                  <div className="cred-value" style={{ marginTop: 2 }}>{s.join_code ?? '—'}</div>
                </div>
                {s.join_code && (
                  <button type="button" className="link-btn" onClick={() => copier(s.join_code!)}>
                    {copie === s.join_code ? 'Copié' : 'Copier le code'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>
            Les magasins sont créés par Quantinvo&nbsp;: la licence est par magasin.
            <Link href="/outils" style={{ color: 'var(--accent)', marginLeft: 6 }}>Imprimer des balises</Link>
          </p>
        </>
      )}
    </AppShell>
  )
}
