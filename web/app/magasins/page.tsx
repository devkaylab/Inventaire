'use client'

// Magasins — les magasins d'un superviseur, leurs codes d'accès.
//
// Ce bloc vivait au milieu de « Mon compte », entre les inventaires et
// l'équipe. Il a son écran : on y vient pour relever un code, pas en
// passant.
//
// L'administrateur de l'entreprise y trouve en plus de quoi **demander
// l'ajout d'un magasin**. Un magasin ne se crée pas depuis le produit — la
// licence se facture par magasin, donc Quantinvo reste seul à créer. La
// demande n'est qu'un signal ; elle n'ajoute rien.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { getMyStores, type Store } from '@/lib/inventory'
import { getMyCompany, type Company } from '@/lib/account'

type StoreRequest = {
  id: string
  store_name: string
  message: string
  status: 'pending' | 'created' | 'rejected'
  requested_label: string
  admin_note: string
  created_at: string
  handled_at: string | null
}

const STATUT: Record<StoreRequest['status'], string> = {
  pending: 'Demande envoyée',
  created: 'Magasin créé',
  rejected: 'Refusée',
}

/** Date courte, comme ailleurs dans l'espace connecté : « 22/08 ». */
function jourCourt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

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

  const estAdmin = !!guard.profile.is_company_admin

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <h1 className="page-title">Magasins</h1>
      </div>

      {!pret ? (
        <p className="muted">Chargement…</p>
      ) : (
        <>
          {stores.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Vous n&apos;êtes affecté à aucun magasin</div>
              <p className="empty-state-hint">
                {estAdmin
                  // Lui écrire « contactez votre administrateur » le renverrait
                  // à lui-même : il s'affecte un magasin depuis Mon équipe.
                  ? <>Affectez-vous un magasin depuis <Link href="/equipe" style={{ color: 'var(--accent)' }}>Mon équipe</Link>, ou demandez à Quantinvo d&apos;en ajouter un.</>
                  : <>Contactez l&apos;administrateur de votre entreprise, ou Quantinvo si elle n&apos;en a pas encore.</>}
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

          {estAdmin && <DemandesMagasin />}
        </>
      )}
    </AppShell>
  )
}

/**
 * Demander l'ajout d'un magasin — administrateur d'entreprise seulement.
 *
 * Les demandes en cours restent affichées : sans cela la même demande part
 * trois fois. Elle s'annule tant que personne n'y a touché ; une demande déjà
 * traitée est une trace, pas un brouillon.
 */
function DemandesMagasin() {
  const toast = useToast()
  const confirm = useConfirm()
  const [demandes, setDemandes] = useState<StoreRequest[]>([])
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [mot, setMot] = useState('')
  const [busy, setBusy] = useState(false)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('ca_list_store_requests')
    if (!error && data) setDemandes(data as StoreRequest[])
  }, [])

  useEffect(() => { charger() }, [charger])

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    const n = nom.trim()
    if (!n) return
    setBusy(true)
    const { data, error } = await supabase.rpc('ca_request_store', { p_name: n, p_message: mot.trim() })
    setBusy(false)
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? 'Demande impossible pour le moment.')
      return
    }
    toast.success('Demande envoyée. Quantinvo vous recontacte.')
    setNom(''); setMot(''); setOuvert(false)
    charger()
  }

  async function annuler(d: StoreRequest) {
    const ok = await confirm({
      title: 'Annuler cette demande ?',
      message: `La demande d’ajout du magasin « ${d.store_name} » ne sera plus transmise à Quantinvo.`,
      confirmLabel: 'Annuler la demande',
      cancelLabel: 'Revenir',
    })
    if (!ok) return
    const { data, error } = await supabase.rpc('ca_cancel_store_request', { p_id: d.id })
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? 'Annulation impossible.')
      return
    }
    charger()
  }

  return (
    <>
      <div className="dash-sub">Demandes de magasin</div>

      {demandes.length > 0 && (
        <div className="req-list">
          {demandes.map((d) => (
            <div className="req-row" key={d.id}>
              <div>
                <div className="req-name">
                  {d.store_name}
                  <span className={`pill ${d.status === 'pending' ? 'pill-attente' : d.status === 'rejected' ? 'pill-refus' : ''}`} style={{ marginLeft: 8 }}>
                    {STATUT[d.status]}
                  </span>
                </div>
                <div className="muted small">
                  Demandé le {jourCourt(d.created_at)}
                  {d.requested_label && ` par ${d.requested_label}`}
                  {d.status === 'pending' && ' · Quantinvo vous recontacte'}
                </div>
                {d.status === 'rejected' && d.admin_note && (
                  <div className="muted small">« {d.admin_note} »</div>
                )}
              </div>
              {d.status === 'pending' && (
                <button type="button" className="link-btn danger-link" onClick={() => annuler(d)}>
                  Annuler la demande
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!ouvert ? (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOuvert(true)}>
            Demander l&apos;ajout d&apos;un magasin
          </button>
        </div>
      ) : (
        <form onSubmit={envoyer} className="panel" style={{ marginTop: 12 }}>
          <p className="muted small" style={{ marginTop: 0 }}>
            Quantinvo crée le magasin et vous recontacte pour le devis&nbsp;: un magasin de plus est une licence de plus.
          </p>
          <div className="field">
            <label htmlFor="magasin-nom">Nom du magasin</label>
            <input
              id="magasin-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Lyon Bellecour"
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="magasin-mot">Précision pour Quantinvo (facultatif)</label>
            <textarea
              id="magasin-mot"
              value={mot}
              onChange={(e) => setMot(e.target.value)}
              placeholder="Date d'ouverture, volume de stock…"
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="inline-form">
            <button className="btn btn-primary" disabled={busy || !nom.trim()}>Envoyer la demande</button>
            <button
              type="button"
              className="link-btn"
              onClick={() => { setOuvert(false); setNom(''); setMot('') }}
            >Annuler</button>
          </div>
        </form>
      )}
    </>
  )
}
