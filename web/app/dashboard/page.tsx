'use client'

// Le tableau de bord d'atterrissage du superviseur (30 août 2026).
//
// /dashboard était la liste des inventaires ; la liste vit désormais sur
// /inventaires, derrière « Tout voir ». Ici : l'essentiel du mois (pièces,
// clôtures, valeur), les comptages par jour, les écarts par inventaire, les
// derniers inventaires et l'équipe — les « Mot de passe à créer » en premier.
//
// Tout est agrégé par `tableau_de_bord_superviseur` côté serveur : la règle
// de tenue en charge interdit de rapatrier les lignes de `counts` pour
// additionner au navigateur. L'écart affiché ici suit LA MÊME règle que le
// rapport (arbitrage > audit > comptage) — la fonction le garantit, et un
// tableau de bord qui contredirait le rapport serait pire que pas de tableau.
//
// Maquette validée par Julien le 30 août 2026 :
// https://claude.ai/code/artifact/5105e587-7a15-4d59-a1c9-f67286ba951c
// La recherche globale et « Écrire à l'administrateur » vivent sur cet
// en-tête ; la cloche de notifications, elle, est dans le RAIL — tous les
// rôles la voient, y compris l'administrateur qui n'atterrit pas ici.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyCompany } from '@/lib/account'
import { supabase } from '@/lib/supabaseClient'
import { money, nb, relativeTime, fmtDate } from '@/lib/format'
import { STATUS_LABELS } from '@/lib/inventory'
import { friendlyError } from '@/lib/errors'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { RechercheGlobale } from '@/components/dashboard/RechercheGlobale'
import { MessageAdmin } from '@/components/dashboard/MessageAdmin'
import {
  Anneau, BarresSemaine, Kpi, lundiDeLaSemaine, type JourTb,
} from '@/components/dashboard/TableauDeBord'

type EcartTb = {
  session_id: string; nom: string; magasin: string; statut: string
  ecart_qte: number; ecart_valeur: number
}
type DernierTb = {
  session_id: string; nom: string; magasin: string; numero: string
  statut: string; cree_le: string; pieces: number; valeur: number
}
type TableauDeBord = {
  pieces_mois: number; pieces_mois_prec: number
  valeur_mois: number; valeur_mois_prec: number
  clotures_mois: number; clotures_mois_prec: number
  semaine_debut: string
  par_jour: JourTb[]
  ecarts: EcartTb[]
  derniers: DernierTb[]
}

type Compteur = {
  id: string; full_name: string | null; email: string | null
  is_active: boolean; last_count_at: string | null
}
type EquipeRang = Compteur & { magasin: string }


export default function DashboardPage() {
  const toast = useToast()
  const guard = useAuthGuard('supervisor')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [tb, setTb] = useState<TableauDeBord | null>(null)
  const [equipe, setEquipe] = useState<EquipeRang[] | null>(null)
  const [semaine, setSemaine] = useState(0)
  const [mesureBarres, setMesureBarres] = useState<'pieces' | 'valeur'>('pieces')
  const [mesureEcarts, setMesureEcarts] = useState<'valeur' | 'qte'>('valeur')
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    if (guard.status !== 'ready') return
    getMyCompany().then((c) => setCompanyName(c?.name ?? null)).catch(() => {})
    supabase.rpc('my_team_by_store').then(({ data, error }) => {
      if (error || !data) return
      const rangs: EquipeRang[] = []
      for (const s of (data.stores ?? []) as { name: string; counters: Compteur[] }[]) {
        for (const c of s.counters ?? []) rangs.push({ ...c, magasin: s.name })
      }
      // Les « Mot de passe à créer » d'abord : c'est ce qui appelle un geste.
      rangs.sort((a, b) => Number(a.is_active) - Number(b.is_active))
      setEquipe(rangs)
    })
  }, [guard.status])

  useEffect(() => {
    if (guard.status !== 'ready') return
    let actif = true
    setChargement(true)
    supabase
      .rpc('tableau_de_bord_superviseur', { p_semaine: lundiDeLaSemaine(semaine) })
      .then(({ data, error }) => {
        if (!actif) return
        if (error) toast.error(friendlyError(error))
        else setTb(data as TableauDeBord)
        setChargement(false)
      })
    return () => { actif = false }
  }, [guard.status, semaine, toast])

  const prenom = useMemo(() => {
    if (guard.status !== 'ready') return ''
    return (guard.profile.full_name ?? '').trim().split(/\s+/)[0] || ''
  }, [guard])

  if (guard.status === 'loading') {
    return <div className="dash"><SkeletonRows rows={3} /></div>
  }

  return (
    <AppShell profile={guard.profile} companyName={companyName}>
      <div className="tb-plein">
      <div className="app-head">
        <div>
          <h1 className="page-title">{prenom ? `Bonjour, ${prenom}` : 'Tableau de bord'}</h1>
          <p className="page-sub">L&apos;essentiel de vos inventaires et de votre équipe.</p>
        </div>
        <div className="app-head-actions">
          <RechercheGlobale />
          {/* Pas de bouton pour l'administrateur d'entreprise : le message lui
              serait adressé à lui-même, et un bouton qui refuse est pire que
              pas de bouton. */}
          {!guard.profile.is_company_admin && <MessageAdmin />}
          <Link href="/dashboard/new" className="btn btn-primary">Nouvel inventaire</Link>
        </div>
      </div>

      {chargement && !tb ? (
        <div style={{ marginTop: 24 }}><SkeletonRows rows={3} height={110} /></div>
      ) : tb && (
        <>
          <section className="tb-kpis">
            <Kpi
              nom="Pièces comptées ce mois-ci"
              icone="pieces"
              valeur={nb(tb.pieces_mois)}
              precedent={tb.pieces_mois_prec}
              actuel={tb.pieces_mois}
              refTexte={`${nb(tb.pieces_mois_prec)} le mois dernier`}
            />
            <Kpi
              nom="Inventaires clôturés ce mois-ci"
              icone="clotures"
              valeur={nb(tb.clotures_mois)}
              precedent={tb.clotures_mois_prec}
              actuel={tb.clotures_mois}
              absolu
              refTexte={`${nb(tb.clotures_mois_prec)} le mois dernier`}
            />
            <Kpi
              nom="Valeur comptée ce mois-ci"
              icone="valeur"
              valeur={`${money(tb.valeur_mois)} €`}
              precedent={tb.valeur_mois_prec}
              actuel={tb.valeur_mois}
              refTexte={`${money(tb.valeur_mois_prec)} € le mois dernier`}
            />
          </section>

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
              titre="Écart"
              entetes={
                <div className="tb-segmente" role="group" aria-label="Mesure de l’écart">
                  <button type="button" aria-pressed={mesureEcarts === 'valeur'} className={mesureEcarts === 'valeur' ? 'choisi' : ''} onClick={() => setMesureEcarts('valeur')}>Valeur</button>
                  <button type="button" aria-pressed={mesureEcarts === 'qte'} className={mesureEcarts === 'qte' ? 'choisi' : ''} onClick={() => setMesureEcarts('qte')}>Quantité</button>
                </div>
              }
              parts={tb.ecarts.map((e) => ({
                nom: e.nom,
                brut: mesureEcarts === 'valeur' ? e.ecart_valeur : e.ecart_qte,
                lien: `/dashboard/${e.session_id}`,
              }))}
              format={(v) => (mesureEcarts === 'valeur' ? `${money(v)} €` : nb(v))}
              sous="sur 30 jours"
              note="Parts en écart absolu"
              vide={<>Aucun écart sur 30 jours. Seuls les inventaires avec un stock théorique importé entrent dans ce calcul.</>}
            />
          </section>

          <section className="tb-listes">
            <div className="panel tb-carte">
              <div className="tb-carte-tete">
                <h2>Derniers inventaires</h2>
                <Link href="/inventaires" className="tb-tout">Tout voir</Link>
              </div>
              {tb.derniers.length === 0 ? (
                <p className="tb-vide">
                  Aucun inventaire pour l&apos;instant. <Link href="/dashboard/new">Créez le premier</Link>.
                </p>
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
                <h2>Mon équipe</h2>
                <Link href="/equipe" className="tb-tout">Tout voir</Link>
              </div>
              {equipe === null ? (
                <SkeletonRows rows={3} height={44} />
              ) : equipe.length === 0 ? (
                <p className="tb-vide">
                  Personne pour l&apos;instant. <Link href="/equipe">Ajoutez un membre</Link>.
                </p>
              ) : (
                <div className="tb-rangs">
                  {equipe.slice(0, 4).map((m) => (
                    <div className="tb-rang" key={m.id}>
                      <span className="tb-avatar">{initialesDe(m.full_name)}</span>
                      <div className="tb-rang-corps">
                        <div className="tb-rang-titre">{m.full_name || m.email || '—'}</div>
                        {/* Même règle que « Mon équipe » : l'adresse tant que la
                            personne n'a pas ouvert l'application, son magasin
                            ensuite. */}
                        <div className="tb-rang-sous">{m.is_active ? m.magasin : m.email}</div>
                      </div>
                      <div className="tb-rang-fin">
                        {m.is_active ? (
                          <span className="tb-rang-sous">
                            {m.last_count_at ? `a compté ${relativeTime(m.last_count_at)}` : 'n’a pas encore compté'}
                          </span>
                        ) : (
                          <span className="tb-attente">Mot de passe à créer</span>
                        )}
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

function initialesDe(nom: string | null): string {
  const mots = (nom ?? '').trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase()
}
