'use client'

// Mon équipe — les personnes, selon ce qu'on a le droit d'en faire.
//
// Un superviseur y gère ses compteurs, rangés par magasin comme le sont ses
// inventaires. Un administrateur d'entreprise voit en plus ses superviseurs :
// invitation (l'e-mail part par l'edge function ca-invite-supervisor),
// affectation aux magasins, retrait des accès, annulation d'invitation.
//
// Même écran, contenu selon le rôle — c'est ce qui évite deux pages qui se
// ressemblent. Chaque écriture passe par une RPC SECURITY DEFINER gardée
// côté base ; la garde client n'est que du confort.

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { AddCounter } from '@/components/dashboard/AddCounter'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { MenuActions, type ActionRangee } from '@/components/ui/MenuActions'
import { getMyCompany, type Company } from '@/lib/account'

type Store = { id: string; name: string }
type Member = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
  is_company_admin: boolean
  email: string | null
  is_active: boolean
  store_ids: string[]
  last_count_at: string | null
  sessions_counted: number
}
type Invitation = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  store_ids: string[]
  created_at: string
}
type TeamCA = { stores: Store[]; members: Member[]; invitations: Invitation[] }

type Counter = {
  id: string; full_name: string | null; email: string | null
  is_active: boolean; sessions_counted: number; last_count_at: string | null
}
type StoreTeam = { id: string; name: string; counters: Counter[] }
type TeamSup = { stores: StoreTeam[]; invitations: Invitation[] }

/** Date courte, comme sur la maquette : « 14/08 ». */
function jourCourt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

/** Pastille « le compte existe mais n'a pas encore servi ». */
function BadgeEnAttente() {
  return (
    <span className="dash-badge dash-badge-counting" style={{ marginLeft: 8 }}>
      <span className="dash-dot" />Mot de passe à créer
    </span>
  )
}

export default function EquipePage() {
  const guard = useAuthGuard('supervisor')
  const confirm = useConfirm()
  const [company, setCompany] = useState<Company | null>(null)
  const [ca, setCa] = useState<TeamCA | null>(null)
  const [sup, setSup] = useState<TeamSup | null>(null)
  const [mfaEnrolled, setMfaEnrolled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [filtre, setFiltre] = useState('')
  const [magasinFiltre, setMagasinFiltre] = useState('')
  const [profilFiltre, setProfilFiltre] = useState('')
  const [ajoutOuvert, setAjoutOuvert] = useState(false)

  const estAdmin = guard.status === 'ready' && !!guard.profile.is_company_admin

  const charger = useCallback(async (admin: boolean) => {
    const [c, s] = await Promise.all([
      getMyCompany().catch(() => null),
      supabase.rpc('my_team_by_store'),
    ])
    setCompany(c)
    if (!s.error && s.data) setSup(s.data as TeamSup)
    if (admin) {
      const { data, error } = await supabase.rpc('ca_list_team')
      if (!error && data) setCa(data as TeamCA)
    }
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger(!!guard.profile.is_company_admin)
    if (guard.profile.is_company_admin) {
      supabase.auth.mfa.listFactors().then(({ data }) => {
        setMfaEnrolled((data?.totp ?? []).some((f) => f.status === 'verified'))
      })
    }
  }, [guard, charger])

  async function rafraichir() { await charger(estAdmin) }

  async function inviterSuperviseur(firstName: string, lastName: string, email: string, storeIds: string[]) {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('ca-invite-supervisor', {
      body: { email, firstName, lastName, storeIds },
    })
    setBusy(false)
    if (error || !data?.success) {
      alert('Erreur : ' + (data?.error ?? error?.message ?? 'inconnue'))
      await rafraichir()
      return false
    }
    alert(`Invitation envoyée. ${data.email} reçoit un e-mail pour créer son mot de passe.`)
    await rafraichir()
    return true
  }

  /**
   * Ajouter un compteur — même edge function que l'application mobile.
   *
   * ⚠️ **Les magasins voyagent maintenant.** Le bloc « Ajouter un compteur »
   * du haut de page n'en proposait aucun, et une liste vide veut dire « tous
   * les magasins du superviseur ». Pour un administrateur d'entreprise, chaque
   * compteur ajouté d'ici recevait donc l'entreprise entière sans qu'on l'ait
   * décidé.
   */
  async function inviterCompteur(firstName: string, lastName: string, email: string, storeIds: string[]) {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('invite-teammate', {
      body: { firstName, lastName, email, storeIds },
    })
    setBusy(false)
    if (error || !data?.success) {
      alert('Erreur : ' + (data?.error ?? error?.message ?? 'inconnue'))
      return false
    }
    alert(
      data.emailSent
        ? `Invitation envoyée. ${firstName} ${lastName} reçoit un e-mail pour créer son mot de passe.`
        : data.alreadyInvited
          ? `${firstName} ${lastName} avait déjà été invité : le lien reçu précédemment reste valable.`
          : `${firstName} ${lastName} a été ajouté, mais l’e-mail n’a pas pu partir (${data.emailError ?? 'raison inconnue'}).`,
    )
    await rafraichir()
    return true
  }

  async function appliquer(fn: string, args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(fn, args)
    if (error || !data?.success) {
      alert('Erreur : ' + (error?.message ?? data?.error ?? 'inconnue'))
      return
    }
    rafraichir()
  }

  /**
   * Supprimer un compte de l'entreprise — administrateur d'entreprise seulement.
   *
   * « Retirer les accès » et « Supprimer le compte » sont voisins à l'écran et
   * n'ont rien de commun : le premier laisse le compte en vie, le second
   * l'efface. D'où la recopie du nom — un clic de travers ne doit pas suffire.
   *
   * Ce qui est dit dans la confirmation est ce que fait vraiment `ca_delete_user` :
   * les comptages sont conservés mais détachés, donc le rapport d'un inventaire
   * passé ne dira plus qui a compté ces lignes.
   */
  async function supprimerCompte(p: { id: string; full_name: string | null; email: string | null }) {
    const nom = (p.full_name ?? '').trim()
    const ok = await confirm({
      title: 'Supprimer définitivement ce compte ?',
      message: 'Cette suppression est définitive.',
      details: [
        `${nom || 'Sans nom'} — ${p.email ?? 'adresse inconnue'}`,
        'La personne perd l’accès à Quantinvo immédiatement.',
        'Ses comptages restent, mais son nom disparaît des rapports déjà faits.',
        'Ses invitations en cours sont annulées.',
      ],
      confirmLabel: 'Supprimer définitivement',
      tone: 'danger',
      requireText: nom || p.email || 'SUPPRIMER',
    })
    if (!ok) return
    appliquer('ca_delete_user', { p_user: p.id })
  }

  /**
   * Changer le rôle d'un membre — superviseur ⇄ compteur.
   *
   * Il n'existait aucun chemin : une personne embauchée compteur puis promue
   * chef de rayon devait être supprimée et réinvitée, en perdant au passage
   * l'attribution de ses comptages.
   *
   * ⚠️ **Ce n'est pas une case à cocher.** Le rôle décide de ce que la
   * personne voit et de ce qu'elle peut défaire ; la confirmation dit donc les
   * deux conséquences qui se remarquent — les magasins qui la suivent, et
   * l'accès aux inventaires qui change. Pas de recopie du nom en revanche :
   * c'est réversible d'un clic, contrairement à la suppression.
   */
  async function changerRole(m: Member, vers: 'supervisor' | 'employee') {
    const nom = m.full_name || 'Cette personne'
    const magasins = m.store_ids.length
    const details = vers === 'supervisor'
      ? [
          magasins > 0
            ? `${nom} garde ${magasins === 1 ? 'son magasin' : `ses ${magasins} magasins`}, mais en tant que superviseur.`
            : `${nom} n’a aucun magasin : affectez-lui-en un d’abord, un superviseur en a toujours au moins un.`,
          'Elle pourra créer des inventaires, importer les fichiers et gérer les compteurs de ses magasins.',
        ]
      : [
          magasins > 0
            ? `${nom} garde ${magasins === 1 ? 'son magasin' : `ses ${magasins} magasins`}, mais en tant que compteur.`
            : `${nom} n’a aucun magasin : elle restera sans accès tant qu’on ne lui en affecte pas un.`,
          'Elle ne pourra plus créer ni clôturer d’inventaire, y compris ceux qu’elle a créés.',
        ]
    const ok = await confirm({
      title: vers === 'supervisor' ? 'Passer cette personne superviseur ?' : 'Passer cette personne compteur ?',
      message: `${nom} — ${m.email ?? 'adresse inconnue'}`,
      details,
      confirmLabel: vers === 'supervisor' ? 'Passer superviseur' : 'Passer compteur',
    })
    if (!ok) return
    appliquer('ca_set_user_role', { p_user: m.id, p_role: vers })
  }

  /**
   * Les magasins d'une personne, quel que soit son rôle.
   *
   * ⚠️ **Deux tables, donc deux fonctions.** Un superviseur est rattaché par
   * `store_supervisors`, un compteur par `store_team`. Côté écran c'est le même
   * geste — des pastilles et un menu — et il doit le rester.
   *
   * Affecter un magasin à un compteur n'existait pas : on ne pouvait que lui en
   * retirer. Un compteur retiré de son dernier magasin devenait donc invisible
   * partout, et impossible à promouvoir.
   */
  function changerMagasins(m: Member, ids: string[]) {
    appliquer(
      m.role === 'supervisor' ? 'ca_set_supervisor_stores' : 'ca_set_counter_stores',
      { p_user: m.id, p_store_ids: ids },
    )
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const storeById: Record<string, Store> = {}
  for (const s of ca?.stores ?? []) storeById[s.id] = s

  /**
   * Pour l'administrateur, l'équipe se lit **personne par personne**, dans une
   * seule liste.
   *
   * Elle était coupée en deux — « Superviseurs » en cartes, « Compteurs » en
   * lignes — avec un formulaire d'invitation coincé entre les deux et une
   * recherche qui ne couvrait que les compteurs. Le rôle est devenu une
   * pastille sur la ligne et un filtre au-dessus : c'est ce qui distingue les
   * gens, pas ce qui doit les séparer en deux pages.
   *
   * Un superviseur ordinaire garde son rangement magasin par magasin : c'est
   * ainsi qu'il travaille, un saisonnier part d'un magasin et pas de tous.
   */
  const membres = estAdmin ? (ca?.members ?? []) : []
  const recherche = filtre.trim().toLowerCase()
  const membresFiltres = membres.filter((m) => {
    if (profilFiltre && m.role !== profilFiltre) return false
    // ⚠️ Le filtre par magasin ne cache pas les administrateurs : ils les ont
    // tous par construction, les retirer d'une liste filtrée laisserait croire
    // qu'ils n'y travaillent pas.
    if (magasinFiltre && !m.is_company_admin && !m.store_ids.includes(magasinFiltre)) return false
    if (!recherche) return true
    return (m.full_name ?? '').toLowerCase().includes(recherche)
      || (m.email ?? '').toLowerCase().includes(recherche)
  })
  const filtreActif = !!recherche || !!magasinFiltre || !!profilFiltre
  const effacerFiltres = () => { setFiltre(''); setMagasinFiltre(''); setProfilFiltre('') }
  const invitations = (estAdmin ? ca?.invitations : sup?.invitations) ?? []

  /**
   * Une personne, en colonnes.
   *
   * ⚠️ CE N'EST PAS UN CHANGEMENT DE DÉCOR. En rangées, chaque membre laissait
   * **918 px de vide** entre son nom et les boutons qui le concernent (mesuré
   * sur l'écran de Julien le 5 septembre 2026), et ses faits étaient noyés dans
   * une phrase grise. Or une équipe se COMPARE — qui est superviseur, qui n'a
   * jamais créé son mot de passe, qui couvre quel magasin : en colonnes on
   * balaie du regard, en phrases il faut lire chaque rangée pour en extraire la
   * même chose.
   *
   * Les cinq cellules sont des frères directs de la grille `.membres` : un
   * conteneur par rangée casserait l'alignement des colonnes.
   */
  const rangMembre = (m: Member) => {
    const superviseur = m.role === 'supervisor'
    // Sa propre ligne et celle d'un autre administrateur n'ont aucune action :
    // ces comptes-là restent chez Quantinvo.
    const intouchable = m.is_company_admin || m.id === guard.profile.id
    const actions: ActionRangee[] = intouchable ? [] : [
      {
        libelle: superviseur ? 'Passer compteur' : 'Passer superviseur',
        onClick: () => changerRole(m, superviseur ? 'employee' : 'supervisor'),
      },
      ...(superviseur ? [{
        libelle: 'Retirer les accès',
        onClick: async () => {
          const ok = await confirm({
            title: 'Retirer tous les accès ?',
            message: `${m.full_name || 'Cette personne'} garde son compte, mais n’aura plus accès à aucun magasin.`,
            confirmLabel: 'Retirer les accès',
          })
          if (ok) appliquer('ca_remove_supervisor', { p_user: m.id })
        },
      }] : []),
      // ⚠️ La suppression garde sa recopie du nom : le menu déplace un bouton,
      // il n'allège aucun garde-fou.
      { libelle: 'Supprimer le compte', onClick: () => supprimerCompte(m), destructif: true },
    ]
    return (
      <Fragment key={m.id}>
        <div>
          <div className="membres-nom">
            {m.full_name || 'Sans nom'}
            {m.id === guard.profile.id && <span className="pill pill-vous">Vous</span>}
          </div>
          <div className="membres-mail">{m.email}</div>
        </div>

        <div>
          {m.is_company_admin
            ? <span className="pill">Admin</span>
            : <span className="pill pill-role">{superviseur ? 'Superviseur' : 'Compteur'}</span>}
        </div>

        <div className="membres-cell">
          {/* Un administrateur a tous les magasins par construction : ses
              affectations ne se modifient pas, une croix qui ne marche pas
              est pire que pas de croix. */}
          {m.is_company_admin ? (
            <>Tous les magasins{m.store_ids.length > 0 ? ` (${m.store_ids.length})` : ''}</>
          ) : (
            <div className="store-sup">
              {m.store_ids.length === 0 && <span className="muted small">Aucun magasin</span>}
              {m.store_ids.map((sid) => (
                <span className="chip" key={sid}>
                  {storeById[sid]?.name || 'Magasin'}
                  <button
                    className="chip-x"
                    aria-label={`Retirer du magasin ${storeById[sid]?.name || ''}`}
                    onClick={() => changerMagasins(m, m.store_ids.filter((x) => x !== sid))}
                  >×</button>
                </span>
              ))}
              {(ca?.stores ?? []).some((s) => !m.store_ids.includes(s.id)) && (
                <select
                  className="store-sup-select"
                  value=""
                  aria-label={`Affecter un magasin à ${m.full_name || 'cette personne'}`}
                  onChange={(e) => {
                    if (!e.target.value) return
                    changerMagasins(m, [...m.store_ids, e.target.value])
                  }}
                >
                  <option value="">+ Affecter un magasin</option>
                  {(ca?.stores ?? []).filter((s) => !m.store_ids.includes(s.id)).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* ⚠️ `is_active` veut dire « s'est déjà connecté », rien d'autre — le
            contresens corrigé le 23 août 2026. C'est le seul fait de cette
            colonne qui appelle un geste, donc le seul qui porte l'ambre. */}
        <div className={`membres-cell${!m.is_active ? ' attente' : ''}`}>
          {!m.is_active
            ? 'Mot de passe à créer'
            : m.sessions_counted > 0
              ? `${m.sessions_counted} inventaire${m.sessions_counted > 1 ? 's' : ''}${m.last_count_at ? ` · ${jourCourt(m.last_count_at)}` : ''}`
              : 'Pas encore de comptage'}
        </div>

        <div className="membres-fin">
          {intouchable
            ? <span className="muted small">Géré par Quantinvo</span>
            : <MenuActions libelle={`Actions pour ${m.full_name || 'cette personne'}`} actions={actions} />}
        </div>
      </Fragment>
    )
  }

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <div>
          <h1 className="page-title">Mon équipe</h1>
          <p className="page-sub">
            {estAdmin
              ? 'Qui travaille dans votre entreprise, et sur quels magasins.'
              : 'Les personnes qui comptent dans vos magasins.'}
          </p>
        </div>
        {/* Une seule porte pour l'administrateur : le rôle se choisit dans le
            panneau. Un superviseur ordinaire n'ajoute que des compteurs. */}
        {estAdmin ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setAjoutOuvert((v) => !v)}
          >
            {ajoutOuvert ? 'Fermer' : '+ Ajouter une personne'}
          </button>
        ) : (
          <AddCounter onAdded={rafraichir} />
        )}
      </div>

      {estAdmin && !mfaEnrolled && (
        <div className="banner banner-warn">
          Vous gérez les accès de l&apos;entreprise&nbsp;: protégez votre compte avec la double
          authentification, depuis <Link href="/account" style={{ textDecoration: 'underline' }}>Mon compte</Link>.
        </div>
      )}

      {estAdmin && ajoutOuvert && (
        <AjouterPersonne
          stores={ca?.stores ?? []}
          membres={membres}
          moi={guard.profile.id}
          busy={busy}
          onCompteur={inviterCompteur}
          onSuperviseur={inviterSuperviseur}
          onFermer={() => setAjoutOuvert(false)}
        />
      )}

      {/* ⚠️ La bande compte ce que `ca_company_overview` a déjà rendu — aucun
          appel de plus. L'ambre n'y désigne que les mots de passe jamais créés :
          c'est le seul fait de cette page qui appelle un geste, et `is_active`
          veut dire « s'est déjà connecté », rien d'autre (23 août 2026). */}
      {estAdmin && membres.length > 0 && (
        <div className="resume-bande">
          <div>
            <strong className="num">{membres.length}</strong>
            <span>Personne{membres.length > 1 ? 's' : ''}</span>
          </div>
          <div>
            <strong className="num">{membres.filter((m) => m.role === 'supervisor').length}</strong>
            <span>Superviseurs</span>
          </div>
          <div>
            <strong className="num">{membres.filter((m) => m.role === 'employee').length}</strong>
            <span>Compteurs</span>
          </div>
          <div className={membres.some((m) => !m.is_active) ? 'attention' : undefined}>
            <strong className="num">{membres.filter((m) => !m.is_active).length}</strong>
            <span>Mot de passe à créer</span>
          </div>
        </div>
      )}

      {estAdmin ? (
        <>
          {/* ── Invitations en attente, en tête ──
              C'est la seule chose de cette page qui attend un geste : elle passe
              devant, comme « Ventes en cours » sur la console. Quand il n'y en a
              aucune, la section disparaît et la page s'ouvre sur les filtres. */}
          {invitations.length > 0 && (
            <section className="admin-section">
              <div className="admin-section-head">
                <div>
                  <h2>Invitations en attente</h2>
                  <p className="section-note">
                    Ces personnes ont reçu un lien et n’ont pas encore créé leur compte.
                  </p>
                </div>
                <span className="dash-sub-n">{invitations.length}</span>
              </div>
              <div className="req-list">
                {invitations.map((i) => (
                  <div className="req-row req-row-block req-row-attente" key={i.id}>
                    <div>
                      <div className="req-name">
                        {i.first_name} {i.last_name}
                        <span className="pill pill-role">
                          {i.role === 'company_admin' ? 'Admin' : i.role === 'supervisor' ? 'Superviseur' : 'Compteur'}
                        </span>
                      </div>
                      <div className="muted small">
                        {i.email} · envoyée le {jourCourt(i.created_at)}
                        {i.store_ids.length > 0 && ` · ${i.store_ids.length} magasin${i.store_ids.length > 1 ? 's' : ''}`}
                      </div>
                      {i.store_ids.length > 0 && (
                        <div className="store-sup" style={{ marginTop: 6 }}>
                          {i.store_ids.map((sid) => (
                            <span className="chip" key={sid}>{storeById[sid]?.name || 'Magasin'}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="req-actions">
                      <button
                        className="link-btn danger-link"
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Annuler cette invitation ?',
                            message: `${i.first_name} ${i.last_name} ne pourra plus créer son compte avec le lien reçu.`,
                            confirmLabel: 'Annuler l’invitation',
                            tone: 'danger',
                          })
                          if (ok) appliquer('ca_cancel_invitation', { p_id: i.id })
                        }}
                      >Annuler l&apos;invitation</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Membres : une seule liste, le rôle en colonne ── */}
          <section className="admin-section">
            <div className="admin-section-head">
              <div>
                <h2>Membres</h2>
                <p className="section-note">
                  Le rôle décide de ce que la personne peut faire&nbsp;; les magasins,
                  de ce qu’elle voit.
                </p>
              </div>
              <span className="dash-sub-n">
                {filtreActif ? `${membresFiltres.length} sur ${membres.length}` : membres.length}
              </span>
            </div>

          <div className="toolbar">
            <div className="champ-borne">
              <input
                type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)}
                placeholder="Rechercher une personne…"
                aria-label="Rechercher une personne"
              />
            </div>
            <select
              value={magasinFiltre}
              onChange={(e) => setMagasinFiltre(e.target.value)}
              aria-label="Filtrer par magasin"
            >
              <option value="">Tous les magasins</option>
              {(ca?.stores ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={profilFiltre}
              onChange={(e) => setProfilFiltre(e.target.value)}
              aria-label="Filtrer par type de profil"
            >
              <option value="">Tous les profils</option>
              <option value="supervisor">Superviseurs</option>
              <option value="employee">Compteurs</option>
            </select>
            {filtreActif && (
              <button className="link-btn" onClick={effacerFiltres}>Effacer les filtres</button>
            )}
          </div>

          {membres.length === 0 ? (
            <p className="muted">Personne dans votre entreprise pour l&apos;instant.</p>
          ) : membresFiltres.length === 0 ? (
            <p className="muted small">Personne ne correspond à cette recherche.</p>
          ) : (
            <div className="membres">
              <div className="membres-th">Personne</div>
              <div className="membres-th">Rôle</div>
              <div className="membres-th">Magasins</div>
              <div className="membres-th">Activité</div>
              <div className="membres-th" />
              {membresFiltres.map(rangMembre)}
            </div>
          )}
          </section>
        </>
      ) : (sup?.stores ?? []).length === 0 ? (
        <section className="admin-section">
          <h2>Compteurs</h2>
          <p className="muted">Vous n&apos;êtes affecté à aucun magasin.</p>
        </section>
      ) : (
        // Le superviseur ordinaire garde son rangement MAGASIN PAR MAGASIN
        // (23 août 2026) : c'est ainsi qu'il travaille, un saisonnier part d'un
        // magasin et pas de tous. Une section par magasin, au lieu d'un
        // sous-titre en capitales plus petit que le texte qu'il coiffait.
        (sup?.stores ?? []).map((s) => (
          <section className="admin-section" key={s.id}>
            <div className="admin-section-head">
              <div>
                <h2>{s.name}</h2>
                <p className="section-note">
                  Les compteurs de ce magasin. Les retirer d’ici ne touche pas aux autres.
                </p>
              </div>
              <span className="dash-sub-n">{s.counters.length}</span>
            </div>
            {s.counters.length === 0 ? (
              <p className="muted small">Aucun compteur sur ce magasin.</p>
            ) : (
              <div className="req-list">
                {s.counters.map((c) => (
                  <div className="req-row" key={c.id}>
                    <div>
                      <div className="req-name">
                        {c.full_name || 'Sans nom'}
                        {!c.is_active && <BadgeEnAttente />}
                      </div>
                      <div className="muted small">
                        {c.email}
                        {c.sessions_counted > 0
                          ? ` · a compté ${c.sessions_counted} inventaire${c.sessions_counted > 1 ? 's' : ''}`
                          : ' · pas encore de comptage'}
                        {c.last_count_at && ` · dernier le ${jourCourt(c.last_count_at)}`}
                      </div>
                    </div>
                    <div className="req-actions">
                      {/* Le geste quotidien du superviseur : un saisonnier part,
                          il le retire de SON magasin — pas de partout. */}
                      <button
                        className="link-btn"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Retirer du magasin ${s.name} ?`,
                            message: `${c.full_name || 'Cette personne'} garde son compte : elle n’aura plus accès aux inventaires de ce magasin.`,
                            confirmLabel: 'Retirer du magasin',
                          })
                          if (ok) appliquer('remove_counter_from_store', { p_user: c.id, p_store_id: s.id })
                        }}
                      >Retirer du magasin</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {/* ── Invitations en cours ──
          Pour le superviseur ordinaire seulement : celles de l'administrateur
          sont passées en tête de page, là où elles attendent un geste. ── */}
      {!estAdmin && (sup?.invitations ?? []).length > 0 && (
        <section className="admin-section">
          <div className="admin-section-head">
            <div>
              <h2>Invitations en cours</h2>
              <p className="section-note">
                Ces personnes ont reçu un lien et n’ont pas encore créé leur compte.
              </p>
            </div>
            <span className="dash-sub-n">{(sup?.invitations ?? []).length}</span>
          </div>
          <div className="req-list">
            {(sup?.invitations ?? []).map((i) => (
              <div className="req-row" key={i.id}>
                <div>
                  <div className="req-name">
                    {i.first_name} {i.last_name}{' '}
                    <span className="pill">
                      {i.role === 'company_admin' ? 'Admin' : i.role === 'supervisor' ? 'Superviseur' : 'Compteur'}
                    </span>
                  </div>
                  <div className="muted small">{i.email}</div>
                </div>
                {/* L'administrateur annule toute invitation de son entreprise ;
                    un superviseur annule celles qu'il a envoyées — une adresse
                    mal tapée doit pouvoir se rattraper. */}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Annuler cette invitation ?',
                      message: `${i.first_name} ${i.last_name} ne recevra pas d’accès. Vous pourrez l’inviter à nouveau.`,
                      confirmLabel: 'Annuler l’invitation',
                      cancelLabel: 'Revenir',
                    })
                    if (ok) appliquer('cancel_my_invitation', { p_id: i.id })
                  }}
                >Annuler</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  )
}

/**
 * Ajouter une personne — une seule porte pour les deux rôles.
 *
 * Il y avait deux chemins : un bouton « Ajouter un compteur » dans l'en-tête,
 * et un formulaire « Inviter un superviseur » déplié en permanence au milieu de
 * la page, entre les deux listes qu'il séparait. Mêmes champs, deux formes,
 * deux endroits — et rien qui dise pourquoi.
 *
 * Le rôle se choisit sur deux cartes plutôt que dans un menu : ce n'est pas un
 * réglage parmi d'autres, c'est ce qui décide de tout le reste — de la fonction
 * appelée jusqu'à l'obligation d'un magasin.
 */
function AjouterPersonne({
  stores, membres, moi, busy, onCompteur, onSuperviseur, onFermer,
}: {
  stores: Store[]
  membres: Member[]
  moi: string
  busy: boolean
  onCompteur: (firstName: string, lastName: string, email: string, storeIds: string[]) => Promise<boolean>
  onSuperviseur: (firstName: string, lastName: string, email: string, storeIds: string[]) => Promise<boolean>
  onFermer: () => void
}) {
  const [role, setRole] = useState<'employee' | 'supervisor'>('employee')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [superviseur, setSuperviseur] = useState('')

  /**
   * Un compteur compte **pour quelqu'un**, dans le magasin de ce quelqu'un.
   *
   * Sans ce choix, l'administrateur cochait n'importe quel magasin de
   * l'entreprise — y compris un magasin que personne ne supervise. Le compteur
   * existait alors sans apparaître dans le « Mon équipe » de qui que ce soit.
   *
   * ⚠️ **Le superviseur choisi ne s'enregistre nulle part** (décision de
   * Julien, option A) : « le superviseur d'un compteur » n'existe pas en base,
   * c'est le magasin qui relie les deux. Ce menu ne fait que restreindre la
   * liste en dessous. Si le superviseur quitte le magasin, le compteur y reste
   * et passe sous la responsabilité de celui qui le reprend — on encadre un
   * magasin, pas des personnes.
   */
  const superviseurs = membres.filter((m) => m.role === 'supervisor')
  // Un administrateur d'entreprise a tous les magasins par construction.
  const magasinsDe = (m: Member) => (m.is_company_admin ? stores.map((s) => s.id) : m.store_ids)
  const choisi = superviseurs.find((m) => m.id === superviseur) ?? null
  const magasinsProposes = role === 'supervisor'
    ? stores
    : choisi
      ? stores.filter((s) => magasinsDe(choisi).includes(s.id))
      : []

  function changerSuperviseur(id: string) {
    setSuperviseur(id)
    const m = superviseurs.find((x) => x.id === id)
    const ids = m ? magasinsDe(m) : []
    // Un seul magasin : rien à choisir, la question a déjà sa réponse. Même
    // règle que la création d'inventaire dans l'application.
    setSelected(ids.length === 1 ? ids : [])
  }

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  // Un superviseur a toujours au moins un magasin — la base le refuse sinon
  // (migration 20260823100001). Le dire avant l'envoi vaut mieux qu'après.
  // Un compteur aussi, désormais : la liste vide voulait dire « tous les
  // magasins », ce qui donnait l'entreprise entière à chaque ajout.
  const superviseurManquant = role === 'employee' && !choisi
  const magasinManquant = selected.length === 0
  const incomplet = !firstName.trim() || !lastName.trim() || !email.trim()
    || superviseurManquant || magasinManquant

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (incomplet) return
    const envoyer = role === 'supervisor' ? onSuperviseur : onCompteur
    const ok = await envoyer(firstName.trim(), lastName.trim(), email.trim().toLowerCase(), selected)
    if (ok) {
      setFirstName(''); setLastName(''); setEmail('')
      setSelected([]); setSuperviseur(''); onFermer()
    }
  }

  return (
    <form onSubmit={submit} className="panel">
      <h3>Ajouter une personne</h3>

      <div className="role-choix" style={{ marginTop: 14 }}>
        <button
          type="button"
          className={`role-carte${role === 'employee' ? ' on' : ''}`}
          aria-pressed={role === 'employee'}
          onClick={() => { setRole('employee'); setSelected([]); setSuperviseur('') }}
        >
          <span className="role-radio" />
          <span>
            <span className="role-nom">Compteur</span>
            <span className="role-quoi" style={{ display: 'block' }}>
              Scanne sur le terrain, depuis l&apos;application.
            </span>
          </span>
        </button>
        <button
          type="button"
          className={`role-carte${role === 'supervisor' ? ' on' : ''}`}
          aria-pressed={role === 'supervisor'}
          onClick={() => { setRole('supervisor'); setSelected([]); setSuperviseur('') }}
        >
          <span className="role-radio" />
          <span>
            <span className="role-nom">Superviseur</span>
            <span className="role-quoi" style={{ display: 'block' }}>
              Prépare les inventaires, gère les compteurs de ses magasins.
            </span>
          </span>
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="champ-label">Identité</div>
        <div className="inline-form" style={{ flexWrap: 'wrap' }}>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" style={{ minWidth: 140 }} />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" style={{ minWidth: 140 }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Adresse e-mail" type="email" style={{ minWidth: 220 }} />
        </div>
      </div>

      {/* ── Superviseur, puis ses magasins ──
          Les deux champs qui dépendent l'un de l'autre sont voisins : on
          choisit le superviseur, la liste se remplit juste en dessous. Un
          superviseur, lui, ne compte pour personne : le menu ne le concerne
          pas. ── */}
      {role === 'employee' && (
        <div style={{ marginTop: 18 }}>
          <div className="champ-label">Superviseur</div>
          {superviseurs.length === 0 ? (
            <>
              <div className="vide-cadre">
                Votre entreprise n&apos;a encore aucun superviseur. Un compteur compte toujours
                pour quelqu&apos;un&nbsp;: commencez par en inviter un.
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => { setRole('supervisor'); setSelected([]); setSuperviseur('') }}
              >Inviter un superviseur</button>
            </>
          ) : (
            <select
              className="champ-select"
              value={superviseur}
              onChange={(e) => changerSuperviseur(e.target.value)}
              aria-label="Superviseur de ce compteur"
            >
              <option value="">Choisir le superviseur de ce compteur…</option>
              {superviseurs.map((m) => {
                const n = magasinsDe(m).length
                return (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.email || 'Sans nom'}
                    {m.id === moi ? ' (vous)' : ''}
                    {' — '}
                    {m.is_company_admin ? 'tous les magasins' : `${n} magasin${n > 1 ? 's' : ''}`}
                  </option>
                )
              })}
            </select>
          )}
        </div>
      )}

      {(role === 'supervisor' || superviseurs.length > 0) && stores.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="champ-label">
            Magasins <span className="obligatoire">· au moins un</span>
          </div>
          {magasinsProposes.length === 0 ? (
            <div className="vide-cadre">
              Choisissez d&apos;abord un superviseur&nbsp;: les magasins proposés seront les siens.
            </div>
          ) : (
            <>
              <div className="chips" style={{ marginBottom: 0 }}>
                {magasinsProposes.map((s) => (
                  <label key={s.id} className="chip" style={{ cursor: 'pointer', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={() => toggle(s.id)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
              {/* Un magasin absent de la liste se remarque : le dire évite de
                  chercher un défaut là où il y a une règle. */}
              {choisi && magasinsProposes.length < stores.length && (
                <p className="muted small" style={{ marginTop: 8 }}>
                  Les autres magasins de l&apos;entreprise ne sont pas proposés&nbsp;:
                  {' '}{choisi.full_name || 'cette personne'} ne les supervise pas.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 18 }}>
        <button className="btn btn-primary" disabled={busy || incomplet}>
          Envoyer l&apos;invitation
        </button>
        <button type="button" className="btn btn-ghost" onClick={onFermer}>Annuler</button>
      </div>

      <p className="muted small" style={{ marginTop: 12 }}>
        {role === 'supervisor'
          ? 'La personne reçoit un e-mail pour vérifier ses informations et choisir son mot de passe. Un superviseur a toujours au moins un magasin.'
          : 'La personne reçoit un e-mail pour vérifier ses informations et choisir son mot de passe. Le superviseur choisi ne sert qu’à trouver le bon magasin : c’est le magasin qui donne l’accès.'}
      </p>
    </form>
  )
}
