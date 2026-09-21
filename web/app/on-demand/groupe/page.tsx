'use client'

/**
 * Réserver plusieurs inventaires d'un coup (20 septembre 2026).
 *
 * Maquette : Client-Groupe. Point 49 du plan.
 *
 * ⚠️ **UNE ENSEIGNE NE RETOMBE PAS DANS UN DEVIS.** C'est précisément quand la
 * commande devient grosse qu'on serait tenté d'y revenir — et c'est là que ça
 * tuerait la promesse. Un prix par magasin, une seule réservation, une seule
 * facture.
 *
 * ⚠️ **ET UN MAGASIN NON DESSERVI RESTE DANS LA LISTE**, avec la raison. Le
 * cacher laisserait croire à un oubli de saisie, et l'enseigne chercherait un
 * établissement qu'elle a bien déclaré.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { Chargement } from '@/components/Chargement'
import { euros } from '@/lib/offres'
import { nb } from '@/lib/format'
import { VERSION_CONDITIONS } from '@/lib/conditions'
import {
  DELAI_HEURES, TRANCHES_ARTICLES, chaine, estDesservi,
} from '@/lib/prixOnDemand'
import { mesEtablissements, type Etablissement } from '@/lib/onDemandClient'
import { enDateCourte } from '@/lib/missionsClient'

/** Le code postal décide de la zone ; il vit dans `stores.address`. */
function codePostalDe(e: Etablissement): string {
  return (e.address ?? '').match(/\b(\d{5})\b/)?.[1] ?? ''
}

/** Ce qu'on retiendra pour ce magasin, d'après son dernier inventaire. */
function trancheDe(e: Etablissement): string {
  if (!e.derniere) return ''
  return TRANCHES_ARTICLES.find((t) => t.max >= e.derniere!.articles_retenus)?.cle ?? ''
}

export default function GroupePage() {
  const guard = useAuthGuard('supervisor')
  const [etablissements, setEtablissements] = useState<Etablissement[] | null>(null)
  const [choix, setChoix] = useState<Record<string, { date: string; tranche: string }>>({})
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [resultat, setResultat] = useState<{
    total_cents: number; missions: unknown[]; refus: { magasin: string; code: string }[]
  } | null>(null)

  const charger = useCallback(async () => {
    try { setEtablissements(await mesEtablissements()) }
    catch (e) { setErreur((e as Error).message) }
  }, [])

  useEffect(() => { if (guard.status === 'ready') charger() }, [guard.status, charger])

  const auPlusTot = useMemo(() => {
    const d = new Date(Date.now() + DELAI_HEURES * 3600_000)
    return d.toISOString().slice(0, 10)
  }, [])

  const prixDe = (e: Etablissement) => {
    const c = choix[e.id]
    if (!c?.tranche) return null
    const t = TRANCHES_ARTICLES.find((x) => x.cle === c.tranche)
    return t ? chaine(t.max).prixCents : null
  }

  const retenus = (etablissements ?? []).filter((e) => choix[e.id]?.date && choix[e.id]?.tranche)
  const total = retenus.reduce((s, e) => s + (prixDe(e) ?? 0), 0)

  const reserver = async () => {
    setErreur(null); setOccupe(true)
    const lignes = retenus.map((e) => {
      const c = choix[e.id]
      const t = TRANCHES_ARTICLES.find((x) => x.cle === c.tranche)!
      const adr = e.address ?? ''
      const cp = codePostalDe(e)
      return {
        magasin: e.name,
        adresse: cp ? adr.slice(0, adr.indexOf(cp)).replace(/,\s*$/, '').trim() : adr,
        code_postal: cp,
        ville: cp ? adr.slice(adr.indexOf(cp) + 5).trim() : '',
        secteur: e.derniere?.secteur ?? 'autre',
        articles_min: t.min,
        articles_max: t.max,
        code_barres: 'tous',
        surface_vente: e.sqm ? String(e.sqm) : '',
        // ⚠️ 20:00 par défaut, et c'est une DÉCISION qu'on affiche : « après la
        // fermeture » est le cas le plus fréquent, et l'enseigne peut changer
        // chaque date une par une. Choisir en silence serait pire.
        debut: `${c.date}T20:00:00`,
        moment: 'apres_fermeture',
        engagement: true,
        cgv_version: VERSION_CONDITIONS,
      }
    })
    const { data, error } = await supabase.rpc('reserver_un_groupe', { p_reservations: lignes })
    setOccupe(false)
    if (error) { setErreur(error.message); return }
    const r = data as { success: boolean; code?: string; total_cents: number;
      missions: unknown[]; refus: { magasin: string; code: string }[] }
    if (!r?.success) {
      setErreur(r?.code === 'trop_de_magasins'
        // ⚠️ ON DIT QUOI FAIRE, ON N'INVITE PAS À ÉCRIRE. Une garde du dépôt
        // refuse « écrivez-nous » sans adresse (règle du 22 août 2026), et
        // elle a raison deux fois : ici, réserver en deux fois marche, et
        // c'est plus rapide qu'un e-mail.
        ? 'Vingt inventaires au maximum par réservation. Au-delà, réservez-en une seconde : les dates n’ont pas besoin de se suivre.'
        : 'Aucune de ces réservations n’a pu être prise.')
      return
    }
    setResultat(r)
  }

  if (guard.status !== 'ready') return <Chargement />

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <div>
          <h1 className="page-title">Réserver plusieurs inventaires</h1>
          <p className="muted">
            Un prix par magasin, une seule réservation — et pas de devis, même à
            vingt.
          </p>
        </div>
      </div>

      {erreur && <p className="field-err">{erreur}</p>}

      {resultat ? (
        <section className="admin-section">
          <h2>{resultat.missions.length} inventaire{resultat.missions.length > 1 ? 's' : ''} réservé{resultat.missions.length > 1 ? 's' : ''}</h2>
          <p className="muted">
            Total : <b>{euros(resultat.total_cents / 100)}</b>. Chacun garde son
            équipe, son suivi et son rapport. Une seule facture.
          </p>
          {resultat.refus.length > 0 && (
            <>
              <p className="muted small" style={{ marginTop: 14 }}>Non pris :</p>
              <ul className="od-prevoir">
                {resultat.refus.map((r) => (
                  <li key={r.magasin}>
                    {r.magasin} — {r.code === 'hors_zone' ? 'nous n’allons pas encore là-bas'
                      : r.code === 'trop_tot' ? 'date trop proche'
                      : 'réservation impossible'}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p style={{ marginTop: 18 }}>
            <Link href="/on-demand/mes-inventaires" className="btn btn-primary">
              Voir mes inventaires
            </Link>
          </p>
        </section>
      ) : (
        <>
          <section className="admin-section">
            <div className="admin-section-head">
              <div>
                <h2>Vos établissements</h2>
                <p className="muted small">
                  Choisissez une date et un volume pour chacun de ceux que vous
                  voulez réserver.
                </p>
              </div>
            </div>

            {etablissements === null && <p className="muted">Lecture…</p>}

            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Magasin</th><th>Dernier inventaire</th>
                    <th>Date choisie</th><th>Volume</th><th className="num">Prix</th>
                  </tr>
                </thead>
                <tbody>
                  {(etablissements ?? []).map((e) => {
                    const cp = codePostalDe(e)
                    const desservi = cp !== '' && estDesservi(cp)
                    const c = choix[e.id] ?? { date: '', tranche: trancheDe(e) }
                    const prix = prixDe(e)
                    return (
                      <tr key={e.id} style={{ opacity: desservi ? 1 : 0.55 }}>
                        <td>
                          {e.name}
                          <div className="muted small">
                            {e.address ?? 'adresse non renseignée'}
                            {e.sqm ? ` · ${nb(e.sqm)} m²` : ''}
                          </div>
                        </td>
                        <td>
                          {e.derniere ? enDateCourte(e.derniere.debut_prevu)
                            : <span className="muted">Jamais</span>}
                        </td>
                        <td>
                          {desservi ? (
                            <input type="date" min={auPlusTot} value={c.date}
                                   onChange={(ev) => setChoix((s) => ({
                                     ...s, [e.id]: { ...c, date: ev.target.value },
                                   }))} />
                          ) : (
                            <span className="muted">Pas encore desservi</span>
                          )}
                        </td>
                        <td>
                          {desservi ? (
                            <select value={c.tranche}
                                    onChange={(ev) => setChoix((s) => ({
                                      ...s, [e.id]: { ...c, tranche: ev.target.value },
                                    }))}>
                              <option value="">Choisir…</option>
                              {TRANCHES_ARTICLES.map((t) => (
                                <option key={t.cle} value={t.cle}>{t.nom}</option>
                              ))}
                            </select>
                          ) : <span className="muted">—</span>}
                        </td>
                        <td className="num">
                          {prix === null ? <span className="muted">—</span> : euros(prix / 100)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-section">
            <div className="od-prochain">
              <div>
                <div className="od-prochain-nom">
                  {retenus.length === 0
                    ? 'Aucun inventaire sélectionné'
                    : `${retenus.length} inventaire${retenus.length > 1 ? 's' : ''}`}
                </div>
                <p className="muted">
                  Chacun garde son équipe, son suivi et son rapport. Une seule
                  facture. Départ à 20:00 — vous pourrez décaler chaque
                  inventaire ensuite.
                </p>
              </div>
              <div>
                <div className="muted small">Total</div>
                <b className="num" style={{ fontSize: 22 }}>{euros(total / 100)}</b>
              </div>
              <button type="button" className="btn btn-primary"
                      disabled={occupe || retenus.length === 0} onClick={reserver}>
                {occupe ? 'Réservation…' : `Réserver les ${retenus.length} — ${euros(total / 100)}`}
              </button>
            </div>
          </section>
        </>
      )}
    </AppShell>
  )
}
