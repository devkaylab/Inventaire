'use client'

/**
 * Console — encaissements et versements (20 septembre 2026).
 *
 * Maquette : Admin-Paiements.
 *
 * ⚠️ **QUATRE NOMBRES QUI S'ADDITIONNENT, PAS CINQ QUI SE RESSEMBLENT.**
 * Encaissé − versé − frais = ce qui reste. La page le vérifie à l'affichage et
 * le dit si ça ne tombe pas : c'est ce tableau qu'on regarde pour décider d'un
 * prix, et un écart silencieux s'y installerait pour des mois.
 *
 * ⚠️ **ET CE N'EST PAS NOUS QUI BLOQUONS UN VERSEMENT.** Une personne dont le
 * dossier Stripe n'est pas complet ne peut pas être payée — par Stripe. Elle
 * garde son dû. L'écran doit le dire dans ces termes, sinon on nous le
 * reproche à nous.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { Chargement } from '@/components/Chargement'
import { euros } from '@/lib/offres'

type Du = {
  user_id: string; prenom: string; nom: string; niveau: string; role: string
  mission: string; debut_prevu: string; montant_cents: number
  paiements_ouverts: boolean; compte_ouvert: boolean
}

type Paiements = {
  success: boolean; error?: string
  encaisse_cents: number; inventaires: number
  verse_cents: number; personnes: number
  frais_cents: number; reste_cents: number; marge: number
  a_verser: Du[]
}

export default function AdminPaiementsPage() {
  const guard = useAuthGuard('admin')
  const [p, setP] = useState<Paiements | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_paiements')
    if (error) { setErreur(error.message); return }
    const r = data as Paiements
    if (!r?.success) { setErreur(r?.error ?? 'Lecture impossible.'); return }
    setP(r)
  }, [])

  useEffect(() => { if (guard.status === 'ready') charger() }, [guard.status, charger])

  if (guard.status !== 'ready') return <Chargement />

  // ⚠️ La vérification se fait ICI, pas en base : si les quatre nombres ne se
  // recomposent pas, c'est l'un d'eux qui ment et il faut le voir.
  const coherent = p ? p.encaisse_cents - p.verse_cents - p.frais_cents === p.reste_cents : true
  const bloques = (p?.a_verser ?? []).filter((d) => !d.paiements_ouverts)

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <div>
          <h1 className="page-title">Encaissements et versements</h1>
          <p className="muted">Ce mois-ci, jusqu’à aujourd’hui.</p>
        </div>
      </div>

      {erreur && <p className="field-err">{erreur}</p>}
      {!p && !erreur && <p className="muted">Lecture…</p>}

      {p && !coherent && (
        <p className="field-err">
          Les quatre montants ne se recomposent pas : encaissé − versé − frais ne
          fait pas le reste. Ne décidez rien sur ce tableau tant que ce n’est pas
          réglé.
        </p>
      )}

      {p && (
        <>
          <section className="admin-section">
            <div className="dash-table-wrap">
              <table className="dash-table">
                <tbody>
                  <tr>
                    <td>Encaissé des clients</td>
                    <td className="num">
                      {euros(p.encaisse_cents / 100)}
                      <div className="muted small">
                        {p.inventaires} inventaire{p.inventaires > 1 ? 's' : ''}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Versé aux inventoristes</td>
                    <td className="num">
                      − {euros(p.verse_cents / 100)}
                      <div className="muted small">
                        {p.personnes} personne{p.personnes > 1 ? 's' : ''}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td>Frais et coûts</td>
                    <td className="num">
                      − {euros(p.frais_cents / 100)}
                      <div className="muted small">Stripe, cartes, Connect</div>
                    </td>
                  </tr>
                  <tr>
                    <td><b>Reste à Quantinvo</b></td>
                    <td className="num">
                      <b>{euros(p.reste_cents / 100)}</b>
                      <div className="muted small">
                        {(p.marge * 100).toFixed(1).replace('.', ',')} % de marge
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
                <h2>À verser</h2>
                <p className="muted small">
                  Missions terminées dont le versement n’est pas parti.
                </p>
              </div>
            </div>

            {p.a_verser.length === 0 ? (
              <p className="muted">Rien en attente.</p>
            ) : (
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Inventoriste</th><th>Mission</th>
                      <th>Compte Stripe</th><th className="num">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.a_verser.map((d) => (
                      <tr key={`${d.user_id}-${d.mission}-${d.debut_prevu}`}>
                        <td>
                          {d.prenom} {d.nom}
                          <div className="muted small">
                            {d.role === 'responsable' ? 'Responsable' : 'Inventoriste'}
                          </div>
                        </td>
                        <td>
                          {d.mission}
                          <div className="muted small">
                            {new Date(d.debut_prevu).toLocaleDateString('fr-FR')}
                          </div>
                        </td>
                        <td>
                          {d.paiements_ouverts ? 'Actif'
                            : d.compte_ouvert ? 'En cours de validation' : 'Non ouvert'}
                        </td>
                        <td className="num">{euros(d.montant_cents / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {bloques.length > 0 && (
              <p className="muted small" style={{ marginTop: 14 }}>
                {bloques.length === 1
                  ? 'Une personne ne peut pas être payée : son compte Stripe n’est pas complet.'
                  : `${bloques.length} personnes ne peuvent pas être payées : leur compte Stripe n’est pas complet.`}
                {' '}C’est Stripe qui bloque, pas nous. Elles gardent leur dû, et le
                versement part dès que leur dossier est validé.
              </p>
            )}
          </section>
        </>
      )}
    </AppShell>
  )
}
