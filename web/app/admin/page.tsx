'use client'

// Tableau de bord Quantinvo — l'entreprise avant la console.
//
// Refondu le 30 août 2026 dans la langue des tableaux de bord (maquette
// validée par Julien) : les chiffres d'affaires en tuiles — dont le revenu en
// attente, celui des ventes en cours —, les ventes elles-mêmes, le revenu
// annuel par entreprise en anneau, ce qui appelle un geste, et le journal des
// actions. Le trio d'usage (inventaires lancés, articles comptés, personnes
// actives) est parti sur /admin/usage — décision de Julien : ici les
// affaires, là-bas l'usage.
//
// Le revenu vient de la base, jamais d'une constante écrite ici : chaque
// magasin porte son tarif annuel (stores.annual_price_cents), les autres sont
// estimés au panier moyen — et l'anneau reprend EXACTEMENT la règle de la
// tuile (admin_revenu_par_entreprise), sinon deux versions du même chiffre.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { relativeTime } from '@/lib/format'
import {
  type VenteEnCours, alerteDensite, enAttenteCents, lienVente, lireVente, trierVentes,
} from '@/lib/pipeline'
import { Anneau, Kpi } from '@/components/dashboard/TableauDeBord'

type CompanyRef = { id: string; name: string }
type Overview = {
  companies: number
  companies_new_month: number
  stores: number
  arr_cents: number
  priced_stores: number
  default_price_cents: number
  active_stores_month: number
  sessions_month: number
  counts_month: number
  active_people_month: number
  companies_without_store: CompanyRef[]
  companies_without_admin: number
  pending_deletions: number
}
type RevenuEntreprise = { id: string; nom: string; revenu_cents: number }
type LigneJournalAdmin = {
  id: number; actor_label: string; action: string
  target_label: string; created_at: string
}

const nb = (n: number) => n.toLocaleString('fr-FR')
/** Un montant se lit en euros entiers : les centimes n'aident personne ici. */
const euros = (cents: number) =>
  Math.round(cents / 100).toLocaleString('fr-FR') + ' €'

/**
 * Les libellés du journal — les seize actions réellement écrites en base
 * (relevées le 30 août 2026). Une action sans libellé s'affiche en clair
 * plutôt que de disparaître, même règle que le journal d'entreprise.
 */
const ACTIONS_ADMIN: Record<string, string> = {
  magasin_ajoute: 'Magasin ajouté',
  magasin_supprime: 'Magasin supprimé',
  paiement_recu: 'Paiement reçu',
  demande_magasin_creee: 'Demande de magasin honorée',
  demande_magasin_paid: 'Demande de magasin réglée',
  devis_envoye: 'Devis envoyé',
  devis_magasin_envoye: 'Devis de magasin envoyé',
  entreprise_creee_depuis_demande: 'Entreprise créée depuis sa demande',
  entreprise_supprimee: 'Entreprise supprimée',
  entreprise_renommee: 'Entreprise renommée',
  admin_entreprise_invite: 'Administrateur d’entreprise invité',
  admin_entreprise_promu: 'Administrateur d’entreprise promu',
  admin_entreprise_revoque: 'Administrateur d’entreprise révoqué',
  compte_supprime: 'Compte supprimé',
  statut_demande_entreprise: 'Statut de demande modifié',
  demande_entreprise_supprimee: 'Demande d’entreprise supprimée',
}
const libelleAdmin = (action: string) =>
  ACTIONS_ADMIN[action] ?? action.replaceAll('_', ' ')

/** L'icône d'un rang de liste — au trait, comme partout. */
function Vignette({ forme }: { forme: 'euro' | 'alerte' | 'personne' | 'magasin' | 'journal' }) {
  const chemins = {
    euro: <><circle cx="12" cy="12" r="8" /><path d="M15 8.5a4 4 0 1 0 0 7" /><line x1="8" y1="10.8" x2="13" y2="10.8" /><line x1="8" y1="13.2" x2="13" y2="13.2" /></>,
    alerte: <><path d="M12 3 2.5 19.5h19L12 3z" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    personne: <><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
    magasin: <><path d="M3.5 9 5 4.5A1 1 0 0 1 6 4h12a1 1 0 0 1 .95.68L20.5 9" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /><path d="M9.5 20v-5h5v5" /></>,
    journal: <><path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></>,
  }
  return (
    <span className="tb-vignette" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        {chemins[forme]}
      </svg>
    </span>
  )
}

/**
 * Une vente en cours, sur un rang : qui, à quelle étape, et à qui le tour.
 * Le rang entier mène là où le geste se fait ; la pastille dit le tour.
 */
function RangVente({ vente }: { vente: VenteEnCours }) {
  const l = lireVente(vente)
  const densite = alerteDensite(vente)
  const quoi = vente.kind === 'company'
    ? 'Inscription'
    : vente.kind === 'store_removal' ? 'Suppression de magasin' : 'Ajout de magasin'
  const aNous = l.tour === 'nous' || l.retard
  return (
    <Link href={lienVente(vente)} className="tb-rang">
      <Vignette forme={aNous ? 'alerte' : 'euro'} />
      <div className="tb-rang-corps">
        <div className="tb-rang-titre">{vente.label} — {quoi.toLowerCase()}</div>
        <div className="tb-rang-sous">{l.etat}{vente.contact ? ` · ${vente.contact}` : ''}</div>
        {/* Le recoupement stock / surface, avant d'envoyer le devis : un
            appel à passer avant de chiffrer, pas une preuve. */}
        {densite && <div className="tb-rang-sous tb-rang-densite">{densite}</div>}
      </div>
      <div className="tb-rang-fin">
        {vente.quote_amount_cents != null && vente.status !== 'pending' && (
          <div className="tb-rang-valeur num">{euros(vente.quote_amount_cents)}</div>
        )}
        {aNous
          ? <span className="tb-attente">À nous — {l.geste}</span>
          : <span className="tb-rang-sous">Attend le client</span>}
      </div>
    </Link>
  )
}

export default function AdminPage() {
  const guard = useAuthGuard('admin')
  const [vue, setVue] = useState<Overview | null>(null)
  const [ventes, setVentes] = useState<VenteEnCours[]>([])
  const [revenu, setRevenu] = useState<RevenuEntreprise[]>([])
  const [journal, setJournal] = useState<LigneJournalAdmin[]>([])

  const charger = useCallback(async () => {
    // La vue d'affaires, la file des ventes, l'anneau du revenu, la trace :
    // quatre lectures distinctes, chacune est son propre objet.
    const [apercu, pipe, parts, trace] = await Promise.all([
      supabase.rpc('admin_business_overview'),
      supabase.rpc('admin_pipeline'),
      supabase.rpc('admin_revenu_par_entreprise'),
      supabase.rpc('admin_list_audit_log', { p_limit: 4 }),
    ])
    if (apercu.data) setVue(apercu.data as Overview)
    if (pipe.data) setVentes(trierVentes(pipe.data as VenteEnCours[]))
    if (parts.data?.entreprises) setRevenu(parts.data.entreprises as RevenuEntreprise[])
    if (trace.data) setJournal(trace.data as LigneJournalAdmin[])
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger()
  }, [guard.status, charger])

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const v = vue
  const rienASignaler = v
    && v.companies_without_store.length === 0
    && v.companies_without_admin === 0
    && v.pending_deletions === 0

  const aNous = ventes.filter((x) => lireVente(x).tour === 'nous')
  const auClient = ventes.filter((x) => lireVente(x).tour === 'client')
  const attente = enAttenteCents(ventes)

  return (
    <AppShell profile={guard.profile}>
      <div className="tb-plein">
      <div className="app-head">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-sub">Les ventes, le parc, et ce qui appelle un geste.</p>
        </div>
      </div>

      {!v ? (
        <div style={{ marginTop: 24 }}><SkeletonRows rows={3} height={110} /></div>
      ) : (
        <>
          <section className="tb-kpis tb-kpis-4">
            <Kpi
              nom="Entreprises clientes" icone="magasin" valeur={nb(v.companies)}
              refTexte={v.companies_new_month > 0 ? `+${nb(v.companies_new_month)} ce mois-ci` : undefined}
            />
            <Kpi
              nom="Magasins sous licence" icone="magasin" valeur={nb(v.stores)}
              refTexte={v.stores > 0
                ? `${nb(v.active_stores_month)} ${v.active_stores_month > 1 ? 'ont' : 'a'} compté ce mois-ci`
                : 'L’unité de facturation'}
            />
            <Kpi
              nom="Revenu annuel récurrent" icone="valeur" valeur={euros(v.arr_cents)}
              refTexte={v.stores === 0
                ? 'Aucun magasin sous licence'
                : v.priced_stores === v.stores
                  ? `${euros(Math.round(v.arr_cents / v.stores))} en moyenne par magasin`
                  : `${nb(v.stores - v.priced_stores)} magasin${v.stores - v.priced_stores > 1 ? 's' : ''} estimé${v.stores - v.priced_stores > 1 ? 's' : ''} à ${euros(v.default_price_cents)}`}
            />
            {/* ⚠️ Annualisé (2 septembre 2026) : un devis mensuel se règle par
                douzièmes, et sommer les échéances afficherait 1 200 € pour une
                affaire qui en vaut 14 400. Le calcul vit en base, dans
                `annuel_du_devis` — voir `lib/pipeline.ts`. */}
            <Kpi
              nom="Revenu en attente" icone="valeur" valeur={euros(attente)}
              refTexte={ventes.length > 0
                ? `${nb(ventes.length)} vente${ventes.length > 1 ? 's' : ''} en cours · à l’année`
                : 'Aucune vente en cours'}
            />
          </section>

          <section className="tb-graphes">
            <div className="panel tb-carte">
              <div className="tb-carte-tete">
                <h2>Ventes en cours</h2>
              </div>
              {ventes.length === 0 ? (
                <p className="tb-vide">
                  Aucune vente en cours. Les demandes d&apos;inscription et d&apos;ajout de
                  magasin apparaissent ici dès qu&apos;elles arrivent, et y restent
                  jusqu&apos;à la création.
                </p>
              ) : (
                <div className="tb-rangs">
                  {aNous.map((x) => <RangVente key={`${x.kind}-${x.id}`} vente={x} />)}
                  {auClient.map((x) => <RangVente key={`${x.kind}-${x.id}`} vente={x} />)}
                </div>
              )}
            </div>

            <Anneau
              titre="Revenu annuel par entreprise"
              parts={revenu.map((r) => ({
                nom: r.nom,
                brut: r.revenu_cents / 100,
                lien: `/admin/entreprise/${r.id}`,
              }))}
              format={(val) => Math.round(val).toLocaleString('fr-FR') + ' €'}
              sous="par an"
              vide={<>Aucune entreprise cliente pour l&apos;instant.</>}
            />
          </section>

          <section className="tb-listes">
            <div className="panel tb-carte">
              <div className="tb-carte-tete">
                <h2>À traiter</h2>
              </div>
              {rienASignaler ? (
                <p className="tb-vide">
                  Rien à signaler : chaque entreprise a au moins un magasin et un
                  administrateur.
                </p>
              ) : (
                <div className="tb-rangs">
                  {v.companies_without_store.map((c) => (
                    <Link href={`/admin/entreprise/${c.id}`} className="tb-rang" key={`sans-magasin-${c.id}`}>
                      <Vignette forme="alerte" />
                      <div className="tb-rang-corps">
                        <div className="tb-rang-titre">{c.name} n&apos;a aucun magasin</div>
                        <div className="tb-rang-sous">Donc aucune licence facturée</div>
                      </div>
                      <div className="tb-rang-fin"><span className="tb-rang-sous">Ouvrir la fiche</span></div>
                    </Link>
                  ))}
                  {v.companies_without_admin > 0 && (
                    <Link href="/admin/entreprises" className="tb-rang">
                      <Vignette forme="personne" />
                      <div className="tb-rang-corps">
                        <div className="tb-rang-titre">
                          {nb(v.companies_without_admin)} entreprise{v.companies_without_admin > 1 ? 's' : ''} sans administrateur
                        </div>
                        <div className="tb-rang-sous">Personne pour gérer leurs superviseurs</div>
                      </div>
                      <div className="tb-rang-fin"><span className="tb-rang-sous">Voir la liste</span></div>
                    </Link>
                  )}
                  {v.pending_deletions > 0 && (
                    <Link href="/admin/console" className="tb-rang">
                      <Vignette forme="personne" />
                      <div className="tb-rang-corps">
                        <div className="tb-rang-titre">
                          {nb(v.pending_deletions)} demande{v.pending_deletions > 1 ? 's' : ''} de suppression de compte
                        </div>
                        <div className="tb-rang-sous">En attente dans la console</div>
                      </div>
                      <div className="tb-rang-fin"><span className="tb-rang-sous">Ouvrir la console</span></div>
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div className="panel tb-carte">
              <div className="tb-carte-tete">
                <h2>Journal des actions</h2>
              </div>
              {journal.length === 0 ? (
                <p className="tb-vide">Aucune action enregistrée pour l&apos;instant.</p>
              ) : (
                <div className="tb-rangs">
                  {journal.map((l) => (
                    <div className="tb-rang" key={l.id}>
                      <Vignette forme="journal" />
                      <div className="tb-rang-corps">
                        <div className="tb-rang-titre">{libelleAdmin(l.action)} — {l.target_label || '—'}</div>
                        <div className="tb-rang-sous">{l.actor_label}</div>
                      </div>
                      <div className="tb-rang-fin">
                        <span className="tb-rang-sous">{relativeTime(l.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
      </div>
    </AppShell>
  )
}
