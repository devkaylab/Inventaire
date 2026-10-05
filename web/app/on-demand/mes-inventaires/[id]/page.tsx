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
    router.push('/on-demand/mes-inventaires')
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
              {/* ⚠️ L'HEURE DE DÉBUT, PAS L'HEURE D'ARRIVÉE (4 octobre 2026).
                  `arrivee_prevue` vaut le début moins un quart d'heure, « pour
                  s'installer » : c'était l'heure à laquelle une équipe de
                  Quantinvo se présentait. On n'envoie plus personne, et le
                  client compte quand il veut — la seule heure qui le concerne
                  est celle de son inventaire. */}
              <tr>
                <td>Début de l’inventaire</td>
                <td>{enHeure(mission.debut_prevu)}</td>
              </tr>
              {/* ⚠️ LES APPAREILS, PAS L'ÉQUIPE. `inventoristes` compte les gens
                  envoyés : il vaut 0 en location, et l'écran affichait donc
                  « 0 inventoriste ». Ce que le client a réservé, et ce qui fait
                  son prix, c'est un nombre d'appareils. */}
              <tr>
                <td>Appareils</td>
                <td>
                  {mission.appareils ?? mission.inventoristes} appareil
                  {(mission.appareils ?? mission.inventoristes) > 1 ? 's' : ''}
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
          {/* ⚠️ CETTE LISTE RECEVAIT UNE ÉQUIPE (réécrite le 4 octobre 2026).
              « Quelqu'un pour ouvrir à 21:45 », « un contact joignable » : on
              décrivait l'accueil de gens qui se déplaçaient. On n'envoie plus
              personne — le client compte avec son équipe, chez lui, quand il
              veut dans la semaine. Il ne reste que ce qui dépend VRAIMENT de
              lui, et sans quoi le rapport est muet. */}
          <div className="admin-section-head"><div><h2>À préparer</h2></div></div>
          <ul className="od-prevoir">
            <li>Votre fichier de stock, déposé avant de commencer</li>
            <li>Vos balises imprimées et posées dans les rayons</li>
            <li>Les comptes de vos compteurs créés</li>
          </ul>
          <p className="muted small" style={{ marginTop: 14 }}>
            {/* ⚠️ On le dit franchement : sans fichier, l'inventaire a lieu mais
                le rapport n'a pas d'écarts. C'est la différence entre « compter »
                et « contrôler », et le client doit la connaître AVANT le soir. */}
            Le fichier de stock — CSV ou Excel, sans reformater. Sans lui, vous
            comptez quand même, mais il n’y aura pas d’écarts : seulement des
            quantités.
          </p>
        </section>
      )}

      {/* ⚠️ LE MÊME INVENTAIRE, AVANT ET APRÈS (4 octobre 2026). Il n'existait
          qu'à partir de l'ouverture de la mission, et le client — qui a son
          tableau de bord Quantinvo OS comme n'importe qui — en créait un autre
          pour préparer. Il naît maintenant avec la réservation : c'est là qu'il
          dépose son fichier et imprime ses balises, et c'est le même qui porte
          son rapport ensuite. Un seul, du début à la fin. */}
      {mission.inventory_session_id && !enCours && (
        <section className="admin-section">
          <h2>{aVenir ? 'Votre inventaire' : 'Votre rapport'}</h2>
          <p className="muted">
            {aVenir
              ? 'Déposez votre fichier de stock, imprimez vos balises, invitez votre équipe. C’est ici que vous compterez.'
              : 'Écarts contrôlés, quantités comptées, exports Excel, CSV et PDF.'}
          </p>
          <p style={{ marginTop: 18 }}>
            <Link href={`/inventaire/${mission.inventory_session_id}`}
                  className={aVenir ? 'btn btn-primary' : 'btn btn-ghost'}>
              {aVenir ? 'Préparer l’inventaire' : 'Ouvrir le rapport'}
            </Link>
          </p>
        </section>
      )}

      {aVenir && frais && (
        <section className="admin-section">
          <div className="admin-section-head"><div><h2>Annuler cet inventaire</h2></div></div>

          {frais.equipe_sur_place ? (
            <p className="muted">
              {/* ⚠️ `equipe_sur_place` garde son nom en base — c'est le même
                  moment, le créneau commencé. Ce n'est plus une équipe qui
                  arrive, c'est l'inventaire qui a démarré. */}
              L’inventaire a commencé. Il ne s’annule plus depuis cette page —
              appelez-nous, nous verrons ensemble.
            </p>
          ) : (
            <>
              {/* ⚠️ GRATUITE, ET SANS CONDITION (4 octobre 2026). Il y avait ici
                  un tableau de paliers — « si vous annulez / vous payez » —
                  justifié par la paie des inventoristes qui s'étaient rendus
                  disponibles. Plus personne ne se rend disponible : des frais
                  sans cette raison ne seraient plus qu'une punition. Décision
                  de Julien, « pas de frais ». Le tableau part avec eux : un
                  tableau à une seule ligne à zéro se lit comme un piège qu'on
                  cherche. */}
              <p className="muted">
                L’annulation est gratuite, jusqu’au début de l’inventaire.
              </p>
              {/* ⚠️ Il y avait ici une phrase qui JUSTIFIAIT les frais — « nous
                  rémunérons les inventoristes qui se sont rendus disponibles ».
                  Sans frais, elle n'a plus rien à expliquer : une justification
                  sans montant fait chercher un montant. */}

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
                    {/* La branche « facturée » est partie avec les frais : la
                        garder aurait laissé croire qu'un cas la déclenche. */}
                    <b>Cette annulation est gratuite.</b>
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
        <Link href="/on-demand/mes-inventaires">← Tous vos inventaires</Link>
      </p>
    </AppShell>
  )
}
