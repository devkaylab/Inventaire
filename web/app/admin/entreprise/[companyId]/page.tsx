'use client'

// Page d'une entreprise, côté console Quantinvo.
//
// Tout le détail d'une entreprise vit ici : ses codes confidentiels, ses
// magasins, l'affectation des superviseurs, son administrateur. La console
// d'accueil (/admin) n'en montre qu'un aperçu chiffré — à cinquante
// entreprises, dérouler chaque carte rendait la page illisible et lançait
// deux requêtes par entreprise au chargement.
//
// Deux requêtes ici : admin_company_detail rend l'ensemble de la fiche, et
// admin_list_store_requests les demandes d'ajout de magasin — arrivées après,
// et volontairement lues à part pour n'avoir pas à rouvrir la première.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'

type Company = { id: string; name: string; join_code: string; created_at: string }
type Store = {
  id: string; name: string; join_code: string
  annual_price_cents: number | null
  supervisor_ids: string[]
}
type Member = {
  id: string; full_name: string | null; role: string | null
  is_company_admin: boolean; email: string | null; is_active: boolean
}
type Invitation = {
  id: string; email: string; role: string
  first_name: string | null; last_name: string | null; created_at: string
}
type Detail = { company: Company; stores: Store[]; members: Member[]; invitations: Invitation[] }
type StoreRequest = {
  id: string; company_id: string; store_name: string; message: string
  status: 'pending' | 'created' | 'rejected'
  requested_label: string; created_at: string
}

function frDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR')
}

export default function AdminCompanyPage() {
  const router = useRouter()
  const params = useParams<{ companyId: string }>()
  const companyId = params?.companyId
  const guard = useAuthGuard('admin')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')
  const [copie, setCopie] = useState<string | null>(null)
  const [demandes, setDemandes] = useState<StoreRequest[]>([])

  const charger = useCallback(async () => {
    if (!companyId) return
    const [fiche, dem] = await Promise.all([
      supabase.rpc('admin_company_detail', { p_company_id: companyId }),
      supabase.rpc('admin_list_store_requests'),
    ])
    if (fiche.error) { setErreur(fiche.error.message); return }
    setDetail(fiche.data as Detail)
    setDemandes(((dem.data ?? []) as StoreRequest[]).filter((d) => d.company_id === companyId))
  }, [companyId])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger()
  }, [guard.status, charger])

  const supervisors = useMemo(
    () => (detail?.members ?? []).filter((m) => m.role === 'supervisor'),
    [detail],
  )
  const memberById = useMemo(() => {
    const m: Record<string, Member> = {}
    for (const x of detail?.members ?? []) m[x.id] = x
    return m
  }, [detail])

  async function appel(fn: string, args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(fn, args)
    if (error || !data?.success) {
      alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue'))
      return false
    }
    await charger()
    return true
  }

  function copier(code: string) {
    navigator.clipboard?.writeText(code)
    setCopie(code)
    setTimeout(() => setCopie(null), 2000)
  }

  async function creerDepuisDemande(d: StoreRequest) {
    appel('admin_fulfil_store_request', { p_id: d.id })
  }

  async function refuserDemande(d: StoreRequest) {
    // Le motif est facultatif mais il est repris tel quel sur l'écran du
    // client : « Refusée » tout court laisserait l'administrateur d'entreprise
    // sans rien à faire de l'information.
    const note = prompt(`Refuser la demande du magasin « ${d.store_name} ».\n\nMotif transmis au client (facultatif) :`, '')
    if (note === null) return
    appel('admin_reject_store_request', { p_id: d.id, p_note: note })
  }

  async function ajouterMagasin(e: React.FormEvent) {
    e.preventDefault()
    const nom = storeName.trim()
    if (!nom) return
    if (await appel('admin_add_store', { p_company_id: companyId, p_name: nom })) setStoreName('')
  }

  async function supprimerMagasin(s: Store) {
    if (!confirm(`Supprimer le magasin « ${s.name} » ?`)) return
    appel('admin_delete_store', { p_store_id: s.id })
  }

  async function supprimerEntreprise() {
    if (!detail) return
    if (!confirm(`Supprimer définitivement « ${detail.company.name} » ?\n\nTous ses inventaires et données seront supprimés, et ses membres détachés de l'entreprise. Cette action est irréversible.`)) return
    const { data, error } = await supabase.rpc('admin_delete_company', { p_company_id: companyId })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    router.replace('/admin')
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }
  if (erreur) {
    return (
      <AppShell profile={guard.profile}>
        <p className="muted">Cette entreprise n&apos;est pas accessible.</p>
        <Link href="/admin/entreprises" className="btn btn-ghost" style={{ marginTop: 16 }}>
          ← Toutes les entreprises
        </Link>
      </AppShell>
    )
  }
  if (!detail) {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const admins = supervisors.filter((m) => m.is_company_admin)

  return (
    <AppShell profile={guard.profile}>
      <Link href="/admin/entreprises" className="link-btn" style={{ display: 'inline-block', marginBottom: 14 }}>
        ← Toutes les entreprises
      </Link>
      <h1 className="page-title">{detail.company.name}</h1>
      <div className="code-row" style={{ marginTop: -4 }}>
        Code : <code>{detail.company.join_code}</code>
        <button className="link-btn" onClick={() => copier(detail.company.join_code)}>
          {copie === detail.company.join_code ? 'Copié' : 'Copier'}
        </button>
        <span className="muted small" style={{ marginLeft: 10 }}>créée le {frDate(detail.company.created_at)}</span>
      </div>

      <section className="admin-section">
        <h2>Administrateur d&apos;entreprise</h2>
        <CompanyAdminBlock
          companyId={detail.company.id}
          admins={admins}
          onChanged={charger}
        />
      </section>

      {/* Une demande précède la création : elle se lit juste avant les
          magasins, et « Créer le magasin » fait exactement ce que fait le
          formulaire d'à côté. */}
      {demandes.filter((d) => d.status === 'pending').length > 0 && (
        <section className="admin-section">
          <h2>Demandes de magasin</h2>
          <div className="req-list">
            {demandes.filter((d) => d.status === 'pending').map((d) => (
              <div className="req-row" key={d.id}>
                <div>
                  <div className="req-name">{d.store_name}</div>
                  <div className="muted small">
                    Demandé le {frDate(d.created_at)}
                    {d.requested_label && ` par ${d.requested_label}`}
                  </div>
                  {d.message && <div className="muted small">« {d.message} »</div>}
                </div>
                <div className="req-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => creerDepuisDemande(d)}>
                    Créer le magasin
                  </button>
                  <button className="link-btn danger-link" onClick={() => refuserDemande(d)}>Refuser</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="admin-section">
        <div className="admin-section-head">
          <h2>Magasins ({detail.stores.length})</h2>
          <form className="inline-form" onSubmit={ajouterMagasin}>
            <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Nouveau magasin" />
            <button className="btn btn-ghost">Ajouter</button>
          </form>
        </div>

        {detail.stores.length === 0 ? (
          <p className="muted">Aucun magasin. La licence étant par magasin, une entreprise sans magasin n&apos;a pas encore d&apos;usage.</p>
        ) : (
          <div className="store-blocks">
            {detail.stores.map((s) => {
              const affectes = new Set(s.supervisor_ids)
              const libres = supervisors.filter((m) => !affectes.has(m.id))
              return (
                <div className="store-block" key={s.id}>
                  <div className="store-block-head">
                    <div>
                      <span className="store-block-name">{s.name}</span>
                      <div className="code-row">
                        Code magasin : <code>{s.join_code}</code>
                        <button className="link-btn" onClick={() => copier(s.join_code)}>
                          {copie === s.join_code ? 'Copié' : 'Copier'}
                        </button>
                      </div>
                    </div>
                    <button className="link-btn danger-link" onClick={() => supprimerMagasin(s)}>Supprimer</button>
                  </div>
                  <TarifMagasin store={s} onSaved={charger} />
                  <div className="store-sup">
                    {s.supervisor_ids.length === 0 && <span className="muted small">Aucun superviseur affecté</span>}
                    {s.supervisor_ids.map((uid) => (
                      <span className="chip" key={uid}>
                        {memberById[uid]?.full_name || 'Superviseur'}
                        <button
                          className="chip-x"
                          onClick={() => appel('admin_unassign_supervisor', { p_store_id: s.id, p_user_id: uid })}
                          aria-label="Retirer"
                        >×</button>
                      </span>
                    ))}
                    {libres.length > 0 && (
                      <select
                        className="store-sup-select"
                        value=""
                        onChange={(e) => { if (e.target.value) appel('admin_assign_supervisor', { p_store_id: s.id, p_user_id: e.target.value }) }}
                      >
                        <option value="">+ Affecter un superviseur</option>
                        {libres.map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name || 'Sans nom'}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Personnes ({detail.members.length})</h2>
        {detail.members.length === 0 ? (
          <p className="muted">Aucun compte rattaché à cette entreprise.</p>
        ) : (
          <div className="req-list">
            {detail.members.map((m) => (
              <div className="req-row" key={m.id}>
                <div>
                  <div className="req-name">
                    {m.full_name || 'Sans nom'}
                    {m.is_company_admin && <span className="pill" style={{ marginLeft: 8 }}>Admin</span>}
                    {!m.is_active && (
                      <span className="dash-badge dash-badge-counting" style={{ marginLeft: 8 }}>
                        <span className="dash-dot" />Mot de passe à créer
                      </span>
                    )}
                  </div>
                  <div className="muted small">
                    {m.email} · {m.role === 'supervisor' ? 'Superviseur' : 'Compteur'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {detail.invitations.length > 0 && (
        <section className="admin-section">
          <h2>Invitations en cours ({detail.invitations.length})</h2>
          <div className="req-list">
            {detail.invitations.map((i) => (
              <div className="req-row" key={i.id}>
                <div>
                  <div className="req-name">
                    {i.first_name} {i.last_name}{' '}
                    <span className="pill">
                      {i.role === 'company_admin' ? 'Admin' : i.role === 'supervisor' ? 'Superviseur' : 'Compteur'}
                    </span>
                  </div>
                  <div className="muted small">{i.email} · envoyée le {frDate(i.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="dash-danger">
        <div className="dash-danger-row">
          <div className="dash-danger-text">
            <strong>Supprimer cette entreprise</strong>
            <p className="muted small" style={{ marginTop: 4 }}>
              Ses inventaires et ses données seront supprimés, ses membres détachés. Irréversible.
            </p>
          </div>
          <button className="btn btn-danger" onClick={supprimerEntreprise}>Supprimer l&apos;entreprise</button>
        </div>
      </div>
    </AppShell>
  )
}

/**
 * Nomination de l'administrateur d'entreprise — le client qui gère ensuite
 * lui-même ses superviseurs depuis « Mon équipe ».
 *
 * Deux issues côté serveur : un compte de l'entreprise existe pour cette
 * adresse et il est promu sur-le-champ ; sinon l'invitation part par e-mail
 * (edge invite-company-admin, garde is_admin() revérifiée en base).
 */
function CompanyAdminBlock({
  companyId, admins, onChanged,
}: {
  companyId: string
  admins: Member[]
  onChanged: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  async function inviter(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('invite-company-admin', {
      body: { companyId, email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim() },
    })
    setBusy(false)
    if (error || !data?.success) {
      alert('Erreur : ' + (data?.error ?? error?.message ?? 'inconnue'))
      return
    }
    alert(data.mode === 'promoted'
      ? `${data.full_name || 'Ce compte'} est maintenant administrateur de l'entreprise.`
      : `Invitation envoyée. ${data.email} reçoit un e-mail pour créer son mot de passe.`)
    setFirstName(''); setLastName(''); setEmail('')
    onChanged()
  }

  async function revoquer(a: Member) {
    if (!confirm(`Retirer le rôle d'administrateur d'entreprise à ${a.full_name || 'ce compte'}${a.email ? ` (${a.email})` : ''} ?\n\nSon compte superviseur et ses magasins sont conservés.`)) return
    const { data, error } = await supabase.rpc('admin_revoke_company_admin', { p_user: a.id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    onChanged()
  }

  return (
    <div className="panel" style={{ marginTop: 0 }}>
      <div className="chips" style={{ marginBottom: admins.length ? 14 : 10 }}>
        {admins.length === 0 && (
          <span className="muted small">Aucun administrateur — l&apos;entreprise est gérée par Quantinvo.</span>
        )}
        {admins.map((a) => (
          <span className="chip" key={a.id}>
            <span>
              {a.full_name || 'Sans nom'}
              {a.email && <span className="muted small" style={{ marginLeft: 6 }}>{a.email}</span>}
            </span>
            <button className="chip-x" onClick={() => revoquer(a)} aria-label="Révoquer">×</button>
          </span>
        ))}
      </div>
      <form className="inline-form" onSubmit={inviter} style={{ flexWrap: 'wrap' }}>
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" style={{ minWidth: 120 }} />
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" style={{ minWidth: 120 }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" style={{ minWidth: 200 }} />
        <button className="btn btn-ghost" disabled={busy || !email.trim()}>Nommer administrateur</button>
      </form>
      <p className="muted small" style={{ marginTop: 10 }}>
        Si un compte de l&apos;entreprise existe déjà pour cette adresse, il est promu directement — sinon la personne reçoit une invitation.
      </p>
    </div>
  )
}

/**
 * Tarif annuel d'un magasin — la licence est par magasin, au volume de
 * stock. Tant qu'il n'est pas posé, le tableau de bord estime ce magasin au
 * panier moyen et le signale : renseigner le vrai chiffre rend le revenu
 * exact.
 */
function TarifMagasin({ store, onSaved }: { store: Store; onSaved: () => void }) {
  const initial = store.annual_price_cents === null ? '' : String(Math.round(store.annual_price_cents / 100))
  const [valeur, setValeur] = useState(initial)
  const [busy, setBusy] = useState(false)

  // Le champ suit la valeur du serveur quand elle change (rechargement).
  useEffect(() => { setValeur(initial) }, [initial])

  const modifie = valeur.trim() !== initial

  async function enregistrer() {
    const brut = valeur.trim()
    let cents: number | null = null
    if (brut !== '') {
      const euros = Number(brut.replace(/\s/g, '').replace(',', '.'))
      if (!Number.isFinite(euros) || euros < 0) {
        alert('Indiquez un montant en euros, par exemple 2400.')
        return
      }
      cents = Math.round(euros * 100)
    }
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_set_store_price', {
      p_store_id: store.id, p_price_cents: cents,
    })
    setBusy(false)
    if (error || !data?.success) {
      alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue'))
      return
    }
    onSaved()
  }

  return (
    <div className="store-sup" style={{ marginTop: 10, alignItems: 'center' }}>
      <label className="muted small" htmlFor={`tarif-${store.id}`}>Licence annuelle</label>
      <input
        id={`tarif-${store.id}`}
        className="dash-audit-input"
        inputMode="numeric"
        value={valeur}
        placeholder="Non renseignée"
        onChange={(e) => setValeur(e.target.value)}
        aria-label={`Licence annuelle de ${store.name}, en euros`}
      />
      <span className="muted small">€ / an</span>
      {modifie && (
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={enregistrer}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      )}
      {!modifie && store.annual_price_cents === null && (
        <span className="muted small">Estimé au panier moyen tant qu&apos;il est vide</span>
      )}
    </div>
  )
}
