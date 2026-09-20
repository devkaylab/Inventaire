'use client'

/**
 * Console — les missions On-Demand (20 septembre 2026).
 *
 * Maquette : Admin-Missions.
 *
 * ⚠️ **CE QUI DEMANDE UNE DÉCISION AUJOURD'HUI PASSE AVANT LE TABLEAU.** Une
 * liste triée par date met une mission de la semaine prochaine au même rang
 * qu'une équipe incomplète à trois heures du départ. Les deux bandeaux du haut
 * sont ce qu'on regarde en arrivant ; le tableau est ce qu'on consulte.
 *
 * ⚠️ **ET LA MARGE S'AFFICHE ICI, NULLE PART AILLEURS.** `admin_missions` est
 * la seule porte qui rend `cout_cents` : la table `missions` le retient par un
 * grant colonne par colonne, parce que la RLS choisit des lignes, pas des
 * colonnes.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { Chargement } from '@/components/Chargement'
import { euros } from '@/lib/offres'
import {
  ETATS_MISSION, etatLisible, urgence, type MissionConsole,
} from '@/lib/missions'

export default function AdminMissionsPage() {
  const guard = useAuthGuard('admin')
  const [missions, setMissions] = useState<MissionConsole[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_missions', { p_limite: 60 })
    if (error) { setErreur(error.message); return }
    const r = data as { success: boolean; error?: string; missions?: MissionConsole[] }
    if (!r?.success) { setErreur(r?.error ?? 'Lecture impossible.'); return }
    setMissions(r.missions ?? [])
  }, [])

  useEffect(() => { if (guard.status === 'ready') charger() }, [guard.status, charger])

  if (guard.status !== 'ready') return <Chargement />

  const aDecider = (missions ?? []).filter((m) => urgence(m) !== null)
  const aVenir = (missions ?? []).filter((m) => !ETATS_MISSION.finis.includes(m.etat))

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <h1 className="page-title">Les missions</h1>
      </div>

      {erreur && <p className="field-err">{erreur}</p>}
      {missions === null && !erreur && <p className="muted">Lecture…</p>}

      {missions !== null && missions.length === 0 && (
        <p className="muted">
          Aucune mission. La première arrivera par le tunnel de réservation.
        </p>
      )}

      {aDecider.length > 0 && (
        <section className="admin-section">
          <div className="admin-section-head">
            <div>
              <h2>À décider aujourd’hui</h2>
              <p className="muted small">
                {aDecider.length === 1
                  ? 'Une mission demande une décision.'
                  : `${aDecider.length} missions demandent une décision.`}
              </p>
            </div>
          </div>
          <div className="acc-inv-list">
            {aDecider.map((m) => {
              const u = urgence(m)!
              return (
                <Link key={m.id} href={`/admin/missions/${m.id}`} className="acc-inv-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="acc-inv-name">{m.magasin_nom} — {u.titre}</div>
                    <div className="muted small" style={{ marginTop: 2 }}>{u.detail}</div>
                  </div>
                  <span className={`dash-badge ${u.grave ? 'dash-badge-counting' : 'dash-badge-open'}`}>
                    <span className="dash-dot" />{u.action}
                  </span>
                  <span className="zone-progress-arrow">›</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {aVenir.length > 0 && (
        <section className="admin-section">
          <div className="admin-section-head"><div><h2>À venir</h2></div></div>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Magasin et client</th>
                  <th>Quand</th>
                  <th>Équipe</th>
                  <th>État</th>
                  <th className="num">Prix</th>
                  <th className="num">Marge</th>
                </tr>
              </thead>
              <tbody>
                {aVenir.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/admin/missions/${m.id}`}>{m.magasin_nom}</Link>
                      <div className="muted small">{m.client_nom}</div>
                    </td>
                    <td>{quand(m.debut_prevu)}</td>
                    <td className="num">{m.confirmes} / {m.places}</td>
                    <td>{etatLisible(m)}</td>
                    <td className="num">{euros(m.prix_cents / 100)}</td>
                    {/* ⚠️ La marge en pourcentage ET en euros : « 25,0 % » ne dit
                        pas si la mission vaut la peine d'être servie, « 237 € »
                        le dit. */}
                    <td className="num">
                      {(m.marge * 100).toFixed(1).replace('.', ',')} %
                      <div className="muted small">{euros(m.marge_cents / 100)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  )
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « Ce soir, 20:00 » quand c'est aujourd'hui, la date sinon. */
function quand(iso: string): string {
  const d = new Date(iso)
  const h = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const maintenant = new Date()
  const memeJour = d.toDateString() === maintenant.toDateString()
  if (memeJour) return `${d.getHours() >= 18 ? 'Ce soir' : 'Aujourd’hui'}, ${h}`
  const dansUneSemaine = (d.getTime() - maintenant.getTime()) / 86400000 < 7
  if (dansUneSemaine) return `${JOURS[d.getDay()]}, ${h}`
  return `${d.getDate()} ${MOIS[d.getMonth()]}, ${h}`
}
