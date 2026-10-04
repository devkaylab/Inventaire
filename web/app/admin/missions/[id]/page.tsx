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
import { enDateLongue } from '@/lib/missionsClient'
import { duree } from '@/lib/prixOnDemand'

type Membre = {
  user_id: string; prenom: string; nom: string; role: string; niveau: string
  etat: string; remuneration_cents: number
  propose_le: string; repondu_le: string | null; pointe_le: string | null
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
    appareils: number | null
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

/**
 * Le parcours d'une LOCATION, dans l'ordre. La base refuse tout ce qui n'est
 * pas permis depuis l'état courant : on propose, elle arbitre.
 */
const PARCOURS = [
  { cle: 'paiement_autorise', bouton: 'Paiement autorisé' },
  { cle: 'confirmee', bouton: 'Confirmer' },
  { cle: 'prete', bouton: 'Prête' },
  { cle: 'en_cours', bouton: 'Ouvrir l’inventaire' },
  { cle: 'controle_qualite', bouton: 'Contrôle qualité' },
  { cle: 'terminee', bouton: 'Terminer' },
  { cle: 'payee', bouton: 'Payée' },
]

const LIBELLE_ETAT: Record<string, string> = Object.fromEntries(
  PARCOURS.map((e) => [e.cle, e.bouton]).concat([
    ['prix_calcule', 'Prix calculé'], ['brouillon', 'Brouillon'],
    ['annulee', 'Annulée'], ['remboursee', 'Remboursée'], ['echouee', 'Échouée'],
    ['litige', 'Litige'],
  ]))

export default function AdminMissionPage() {
  const guard = useAuthGuard('admin')
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const charger = useCallback(async () => {
    // ⚠️ `admin_candidats_mission` n'est plus appelée (4 octobre 2026) : on ne
    // propose plus de mission à personne. La fonction reste en base, inerte.
    const d = await supabase.rpc('admin_mission', { p_mission: id })
    if (d.error) { setErreur(d.error.message); return }
    setDetail(d.data as Detail)
  }, [id])

  useEffect(() => { if (guard.status === 'ready') charger() }, [guard.status, charger])

  /**
   * ⚠️ **SANS CECI, UNE MISSION RÉSERVÉE NE BOUGEAIT JAMAIS** (4 octobre 2026).
   * `admin_avancer_mission` existait en base depuis le 20 septembre, et AUCUN
   * écran ne l'appelait : une réservation restait à « Prix calculé », donc pas
   * de session d'inventaire — elle n'est créée qu'en passant « en cours » —,
   * donc pas d'appareils ouverts, donc pas d'inventaire. Le client payait et
   * attendait.
   *
   * ⚠️ ON NE RECOPIE PAS LA MACHINE D'ÉTATS ICI. `transition_mission_permise`
   * arbitre en base, et refuse par un message lisible. Deux tables d'états qui
   * divergent, c'est une console qui propose un bouton qui ne marche pas.
   */
  const avancer = async (etat: string) => {
    setErreur(null); setOccupe(true)
    const { data, error } = await supabase.rpc('admin_avancer_mission', {
      p_mission: id, p_etat: etat,
    })
    setOccupe(false)
    if (error) { setErreur(error.message); return }
    const r = data as { success: boolean; error?: string }
    if (!r?.success) { setErreur(r?.error ?? 'Transition impossible.'); return }
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

      {/* ⚠️ CETTE SECTION MONTRAIT « L'ÉQUIPE — N INVENTORISTES », avec les
          personnes assignées, leurs niveaux, leur rémunération et les places
          vides à pourvoir (4 octobre 2026). On ne propose plus d'équipe : il
          n'y a ni place à pourvoir ni rémunération à lire. Ce qui reste d'une
          mission, c'est ce que le client a loué.
          Le code est conservé sur la branche `on-demand-inventoristes`. */}
      <section className="admin-section">
        <div className="admin-section-head"><div><h2>Ce que le client a loué</h2></div></div>
        <div className="dash-table-wrap">
          <table className="dash-table">
            <tbody>
              <tr>
                <td>Appareils</td>
                <td>{m.appareils ?? m.inventoristes} appareil{(m.appareils ?? m.inventoristes) > 1 ? 's' : ''}</td>
              </tr>
              <tr><td>Début de l’inventaire</td><td>{enDateLongue(m.debut_prevu)}</td></tr>
              <tr><td>Durée prévue</td><td>{duree(m.duree_prevue_minutes)} environ</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ⚠️ Les états sont ceux du parcours LOCATION — la base arbitre, cette
          liste ne fait que proposer. L'ordre est celui du parcours, pour qu'on
          lise la suite sans la chercher. */}
      <section className="admin-section">
        <div className="admin-section-head">
          <div>
            <h2>Où en est la mission</h2>
            <p className="muted small">{LIBELLE_ETAT[m.etat] ?? m.etat}</p>
          </div>
        </div>
        <div className="res-actions" style={{ flexWrap: 'wrap' }}>
          {PARCOURS.map((e) => (
            <button key={e.cle} type="button" className="btn btn-ghost" disabled={occupe}
                    onClick={() => avancer(e.cle)}>
              {e.bouton}
            </button>
          ))}
          <button type="button" className="btn btn-danger" disabled={occupe}
                  onClick={() => avancer('annulee')}>
            Annuler la mission
          </button>
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
              {/* « Versé à l’équipe » est parti : plus personne n’est payé. */}
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


      <p className="muted small">
        <Link href="/admin/missions">← Toutes les missions</Link>
      </p>
    </AppShell>
  )
}
