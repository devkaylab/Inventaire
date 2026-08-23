'use client'

/**
 * Usage constaté — tout le parc.
 *
 * Direction « Atelier », choisie le 23 août 2026 : un rail de filtres à
 * gauche, le graphique en grand à droite. C'est une surface de travail — on y
 * cherche, on y trie — là où la section de la fiche entreprise, elle, se
 * consulte au renouvellement d'un client précis.
 *
 * Le jugement vient entièrement de `lib/mesure.ts`, vocabulaire compris.
 * ⚠️ Ne jamais écrire « Conforme » ni « Cohérent » : la lecture ne conclut que
 * dans un sens (règle d'asymétrie).
 *
 * Rien de ce que montre cette page n'est visible du client.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { nb, relativeTime, plural } from '@/lib/format'
import {
  lireUsage, compteursLisibles, aRevoir, ecartTotalEuros, licencesEuros,
  LIBELLES, TRANCHES_CHIFFREES, type MagasinUsage, type UsageEntreprise,
} from '@/lib/mesure'

// Sur tout le parc, chaque magasin porte son entreprise — sans elle une liste
// de quarante lignes ne se lit pas. `Omit` plutôt qu'une intersection : croiser
// deux fois le champ `stores` donne un type que rien ne satisfait.
type MagasinParc = MagasinUsage & { company_id: string; company_name: string }
type Parc = Omit<UsageEntreprise, 'stores'> & { stores: MagasinParc[]; entreprises: number }

export default function AdminUsagePage() {
  const guard = useAuthGuard('admin')
  const [parc, setParc] = useState<Parc | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [entreprise, setEntreprise] = useState('')
  const [tranche, setTranche] = useState('')
  const [seulementARevoir, setSeulementARevoir] = useState(false)
  const [edite, setEdite] = useState<string | null>(null)
  const [saisie, setSaisie] = useState('')

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_usage_overview', { p_company_id: null })
    if (error) { setErr(error.message); return }
    setErr(null)
    setParc(data as Parc)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    void charger()
  }, [guard.status, charger])

  const entreprises = useMemo(() => {
    const vues = new Map<string, string>()
    for (const m of parc?.stores ?? []) vues.set(m.company_id, m.company_name)
    return [...vues].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
  }, [parc])

  const visibles = useMemo(() => {
    let liste = parc?.stores ?? []
    if (entreprise) liste = liste.filter((m) => m.company_id === entreprise)
    if (tranche) liste = liste.filter((m) => lireUsage(m).payee?.profil === tranche)
    if (seulementARevoir) liste = liste.filter((m) => lireUsage(m).etat === 'au-dela')
    // Le plus gros dépassement d'abord : c'est ce qu'on vient chercher. Les
    // magasins sans mesure ferment la marche plutôt que de couper la liste.
    return [...liste].sort((a, b) => (lireUsage(b).part ?? -1) - (lireUsage(a).part ?? -1))
  }, [parc, entreprise, tranche, seulementARevoir])

  async function poserVolume(m: MagasinParc) {
    const units = Number(saisie.replace(/[^\d]/g, ''))
    if (!Number.isFinite(units) || units <= 0) return
    const { data, error } = await supabase.rpc('admin_set_store_volume', {
      p_store_id: m.id, p_units: units,
    })
    const res = data as { success?: boolean; error?: string } | null
    if (error || !res?.success) { setErr(error?.message ?? res?.error ?? 'Échec'); return }
    setEdite(null); setSaisie('')
    await charger()
  }

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const tous = parc?.stores ?? []
  const nARevoir = aRevoir(tous).length
  const ecart = ecartTotalEuros(tous)

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <div>
          <h1 className="page-title">Usage constaté</h1>
          <p className="page-sub">Douze derniers mois · lecture interne, invisible du client</p>
        </div>
      </div>

      {err && <p className="muted">Lecture impossible pour l&apos;instant — {err}</p>}

      {!parc ? (
        <p className="muted">Lecture en cours…</p>
      ) : (
        <div className="dash-detail">

          <div className="dash-rail">
            <div className="panel">
              <h3>Filtrer</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
                <label className="usage-champ">
                  Entreprise
                  <select value={entreprise} onChange={(e) => setEntreprise(e.target.value)}>
                    <option value="">Toutes ({parc.entreprises})</option>
                    {entreprises.map(([id, nom]) => (
                      <option key={id} value={id}>{nom}</option>
                    ))}
                  </select>
                </label>
                <label className="usage-champ">
                  Tranche
                  <select value={tranche} onChange={(e) => setTranche(e.target.value)}>
                    <option value="">Toutes</option>
                    {TRANCHES_CHIFFREES.map((t) => (
                      <option key={t.profil} value={t.profil}>{t.profil}</option>
                    ))}
                  </select>
                </label>
                <div className="usage-champ">
                  <span>Lecture</span>
                  <div className="usage-bascule">
                    <button
                      type="button"
                      aria-pressed={!seulementARevoir}
                      onClick={() => setSeulementARevoir(false)}
                    >
                      Tous
                    </button>
                    <button
                      type="button"
                      aria-pressed={seulementARevoir}
                      onClick={() => setSeulementARevoir(true)}
                    >
                      Au-delà
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ⚠️ Ces totaux couvrent TOUT le parc, jamais la sélection — deux
                d'entre eux (inventaires, compteurs distincts) sont agrégés par
                la base et ne se recalculent pas côté navigateur. D'où le titre :
                sans lui, filtrer sur une entreprise laissait « Magasins 8 » à
                l'écran, ce qui se lit comme un chiffre de la sélection. */}
            <div className="panel">
              <h3>Tout le parc</h3>
              <div className="usage-somme" style={{ marginTop: 8 }}>
                <span className="muted small">Magasins</span><b>{tous.length}</b>
              </div>
              <div className="usage-somme">
                <span className="muted small">Inventaires</span><b>{parc.inventaires}</b>
              </div>
              <div className="usage-somme">
                <span className="muted small">Compteurs distincts</span><b>{parc.compteurs_distincts}</b>
              </div>
              <div className="usage-somme">
                <span className="muted small">Licences / an</span>
                <b style={{ color: 'var(--cyan)' }}>{nb(Math.round(licencesEuros(tous)))} €</b>
              </div>
            </div>

            {nARevoir > 0 && (
              <div className="panel">
                <h3>À porter au renouvellement</h3>
                <p style={{ marginTop: 6 }}>
                  {plural(nARevoir, 'magasin a compté', 'magasins ont compté')} au-delà de sa tranche.
                </p>
                <div
                  className="dash-big"
                  style={{ color: 'var(--warning-text)', fontSize: 34, letterSpacing: '-1px' }}
                >
                  +{nb(ecart)} €
                </div>
                <div className="muted small">par an, si tous passent</div>
              </div>
            )}
          </div>

          <div className="panel" style={{ marginTop: 0 }}>
            <h3>Plancher observé, rapporté à la tranche vendue</h3>
            <p>
              Le plus gros inventaire des douze derniers mois, en part de la borne haute facturée
            </p>

            {visibles.length === 0 ? (
              <p className="muted" style={{ marginTop: 20 }}>
                Aucun magasin ne correspond à ce filtre.
              </p>
            ) : (
              <div style={{ marginTop: 22 }}>
                <div className="usage-plot">
                  <div className="usage-repere" aria-hidden="true" />
                  {visibles.map((m) => {
                    const l = lireUsage(m)
                    const cpt = compteursLisibles(m)
                    const part = l.part
                    // La piste couvre 0 à 150 % : la tranche est aux deux tiers.
                    const dedans = part === null ? 0 : (Math.min(part, 1) / 1.5) * 100
                    const sur = part !== null && part > 1
                      ? ((Math.min(part, 1.5) - 1) / 1.5) * 100
                      : 0
                    return (
                      <div className="usage-ligne" key={m.id}>
                        <Link
                          className="usage-nom"
                          href={`/admin/entreprise/${m.company_id}`}
                          title={`${m.name} — ${m.company_name}`}
                        >
                          {m.name}
                        </Link>
                        <span className="usage-piste">
                          <span className="usage-part" style={{ width: `${dedans}%` }} />
                          {sur > 0 && <span className="usage-sur" style={{ width: `${sur}%` }} />}
                        </span>
                        <span className={`usage-pct${l.etat === 'au-dela' ? ' au-dela' : ''}`}>
                          {part === null ? '—' : `${Math.round(part * 100)} %`}
                        </span>
                        <span className="usage-faits">
                          {m.units === null ? (
                            edite === m.id ? (
                              <span style={{ display: 'inline-flex', gap: 6 }}>
                                <input
                                  className="dash-audit-input"
                                  autoFocus
                                  inputMode="numeric"
                                  value={saisie}
                                  placeholder="pièces"
                                  style={{ width: 80 }}
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
                                Renseigner le volume
                              </button>
                            )
                          ) : m.plancher === null ? (
                            LIBELLES['pas-mesurable']
                          ) : (
                            <>
                              {cpt === null ? 'compteurs n. c.' : plural(cpt, 'compteur')}
                              {' · '}
                              {m.dernier ? relativeTime(m.dernier) : '—'}
                            </>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div className="usage-axe">
                  <span>0 %</span>
                  <span>50 %</span>
                  <span>tranche vendue</span>
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 20,
                paddingTop: 16, borderTop: '1px solid var(--hairline)',
                fontSize: 12.5, color: 'var(--text-2)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <i style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--accent)' }} />
                Dans la tranche
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <i style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--warning)' }} />
                Au-delà de la tranche
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <i
                  style={{
                    width: 11, height: 11, borderRadius: 3,
                    background: 'color-mix(in srgb, var(--text) 10%, transparent)',
                  }}
                />
                Non mesuré
              </span>
            </div>

            <p className="muted small" style={{ marginTop: 16, maxWidth: '78ch' }}>
              Le plancher est le plus gros inventaire <b>unique</b> des douze derniers mois — jamais
              la somme de l&apos;année, un magasin comptant son stock plusieurs fois. Au-dessus de la
              borne de sa tranche, c&apos;est un fait : on ne compte pas ce qu&apos;on n&apos;a pas.
              En dessous, cela ne dit rien — un inventaire tournant ne couvre qu&apos;un rayon.
            </p>
          </div>

        </div>
      )}
    </AppShell>
  )
}
