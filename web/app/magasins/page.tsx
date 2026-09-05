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
// ⚠️ UN MAGASIN SE CRÉE DEPUIS LE PRODUIT DEPUIS LE 4 SEPTEMBRE 2026, et cette
// note disait l'inverse jusque-là. La licence se facture toujours par magasin —
// c'est même pour cela que la création reste derrière le paiement — mais l'offre
// est publique et le client n'a plus besoin de nous pour l'acheter (Julien :
// « plus besoin de passer par un devis pour quoi que ce soit »). Le paiement
// ouvre une session Stripe, et c'est le webhook qui crée, comme pour une
// inscription : aucun second chemin de création.
//
// Les demandes d'avant restent affichées tant qu'elles ne sont pas abouties —
// un devis en cours se règle encore par son lien.

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
import { PayerEnLigne, ReprendrePaiement } from '@/components/PayerEnLigne'
import { QuiSupervise } from '@/components/QuiSupervise'
import { compositionOffre, proposer } from '@/lib/appareils'
import { PLAFOND_LIBRE_SERVICE } from '@/lib/offres'
import { ecrivezNous } from '@/lib/contact'
import { alertesMagasin, etatMagasin, type ApercuEntreprise, type StoreBloc } from '@/lib/entreprise'
import { getMyStores, type Store } from '@/lib/inventory'
import { getMyCompany, type Company } from '@/lib/account'
import { nb } from '@/lib/format'

type StoreRequest = {
  id: string
  kind: 'add' | 'remove' | 'offre'
  billing_period: string | null
  store_id: string | null
  store_name: string
  message: string
  /** Appareils déclarés. Nul pour les demandes d'avant le 2 septembre 2026. */
  devices: number | null
  /** ⚠️ Volume de stock — ne tarife plus rien. Lu pour les demandes anciennes. */
  units: number | null
  sqm: number | null
  status: 'pending' | 'quoted' | 'accepted' | 'paid' | 'created' | 'removed' | 'rejected' | 'declined'
  requested_label: string
  admin_note: string
  created_at: string
  handled_at: string | null
  quote_reference?: string
  quote_amount_cents?: number | null
  quote_token?: string | null
  quote_expires_at?: string | null
}

/** Le statut se lit différemment selon ce qu'on a demandé : « créé » ne veut
    rien dire pour une suppression. */
const STATUT: Record<StoreRequest['status'], string> = {
  pending: 'Demande envoyée',
  quoted: 'Devis reçu',
  accepted: 'Devis accepté',
  paid: 'Paiement reçu',
  created: 'Magasin créé',
  removed: 'Magasin supprimé',
  rejected: 'Refusée',
  declined: 'Devis décliné',
}

/** Montant du devis, en euros. */
const euros = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

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
  const [neMagasin, setNeMagasin] = useState<{ id: string; nom: string } | null>(null)

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

  /**
   * Au retour du paiement : on demande qui va superviser le magasin.
   *
   * ⚠️ ON ATTEND LE WEBHOOK, ET C'EST TOUTE LA DIFFICULTÉ. Stripe renvoie le
   * client sur cette page dans la seconde ; le magasin, lui, naît quand le
   * webhook passe. Sans cette attente, la fenêtre ne s'ouvrirait jamais — on
   * lirait une demande encore en `paid` et on conclurait qu'il n'y a rien.
   *
   * Elle s'arrête au bout de vingt secondes : au-delà c'est une anomalie, elle
   * remonte dans « Ventes en cours » et l'écran dit déjà « le magasin est créé
   * dans la minute ».
   */
  useEffect(() => {
    if (guard.status !== 'ready' || !guard.profile.is_company_admin) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('magasin') !== 'ok') return
    const demande = params.get('demande')
    // ⚠️ L'adresse se nettoie TOUT DE SUITE : un rafraîchissement ne doit pas
    // rouvrir la fenêtre, et le paiement ne se rejoue pas.
    window.history.replaceState({}, '', '/magasins')
    if (!demande) return

    let vivant = true
    let essais = 0
    const voir = async () => {
      if (!vivant) return
      const { data } = await supabase.rpc('magasin_cree_par', { p_id: demande })
      const r = data as { store_id: string | null; magasin: string; statut: string } | null
      if (r?.store_id && r.statut === 'created') {
        setNeMagasin({ id: r.store_id, nom: r.magasin })
        charger(true)
        return
      }
      essais += 1
      if (essais < 10) setTimeout(voir, 2000)
    }
    voir()
    return () => { vivant = false }
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
                Ajoutez-en un ci-dessous&nbsp;: il est créé dès le paiement.
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
      {neMagasin && (
        <QuiSupervise
          storeId={neMagasin.id}
          magasin={neMagasin.nom}
          onClose={() => setNeMagasin(null)}
        />
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
/**
 * Une demande du libre-service qui attend son paiement.
 *
 * ⚠️ LE DISCRIMINANT EST LE JETON DE DEVIS, et il n'y a pas plus sûr : une
 * demande devisée en porte un, le libre-service jamais. C'est aussi ce qui
 * décide, côté base, de ce qui s'annule et de ce qui ne s'annule pas — un
 * accord signé sur un montant négocié n'est pas un brouillon.
 */
function libreService(d: StoreRequest): boolean {
  return d.status === 'accepted' && !d.quote_token
}

function DemandesMagasin() {
  const confirm = useConfirm()
  const toast = useToast()
  const [demandes, setDemandes] = useState<StoreRequest[]>([])
  const [ouvert, setOuvert] = useState(false)
  const [saisie, setSaisie] = useState<SaisieMagasin>({ nom: '', appareils: '' })
  const uid = useId()

  const appareils = nombreOuNull(saisie.appareils)
  const nom = saisie.nom.trim()

  // L'offre qui couvre ce nombre d'appareils, et ses deux prix. Elle vient de
  // la MÊME fonction que la proposition de la fiche magasin : deux calculs du
  // même palier divergeraient au premier ajustement de la grille.
  const offre = useMemo(
    () => (appareils && appareils > 0 ? proposer(0, Math.round(appareils)) : null),
    [appareils],
  )
  const composition = offre ? compositionOffre(offre) : null
  // ⚠️ Le serveur refuse ce cas (`hors_grille`), et l'écran le dit AVANT le
  // clic : à 1 000 la borne était théorique, personne ne la tapait ; à 200
  // elle se rencontre — une enseigne saisit 250 sans y penser. Découvrir
  // après avoir cliqué qu'il n'y avait rien à acheter fait douter du bouton.
  const horsGrille = appareils != null && appareils > PLAFOND_LIBRE_SERVICE

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('ca_list_store_requests')
    if (error || !data) return
    // ⚠️ Un changement d'offre n'est pas une demande de magasin. Il porte le
    // même genre de ligne — c'est ce qui lui donne le webhook et la purge sans
    // rien réécrire — mais il se lit sur la fiche du magasin concerné.
    setDemandes((data as StoreRequest[]).filter((d) => d.kind !== 'offre'))
  }, [])

  useEffect(() => { charger() }, [charger])

  function fermer() {
    setOuvert(false)
    setSaisie({ nom: '', appareils: '' })
  }

  async function annuler(d: StoreRequest) {
    const ok = await confirm({
      title: 'Annuler cette demande ?',
      message: `« ${d.store_name} » ne sera pas créé, et rien ne sera prélevé.`,
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
                  <span className={`pill ${d.status === 'pending' || libreService(d) ? 'pill-attente' : d.status === 'rejected' || d.status === 'declined' ? 'pill-refus' : ''}`} style={{ marginLeft: 8 }}>
                    {/* ⚠️ « Devis accepté » est le libellé de l'AUTRE parcours,
                        et il ment ici : le libre-service dépose sa demande en
                        `accepted` parce qu'il n'y a rien à négocier. Ce qui les
                        distingue, c'est le jeton de devis — le libre-service
                        n'en a pas. */}
                    {libreService(d) ? 'Paiement à finir' : STATUT[d.status]}
                  </span>
                </div>
                <div className="muted small">
                  {/* Les demandes d'avant le 2 septembre 2026 portent un volume
                      de stock et pas d'appareils : on affiche ce qu'elles ont. */}
                  {d.devices !== null && `${nb(d.devices)} appareil${d.devices > 1 ? 's' : ''} · `}
                  {d.devices === null && d.units !== null && `${nb(d.units)} pièces · `}
                  demandé le {jourCourt(d.created_at)}
                  {d.requested_label && ` par ${d.requested_label}`}
                  {d.status === 'pending' && ' · Quantinvo vous recontacte'}
                </div>
                {d.status === 'quoted' && d.quote_token && (
                  <div className="muted small">
                    Devis {d.quote_reference} — {d.quote_amount_cents == null ? '—' : euros(d.quote_amount_cents)}{' '}
                    · <a href={`/devis/${d.quote_token}`}>voir et accepter</a>
                  </div>
                )}
                {libreService(d) && (
                  <div className="muted small">
                    Votre magasin est créé dès le paiement. Rien n’est prélevé tant que
                    vous n’avez pas réglé.
                  </div>
                )}
                {d.status === 'accepted' && d.quote_token && (
                  // Le paiement passe par Stripe : un client qui a fermé la page
                  // de paiement doit pouvoir y revenir d'ici, pas seulement
                  // depuis l'e-mail. La page du devis rouvre la même session.
                  <div className="muted small">
                    Accord enregistré. Il reste à régler la licence : le magasin est créé dès le paiement.{' '}
                    · <a href={`/devis/${d.quote_token}`}>Régler en ligne</a>
                  </div>
                )}
                {d.status === 'paid' && (
                  <div className="muted small">Paiement reçu. Le magasin est créé dans la minute.</div>
                )}
                {d.status === 'rejected' && d.admin_note && (
                  <div className="muted small">« {d.admin_note} »</div>
                )}
              </div>
              {(d.status === 'pending' || libreService(d)) && (
                <div className="req-actions">
                  {libreService(d) && (
                    <ReprendrePaiement requestId={d.id} devices={d.devices} billingPeriod={d.billing_period} />
                  )}
                  <button type="button" className="link-btn danger-link" onClick={() => annuler(d)}>
                    Annuler la demande
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!ouvert ? (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOuvert(true)}>
            Ajouter un magasin
          </button>
        </div>
      ) : (
        <div className="panel demande-magasin" style={{ marginTop: 12 }}>
          <p className="muted small" style={{ marginTop: 0 }}>
            Le prix dépend du nombre d&apos;appareils qui comptent en même temps dans ce magasin.
          </p>

          <MagasinSaisie
            valeur={saisie}
            idPrefix={`${uid}-ajout`}
            onChange={(champ, valeur) => setSaisie((v) => ({ ...v, [champ]: valeur }))}
          />

          {horsGrille && (
            <p className="offre-refus" role="status">
              Au-delà de {nb(PLAFOND_LIBRE_SERVICE)} appareils, l&apos;offre d&apos;un magasin ne se
              prolonge plus&nbsp;: l&apos;abonnement est par magasin, déclarez-les séparément.
              {/* ⚠️ `ecrivezNous` se tait quand l'adresse n'est pas posée : on
                  n'invite jamais à écrire sans dire où. Règle du 22 août 2026. */}
              {ecrivezNous() && <> Si votre cas ne rentre pas, {ecrivezNous()}.</>}
            </p>
          )}

          {offre && nom !== '' && (
            <div style={{ marginTop: 14 }}>
              <div className="muted small">
                <strong>{offre.nom}</strong> couvre {nb(offre.couvre)} appareils à la fois.
                {/* ⚠️ La page Stripe décompose en deux lignes : si notre écran
                    ne le dit pas, le « Qté 4 » s'y découvre sans prévenir. Et
                    une tranche entamée se paie entière — 137 demandés, 140
                    couverts. */}
                {composition && <> — {composition}.</>}
              </div>
              {/* ⚠️ LE BOUTON DIT L'ACTION, JAMAIS LE MONTANT — « à garder
                  uniquement : "Créer le magasin" » (Julien, 4 septembre 2026).
                  Les deux prix sont juste au-dessus. */}
              <PayerEnLigne
                offre={offre}
                corps={{ action: 'magasin', name: nom, devices: Math.round(appareils ?? 0) }}
                libelle="Créer le magasin"
              />
            </div>
          )}

          <div className="inline-form" style={{ marginTop: 10 }}>
            <button type="button" className="link-btn" onClick={fermer}>Annuler</button>
          </div>
          {(!appareils || appareils <= 0) && nom !== '' && (
            <p className="field-hint" style={{ marginTop: 10 }}>
              Indiquez le nombre d&apos;appareils pour voir le prix.
            </p>
          )}
        </div>
      )}
    </>
  )
}
