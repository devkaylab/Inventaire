'use client'

// La fiche d'un magasin — son profil.
//
// Julien, 22 août 2026 : « bouton ouvrir le magasin mène à la page du magasin
// en question, son profil, où on trouve son code, ses membres, ses
// inventaires ». C'est le pendant, à l'échelle d'une entreprise, de la fiche
// d'entreprise de la console Quantinvo.
//
// La liste des magasins n'en montre que l'essentiel — les inventaires ouverts
// et le dernier clôturé. Ici, tout : `ca_store_detail` rend l'historique
// complet et les personnes avec leur activité **dans ce magasin**.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyCompany, type Company } from '@/lib/account'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Renommer } from '@/components/ui/Renommer'
import { LigneInventaire } from '@/components/magasin/CorpsMagasin'
import { nb, relativeTime } from '@/lib/format'
import { Stat } from '@/components/ui/Stat'
import { euros } from '@/lib/offres'
import { compositionOffre, lireAppareils, type AppareilsMagasin } from '@/lib/appareils'
import { ChangerOffre, PayerEnLigne, ReprendrePaiement } from '@/components/PayerEnLigne'
import type { SessionBloc } from '@/lib/entreprise'

type Personne = {
  id: string
  full_name: string | null
  email: string | null
  is_active: boolean
  is_company_admin?: boolean
  last_count_at?: string | null
  sessions_counted?: number
}

type Fiche = {
  store: { id: string; name: string; join_code: string; created_at: string }
  supervisors: Personne[]
  counters: Personne[]
  sessions: SessionBloc[]
}

/**
 * Une demande, telle que la rend `ca_list_store_requests`.
 *
 * ⚠️ `offre` est née du libre-service (4 septembre 2026) : elle porte le même
 * genre de ligne — c'est ce qui lui donne le webhook et la purge sans rien
 * réécrire — mais elle ne crée aucun magasin, elle élargit le forfait de
 * celui-ci.
 */
type Demande = {
  id: string
  kind: 'add' | 'remove' | 'offre'
  store_id: string | null
  store_name: string
  status: 'pending' | 'accepted' | 'paid' | 'created' | 'removed' | 'rejected'
  devices: number | null
  billing_period: string | null
  admin_note: string
  created_at: string
}

export default function FicheMagasinPage() {
  const guard = useAuthGuard('supervisor')
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId
  const [fiche, setFiche] = useState<Fiche | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [erreur, setErreur] = useState(false)
  const [copie, setCopie] = useState(false)
  const [suppression, setSuppression] = useState<Demande | null>(null)
  // ⚠️ Un changement d'offre resté impayé DOIT se voir ici, sinon c'est le
  // cul-de-sac de la page Magasins recopié : le dépôt refuse un second
  // changement (`deja_en_cours`), et rien à l'écran ne dit quoi faire.
  const [offreEnCours, setOffreEnCours] = useState<Demande | null>(null)
  const [appareils, setAppareils] = useState<AppareilsMagasin | null>(null)
  const toast = useToast()
  const confirm = useConfirm()

  const charger = useCallback(async () => {
    if (!storeId) return
    const [f, c, d, ap] = await Promise.all([
      supabase.rpc('ca_store_detail', { p_store_id: storeId }),
      getMyCompany().catch(() => null),
      supabase.rpc('ca_list_store_requests'),
      // Le décompte d'appareils. Il ne conditionne rien : la fiche s'affiche
      // sans lui, et la section se tait — un chiffre absent ne doit pas
      // emporter la page.
      supabase.rpc('appareils_du_magasin', { p_store_id: storeId }),
    ])
    if (f.error || !f.data) { setErreur(true); return }
    setFiche(f.data as Fiche)
    setAppareils(ap.error ? null : (ap.data as AppareilsMagasin))
    setCompany(c)
    const demandes = (d.data ?? []) as Demande[]
    setSuppression(demandes.find((x) => x.kind === 'remove' && x.status === 'pending' && x.store_id === storeId) ?? null)
    setOffreEnCours(demandes.find((x) => x.kind === 'offre' && x.status === 'accepted' && x.store_id === storeId) ?? null)
  }, [storeId])

  useEffect(() => {
    if (guard.status !== 'ready') return
    if (!guard.profile.is_company_admin) { window.location.replace('/magasins'); return }
    charger()
  }, [guard, charger])

  async function annulerOffre() {
    if (!offreEnCours) return
    const ok = await confirm({
      title: 'Annuler ce changement d’offre ?',
      message: 'Votre offre ne change pas, et rien ne sera prélevé.',
      confirmLabel: 'Annuler le changement',
      cancelLabel: 'Revenir',
    })
    if (!ok) return
    const { data, error } = await supabase.rpc('ca_cancel_store_request', { p_id: offreEnCours.id })
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? 'Annulation impossible.')
      return
    }
    charger()
  }

  async function copier(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch { /* sélection manuelle */ }
  }

  /**
   * Demander la fermeture du magasin.
   *
   * Une demande, pas une suppression : la licence se facture par magasin, donc
   * Quantinvo reste seul à supprimer — comme il est seul à créer. Ce qui n'est
   * pas une raison de l'annoncer à la légère : la suppression emportera les
   * inventaires du magasin et leurs comptages, et la confirmation le dit.
   */
  async function demanderSuppression(nom: string) {
    const ok = await confirm({
      title: 'Demander la suppression de ce magasin ?',
      message: 'Vous demandez la suppression, c’est Quantinvo qui l’effectue. D’ici là, le magasin continue de fonctionner normalement.',
      details: [
        nom,
        'Sa suppression effacera définitivement ses inventaires et leurs comptages.',
        'Sa licence cessera d’être facturée.',
        'Vous pouvez annuler la demande tant que Quantinvo ne l’a pas traitée.',
      ],
      confirmLabel: 'Demander la suppression',
      tone: 'danger',
    })
    if (!ok) return
    const { data, error } = await supabase.rpc('ca_request_store_removal', { p_store_id: storeId })
    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? 'Demande impossible pour le moment.')
      return
    }
    toast.success('Demande envoyée. Quantinvo vous recontacte.')
    charger()
  }

  async function annulerSuppression(d: Demande) {
    const ok = await confirm({
      title: 'Annuler cette demande ?',
      message: `Le magasin « ${d.store_name} » ne sera pas supprimé.`,
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

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  if (erreur) {
    return (
      <AppShell profile={guard.profile} companyName={company?.name}>
        <p className="muted">Ce magasin n&apos;est pas accessible.</p>
        <Link href="/magasins" className="btn btn-ghost" style={{ marginTop: 16 }}>← Tous les magasins</Link>
      </AppShell>
    )
  }

  if (!fiche) {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  // Ce que le décompte d'appareils veut dire — le jugement vit dans
  // `lib/appareils.ts`, testable sans base ni navigateur.
  const verdict = lireAppareils(appareils)

  const ouverts = fiche.sessions.filter((s) => s.status !== 'closed')
  const clos = fiche.sessions.filter((s) => s.status === 'closed')

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <Link href="/magasins" className="link-btn" style={{ display: 'inline-block', marginBottom: 14 }}>
        ← Tous les magasins
      </Link>

      <div className="app-head">
        <div>
          {/* La page entière est réservée à l'administrateur d'entreprise
              (redirection plus haut) : pas de garde de rôle à répéter ici. */}
          <Renommer
            nom={fiche.store.name}
            label="ce magasin"
            className="page-title"
            onValider={async (nom) => {
              const { data, error } = await supabase.rpc('ca_rename_store', {
                p_store_id: storeId, p_name: nom,
              })
              if (error || !data?.success) return error?.message ?? data?.error ?? 'Renommage impossible.'
              await charger()
              return null
            }}
          />
          {/* ⚠️ LE SOUS-TITRE DIT L'IDENTITÉ, PLUS LES CHIFFRES. Il portait
              « 3 inventaires · 1 compteur · créé le … » — les mêmes nombres que
              la bande de résumé juste dessous, en plus petit et sans étiquette.
              Ici on situe le magasin ; les chiffres, eux, ont leur rangée. */}
          <p className="page-sub">
            {company?.name ? `${company.name} · ` : ''}
            créé le {new Date(fiche.store.created_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
        {/* Le rapport consolidé du magasin : tous ses inventaires clôturés
            additionnés. Réservé à l'administrateur d'entreprise et à
            Quantinvo — cette page l'est déjà. */}
        <div className="app-head-actions">
          <Link href={`/magasins/${storeId}/rapport`} className="btn btn-ghost">
            Rapport du magasin
          </Link>
        </div>
      </div>

      {/* ⚠️ CE QU'ON VIENT VÉRIFIER, AVANT D'AVOIR À LE CHERCHER. Une page qui
          ne répond qu'après quatre sections oblige à parcourir pour savoir si
          tout va bien. Aucun appel de plus : ces quatre chiffres sont déjà
          chargés. Et l'ambre n'y désigne QUE ce qui appelle une décision. */}
      <div className="resume-bande">
        <div>
          <b>Inventaires</b>
          <strong>{nb(ouverts.length)}</strong>
          <span>en cours, sur {nb(fiche.sessions.length)}</span>
        </div>
        <div>
          <b>Équipe</b>
          <strong>{nb(fiche.supervisors.length + fiche.counters.length)}</strong>
          <span>
            {nb(fiche.supervisors.length)} superviseur{fiche.supervisors.length > 1 ? 's' : ''}
          </span>
        </div>
        {appareils && (
          <div>
            <b>Offre</b>
            <strong>{appareils.plafond == null ? '—' : nb(appareils.plafond)}</strong>
            <span>
              {verdict.offreActuelle ? `appareils · ${verdict.offreActuelle}` : 'aucune offre définie'}
            </span>
          </div>
        )}
        {appareils && (
          <div className={verdict.etat === 'depasse' ? 'attention' : undefined}>
            <b>Refusés · {appareils.jours} j</b>
            <strong>{nb(appareils.refus)}</strong>
            <span>
              {appareils.refus_le
                ? `dernier ${relativeTime(appareils.refus_le)}`
                : 'aucun appareil refusé'}
            </span>
          </div>
        )}
      </div>

      {/* ⚠️ DEUX COLONNES AU-DELÀ DE 1180 px. Le travail à gauche — ce qu'on
          vient consulter et décider —, les références à droite : le code
          d'accès, qu'on lit une fois, et la fermeture, qu'on ne veut pas sur le
          chemin. Sans cela une rangée d'inventaire s'étale sur 1 440 px et son
          bouton se retrouve à l'autre bout de l'écran. */}
      <div className="fiche-colonnes">
      <div>

      {appareils && (
        // ⚠️ L'ANCRE EST CE QUE VISE L'E-MAIL. « Le changement se fait en ligne,
        // depuis la fiche du magasin » : le lien doit tomber sur la section, pas
        // en haut d'une page où il faut ensuite chercher.
        <section className="admin-section" id="appareils">
          <div className="admin-section-head">
            <div>
              <h2>Appareils</h2>
              <p className="section-note">
                Ce que votre offre couvre, et ce que le magasin a réellement demandé.
              </p>
            </div>
            <Link href="/tarifs" className="btn btn-ghost btn-sm">Voir les offres</Link>
          </div>

          {/* ⚠️ NI « PIC », NI « EN TRAIN DE COMPTER ». Le pic est parti le
              4 septembre 2026 — « un pic signifie que ça va redescendre après,
              donc pas d'intérêt de passer à la tranche supérieure » — et le
              décompte instantané le 5 : il vaut zéro dès que personne ne
              scanne, donc la plupart du temps quand on ouvre la page, et ce
              qu'il mesurait vraiment (le magasin tient-il dans son offre) est
              déjà dans les deux qui restent. Chacune mène à un geste. */}
          <div className="dash-stats dash-stats-5">
            {/* ⚠️ L'AMBRE SUIT LE VERDICT, PAS LE COMPTE. Les refus restent
                trente jours : après un passage à l'offre supérieure, la tuile
                serait restée ambre un mois durant pour un problème résolu — et
                une alerte qui persiste après le geste qui la règle est une
                alerte qu'on cesse de lire. Même famille que « un zéro ne porte
                aucune couleur ».
                ⚠️ Et le commentaire se pose AVANT la balise : entre deux
                attributs, il n'est pas du JSX valide. Troisième fois. */}
            <Stat
              label={`Refusés · ${appareils.jours} derniers jours`}
              value={nb(appareils.refus)}
              tone={verdict.etat === 'depasse' ? 'warn' : 'neutral'}
              sub={appareils.refus_le
                ? `dernier le ${new Date(appareils.refus_le).toLocaleDateString('fr-FR')}`
                : 'aucun appareil refusé'}
            />
            <Stat
              label="Votre offre"
              value={appareils.plafond == null ? '—' : nb(appareils.plafond)}
              sub={verdict.offreActuelle
                ? `appareils à la fois · ${verdict.offreActuelle}`
                : 'aucune offre définie'}
            />
          </div>

          {/* ⚠️ Le bandeau ne se déclenche PAS sur le pic — depuis que le
              verrou ferme la porte, le pic ne peut plus dépasser le plafond.
              Ce qui dit qu'une offre plus large est devenue nécessaire, c'est
              le nombre d'appareils éconduits. */}
          {offreEnCours && (
            <div className="signal signal-alerte">
              <div className="signal-txt">
                <strong>Un changement d’offre attend son paiement</strong>
                <div className="muted small">
                  {nb(offreEnCours.devices ?? 0)} appareils à la fois. L’offre change dès le
                  paiement ; rien n’est prélevé tant que vous n’avez pas réglé.
                </div>
              </div>
              <div className="req-actions">
                <ReprendrePaiement
                  requestId={offreEnCours.id}
                  devices={offreEnCours.devices}
                  billingPeriod={offreEnCours.billing_period}
                />
                <button type="button" className="link-btn danger-link" onClick={annulerOffre}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {!offreEnCours && verdict.etat === 'depasse' && verdict.proposition && (
            <div className="signal signal-alerte">
              <div className="signal-txt">
                <strong>
                  {nb(appareils.refus)} appareil{appareils.refus > 1 ? 's n’ont' : ' n’a'} pas pu
                  compter faute de place
                </strong>
                <div className="muted small">
                  {/* ⚠️ « JUSQU’À », JAMAIS « AU MOINS ». `besoin` majore — deux
                      appareils refusés à deux heures d’écart s’y additionnent
                      alors qu’ils n’étaient pas simultanés —, donc le vrai
                      besoin est AU PLUS ce chiffre. La première version écrivait
                      l’inverse. */}
                  Votre offre couvre {nb(appareils.plafond ?? 0)} appareils à la fois&nbsp;;
                  il en aurait fallu jusqu’à {nb(appareils.besoin)} pour que personne n’attende.
                  {' '}<strong>{verdict.proposition.nom}</strong> en couvre
                  {' '}{nb(verdict.proposition.couvre)}
                  {/* Le détail de l'addition quand elle dépasse un palier :
                      la page Stripe la décompose, notre écran doit l'annoncer. */}
                  {compositionOffre(verdict.proposition)
                    ? ` (${compositionOffre(verdict.proposition)})`
                    : ''}, pour
                  {' '}<span className="prix">{euros(verdict.proposition.mois)} par mois</span> ou
                  {' '}<span className="prix">{euros(verdict.proposition.an)} par an</span>.
                </div>
              </div>
              {/* ⚠️ LE CHANGEMENT SE FAIT ICI, PLUS SUR /tarifs. Le bouton
                  menait à la grille publique faute de mieux : le client y
                  relisait ce qu'il venait de lire, et devait nous écrire. Depuis
                  le 4 septembre 2026, l'offre est claire et le geste est en
                  libre-service. */}
              <PayerEnLigne
                offre={verdict.proposition}
                corps={{ action: 'offre', storeId, devices: verdict.proposition.couvre }}
                libelle={verdict.proposition.action}
                onApplique={charger}
              />
            </div>
          )}

          {/* ⚠️ ON NE RACONTE PAS AU CLIENT UNE HISTOIRE QU'ON NE CONNAÎT PAS.
              La première version disait « il a été ouvert avant que la licence
              ne se compte de cette façon » — vrai des magasins d'essai
              d'aujourd'hui, invérifiable pour un magasin réel dont le forfait
              manquerait pour une tout autre raison. On dit le fait, et ce qu'il
              change. */}
          {verdict.etat === 'sans_forfait' && (
            <p className="muted small">
              Ce magasin n’a pas d’offre en appareils. Les appareils sont comptés, aucun n’est
              refusé.
            </p>
          )}

          {verdict.etat === 'dans_le_forfait' && (
            <p className="muted small">
              Un appareil compte tant que quelqu’un a l’écran de comptage ou d’audit ouvert, et
              cesse de compter dès qu’il le referme. Le nombre de personnes dans l’équipe n’entre
              pas en ligne de compte.
            </p>
          )}

          {/* ⚠️ LE CHANGEMENT D'OFFRE EST LÀ DANS LES TROIS ÉTATS — c'est le
              constat de Julien du 5 septembre 2026 : le panneau de paiement
              n'existait que sous `etat === 'depasse'`, donc il fallait s'être
              heurté au verrou pour avoir le droit d'acheter. On n'avait
              construit que le chemin de la réaction, jamais celui de
              l'anticipation, qui est pourtant le cas normal.

              ⚠️ La seule exception est un changement DÉJÀ déposé : proposer
              d'acheter ce qu'on est en train d'acheter n'a pas de sens, et le
              serveur le refuserait (`deja_en_cours`). Le bandeau au-dessus
              porte alors les deux sorties — reprendre, ou annuler. */}
          {!offreEnCours && (
            <ChangerOffre
              storeId={storeId as string}
              plafond={appareils.plafond}
              invite={verdict.etat === 'depasse'
                ? 'Il vous en faut davantage\u00a0?'
                : 'Besoin de plus d’appareils pour un prochain inventaire\u00a0?'}
              libelle={verdict.etat === 'depasse' ? 'Choisir une autre offre' : 'Changer d’offre'}
              onApplique={charger}
            />
          )}
        </section>
      )}

      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Équipe</h2>
            <p className="section-note">
              Qui peut compter dans ce magasin. Les accès se gèrent depuis Mon équipe.
            </p>
          </div>
          <Link href="/equipe" className="btn btn-ghost btn-sm">Gérer l&apos;équipe</Link>
        </div>

        {/* Le compte vit sur la sous-section, plus dans le titre : c'est là
            qu'il sert à quelque chose. */}
        <div className="dash-sub">Superviseurs · {nb(fiche.supervisors.length)}</div>
        {fiche.supervisors.length === 0 ? (
          <p className="muted small">Aucun superviseur sur ce magasin.</p>
        ) : (
          <div className="req-list">
            {fiche.supervisors.map((p) => (
              <div className="req-row" key={p.id}>
                <div>
                  <div className="req-name">
                    {p.full_name || 'Sans nom'}
                    {p.is_company_admin && <span className="pill" style={{ marginLeft: 8 }}>Admin</span>}
                  </div>
                  <div className="muted small">{p.email}</div>
                </div>
                {!p.is_active && <span className="dash-badge dash-badge-counting"><span className="dash-dot" />Mot de passe à créer</span>}
              </div>
            ))}
          </div>
        )}

        <div className="dash-sub">Compteurs · {nb(fiche.counters.length)}</div>
        {fiche.counters.length === 0 ? (
          <p className="muted small">Aucun compteur sur ce magasin.</p>
        ) : (
          <div className="req-list">
            {fiche.counters.map((p) => (
              <div className="req-row" key={p.id}>
                <div>
                  <div className="req-name">{p.full_name || 'Sans nom'}</div>
                  <div className="muted small">
                    {p.email}
                    {/* L'activité affichée est celle de ce magasin : quelqu'un
                        qui compte beaucoup ailleurs n'y est pas actif ici. */}
                    {p.sessions_counted
                      ? ` · ${nb(p.sessions_counted)} inventaire${p.sessions_counted > 1 ? 's' : ''} ici · dernier comptage ${relativeTime(p.last_count_at)}`
                      : ' · n’a pas encore compté ici'}
                  </div>
                </div>
                {!p.is_active && <span className="dash-badge dash-badge-counting"><span className="dash-dot" />Mot de passe à créer</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Inventaires</h2>
            <p className="section-note">
              Ceux qui tournent, et ceux qui sont clôturés. Le rapport du magasin les additionne.
            </p>
          </div>
          <Link href={`/magasins/${storeId}/rapport`} className="btn btn-ghost btn-sm">
            Rapport du magasin
          </Link>
        </div>
        {fiche.sessions.length === 0 ? (
          <p className="muted">Aucun inventaire n&apos;a encore été lancé sur ce magasin.</p>
        ) : (
          <>
            {ouverts.length > 0 && (
              <>
                <div className="dash-sub">En cours</div>
                <div className="req-list">
                  {ouverts.map((s) => <LigneInventaire key={s.id} s={s} />)}
                </div>
              </>
            )}
            {clos.length > 0 && (
              <>
                <div className="dash-sub">Clôturés</div>
                <div className="req-list">
                  {clos.map((s) => <LigneInventaire key={s.id} s={s} />)}
                </div>
              </>
            )}
          </>
        )}
      </section>

      </div>

      <aside className="fiche-cote">

      {/* ⚠️ LE CODE D'ACCÈS DESCEND. Il ouvrait la page — or on le lit UNE FOIS
          par magasin, à la constitution de l'équipe, jamais à chaque visite.
          Ce qu'on vient voir, c'est l'activité et l'équipe ; le code est une
          référence, il se range avec les références. */}
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Code d&apos;accès</h2>
            <p className="section-note">
              Il ouvre l&apos;entrée dans le magasin&nbsp;: transmettez-le à une personne, jamais
              à un groupe.
            </p>
          </div>
        </div>
        <div className="acc-inv-row">
          <div className="cred-value">{fiche.store.join_code}</div>
          <button type="button" className="link-btn" onClick={() => copier(fiche.store.join_code)}>
            {copie ? 'Copié' : 'Copier le code'}
          </button>
        </div>
      </section>

      {/* ⚠️ CE QUI DÉTRUIT SORT DES CARTES. Cinq sections identiques dont la
          dernière efface le magasin et ses comptages : rien ne distinguait le
          geste grave des quatre autres. Il descend, perd sa surface, et se
          tient derrière un filet — c'est la DISTANCE qui protège, la
          confirmation ne vient qu'après. Même raisonnement que « Supprimer mon
          compte » éloigné de « Se déconnecter » le 28 août 2026. */}
      <section className="zone-sensible">
        {suppression ? (
          <div className="signal signal-alerte">
            <div className="signal-txt">
              <strong>Suppression demandée</strong>
              <div className="muted small">
                Envoyée le {new Date(suppression.created_at).toLocaleDateString('fr-FR')} ·
                {' '}Quantinvo vous recontacte. Le magasin continue de fonctionner jusqu&apos;à sa suppression.
              </div>
            </div>
            <button type="button" className="link-btn" onClick={() => annulerSuppression(suppression)}>
              Annuler la demande
            </button>
          </div>
        ) : (
          <>
            <div>
              <h3>Fermer ce magasin</h3>
              <p>
                Ses inventaires et tous leurs comptages seront effacés. Vous ne le supprimez pas
                vous-même&nbsp;: Quantinvo s&apos;en charge, comme pour la création.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => demanderSuppression(fiche.store.name)}
            >
              Demander la suppression
            </button>
          </>
        )}
      </section>

      </aside>
      </div>
    </AppShell>
  )
}
