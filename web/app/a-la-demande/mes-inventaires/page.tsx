'use client'

/**
 * Mes inventaires à la demande — l'accueil du client (20 septembre 2026).
 *
 * Maquette : la planche Accueil.
 *
 * ⚠️ **LE PROCHAIN INVENTAIRE EST EN HAUT, SEUL.** C'est la seule chose qui
 * demande peut-être quelque chose au client — quelqu'un pour ouvrir, un fichier
 * de stock à déposer, une annulation à décider. Le reste se consulte.
 *
 * ⚠️ **ET LE PRIX DE CHAQUE ÉTABLISSEMENT EST UNE ESTIMATION**, déduite de son
 * dernier inventaire. Le montant qui engage sort de la base au moment de
 * réserver. Un magasin jamais inventorié n'affiche pas de prix : il affiche
 * « Obtenir un prix ».
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { Chargement } from '@/components/Chargement'
import { euros } from '@/lib/offres'
import { nb } from '@/lib/format'
import { duree } from '@/lib/prixOnDemand'
import {
  estAVenir, mesEtablissements, mesMissions, prixIndicatif,
  type Etablissement, type Mission,
} from '@/lib/onDemandClient'
import { enDateCourte, enDateLongue, enHeure, etatClient } from '@/lib/missionsClient'

export default function MesInventairesPage() {
  const guard = useAuthGuard('supervisor')
  const [missions, setMissions] = useState<Mission[] | null>(null)
  const [etablissements, setEtablissements] = useState<Etablissement[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const [m, e] = await Promise.all([mesMissions(), mesEtablissements()])
      setMissions(m); setEtablissements(e)
    } catch (e) {
      setErreur((e as Error).message)
    }
  }, [])

  useEffect(() => { if (guard.status === 'ready') charger() }, [guard.status, charger])

  if (guard.status !== 'ready') return <Chargement />

  const aVenir = (missions ?? []).filter(estAVenir)
    .sort((a, b) => a.debut_prevu.localeCompare(b.debut_prevu))
  const prochain = aVenir[0] ?? null
  const passees = (missions ?? []).filter((m) => !estAVenir(m))

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <h1 className="page-title">Vos inventaires</h1>
        <div className="app-head-actions">
          <Link href="/reserver" className="btn btn-primary">Réserver un inventaire</Link>
        </div>
      </div>

      {erreur && <p className="field-err">{erreur}</p>}
      {missions === null && !erreur && <p className="muted">Lecture…</p>}

      {missions !== null && missions.length === 0 && (
        <section className="admin-section">
          <h2>Aucun inventaire pour l’instant</h2>
          <p className="muted">
            Trois questions et votre prix s’affiche. Vous ne payez qu’au moment
            de réserver, et l’annulation est gratuite jusqu’à trois jours avant.
          </p>
          <p style={{ marginTop: 18 }}>
            <Link href="/reserver" className="btn btn-primary">Réserver un inventaire</Link>
          </p>
        </section>
      )}

      {prochain && (
        <section className="admin-section">
          <div className="admin-section-head">
            <div><h2>Prochain inventaire</h2></div>
          </div>
          <div className="od-prochain">
            <div>
              <div className="od-prochain-nom">{prochain.magasin_nom}</div>
              <p className="muted">
                {enDateLongue(prochain.debut_prevu)}, {enHeure(prochain.debut_prevu)}
                {' — '}{prochain.inventoristes} inventoriste{prochain.inventoristes > 1 ? 's' : ''}
                {prochain.responsable ? ' et 1 responsable' : ''}
                {' · '}{duree(prochain.duree_prevue_minutes)} environ
              </p>
            </div>
            <span className="dash-badge dash-badge-open">
              <span className="dash-dot" />{etatClient(prochain.etat)}
            </span>
            <Link href={`/a-la-demande/mes-inventaires/${prochain.id}`} className="btn btn-ghost btn-sm">
              Voir le détail
            </Link>
          </div>
        </section>
      )}

      {etablissements !== null && etablissements.length > 0 && (
        <section className="admin-section">
          <div className="admin-section-head">
            <div>
              <h2>Réserver à nouveau</h2>
              <p className="muted small">
                Le prix du dernier inventaire de chaque établissement, à volume égal.
              </p>
            </div>
          </div>
          <div className="acc-inv-list">
            {etablissements.map((e) => {
              const prix = prixIndicatif(e)
              return (
                <Link key={e.id} href="/reserver" className="acc-inv-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="acc-inv-name">{e.name}</div>
                    <div className="muted small" style={{ marginTop: 2 }}>
                      {e.sqm ? `${nb(e.sqm)} m²` : 'surface non renseignée'}
                      {' — '}
                      {e.derniere
                        ? `dernier le ${enDateCourte(e.derniere.debut_prevu)}`
                        : 'jamais inventorié'}
                    </div>
                  </div>
                  <span className="btn btn-ghost btn-sm">
                    {prix === null ? 'Obtenir un prix' : `Réserver — ${euros(prix / 100)}`}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {passees.length > 0 && (
        <section className="admin-section">
          <div className="admin-section-head"><div><h2>Inventaires passés</h2></div></div>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Établissement</th><th>Date</th><th>État</th>
                  <th className="num">Montant</th><th />
                </tr>
              </thead>
              <tbody>
                {passees.map((m) => (
                  <tr key={m.id}>
                    <td>{m.magasin_nom}</td>
                    <td>{enDateCourte(m.debut_prevu)}</td>
                    <td>{etatClient(m.etat)}</td>
                    <td className="num">{euros(m.prix_cents / 100)}</td>
                    <td className="num">
                      <Link href={`/a-la-demande/mes-inventaires/${m.id}`}>Ouvrir</Link>
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
