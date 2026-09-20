'use client'

/**
 * Un inventaire à la demande, côté client (20 septembre 2026).
 *
 * Maquette : les planches Confirme, Suivi et Annuler.
 *
 * ⚠️ **LE SUIVI EN DIRECT N'EST PAS REFAIT ICI.** Un inventaire On-Demand est
 * un inventaire Quantinvo : la page `/inventaire/[id]` porte déjà l'avancement,
 * les zones, les écarts et le rapport. En redessiner une version « On-Demand »
 * donnerait deux écrans à tenir en phase, et l'un des deux finirait en retard
 * sur l'autre. Cette page porte ce que l'AUTRE ne sait pas : la mission, son
 * équipe, son prix, son annulation.
 *
 * ⚠️ **ET L'ANNULATION AFFICHE DES EUROS, PAS DES POURCENTAGES.** « 30 % » ne
 * veut rien dire au moment de décider ; « 284 € » se comprend tout de suite. Le
 * montant vient de `frais_annulation`, en base, calculé sur SA réservation.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { Chargement } from '@/components/Chargement'
import { euros } from '@/lib/offres'
import { duree } from '@/lib/prixOnDemand'
import { estAVenir, maMission, type Mission } from '@/lib/onDemandClient'
import { ceQuOnFait, enDateLongue, enHeure, etatClient } from '@/lib/missionsClient'

type Frais = {
  success: boolean; code?: string
  gratuite_jusqu_au: string | null
  heures_restantes: number
  equipe_sur_place: boolean
  a_payer_cents: number
  prix_cents: number
  paliers: { heures_avant: number; client_cents: number }[]
}

export default function MonInventairePage() {
  const guard = useAuthGuard('supervisor')
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [mission, setMission] = useState<Mission | null>(null)
  const [frais, setFrais] = useState<Frais | null>(null)
  const [demandeAnnulation, setDemandeAnnulation] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const charger = useCallback(async () => {
    try {
      const m = await maMission(id)
      setMission(m)
      if (m && estAVenir(m)) {
        const { data } = await supabase.rpc('frais_annulation', { p_mission: id })
        setFrais(data as Frais)
      }
    } catch (e) { setErreur((e as Error).message) }
  }, [id])

  useEffect(() => { if (guard.status === 'ready') charger() }, [guard.status, charger])

  const annuler = async () => {
    setErreur(null); setOccupe(true)
    const { data, error } = await supabase.rpc('annuler_ma_mission', {
      p_mission: id, p_motif: null,
    })
    setOccupe(false)
    if (error) { setErreur(error.message); return }
    const r = data as { success: boolean; error?: string; code?: string }
    if (!r?.success) { setErreur(r?.error ?? 'Annulation impossible.'); return }
    router.push('/a-la-demande/mes-inventaires')
  }

  if (guard.status !== 'ready') return <Chargement />
  if (erreur && !mission) {
    return <AppShell profile={guard.profile}><p className="field-err">{erreur}</p></AppShell>
  }
  if (!mission) {
    return <AppShell profile={guard.profile}><p className="muted">Lecture…</p></AppShell>
  }

  const aVenir = estAVenir(mission)
  const enCours = mission.etat === 'en_cours' || mission.etat === 'controle_qualite'
  const explication = ceQuOnFait(mission.etat)
  const gratuite = frais ? frais.a_payer_cents === 0 : false

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <div>
          <h1 className="page-title">{mission.magasin_nom}</h1>
          <p className="muted">
            {enDateLongue(mission.debut_prevu)}, {enHeure(mission.debut_prevu)}
            {' · '}{mission.reference}
          </p>
        </div>
        <div className="app-head-actions">
          <span className="dash-badge dash-badge-open">
            <span className="dash-dot" />{etatClient(mission.etat)}
          </span>
        </div>
      </div>

      {erreur && <p className="field-err">{erreur}</p>}

      {explication && (
        <section className="admin-section">
          <h2>Où en est votre inventaire</h2>
          <p className="muted">{explication}</p>
          {enCours && mission.inventory_session_id && (
            <p style={{ marginTop: 18 }}>
              <Link href={`/inventaire/${mission.inventory_session_id}`} className="btn btn-primary">
                Suivre en direct
              </Link>
            </p>
          )}
        </section>
      )}

      <section className="admin-section">
        <div className="admin-section-head"><div><h2>Votre réservation</h2></div></div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <tbody>
              <tr><td>Établissement</td><td>{mission.magasin_nom}<div className="muted small">{mission.adresse}</div></td></tr>
              <tr>
                <td>L’équipe arrive à</td>
                <td>{enHeure(mission.arrivee_prevue)}<div className="muted small">
                  un quart d’heure avant, pour s’installer</div></td>
              </tr>
              <tr>
                <td>Équipe</td>
                <td>
                  {mission.inventoristes} inventoriste{mission.inventoristes > 1 ? 's' : ''}
                  {mission.responsable ? ' et 1 responsable' : ''}
                </td>
              </tr>
              <tr><td>Durée prévue</td><td>{duree(mission.duree_prevue_minutes)} environ</td></tr>
              <tr>
                <td>Prix</td>
                <td>
                  <b className="num">{euros(mission.prix_cents / 100)}</b>
                  <div className="muted small">TVA non applicable, article 293 B du CGI</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {aVenir && (
        <section className="admin-section">
          <div className="admin-section-head"><div><h2>À prévoir sur place</h2></div></div>
          <ul className="od-prevoir">
            <li>Quelqu’un pour ouvrir à {enHeure(mission.arrivee_prevue)}</li>
            <li>Un contact joignable pendant l’inventaire</li>
            <li>La réserve ouverte et éclairée</li>
            <li>Votre fichier de stock déposé avant la veille</li>
          </ul>
          <p className="muted small" style={{ marginTop: 14 }}>
            {/* ⚠️ On le dit franchement : sans fichier, l'inventaire a lieu mais
                le rapport n'a pas d'écarts. C'est la différence entre « compter »
                et « contrôler », et le client doit la connaître AVANT le soir. */}
            Le fichier de stock — CSV ou Excel, sans reformater. Sans lui, nous
            comptons quand même, mais il n’y aura pas d’écarts : seulement des
            quantités.
          </p>
        </section>
      )}

      {mission.inventory_session_id && !enCours && (
        <section className="admin-section">
          <h2>Votre rapport</h2>
          <p className="muted">Écarts contrôlés, quantités comptées, exports Excel, CSV et PDF.</p>
          <p style={{ marginTop: 18 }}>
            <Link href={`/inventaire/${mission.inventory_session_id}`} className="btn btn-ghost">
              Ouvrir le rapport
            </Link>
          </p>
        </section>
      )}

      {aVenir && frais && (
        <section className="admin-section">
          <div className="admin-section-head"><div><h2>Annuler cet inventaire</h2></div></div>

          {frais.equipe_sur_place ? (
            <p className="muted">
              L’équipe est sur place. L’inventaire ne s’annule plus depuis cette
              page — appelez-nous, nous verrons ensemble.
            </p>
          ) : (
            <>
              <p className="muted">
                {gratuite
                  ? `Gratuite jusqu’au ${frais.gratuite_jusqu_au
                      ? `${enDateLongue(frais.gratuite_jusqu_au)} à ${enHeure(frais.gratuite_jusqu_au)}` : ''}.`
                  : 'Passé le délai gratuit, une part du montant reste due.'}
              </p>
              <div className="dash-table-wrap" style={{ marginTop: 14 }}>
                <table className="dash-table">
                  <thead><tr><th>Si vous annulez</th><th className="num">Vous payez</th></tr></thead>
                  <tbody>
                    {frais.paliers.map((p) => (
                      <tr key={p.heures_avant}>
                        <td>
                          {p.heures_avant >= 72 ? 'Plus de 72 h avant'
                            : p.heures_avant >= 24 ? 'De 72 h à 24 h avant'
                            : 'Moins de 24 h avant'}
                        </td>
                        <td className="num">{euros(p.client_cents / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* ⚠️ La phrase qui explique, et elle n'est pas cosmétique : sans
                  elle, des frais d'annulation se lisent comme une punition. */}
              <p className="muted small" style={{ marginTop: 12 }}>
                Nous rémunérons les inventoristes qui se sont rendus disponibles
                pour vous.
              </p>

              {!demandeAnnulation ? (
                <p style={{ marginTop: 18 }}>
                  <button type="button" className="btn btn-danger"
                          onClick={() => setDemandeAnnulation(true)}>
                    Annuler cet inventaire
                  </button>
                </p>
              ) : (
                <div className="od-confirmer">
                  <p>
                    <b>
                      {frais.a_payer_cents === 0
                        ? 'Cette annulation est gratuite.'
                        : `Cette annulation vous sera facturée ${euros(frais.a_payer_cents / 100)}.`}
                    </b>
                  </p>
                  <div className="res-actions">
                    <button type="button" className="btn btn-ghost" disabled={occupe}
                            onClick={() => setDemandeAnnulation(false)}>
                      Garder mon inventaire
                    </button>
                    <button type="button" className="btn btn-danger" disabled={occupe}
                            onClick={annuler}>
                      {occupe ? 'Annulation…' : 'Confirmer l’annulation'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <p className="muted small">
        <Link href="/a-la-demande/mes-inventaires">← Tous vos inventaires</Link>
      </p>
    </AppShell>
  )
}
