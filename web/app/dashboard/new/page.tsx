'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyCompany } from '@/lib/account'
import { createSession, getMyStores, type Store } from '@/lib/inventory'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'

/** Code d'accès communiqué aux compteurs — court, sans caractères ambigus. */
function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

export default function NewSessionPage() {
  const router = useRouter()
  const toast = useToast()
  const guard = useAuthGuard('supervisor')

  const [stores, setStores] = useState<Store[]>([])
  const [loadingStores, setLoadingStores] = useState(true)
  const [name, setName] = useState('')
  const [storeId, setStoreId] = useState('')
  const [code, setCode] = useState('')
  const [usesZones, setUsesZones] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [companyName, setCompanyName] = useState<string | null>(null)

  useEffect(() => { setCode(generateCode()) }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    getMyCompany().then(c => setCompanyName(c?.name ?? null)).catch(() => {})
    let active = true
    ;(async () => {
      try {
        const list = await getMyStores()
        if (!active) return
        setStores(list)
        if (list.length === 1) setStoreId(list[0].id)
      } catch (err) {
        if (active) toast.error(friendlyError(err))
      } finally {
        if (active) setLoadingStores(false)
      }
    })()
    return () => { active = false }
  }, [guard.status, toast])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Donnez un nom à l'inventaire."); return }
    if (!storeId) { setError('Choisissez le magasin concerné.'); return }
    if (code.trim().length < 4) { setError('Le code d’accès doit comporter au moins 4 caractères.'); return }
    setError(null)
    setBusy(true)

    try {
      const r = await createSession(name.trim(), storeId, code.trim().toUpperCase(), usesZones)
      if (!r.success || !r.session_id) {
        setError(r.error ?? "L'inventaire n'a pas pu être créé.")
        return
      }
      toast.success(`Inventaire ${r.inventory_number} créé. Code d’accès : ${r.security_code ?? code}`)
      // Toute la préparation — balises et fichiers — se fait dans Set up.
      router.replace(`/dashboard/${r.session_id}?tab=setup`)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (guard.status === 'loading') {
    return <div className="dash"><SkeletonRows rows={3} /></div>
  }

  return (
    <AppShell profile={guard.profile} companyName={companyName}>
      <div style={{ maxWidth: 720 }}>
        <h1 className="page-title">Nouvel inventaire</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Après la création, vous serez guidé : renseigner les zones à inventorier, transférer les
          fichiers, puis suivre le comptage.
        </p>

        {loadingStores ? (
          <SkeletonRows rows={2} />
        ) : stores.length === 0 ? (
          <EmptyState
            title="Aucun magasin ne vous est affecté"
            hint="Un inventaire est toujours rattaché à un magasin. Demandez à votre administrateur de vous affecter au magasin concerné."
            action={<Link href="/account" className="btn btn-ghost">Mon compte</Link>}
          />
        ) : (
          <form className="panel" onSubmit={onSubmit} style={{ marginTop: 0 }}>
            {error && <div className="error" role="alert">{error}</div>}

            <div className="field">
              <label htmlFor="inv-name">Nom de l’inventaire</label>
              <input
                id="inv-name" value={name} onChange={e => setName(e.target.value)}
                placeholder="Inventaire annuel 2026" autoComplete="off"
              />
              <p className="field-hint">Sert à le reconnaître dans la liste. Le numéro est généré automatiquement.</p>
            </div>

            <div className="field">
              <label htmlFor="inv-store">Magasin</label>
              <select id="inv-store" value={storeId} onChange={e => setStoreId(e.target.value)}>
                <option value="">Choisir un magasin…</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label htmlFor="inv-code">Code d’accès</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  id="inv-code" value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={10} autoComplete="off" spellCheck={false}
                  style={{ letterSpacing: 2, fontWeight: 700 }}
                />
                <button type="button" className="btn btn-ghost" onClick={() => setCode(generateCode())}>
                  Générer
                </button>
              </div>
              <p className="field-hint">
                Les compteurs saisissent le numéro d’inventaire et ce code pour rejoindre la session.
                4 caractères minimum.
              </p>
            </div>

            <div className="field">
              <label htmlFor="inv-zones">Organisation du comptage</label>
              <select
                id="inv-zones"
                value={usesZones ? 'zones' : 'classic'}
                onChange={e => setUsesZones(e.target.value === 'zones')}
              >
                <option value="zones">Zones et balises — recommandé</option>
                <option value="classic">Classique — sans balise</option>
              </select>
              <p className="field-hint">
                {usesZones
                  ? 'Chaque emplacement reçoit une plage de balises QR (étiquettes à imprimer et coller — vous les créerez à l’étape suivante, dans Set up). Vous suivez l’avancement balise par balise et l’audit se compare zone par zone.'
                  : 'Les compteurs scannent sans délimiter d’emplacement. Plus simple à lancer, mais pas de suivi par zone ni de comparaison d’audit par balise.'}
              </p>
            </div>

            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? 'Création…' : 'Créer l’inventaire'}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  )
}
