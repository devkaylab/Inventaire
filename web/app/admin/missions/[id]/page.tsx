'use client'

/**
 * Console — une mission, et l'équipe qui la fera (20 septembre 2026).
 *
 * Maquette : Admin-Mission et Admin-Matching.
 *
 * ⚠️ **LA LISTE PROPOSE, VOUS DÉCIDEZ.** Le matching reste manuel tant qu'il
 * n'a pas fait ses preuves, et `admin_candidats_mission` n'écarte personne :
 * chaque profil sort avec la raison pour laquelle il est retenu ou non, et
 * « Voir tout le monde » montre les autres. Un profil écarté par un calcul doit
 * pouvoir être repêché à la main — c'est l'article 22 du RGPD, pas une
 * politesse.
 *
 * ⚠️ **ET IL N'Y A PAS DE DISTANCE EN KILOMÈTRES.** Aucune coordonnée n'existe
 * en base, aucun géocodage n'est branché : la maquette montre « 3,2 km », on
 * montre le département et le rayon déclaré. Un kilométrage inventé se lirait
 * comme une mesure.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { Chargement } from '@/components/Chargement'
import { euros } from '@/lib/offres'
import { nb } from '@/lib/format'

type Membre = {
  user_id: string; prenom: string; nom: string; role: string; niveau: string
  etat: string; remuneration_cents: number
  propose_le: string; repondu_le: string | null; pointe_le: string | null
}

type Candidat = {
  user_id: string; prenom: string; nom: string; niveau: string; etat: string
  secteurs: string[]; rayon_km: number; mobilite: string | null
  paiements_ouverts: boolean; missions_faites: number
  disponible: boolean; secteur_connu: boolean; deja_pris: boolean
  retenu: boolean; pourquoi: string
}

type Detail = {
  success: boolean; error?: string
  mission?: Record<string, never> & {
    id: string; reference: string; etat: string
    client_nom: string; magasin_nom: string; adresse: string
    code_postal: string | null; ville: string | null
    secteur: string; code_barres: string
    surface_vente_m2: number | null; surface_reserve_m2: number | null
    articles_min: number; articles_max: number; articles_retenus: number
    debut_prevu: string; arrivee_prevue: string; duree_prevue_minutes: number
    inventoristes: number; responsable: boolean
    inventory_session_id: string | null
  }
  economie?: {
    prix_cents: number; equipe_cents: number; frais_cents: number
    cout_cents: number; marge_cents: number; marge: number
    remuneration_inventoriste_cents: number; remuneration_responsable_cents: number
  }
  equipe?: Membre[]
}

const ETAT_MEMBRE: Record<string, string> = {
  proposee: 'Proposée', acceptee: 'Confirmé', refusee: 'Refusée',
  retiree: 'Retiré', remplacee: 'Remplacé', absente: 'Absent',
}

const NIVEAU: Record<string, string> = {
  nouveau: 'Nouveau', confirme: 'Confirmé', expert: 'Expert', responsable: 'Responsable',
}

export default function AdminMissionPage() {
  const guard = useAuthGuard('admin')
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [candidats, setCandidats] = useState<Candidat[] | null>(null)
  const [tousLesProfils, setTousLesProfils] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const charger = useCallback(async () => {
    const [d, c] = await Promise.all([
      supabase.rpc('admin_mission', { p_mission: id }),
      supabase.rpc('admin_candidats_mission', { p_mission: id }),
    ])
    if (d.error) { setErreur(d.error.message); return }
    setDetail(d.data as Detail)
    if (!c.error) {
      setCandidats(((c.data as { candidats?: Candidat[] })?.candidats) ?? [])
    }
  }, [id])

  useEffect(() => { if (guard.status === 'ready') charger() }, [guard.status, charger])

  const proposer = async (userId: string, role: string) => {
    setErreur(null); setOccupe(true)
    const { data, error } = await supabase.rpc('admin_proposer_mission', {
      p_mission: id, p_user: userId, p_role: role,
    })
    setOccupe(false)
    if (error) { setErreur(error.message); return }
    const r = data as { success: boolean; error?: string }
    if (!r?.success) { setErreur(r?.error ?? 'Proposition impossible.'); return }
    charger()
  }

  const retirer = async (userId: string) => {
    setErreur(null); setOccupe(true)
    const { data, error } = await supabase.rpc('admin_retirer_de_la_mission', {
      p_mission: id, p_user: userId, p_motif: null,
    })
    setOccupe(false)
    if (error) { setErreur(error.message); return }
    const r = data as { success: boolean; error?: string }
    if (!r?.success) { setErreur(r?.error ?? 'Retrait impossible.'); return }
    charger()
  }

  if (guard.status !== 'ready') return <Chargement />
  if (erreur && !detail) return <AppShell profile={guard.profile}><p className="field-err">{erreur}</p></AppShell>
  if (!detail) return <AppShell profile={guard.profile}><p className="muted">Lecture…</p></AppShell>
  if (!detail.success || !detail.mission || !detail.economie) {
    return <AppShell profile={guard.profile}><p className="field-err">{detail.error ?? 'Mission introuvable.'}</p></AppShell>
  }

  const m = detail.mission
  const e = detail.economie
  const equipe = detail.equipe ?? []
  const enPlace = equipe.filter((x) => x.etat === 'acceptee' || x.etat === 'proposee')
  const places = m.inventoristes + (m.responsable ? 1 : 0)
  const manque = places - enPlace.length
  const besoinResponsable = m.responsable
    && !enPlace.some((x) => x.role === 'responsable')
  const visibles = (candidats ?? []).filter((c) => tousLesProfils || c.retenu)

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <div>
          <h1 className="page-title">{m.magasin_nom}</h1>
          <p className="muted">
            {m.client_nom} · {m.reference} · {m.secteur}
            {m.surface_vente_m2 ? ` · ${nb(m.surface_vente_m2)} m² de vente` : ''}
            {m.surface_reserve_m2 ? `, ${nb(m.surface_reserve_m2)} m² de réserve` : ''}
            {' · '}{nb(m.articles_min)} à {nb(m.articles_max)} articles déclarés
          </p>
        </div>
      </div>

      {erreur && <p className="field-err">{erreur}</p>}

      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>
              L’équipe — {m.inventoristes} inventoriste{m.inventoristes > 1 ? 's' : ''}
              {m.responsable ? ' et 1 responsable' : ''}
            </h2>
            <p className="muted small">
              {manque > 0
                ? `${manque} place${manque > 1 ? 's' : ''} à pourvoir.`
                : 'Toutes les places sont pourvues.'}
            </p>
          </div>
        </div>

        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Personne</th><th>Rôle et niveau</th><th>État</th>
                <th className="num">Rémunération</th><th />
              </tr>
            </thead>
            <tbody>
              {equipe.map((x) => (
                <tr key={x.user_id}>
                  <td>{x.prenom} {x.nom}</td>
                  <td>
                    {x.role === 'responsable' ? 'Responsable' : 'Inventoriste'}
                    {' · '}{NIVEAU[x.niveau] ?? x.niveau}
                  </td>
                  <td>{ETAT_MEMBRE[x.etat] ?? x.etat}</td>
                  <td className="num">{euros(x.remuneration_cents / 100)}</td>
                  <td className="num">
                    {(x.etat === 'proposee' || x.etat === 'acceptee') && (
                      <button type="button" className="link-btn" disabled={occupe}
                              onClick={() => retirer(x.user_id)}>Retirer</button>
                    )}
                  </td>
                </tr>
              ))}
              {Array.from({ length: Math.max(manque, 0) }).map((_, i) => (
                <tr key={`vide-${i}`}>
                  <td className="muted">Place vide</td>
                  <td className="muted">
                    {besoinResponsable && i === 0 ? 'Responsable' : 'Inventoriste'}
                  </td>
                  <td className="muted">—</td>
                  <td className="num muted">
                    {euros((besoinResponsable && i === 0
                      ? e.remuneration_responsable_cents
                      : e.remuneration_inventoriste_cents) / 100)}
                  </td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ⚠️ L'ÉCONOMIE N'EXISTE QUE SUR CET ÉCRAN. Aucun client ne lit ces
          quatre lignes — `missions` retient `cout_cents` par un grant nominatif,
          et c'est `admin_mission` qui l'ouvre. */}
      <section className="admin-section">
        <div className="admin-section-head"><div><h2>Ce que la mission rapporte</h2></div></div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <tbody>
              <tr><td>Payé par le client</td><td className="num">{euros(e.prix_cents / 100)}</td></tr>
              <tr><td>Versé à l’équipe</td><td className="num">− {euros(e.equipe_cents / 100)}</td></tr>
              <tr><td>Frais de paiement et coûts</td><td className="num">− {euros(e.frais_cents / 100)}</td></tr>
              <tr>
                <td><b>Reste à Quantinvo</b></td>
                <td className="num">
                  <b>{euros(e.marge_cents / 100)}</b>
                  <div className="muted small">
                    {(e.marge * 100).toFixed(1).replace('.', ',')} % de marge
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Qui pourrait la faire</h2>
            <p className="muted small">
              Classés par disponibilité sur le créneau, puis secteur, puis niveau.
              {' '}Aucun score n’entre dans ce classement : il n’y en a pas encore.
            </p>
          </div>
          {candidats && candidats.some((c) => !c.retenu) && (
            <button type="button" className="link-btn"
                    onClick={() => setTousLesProfils((v) => !v)}>
              {tousLesProfils ? 'Ne montrer que les retenus' : 'Voir tout le monde'}
            </button>
          )}
        </div>

        {candidats === null && <p className="muted">Lecture…</p>}
        {candidats !== null && candidats.length === 0 && (
          <p className="muted">
            Aucun inventoriste inscrit. Le vivier se constitue par la page
            d’inscription prestataire.
          </p>
        )}

        {visibles.length > 0 && (
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Profil</th><th>Secteur et zone</th>
                  <th className="num">Missions</th><th>Pourquoi</th><th />
                </tr>
              </thead>
              <tbody>
                {visibles.map((c) => (
                  <tr key={c.user_id} style={{ opacity: c.retenu ? 1 : 0.6 }}>
                    <td>
                      {c.prenom} {c.nom}
                      <div className="muted small">{NIVEAU[c.niveau] ?? c.niveau}</div>
                    </td>
                    <td>
                      {c.secteurs.length ? c.secteurs.join(', ') : <span className="muted">non déclaré</span>}
                      <div className="muted small">
                        rayon {c.rayon_km} km{c.mobilite ? ` · ${c.mobilite}` : ''}
                      </div>
                    </td>
                    <td className="num">{c.missions_faites}</td>
                    <td className="muted">{c.pourquoi}</td>
                    <td className="num">
                      {c.deja_pris ? (
                        <span className="muted">Indisponible</span>
                      ) : (
                        <>
                          <button type="button" className="link-btn" disabled={occupe}
                                  onClick={() => proposer(c.user_id, 'inventoriste')}>
                            Proposer
                          </button>
                          {besoinResponsable && (
                            <>
                              {' · '}
                              <button type="button" className="link-btn" disabled={occupe}
                                      onClick={() => proposer(c.user_id, 'responsable')}>
                                comme responsable
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted small">
        <Link href="/admin/missions">← Toutes les missions</Link>
      </p>
    </AppShell>
  )
}
