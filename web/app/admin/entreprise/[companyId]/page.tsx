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
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Renommer } from '@/components/ui/Renommer'
import { AppShell } from '@/components/AppShell'
import { densite, trancheDe } from '@/lib/tarifs'
import { lignesProposees, referenceProposee, totalProposeCents } from '@/lib/devis'

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
  id: string; company_id: string; store_id: string | null; store_name: string; message: string
  units: number | null; sqm: number | null
  kind: 'add' | 'remove'
  status: 'pending' | 'quoted' | 'accepted' | 'paid' | 'created' | 'removed' | 'rejected' | 'declined'
  requested_label: string; created_at: string
  quote_reference?: string
  quote_amount_cents?: number | null
  decline_reason?: string | null
}

function frDate(s: string) {
  return new Date(s).toLocaleDateString('fr-FR')
}

const nb = (n: number) => n.toLocaleString('fr-FR')

/**
 * Ce qu'il faut pour deviser, sur une ligne : la tranche, son prix, et le
 * recoupement stock / surface.
 *
 * Ce repère ne s'affiche que dans la console — sur le formulaire du client il
 * lui indiquerait quel chiffre ajuster pour changer de tranche. Et ce n'est pas
 * un détecteur de mensonge : stock et surface viennent de la même personne. Il
 * attrape l'erreur d'ordre de grandeur, un zéro oublié.
 */
/**
 * Les statuts d'une demande de magasin, tels qu'ils se lisent en console.
 *
 * Le parcours est celui d'une inscription depuis le 22 août 2026 :
 * pending → quoted → accepted → paid → created. La licence se facture par
 * magasin, un magasin ajouté est une ligne de revenu.
 */
const STATUT_DEMANDE: Record<StoreRequest['status'], string> = {
  pending: 'À deviser',
  quoted: 'Devis envoyé',
  accepted: 'Devis accepté',
  paid: 'Facture encaissée',
  created: 'Magasin créé',
  removed: 'Magasin supprimé',
  rejected: 'Refusée',
  declined: 'Déclinée par le client',
}

/** Ce qui attend encore un geste de Quantinvo. */
const enCours = (d: StoreRequest) =>
  d.status === 'pending' || d.status === 'quoted' || d.status === 'accepted' || d.status === 'paid'
  || d.status === 'declined'

/**
 * Le panneau qui établit le devis d'un magasin — même figure que celui des
 * demandes d'inscription, sur une seule ligne : un magasin, une licence.
 *
 * Le montant proposé vient de la grille et du volume déclaré ; il reste
 * modifiable, c'est la ligne saisie qui part dans le PDF.
 */
function PanneauDevisMagasin({
  demande, busy, onEnvoyer,
}: {
  demande: StoreRequest
  busy: boolean
  onEnvoyer: (reference: string, cents: number) => void
}) {
  const lignes = lignesProposees([{ name: demande.store_name, units: demande.units, sqm: demande.sqm }], 1)
  const propose = totalProposeCents(lignes)
  const [reference, setReference] = useState(
    demande.quote_reference || referenceProposee(new Date().getFullYear(), demande.id),
  )
  const [montant, setMontant] = useState(
    ((demande.quote_amount_cents ?? propose.cents) / 100).toFixed(2).replace('.', ','),
  )

  const cents = Math.round(Number(montant.replace(/\s/g, '').replace(',', '.')) * 100)
  const valide = reference.trim() !== '' && Number.isFinite(cents) && cents >= 0

  return (
    <div className="devis-panneau">
      <div className="devis-panneau-lignes">
        {lignes.map((l, i) => (
          <div className="devis-panneau-ligne" key={i}>
            <span>{l.libelle}</span>
            <span className="muted">{l.unites == null ? '—' : `${nb(l.unites)} pièces`}</span>
            <span className="muted">{l.tranche || '—'}</span>
            <span className="n">
              {l.prixCents == null
                ? 'sur devis'
                : (l.prixCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>
        ))}
      </div>
      <div className="devis-panneau-champs">
        <label>
          Référence
          <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={40} />
        </label>
        <label>
          Montant annuel HT
          <input value={montant} onChange={(e) => setMontant(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <div className="devis-panneau-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={busy || !valide}
          onClick={() => valide && onEnvoyer(reference.trim(), cents)}
        >
          {busy ? 'Envoi…' : 'Envoyer le devis'}
        </button>
        <span className="muted small">
          Le PDF est fabriqué et joint à l&apos;envoi, avec le lien d&apos;acceptation.
        </span>
      </div>
    </div>
  )
}

function VolumeDemande({ units, sqm }: { units: number | null; sqm: number | null }) {
  const tranche = trancheDe(units)
  const d = densite(units, sqm)
  return (
    <div className="muted small">
      {units === null ? 'Stock non déclaré' : `${nb(units)} pièces`}
      {sqm !== null && ` · ${nb(sqm)} m²`}
      {d !== null && ` · ${nb(Math.round(d))} pièces/m²`}
      {tranche && (
        <> · <b>{tranche.profil}</b> — {tranche.prixEuros === null
          ? 'sur devis'
          : `${nb(tranche.prixEuros)} € / an`}</>
      )}
    </div>
  )
}

export default function AdminCompanyPage() {
  const router = useRouter()
  const params = useParams<{ companyId: string }>()
  const companyId = params?.companyId
  const guard = useAuthGuard('admin')
  const confirmer = useConfirm()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')
  const [copie, setCopie] = useState<string | null>(null)
  const [demandes, setDemandes] = useState<StoreRequest[]>([])
  // Un seul panneau de devis ouvert à la fois : deux montants côte à côte, ce
  // sont deux montants qu'on confond.
  const [devisOuvert, setDevisOuvert] = useState<string | null>(null)
  // La demande en cours de traitement : ses boutons se désactivent le temps de
  // l'aller-retour, sinon un double clic envoie deux devis.
  const [busy, setBusy] = useState<string | null>(null)

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

  /** Envoyer le devis d'un magasin — même edge que les inscriptions. */
  async function envoyerDevisMagasin(d: StoreRequest, reference: string, cents: number) {
    const lignes = lignesProposees([{ name: d.store_name, units: d.units, sqm: d.sqm }], 1)
    setBusy(d.id)
    const { data, error } = await supabase.functions.invoke('admin-send-quote', {
      body: { requestId: d.id, reference, amountCents: cents, lines: lignes, target: 'store' },
    })
    setBusy(null)
    if (!error && data?.success) {
      setDevisOuvert(null)
      if (data.emailed === false) {
        alert(`Devis enregistré, mais l'e-mail n'a pas pu partir : ${data.error ?? 'raison inconnue'}`)
      }
      await charger()
      return
    }
    if (error) {
      if (await appel('admin_quote_store_request', {
        p_id: d.id, p_reference: reference, p_amount_cents: cents, p_note: '', p_lines: lignes,
      })) {
        alert("Devis enregistré, mais l'envoi automatique n'a pas répondu : le client n'a rien reçu.")
        setDevisOuvert(null)
      }
      return
    }
    alert('Erreur : ' + (data?.error ?? 'inconnue'))
  }

  /** Accord du client, puis encaissement — déclarés à la main pour l'instant. */
  async function statutDemande(d: StoreRequest, statut: 'accepted' | 'paid') {
    await appel('admin_set_store_request_status', { p_id: d.id, p_status: statut, p_note: '' })
  }

  async function creerDepuisDemande(d: StoreRequest) {
    // Par l'edge function : elle appelle la même RPC avec ce jeton, puis
    // prévient le demandeur par e-mail. Repli sur la RPC directe si elle est
    // injoignable — un magasin créé sans e-mail vaut mieux qu'un magasin non
    // créé, et le journal garde la trace des deux côtés.
    const { data, error } = await supabase.functions.invoke('admin-fulfil-store-request', {
      body: { requestId: d.id },
    })
    if (!error && data?.success) {
      if (data.emailed === false) {
        alert(`Magasin créé, mais l'e-mail n'a pas pu partir : ${data.error ?? 'raison inconnue'}`)
      }
      await charger()
      return
    }
    if (error) {
      await appel('admin_fulfil_store_request', { p_id: d.id })
      return
    }
    alert('Erreur : ' + (data?.error ?? 'inconnue'))
  }

  async function supprimerDepuisDemande(d: StoreRequest) {
    // Même avertissement que la suppression directe : supprimer un magasin
    // emporte ses inventaires, et c'est irréversible.
    if (!confirm(`Supprimer le magasin « ${d.store_name} » ?\n\nSes inventaires et tous leurs comptages seront effacés. Cette action est irréversible.`)) return
    appel('admin_fulfil_store_removal', { p_id: d.id })
  }

  async function refuserDemande(d: StoreRequest) {
    // Le motif est facultatif mais il est repris tel quel sur l'écran du
    // client : « Refusée » tout court laisserait l'administrateur d'entreprise
    // sans rien à faire de l'information.
    // Le motif part aussi par e-mail depuis le 22 août 2026 : le client n'a plus
    // à retourner sur /magasins pour apprendre que sa demande est refusée.
    const note = prompt(`Refuser la demande du magasin « ${d.store_name} ».\n\nMotif transmis au client, par e-mail et à l'écran (facultatif) :`, '')
    if (note === null) return
    const { data, error } = await supabase.functions.invoke('admin-reject-store-request', {
      body: { requestId: d.id, note },
    })
    if (!error && data?.success) {
      if (data.emailed === false) {
        alert(`Demande refusée, mais l'e-mail n'a pas pu partir : ${data.error ?? 'raison inconnue'}`)
      }
      await charger()
      return
    }
    if (error) {
      await appel('admin_reject_store_request', { p_id: d.id, p_note: note })
      return
    }
    alert('Erreur : ' + (data?.error ?? 'inconnue'))
  }

  async function ajouterMagasin(e: React.FormEvent) {
    e.preventDefault()
    const nom = storeName.trim()
    if (!nom) return
    if (await appel('admin_add_store', { p_company_id: companyId, p_name: nom })) setStoreName('')
  }

  async function supprimerMagasin(s: Store) {
    // Texte complété le 22 août 2026 : `admin_delete_store` supprime désormais
    // les inventaires du magasin — elle échouait avant sur la clé étrangère.
    // Ce que ça emporte doit se lire avant, pas se découvrir après.
    if (!confirm(`Supprimer le magasin « ${s.name} » ?\n\nSes inventaires et tous leurs comptages seront effacés. Cette action est irréversible.`)) return
    appel('admin_delete_store', { p_store_id: s.id })
  }

  /**
   * Supprimer une personne — le geste qui manquait à Quantinvo.
   *
   * ⚠️ **La console ne savait supprimer personne.** `admin_delete_user` existe
   * depuis le 18 août 2026, mais le seul bouton qui l'appelait était sur une
   * **demande de suppression** déposée par la personne elle-même
   * (/admin/console). Autrement dit : Quantinvo pouvait effacer une entreprise
   * entière, pas un compte. Constat de Julien, 23 août 2026.
   *
   * La recopie du nom est la même règle que /equipe, et pour la même raison :
   * ce bouton est à quelques centimètres d'une liste de lecture, et la
   * suppression est irréversible. C'est aussi pourquoi il ouvre la modale du
   * produit et non un `confirm()` du navigateur, comme le reste de cette page
   * — `window.confirm` ne sait pas exiger un geste délibéré.
   */
  async function supprimerPersonne(m: Member) {
    const nom = (m.full_name ?? '').trim()
    const details = [
      `${nom || 'Sans nom'} — ${m.email ?? 'adresse inconnue'}`,
      'La personne perd l’accès à Quantinvo immédiatement.',
      'Ses comptages restent, mais son nom disparaît des rapports déjà faits.',
      'Ses inventaires et ses invitations sont détachés de son compte.',
    ]
    // Une entreprise sans administrateur remonte dans « À traiter » sur
    // /admin : autant le dire avant, pas après.
    if (m.is_company_admin) {
      details.push(
        'C’est un administrateur de cette entreprise : sans lui, plus personne n’y gère les superviseurs.',
      )
    }
    const ok = await confirmer({
      title: 'Supprimer définitivement ce compte ?',
      message: 'Cette suppression est définitive.',
      details,
      confirmLabel: 'Supprimer définitivement',
      tone: 'danger',
      requireText: nom || m.email || 'SUPPRIMER',
    })
    if (!ok) return
    const { data, error } = await supabase.rpc('admin_delete_user', { p_user_id: m.id })
    if (error || !data?.success) { alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue')); return }
    charger()
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
      <Renommer
        nom={detail.company.name}
        label="cette entreprise"
        className="page-title"
        onValider={async (nom) => {
          const { data, error } = await supabase.rpc('admin_rename_company', {
            p_company_id: companyId, p_name: nom,
          })
          if (error || !data?.success) return error?.message ?? data?.error ?? 'Renommage impossible.'
          await charger()
          return null
        }}
      />
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
      {demandes.filter(enCours).length > 0 && (
        <section className="admin-section">
          <h2>Demandes de magasin</h2>
          <div className="req-list">
            {demandes.filter(enCours).map((d) => (
              <div className="req-row" key={d.id}>
                <div>
                  <div className="req-name">
                    {d.store_name}
                    {d.kind === 'remove' && (
                      <span className="pill pill-refus" style={{ marginLeft: 8 }}>Suppression</span>
                    )}
                  </div>
                  {d.kind === 'add' && <VolumeDemande units={d.units} sqm={d.sqm} />}
                  <div className="muted small">
                    Demandé le {frDate(d.created_at)}
                    {d.requested_label && ` par ${d.requested_label}`}
                  </div>
                  {d.message && <div className="muted small">« {d.message} »</div>}
                  {d.status === 'declined' && (
                    <div className="muted small">
                      Déclinée par le client{d.decline_reason ? ` : « ${d.decline_reason} »` : ', sans motif'}.
                    </div>
                  )}
                  {d.quote_reference && (
                    <div className="muted small">
                      Devis {d.quote_reference} — {d.quote_amount_cents == null
                        ? '—'
                        : (d.quote_amount_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      {' · '}{STATUT_DEMANDE[d.status]}
                    </div>
                  )}
                  {devisOuvert === d.id && d.kind === 'add' && (
                    <PanneauDevisMagasin
                      demande={d}
                      busy={busy === d.id}
                      onEnvoyer={(reference, cents) => envoyerDevisMagasin(d, reference, cents)}
                    />
                  )}
                </div>
                <div className="req-actions">
                  {d.kind === 'remove' ? (
                    <button className="btn btn-danger btn-sm" onClick={() => supprimerDepuisDemande(d)}>
                      Supprimer le magasin
                    </button>
                  ) : (
                    <>
                      {(d.status === 'pending' || d.status === 'quoted' || d.status === 'declined') && (
                        <button
                          className={`btn btn-sm ${d.status === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
                          disabled={busy === d.id}
                          onClick={() => setDevisOuvert(devisOuvert === d.id ? null : d.id)}
                        >
                          {devisOuvert === d.id
                            ? 'Fermer'
                            : d.status === 'pending' ? 'Établir le devis'
                            : d.status === 'declined' ? 'Nouveau devis' : 'Renvoyer le devis'}
                        </button>
                      )}
                      {d.status === 'quoted' && (
                        <button className="link-btn" disabled={busy === d.id}
                          onClick={() => statutDemande(d, 'accepted')}>
                          Marquer accepté
                        </button>
                      )}
                      {d.status === 'accepted' && (
                        // Secours : un paiement reçu hors Stripe. Le chemin
                        // normal est le webhook, qui crée tout seul.
                        <button className="link-btn" disabled={busy === d.id}
                          onClick={() => { if (confirm('Marquer ce devis comme réglé hors Stripe ?\n\nÀ n’utiliser que pour un paiement reçu par un autre canal.')) statutDemande(d, 'paid') }}>
                          Réglé hors Stripe
                        </button>
                      )}
                      {d.status === 'paid' && (
                        <button className="btn btn-success btn-sm" disabled={busy === d.id}
                          onClick={() => creerDepuisDemande(d)}>
                          Créer le magasin
                        </button>
                      )}
                    </>
                  )}
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
                      <Renommer
                        nom={s.name}
                        label="ce magasin"
                        className="store-block-name"
                        onValider={async (nom) => {
                          const { data, error } = await supabase.rpc('admin_rename_store', {
                            p_store_id: s.id, p_name: nom,
                          })
                          if (error || !data?.success) return error?.message ?? data?.error ?? 'Renommage impossible.'
                          await charger()
                          return null
                        }}
                      />
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
                <div className="req-actions">
                  <button className="link-btn danger-link" onClick={() => supprimerPersonne(m)}>
                    Supprimer le compte
                  </button>
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
