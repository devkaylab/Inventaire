'use client'

/**
 * Usage constaté — la section de la fiche entreprise.
 *
 * Elle vit là où l'on regarde déjà un client, plutôt que dans une page à part :
 * ce constat sert au renouvellement, pas au quotidien. Rien de ce qu'elle
 * affiche n'est visible du client.
 *
 * Elle ne juge pas elle-même — tout passe par `lib/mesure.ts`, y compris le
 * vocabulaire. ⚠️ Ne jamais écrire « Conforme » ni « Cohérent » ici : la mesure
 * ne conclut que dans un sens (voir la règle d'asymétrie).
 */

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { nb, relativeTime } from '@/lib/format'
import {
  lireUsage, compteursLisibles, phraseConstat, ecartTotalEuros, licencesEuros,
  LIBELLES, type MagasinUsage, type UsageEntreprise,
} from '@/lib/mesure'

export function UsageConstate({ companyId }: { companyId: string }) {
  const [data, setData] = useState<UsageEntreprise | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [edite, setEdite] = useState<string | null>(null)
  const [saisie, setSaisie] = useState('')

  const charger = useCallback(async () => {
    const { data: d, error } = await supabase.rpc('admin_usage_overview', { p_company_id: companyId })
    if (error) { setErr(error.message); return }
    setErr(null)
    setData(d as UsageEntreprise)
  }, [companyId])

  useEffect(() => { void charger() }, [charger])

  async function poserVolume(m: MagasinUsage) {
    const units = Number(saisie.replace(/[^\d]/g, ''))
    if (!Number.isFinite(units) || units <= 0) return
    const { data: r, error } = await supabase.rpc('admin_set_store_volume', {
      p_store_id: m.id, p_units: units,
    })
    const res = r as { success?: boolean; error?: string } | null
    if (error || !res?.success) { setErr(error?.message ?? res?.error ?? 'Échec'); return }
    setEdite(null); setSaisie('')
    await charger()
  }

  if (err) {
    return (
      <section className="admin-section">
        <h2>Usage constaté</h2>
        {/* Un échec de chargement n'est pas une absence d'usage : le dire, plutôt
            que d'afficher un parc vide à quelqu'un qui en a un. */}
        <p className="muted">Lecture impossible pour l&apos;instant — {err}</p>
      </section>
    )
  }
  if (!data) {
    return (
      <section className="admin-section">
        <h2>Usage constaté</h2>
        <p className="muted">Lecture en cours…</p>
      </section>
    )
  }

  const constat = phraseConstat(data.stores)
  const ecart = ecartTotalEuros(data.stores)
  const aRevoirN = data.stores.filter((m) => lireUsage(m).etat === 'au-dela').length

  return (
    <section className="admin-section">
      <h2>Usage constaté</h2>
      <p className="muted small" style={{ marginTop: -4 }}>
        Douze derniers mois · lecture interne, invisible du client
      </p>

      <div className="dash-stats dash-stats-5" style={{ marginTop: 16 }}>
        <div className="dash-stat">
          <div className="dash-stat-value">{data.inventaires}</div>
          <div className="dash-stat-label">Inventaires</div>
        </div>
        <div className="dash-stat">
          <div className="dash-stat-value">{data.compteurs_distincts}</div>
          <div className="dash-stat-label">Compteurs distincts</div>
        </div>
        <div className="dash-stat">
          <div className="dash-stat-value">{data.stores.length}</div>
          <div className="dash-stat-label">Magasins</div>
        </div>
        <div className="dash-stat">
          <div className="dash-stat-value">{nb(Math.round(licencesEuros(data.stores)))} €</div>
          <div className="dash-stat-label">Licences / an</div>
        </div>
        <div className="dash-stat">
          <div
            className="dash-stat-value"
            style={aRevoirN > 0 ? { color: 'var(--warning-text)' } : undefined}
          >
            {aRevoirN}
          </div>
          <div className="dash-stat-label">À revoir</div>
        </div>
      </div>

      {constat && (
        <p className="usage-constat">
          {constat.split(/(\d[\d   ]*€)/).map((bout, i) =>
            /€$/.test(bout) ? <b key={i}>{bout}</b> : <span key={i}>{bout}</span>,
          )}
        </p>
      )}

      {data.stores.length === 0 ? (
        <p className="muted">Cette entreprise n&apos;a encore aucun magasin.</p>
      ) : (
        <div className="dash-table-wrap" style={{ marginTop: constat ? 0 : 16 }}>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Magasin</th>
                <th className="num">Volume déclaré</th>
                <th className="num">Plancher observé</th>
                <th>Part de la tranche</th>
                <th className="num">Compteurs</th>
                <th className="num">Inv.</th>
                <th className="num">Dernier</th>
                <th>Lecture</th>
              </tr>
            </thead>
            <tbody>
              {data.stores.map((m) => {
                const l = lireUsage(m)
                const cpt = compteursLisibles(m)
                const part = l.part
                const dedans = part === null ? 0 : Math.min(part, 1) * 96
                const sur = part !== null && part > 1 ? (Math.min(part, 1.35) - 1) * 96 : 0
                return (
                  <tr key={m.id}>
                    <td>
                      <span className="dash-art-label">{m.name}</span>
                      {/* La tranche seule : le prix figure déjà dans la tuile
                          « Licences » et dans la section Magasins, et sur trois
                          lignes il faisait déborder la colonne. */}
                      {l.payee && <div className="muted small">{l.payee.profil}</div>}
                    </td>
                    <td className="num">
                      {m.units === null ? (
                        edite === m.id ? (
                          <span style={{ display: 'inline-flex', gap: 6 }}>
                            <input
                              className="dash-audit-input"
                              autoFocus
                              inputMode="numeric"
                              value={saisie}
                              placeholder="pièces"
                              style={{ width: 92 }}
                              onChange={(e) => setSaisie(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void poserVolume(m)
                                if (e.key === 'Escape') { setEdite(null); setSaisie('') }
                              }}
                            />
                            <button className="link-btn" onClick={() => void poserVolume(m)}>OK</button>
                          </span>
                        ) : (
                          <button
                            className="link-btn"
                            onClick={() => { setEdite(m.id); setSaisie('') }}
                          >
                            Renseigner
                          </button>
                        )
                      ) : (
                        nb(m.units)
                      )}
                    </td>
                    <td className="num">
                      {m.plancher === null ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className={l.etat === 'au-dela' ? 'jauge-val au-dela' : undefined}>
                          {nb(Math.round(m.plancher))}
                        </span>
                      )}
                    </td>
                    <td>
                      {part === null ? (
                        <span className="muted small">—</span>
                      ) : (
                        <span className="jauge">
                          <span className="jauge-zone">
                            <span className="jauge-piste">
                              <span className="jauge-part" style={{ width: dedans }} />
                            </span>
                            {sur > 0 && <span className="jauge-sur" style={{ width: sur }} />}
                          </span>
                          <span className={`jauge-val${l.etat === 'au-dela' ? ' au-dela' : ''}`}>
                            {Math.round(part * 100)} %
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {cpt === null ? (
                        <span className="muted" title="Comptages détachés d’un compte supprimé">n. c.</span>
                      ) : (
                        cpt
                      )}
                    </td>
                    <td className="num">{m.inventaires}</td>
                    <td className="num">
                      {m.dernier ? relativeTime(m.dernier) : <span className="muted">—</span>}
                    </td>
                    <td>
                      <span className={l.etat === 'au-dela' ? 'jauge-val au-dela' : 'muted small'}>
                        {LIBELLES[l.etat]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted small" style={{ marginTop: 12, maxWidth: '78ch' }}>
        Le plancher est le plus gros inventaire <b>unique</b> des douze derniers mois — jamais
        la somme de l&apos;année, un magasin comptant son stock plusieurs fois. Au-dessus de la
        borne de sa tranche, c&apos;est un fait : on ne compte pas ce qu&apos;on n&apos;a pas.
        En dessous, cela ne dit rien — un inventaire tournant ne couvre qu&apos;un rayon.
        {ecart > 0 && ' Un écart se porte au renouvellement, jamais en cours de contrat.'}
      </p>
    </section>
  )
}
