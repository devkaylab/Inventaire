'use client'

// Magasins.
//
// Deux lectures, parce que ce ne sont pas les mêmes besoins :
//
// · **Un superviseur** vient y relever un code d'accès. Une liste, des codes,
//   rien d'autre — ce bloc vivait au milieu de « Mon compte », il a son écran.
// · **L'administrateur d'entreprise** y trouve son patrimoine, à la façon de la
//   page Entreprises de la console Quantinvo : une ligne par magasin, ce qui
//   demande attention lisible sans ouvrir, et une fiche derrière chacune.
//   Chaque magasin est un volet — replié par défaut, son nom en en-tête (22
//   août 2026, demande de Julien : ces blocs occupaient tout le tableau de
//   bord, ils appartiennent à cette page).
//
// Un magasin ne se crée pas depuis le produit — la licence se facture par
// magasin, donc Quantinvo reste seul à créer. La demande n'est qu'un signal.

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Volet } from '@/components/ui/Volet'
import { MagasinSaisie, nombreOuNull, type SaisieMagasin } from '@/components/MagasinSaisie'
import { CorpsMagasin, resumeMagasin } from '@/components/magasin/CorpsMagasin'
import { alertesMagasin, etatMagasin, type ApercuEntreprise, type StoreBloc } from '@/lib/entreprise'
import { getMyStores, type Store } from '@/lib/inventory'
import { getMyCompany, type Company } from '@/lib/account'
import { nb } from '@/lib/format'

type StoreRequest = {
  id: string
  kind: 'add' | 'remove'
  store_id: string | null
  store_name: string
  message: string
  units: number | null
  sqm: number | null
  status: 'pending' | 'created' | 'removed' | 'rejected'
  requested_label: string
  admin_note: string
  created_at: string
  handled_at: string | null
}

/** Le statut se lit différemment selon ce qu'on a demandé : « créé » ne veut
    rien dire pour une suppression. */
const STATUT: Record<StoreRequest['status'], string> = {
  pending: 'Demande envoyée',
  created: 'Magasin créé',
  removed: 'Magasin supprimé',
  rejected: 'Refusée',
}

/** Date courte, comme ailleurs dans l'espace connecté : « 22/08 ». */
function jourCourt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

/** Sans accents ni casse : « Élysée » se trouve en tapant « elysee ». */
function normaliser(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function MagasinsPage() {
  const guard = useAuthGuard('supervisor')
  const [stores, setStores] = useState<Store[]>([])
  const [vue, setVue] = useState<ApercuEntreprise | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [copie, setCopie] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [pret, setPret] = useState(false)

  const estAdmin = guard.status === 'ready' && !!guard.profile.is_company_admin

  const charger = useCallback(async (admin: boolean) => {
    // L'administrateur lit son entreprise entière ; un superviseur, ses seuls
    // magasins. Deux requêtes différentes pour deux besoins différents.
    const [s, c, apercu] = await Promise.all([
      admin ? Promise.resolve([] as Store[]) : getMyStores().catch(() => [] as Store[]),
      getMyCompany().catch(() => null),
      admin ? supabase.rpc('ca_company_overview') : Promise.resolve({ data: null }),
    ])
    setStores(s)
    setCompany(c)
    if (apercu?.data) setVue(apercu.data as ApercuEntreprise)
    setPret(true)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger(!!guard.profile.is_company_admin)
  }, [guard, charger])

  async function copier(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopie(code)
      setTimeout(() => setCopie(null), 2000)
    } catch { /* sélection manuelle */ }
  }

  // Recherche par fragments, comme la liste des entreprises de la console :
  // « lyon part » trouve « Magasin Lyon Part-Dieu ».
  const magasins = useMemo(() => vue?.stores ?? [], [vue])
  const visibles = useMemo(() => {
    const mots = normaliser(recherche).split(/\s+/).filter(Boolean)
    if (mots.length === 0) return magasins
    return magasins.filter((m) => {
      const nom = normaliser(m.name)
      return mots.every((mot) => nom.includes(mot))
    })
  }, [magasins, recherche])

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <h1 className="page-title">
          Magasins{estAdmin && magasins.length > 0 ? ` (${magasins.length})` : ''}
        </h1>
      </div>

      {!pret ? (
        <p className="muted">Chargement…</p>
      ) : estAdmin ? (
        <>
          {magasins.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Votre entreprise n’a encore aucun magasin</div>
              <p className="empty-state-hint">
                Seul Quantinvo peut créer un magasin&nbsp;: demandez-lui d&apos;en ajouter un.
              </p>
            </div>
          ) : (
            <>
              {magasins.length > 4 && (
                <div className="toolbar">
                  <div className="toolbar-grow">
                    <input
                      type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
                      placeholder="Rechercher un magasin par son nom…"
                      aria-label="Rechercher un magasin"
                    />
                  </div>
                  {recherche.trim() !== '' && (
                    <>
                      <span className="muted small" aria-live="polite">
                        {visibles.length} sur {magasins.length}
                      </span>
                      <button type="button" className="link-btn" onClick={() => setRecherche('')}>Effacer</button>
                    </>
                  )}
                </div>
              )}

              {visibles.length === 0 ? (
                <p className="muted">Aucun magasin ne correspond à « {recherche} ».</p>
              ) : (
                <div style={{ marginTop: 4 }}>
                  {visibles.map((m) => <VoletMagasin key={m.id} store={m} />)}
                </div>
              )}
            </>
          )}
          <DemandesMagasin />
        </>
      ) : stores.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">Vous n&apos;avez accès à aucun magasin</div>
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
            Seul Quantinvo peut créer un magasin.
            <Link href="/outils" style={{ color: 'var(--accent)', marginLeft: 6 }}>Imprimer des balises</Link>
          </p>
        </>
      )}
    </AppShell>
  )
}

/**
 * Un magasin, replié.
 *
 * L'en-tête dit ce qu'il y a dedans — c'est ce qui sépare « replié » de
 * « caché » : le résumé et la pastille suffisent à savoir où en est le magasin
 * sans l'ouvrir, sinon on n'aurait fait que déplacer le mur.
 */
function VoletMagasin({ store }: { store: StoreBloc }) {
  const alertes = alertesMagasin(store)
  const etat = etatMagasin(store)
  return (
    <Volet
      titre={store.name}
      resume={resumeMagasin(store)}
      etat={alertes.length > 0
        ? { libelle: `${alertes.length} à surveiller`, ton: 'faire' }
        : { libelle: etat?.libelle ?? 'Rien à signaler', ton: 'pret' }}
    >
      <CorpsMagasin store={store} />
    </Volet>
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
  const [saisie, setSaisie] = useState<SaisieMagasin>({ nom: '', stock: '', surface: '' })
  const [mot, setMot] = useState('')
  const [busy, setBusy] = useState(false)
  const uid = useId()

  const stock = nombreOuNull(saisie.stock)
  const surface = nombreOuNull(saisie.surface)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('ca_list_store_requests')
    if (!error && data) setDemandes(data as StoreRequest[])
  }, [])

  useEffect(() => { charger() }, [charger])

  function fermer() {
    setOuvert(false)
    setSaisie({ nom: '', stock: '', surface: '' })
    setMot('')
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault()
    const n = saisie.nom.trim()
    if (!n || !stock) return
    setBusy(true)
    const { data, error } = await supabase.rpc('ca_request_store', {
      p_name: n,
      p_message: mot.trim(),
      p_units: Math.round(stock),
      p_sqm: surface === null ? null : Math.round(surface),
    })
    setBusy(false)
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? 'Demande impossible pour le moment.')
      return
    }
    toast.success('Demande envoyée. Quantinvo vous recontacte.')
    fermer()
    charger()
  }

  async function annuler(d: StoreRequest) {
    const ok = await confirm({
      title: 'Annuler cette demande ?',
      message: `Quantinvo ne recevra plus votre demande pour « ${d.store_name} ».`,
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
                  {d.kind === 'remove' && (
                    <span className="pill pill-refus" style={{ marginLeft: 8 }}>Suppression</span>
                  )}
                  <span className={`pill ${d.status === 'pending' ? 'pill-attente' : d.status === 'rejected' ? 'pill-refus' : ''}`} style={{ marginLeft: 8 }}>
                    {STATUT[d.status]}
                  </span>
                </div>
                <div className="muted small">
                  {d.units !== null && `${nb(d.units)} pièces`}
                  {d.sqm !== null && ` · ${nb(d.sqm)} m²`}
                  {d.units !== null && ' · '}
                  demandé le {jourCourt(d.created_at)}
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
        <form onSubmit={envoyer} className="panel demande-magasin" style={{ marginTop: 12 }}>
          <p className="muted small" style={{ marginTop: 0 }}>
            Le prix dépend du volume de stock&nbsp;: indiquez-le pour qu&apos;on puisse vous faire
            un devis. Quantinvo crée ensuite le magasin.
          </p>

          <MagasinSaisie
            valeur={saisie}
            idPrefix={`${uid}-demande`}
            onChange={(champ, valeur) => setSaisie((v) => ({ ...v, [champ]: valeur }))}
          />

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="magasin-mot">Précision pour Quantinvo (facultatif)</label>
            <textarea
              id="magasin-mot"
              value={mot}
              onChange={(e) => setMot(e.target.value)}
              placeholder="Date d'ouverture, contraintes particulières…"
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="inline-form">
            <button className="btn btn-primary" disabled={busy || !saisie.nom.trim() || !stock}>
              Envoyer la demande
            </button>
            <button type="button" className="link-btn" onClick={fermer}>Annuler</button>
          </div>
          {!stock && saisie.nom.trim() !== '' && (
            <p className="field-hint" style={{ marginTop: 10 }}>
              Sans le stock, nous ne pouvons pas vous faire de devis.
            </p>
          )}
        </form>
      )}
    </>
  )
}
