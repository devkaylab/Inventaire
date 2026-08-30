'use client'

// Tableau de bord de l'entreprise — l'écran d'accueil de son administrateur.
//
// Refondu le 30 août 2026 dans la langue des tableaux de bord (maquette
// validée par Julien) : les cinq indicateurs en tuiles, les comptages par
// jour de TOUTE l'entreprise, l'écart par magasin — il pilote des magasins,
// pas des inventaires —, les derniers inventaires et l'activité récente.
//
// Les agrégats viennent de `tableau_de_bord_superviseur` : l'administrateur
// est un superviseur dont le périmètre couvre l'entreprise entière, et deux
// écrans qui montrent le même chiffre doivent le calculer pareil. L'écart
// suit donc la même règle que le rapport, groupé par magasin côté serveur.
//
// L'activité vient du journal, qui reste global : rien de ce que
// `company_audit_log` enregistre ne porte de magasin.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { Renommer } from '@/components/ui/Renommer'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { type ApercuEntreprise } from '@/lib/entreprise'
import { libelleAction, type LigneJournal } from '@/lib/journal'
import { money, nb, relativeTime, fmtDate } from '@/lib/format'
import { STATUS_LABELS } from '@/lib/inventory'
import {
  Anneau, BarresSemaine, Kpi, lundiDeLaSemaine, type JourTb,
} from '@/components/dashboard/TableauDeBord'

type EcartMagasin = { store_id: string | null; nom: string; ecart_qte: number; ecart_valeur: number }
type DernierTb = {
  session_id: string; nom: string; magasin: string; numero: string
  statut: string; cree_le: string; pieces: number; valeur: number
}
type TbEntreprise = {
  semaine_debut: string
  par_jour: JourTb[]
  ecarts_magasins: EcartMagasin[]
  derniers: DernierTb[]
}

export default function EntreprisePage() {
  const guard = useAuthGuard('supervisor')
  const [vue, setVue] = useState<ApercuEntreprise | null>(null)
  const [journal, setJournal] = useState<LigneJournal[]>([])
  const [tb, setTb] = useState<TbEntreprise | null>(null)
  const [semaine, setSemaine] = useState(0)
  const [mesureBarres, setMesureBarres] = useState<'pieces' | 'valeur'>('pieces')
  const [mesureEcarts, setMesureEcarts] = useState<'valeur' | 'qte'>('valeur')
  const [chargement, setChargement] = useState(true)
  const [pret, setPret] = useState(false)

  const charger = useCallback(async () => {
    const [apercu, lignes] = await Promise.all([
      supabase.rpc('ca_company_overview'),
      supabase.rpc('ca_list_audit_log', { p_limit: 4 }),
    ])
    if (apercu.data) setVue(apercu.data as ApercuEntreprise)
    if (lignes.data) setJournal(lignes.data as LigneJournal[])
    setPret(true)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    // Un superviseur ordinaire n'a rien à faire ici : la RPC le refuserait de
    // toute façon, cette garde lui évite un écran en erreur.
    if (!guard.profile.is_company_admin) { window.location.replace('/dashboard'); return }
    charger()
  }, [guard, charger])

  useEffect(() => {
    if (guard.status !== 'ready' || !guard.profile.is_company_admin) return
    let actif = true
    setChargement(true)
    supabase
      .rpc('tableau_de_bord_superviseur', { p_semaine: lundiDeLaSemaine(semaine) })
      .then(({ data }) => {
        if (!actif) return
        if (data) setTb(data as TbEntreprise)
        setChargement(false)
      })
    return () => { actif = false }
  }, [guard, semaine])

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const t = vue?.totals

  return (
    <AppShell profile={guard.profile} companyName={vue?.company.name}>
      <div className="tb-plein">
      <div className="app-head">
        <div>
          {/* Réservé à l'administrateur d'entreprise (redirection plus haut).
              Son entreprise porte son nom : il doit pouvoir le corriger sans
              nous écrire. */}
          {vue?.company.name ? (
            <Renommer
              nom={vue.company.name}
              label="votre entreprise"
              className="page-title"
              onValider={async (nom) => {
                const { data, error } = await supabase.rpc('ca_rename_company', { p_name: nom })
                if (error || !data?.success) return error?.message ?? data?.error ?? 'Renommage impossible.'
                await charger()
                return null
              }}
            />
          ) : (
            <h1 className="page-title">Mon entreprise</h1>
          )}
          <p className="page-sub">Tableau de bord</p>
        </div>
      </div>

      {!pret ? (
        <div style={{ marginTop: 24 }}><SkeletonRows rows={3} height={110} /></div>
      ) : !t ? (
        <EmptyState
          title="Tableau de bord indisponible"
          hint="Rechargez la page dans un instant."
        />
      ) : (
        <>
          <section className="tb-kpis tb-kpis-5">
            <Kpi
              nom="Magasins" icone="magasin" valeur={nb(t.stores)}
              refTexte={t.store_requests > 0
                ? `${nb(t.store_requests)} demande${t.store_requests > 1 ? 's' : ''} en attente chez Quantinvo`
                : undefined}
            />
            <Kpi
              nom="Inventaires en cours" icone="pieces" valeur={nb(t.sessions_open)}
              refTexte={`${nb(t.sessions_month)} lancé${t.sessions_month > 1 ? 's' : ''} ce mois-ci`}
            />
            <Kpi
              nom="Personnes" icone="equipe" valeur={nb(t.people)}
              refTexte={`${nb(t.supervisors)} superviseur${t.supervisors > 1 ? 's' : ''} · ${nb(t.counters)} compteur${t.counters > 1 ? 's' : ''}`}
            />
            <Kpi
              nom="Ont compté aujourd’hui" icone="actif" valeur={nb(t.active_today)}
              refTexte={t.never_signed_in > 0
                ? `${nb(t.never_signed_in)} mot${t.never_signed_in > 1 ? 's' : ''} de passe à créer`
                : 'Tout le monde s’est déjà connecté'}
            />
            <Kpi nom="Pièces comptées ce mois-ci" icone="clotures" valeur={nb(t.pieces_month)} />
          </section>

          {tb && (
            <section className="tb-graphes">
              <BarresSemaine
                jours={tb.par_jour}
                mesure={mesureBarres}
                onMesure={setMesureBarres}
                semaine={semaine}
                onSemaine={setSemaine}
                enChargement={chargement}
                format={{ pieces: (v) => `${nb(v)} pièces`, valeur: (v) => `${money(v)} €` }}
              />
              <Anneau
                titre="Écart par magasin"
                entetes={
                  <div className="tb-segmente" role="group" aria-label="Mesure de l’écart">
                    <button type="button" aria-pressed={mesureEcarts === 'valeur'} className={mesureEcarts === 'valeur' ? 'choisi' : ''} onClick={() => setMesureEcarts('valeur')}>Valeur</button>
                    <button type="button" aria-pressed={mesureEcarts === 'qte'} className={mesureEcarts === 'qte' ? 'choisi' : ''} onClick={() => setMesureEcarts('qte')}>Quantité</button>
                  </div>
                }
                parts={tb.ecarts_magasins.map((m) => ({
                  nom: m.nom,
                  brut: mesureEcarts === 'valeur' ? m.ecart_valeur : m.ecart_qte,
                  lien: m.store_id ? `/magasins/${m.store_id}` : undefined,
                }))}
                format={(v) => (mesureEcarts === 'valeur' ? `${money(v)} €` : nb(v))}
                sous="sur 30 jours"
                note="Parts en écart absolu"
                vide={<>Aucun écart sur 30 jours. Seuls les inventaires avec un stock théorique importé entrent dans ce calcul.</>}
              />
            </section>
          )}

          <section className="tb-listes">
            <div className="panel tb-carte">
              <div className="tb-carte-tete">
                <h2>Derniers inventaires</h2>
                <Link href="/inventaires" className="tb-tout">Tout voir</Link>
              </div>
              {!tb || tb.derniers.length === 0 ? (
                <p className="tb-vide">Aucun inventaire pour l&apos;instant.</p>
              ) : (
                <div className="tb-rangs">
                  {tb.derniers.map((d) => (
                    <Link href={`/dashboard/${d.session_id}`} className="tb-rang" key={d.session_id}>
                      <span className="tb-vignette" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3.5 9 5 4.5A1 1 0 0 1 6 4h12a1 1 0 0 1 .95.68L20.5 9" />
                          <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
                          <path d="M9.5 20v-5h5v5" />
                        </svg>
                      </span>
                      <div className="tb-rang-corps">
                        <div className="tb-rang-titre">{d.nom}</div>
                        <div className="tb-rang-sous">{d.magasin} · {fmtDate(d.cree_le)}</div>
                      </div>
                      <div className="tb-rang-fin">
                        <div className="tb-rang-valeur num">{money(d.valeur)} €</div>
                        <span className={`dash-badge dash-badge-${d.statut}`}>
                          <span className="dash-dot" />{STATUS_LABELS[d.statut as keyof typeof STATUS_LABELS] ?? d.statut}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="panel tb-carte">
              <div className="tb-carte-tete">
                <h2>Activité récente</h2>
                <Link href="/journal" className="tb-tout">Tout le journal</Link>
              </div>
              {journal.length === 0 ? (
                <p className="tb-vide">Aucune action enregistrée pour l&apos;instant.</p>
              ) : (
                <div className="tb-rangs">
                  {journal.map((l) => (
                    <div className="tb-rang" key={l.id}>
                      <span className="tb-vignette" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                          <line x1="9" y1="8" x2="15" y2="8" />
                          <line x1="9" y1="12" x2="15" y2="12" />
                          <line x1="9" y1="16" x2="13" y2="16" />
                        </svg>
                      </span>
                      <div className="tb-rang-corps">
                        <div className="tb-rang-titre">{libelleAction(l, guard.profile.id)}</div>
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
