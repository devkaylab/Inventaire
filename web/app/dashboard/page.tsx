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

type JourTb = { jour: string; pieces: number; valeur: number }
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

/* Les couleurs de l'anneau — validées pour les daltonismes sur les deux
   surfaces (validateur du 30 août 2026). L'or et le cyan du thème sombre sont
   des pas plus foncés que les jetons de marque : les jetons clairs sont trop
   clairs pour se distinguer sur --surface sombre. « Autres » est neutre. */
const SERIES_SOMBRE = ['#6366f1', '#bd7f09', '#1590c1']
const SERIES_CLAIR = ['#4f46e5', '#d97706', '#0aa5d8']

/** Lundi de la semaine d'aujourd'hui, décalé de `retard` semaines. */
function lundiDeLaSemaine(retard: number): string {
  const d = new Date()
  const decalage = (d.getDay() + 6) % 7 // lundi = 0
  d.setDate(d.getDate() - decalage - retard * 7)
  return d.toISOString().slice(0, 10)
}

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

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
            />
            <AnneauEcarts
              ecarts={tb.ecarts}
              mesure={mesureEcarts}
              onMesure={setMesureEcarts}
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
    </AppShell>
  )
}

function initialesDe(nom: string | null): string {
  const mots = (nom ?? '').trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase()
}

/** Les trois icônes des tuiles, celles de la maquette — au trait, grille 24. */
const KPI_ICONES = {
  pieces: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  ),
  clotures: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4v16h16" />
      <rect x="7" y="12" width="2.6" height="5" rx="0.5" />
      <rect x="11.7" y="8" width="2.6" height="9" rx="0.5" />
      <rect x="16.4" y="5" width="2.6" height="12" rx="0.5" />
    </svg>
  ),
  valeur: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M15 8.5a4 4 0 1 0 0 7" />
      <line x1="8" y1="10.8" x2="13" y2="10.8" />
      <line x1="8" y1="13.2" x2="13" y2="13.2" />
    </svg>
  ),
} as const

/**
 * Un indicateur et son évolution contre le mois dernier.
 * `absolu` : la différence en unités plutôt qu'en pourcentage — « 1 de
 * moins » se lit, « −14 % » sur 7 inventaires ne veut rien dire.
 * Un mois précédent à zéro n'affiche pas d'évolution : un pourcentage de
 * zéro est un chiffre inventé.
 */
function Kpi({ nom, valeur, actuel, precedent, refTexte, absolu, icone }: {
  nom: string; valeur: string; actuel: number; precedent: number
  refTexte: string; absolu?: boolean; icone: keyof typeof KPI_ICONES
}) {
  const delta = actuel - precedent
  let chip: { texte: string; sens: 'plus' | 'moins' } | null = null
  if (precedent > 0 && delta !== 0) {
    chip = absolu
      ? { texte: `${nb(Math.abs(delta))} de ${delta > 0 ? 'plus' : 'moins'}`, sens: delta > 0 ? 'plus' : 'moins' }
      : { texte: `${nb(Math.round(Math.abs(delta) / precedent * 100))} %`, sens: delta > 0 ? 'plus' : 'moins' }
  }
  return (
    <div className="panel tb-kpi">
      <div className="tb-kpi-haut">
        <span className="tb-kpi-ico">{KPI_ICONES[icone]}</span>
        <span className="tb-kpi-nom">{nom}</span>
      </div>
      <div className="tb-kpi-bas">
        <span className="tb-kpi-valeur num">{valeur}</span>
        {chip && (
          <span className={`tb-chip tb-chip-${chip.sens}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {chip.sens === 'plus' ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
            </svg>
            {chip.texte}
          </span>
        )}
        <span className="tb-kpi-ref num">{refTexte}</span>
      </div>
    </div>
  )
}

const SEMAINES = [
  { valeur: 0, label: 'Cette semaine' },
  { valeur: 1, label: 'Semaine dernière' },
  { valeur: 2, label: 'Il y a 2 semaines' },
  { valeur: 3, label: 'Il y a 3 semaines' },
]

function BarresSemaine({ jours, mesure, onMesure, semaine, onSemaine, enChargement }: {
  jours: JourTb[]
  mesure: 'pieces' | 'valeur'
  onMesure: (m: 'pieces' | 'valeur') => void
  semaine: number
  onSemaine: (s: number) => void
  enChargement: boolean
}) {
  const valeurs = jours.map(j => (mesure === 'pieces' ? j.pieces : j.valeur))
  const max = Math.max(...valeurs, 1)
  // Un plafond « rond » pour que la graduation du haut soit lisible.
  const plafond = plafondRond(max)
  const iMax = valeurs.indexOf(Math.max(...valeurs))

  return (
    <div className="panel tb-carte" style={{ opacity: enChargement ? 0.6 : 1 }}>
      <div className="tb-carte-tete">
        <h2>{mesure === 'pieces' ? 'Pièces comptées par jour' : 'Valeur comptée par jour'}</h2>
        <div className="tb-filtres">
          <div className="tb-segmente" role="group" aria-label="Mesure du graphique">
            <button type="button" className={mesure === 'pieces' ? 'choisi' : ''} onClick={() => onMesure('pieces')}>Quantité</button>
            <button type="button" className={mesure === 'valeur' ? 'choisi' : ''} onClick={() => onMesure('valeur')}>Valeur</button>
          </div>
          <select
            value={semaine}
            onChange={(e) => onSemaine(Number(e.target.value))}
            aria-label="Semaine affichée"
          >
            {SEMAINES.map(s => <option key={s.valeur} value={s.valeur}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="tb-plot">
        <div className="tb-grille">
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <div className="tb-grille-ligne" style={{ bottom: `${f * 100}%` }} key={f}>
              <span className="num">{nb(Math.round(plafond * f))}</span>
            </div>
          ))}
          <div className="tb-barres">
            {jours.map((j, i) => {
              const v = valeurs[i]
              const h = Math.round(v / plafond * 100)
              return (
                <div className="tb-jour" key={j.jour}>
                  {v > 0 && (
                    <div className="tb-bulle num" role="tooltip">
                      {mesure === 'pieces' ? `${nb(v)} pièces` : `${money(v)} €`}
                    </div>
                  )}
                  <div
                    className={`tb-barre${i === iMax && v > 0 ? ' tb-barre-forte' : ''}`}
                    style={{ height: `${Math.max(h, v > 0 ? 2 : 0)}%` }}
                  />
                </div>
              )
            })}
          </div>
        </div>
        <div className="tb-jours-noms">
          {jours.map((j, i) => <span key={j.jour}>{JOURS_COURTS[i] ?? ''}</span>)}
        </div>
      </div>
    </div>
  )
}

/** 4 000 plutôt que 3 846 : la graduation se lit, la barre ne déborde pas. */
function plafondRond(max: number): number {
  const puissance = Math.pow(10, Math.floor(Math.log10(max)))
  const base = max / puissance
  const facteur = base <= 1 ? 1 : base <= 2 ? 2 : base <= 4 ? 4 : base <= 5 ? 5 : 10
  return facteur * puissance
}

function AnneauEcarts({ ecarts, mesure, onMesure }: {
  ecarts: EcartTb[]
  mesure: 'valeur' | 'qte'
  onMesure: (m: 'valeur' | 'qte') => void
}) {
  // Trois parts nommées au plus, le reste en « Autres » : la palette est
  // validée pour trois teintes voisines, au-delà on replie (règle dataviz).
  const [sombre, setSombre] = useState(true)
  useEffect(() => {
    const racine = document.documentElement
    const lireTheme = () => setSombre(racine.getAttribute('data-theme') !== 'light')
    lireTheme()
    const obs = new MutationObserver(lireTheme)
    obs.observe(racine, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  const series = sombre ? SERIES_SOMBRE : SERIES_CLAIR

  const val = (e: EcartTb) => (mesure === 'valeur' ? e.ecart_valeur : e.ecart_qte)
  const tetes = ecarts.slice(0, 3)
  const reste = ecarts.slice(3)
  const parts: { nom: string; brut: number; couleur: string; session_id?: string }[] = [
    ...tetes.map((e, i) => ({ nom: e.nom, brut: val(e), couleur: series[i], session_id: e.session_id })),
    ...(reste.length > 0
      ? [{ nom: `${reste.length} autre${reste.length > 1 ? 's' : ''}`, brut: reste.reduce((s, e) => s + val(e), 0), couleur: 'var(--text-3)' }]
      : []),
  ]
  const total = parts.reduce((s, p) => s + p.brut, 0)
  const totalAbs = parts.reduce((s, p) => s + Math.abs(p.brut), 0)

  // Géométrie : r 66, circonférence 414,7, un jour de 4,5 px entre les parts.
  const C = 2 * Math.PI * 66
  let offset = 0
  const arcs = parts.map((p) => {
    const part = totalAbs > 0 ? Math.abs(p.brut) / totalAbs : 0
    const longueur = Math.max(part * C - 4.5, 0)
    const a = { ...p, longueur, offset }
    offset += part * C
    return a
  })

  return (
    <div className="panel tb-carte">
      <div className="tb-carte-tete">
        <h2>Écart</h2>
        <div className="tb-filtres">
          <div className="tb-segmente" role="group" aria-label="Mesure de l’écart">
            <button type="button" className={mesure === 'valeur' ? 'choisi' : ''} onClick={() => onMesure('valeur')}>Valeur</button>
            <button type="button" className={mesure === 'qte' ? 'choisi' : ''} onClick={() => onMesure('qte')}>Quantité</button>
          </div>
        </div>
      </div>
      {ecarts.length === 0 ? (
        <p className="tb-vide">
          Aucun écart sur 30 jours. Seuls les inventaires avec un stock
          théorique importé entrent dans ce calcul.
        </p>
      ) : (
        <div className="tb-anneau-corps">
          <div className="tb-anneau">
            <svg width="150" height="150" viewBox="0 0 180 180" aria-hidden="true">
              <g transform="rotate(-90 90 90)">
                {arcs.map((a) => (
                  <circle
                    key={a.nom} cx="90" cy="90" r="66" fill="none"
                    stroke={a.couleur} strokeWidth="24"
                    strokeDasharray={`${a.longueur.toFixed(1)} ${(C - a.longueur).toFixed(1)}`}
                    strokeDashoffset={(-a.offset).toFixed(1)}
                  />
                ))}
              </g>
            </svg>
            <div className="tb-anneau-centre">
              <div>
                <div className="tb-anneau-gros num">
                  {mesure === 'valeur' ? `${money(total)} €` : nb(total)}
                </div>
                <div className="tb-anneau-sous">sur 30 jours</div>
              </div>
            </div>
          </div>
          <div className="tb-legende">
            {arcs.map((a) => (
              <div className="tb-legende-rang" key={a.nom}>
                <span className="tb-puce" style={{ background: a.couleur }} />
                {a.session_id ? (
                  <Link href={`/dashboard/${a.session_id}`} className="tb-legende-nom">{a.nom}</Link>
                ) : (
                  <span className="tb-legende-nom">{a.nom}</span>
                )}
                <span className="tb-legende-val num">
                  {mesure === 'valeur' ? `${money(a.brut)} €` : nb(a.brut)}
                </span>
              </div>
            ))}
            {/* L'anneau montre des parts en absolu — le signe se lit sur
                chaque ligne et au centre, pas dans la taille des parts. */}
            <div className="tb-legende-note">Parts en écart absolu</div>
          </div>
        </div>
      )}
    </div>
  )
}
