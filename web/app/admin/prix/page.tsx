'use client'

/**
 * Console — les réglages du prix (20 septembre 2026).
 *
 * Maquette : Admin-Prix.
 *
 * ⚠️ **L'APERÇU EST CALCULÉ PAR LA BASE, PAS PAR CETTE PAGE.** C'est le seul
 * écran où l'on décide d'un taux horaire : le voir passer de 666 € à 512 €
 * pendant qu'on tape est tout l'intérêt, et une septième copie de la chaîne
 * ici mentirait le jour où elle dériverait. La page appelle `admin_apercu_prix`
 * après chaque changement enregistré.
 *
 * ⚠️ **ET UNE VERSION NE SE MODIFIE PAS — ON EN POSE UNE NEUVE.** Enregistrer
 * crée une version datée et signée ; les missions déjà réservées gardent la
 * leur. Le bouton dit donc « Poser une nouvelle version », pas « Enregistrer ».
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { Chargement } from '@/components/Chargement'
import { euros } from '@/lib/offres'
import { duree } from '@/lib/prixOnDemand'

type Reglages = {
  version: number
  taux_inventoriste_cents: number
  taux_responsable_cents: number
  productivite: number
  duree_cible_minutes: number
  frais_fixes_cents: number
  responsable_des_n: number
  arrondi_minutes: number
  marge_cible: number
  marge_minimum: number
  pose_le: string
  note: string | null
}

type Apercu = {
  success: boolean
  inventoristes?: number
  responsable?: boolean
  duree_minutes?: number
  equipe_cents?: number
  frais_cents?: number
  cout_cents?: number
  prix_cents?: number
  marge?: number
}

/** Les champs modifiables, et ce qu'ils touchent. Un seul endroit. */
const CHAMPS: { cle: keyof Reglages; libelle: string; suffixe: string; euros?: boolean }[] = [
  { cle: 'taux_inventoriste_cents', libelle: 'Inventoriste, par heure', suffixe: '€', euros: true },
  { cle: 'taux_responsable_cents', libelle: 'Responsable, par heure', suffixe: '€', euros: true },
  { cle: 'productivite', libelle: 'Productivité retenue', suffixe: 'art./h' },
  { cle: 'duree_cible_minutes', libelle: 'Durée cible', suffixe: 'min' },
  { cle: 'frais_fixes_cents', libelle: 'Frais fixes par mission', suffixe: '€', euros: true },
  { cle: 'responsable_des_n', libelle: 'Un responsable à partir de', suffixe: 'inventoristes' },
]

export default function AdminPrixPage() {
  const guard = useAuthGuard('admin')
  const [reglages, setReglages] = useState<Reglages | null>(null)
  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [modifs, setModifs] = useState<Record<string, string>>({})
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const charger = useCallback(async () => {
    const [r, a] = await Promise.all([
      supabase.from('reglages_prix').select('*').eq('en_vigueur', true).maybeSingle(),
      supabase.rpc('admin_apercu_prix', { p_articles: 20000, p_secteur: 'textile' }),
    ])
    if (r.error) { setErreur(r.error.message); return }
    setReglages(r.data as Reglages)
    setModifs({})
    if (!a.error) setApercu(a.data as Apercu)
  }, [])

  useEffect(() => { if (guard.status === 'ready') charger() }, [guard.status, charger])

  const poser = async () => {
    if (!reglages) return
    setErreur(null); setOccupe(true)
    const valeurs: Record<string, number> = {}
    for (const c of CHAMPS) {
      const saisi = modifs[c.cle]
      if (saisi === undefined || saisi === '') continue
      valeurs[c.cle] = c.euros ? Math.round(Number(saisi) * 100) : Number(saisi)
    }
    for (const cle of ['marge_cible', 'marge_minimum']) {
      const saisi = modifs[cle]
      if (saisi !== undefined && saisi !== '') valeurs[cle] = Number(saisi) / 100
    }
    const { data, error } = await supabase.rpc('admin_poser_reglages_prix', { p_valeurs: valeurs })
    setOccupe(false)
    if (error) { setErreur(error.message); return }
    const res = data as { success: boolean; error?: string }
    if (!res?.success) { setErreur(res?.error ?? 'Enregistrement impossible.'); return }
    charger()
  }

  if (guard.status !== 'ready') return <Chargement />

  const valeur = (c: typeof CHAMPS[number]) => {
    if (modifs[c.cle] !== undefined) return modifs[c.cle]
    if (!reglages) return ''
    const v = reglages[c.cle] as number
    return String(c.euros ? v / 100 : v)
  }
  const aChange = Object.values(modifs).some((v) => v !== '')

  return (
    <AppShell profile={guard.profile}>
      <div className="app-head">
        <div>
          <h1 className="page-title">Les réglages du prix</h1>
          <p className="muted">
            Changer une valeur ici change ce que le prochain client verra. Les
            missions déjà réservées gardent leur prix.
          </p>
        </div>
      </div>

      {erreur && <p className="field-err">{erreur}</p>}
      {!reglages && !erreur && <p className="muted">Lecture…</p>}

      {reglages && (
        <>
          <section className="admin-section">
            <div className="admin-section-head">
              <div>
                <h2>Ce qu’on paie</h2>
                <p className="muted small">
                  Version {reglages.version} en vigueur depuis le{' '}
                  {new Date(reglages.pose_le).toLocaleDateString('fr-FR')}.
                </p>
              </div>
            </div>
            {CHAMPS.map((c) => (
              <div className="field" key={c.cle}>
                <label htmlFor={`prix-${c.cle}`}>{c.libelle}</label>
                <input id={`prix-${c.cle}`} inputMode="decimal" value={valeur(c)}
                       onChange={(e) => setModifs((m) => ({ ...m, [c.cle]: e.target.value }))} />
                <p className="field-hint">{c.suffixe}</p>
              </div>
            ))}
          </section>

          <section className="admin-section">
            <div className="admin-section-head"><div><h2>Ce qui protège</h2></div></div>
            <div className="field">
              <label htmlFor="prix-marge">Marge cible</label>
              <input id="prix-marge" inputMode="decimal"
                     value={modifs.marge_cible ?? String(reglages.marge_cible * 100)}
                     onChange={(e) => setModifs((m) => ({ ...m, marge_cible: e.target.value }))} />
              <p className="field-hint">% — c’est elle qui fait le prix</p>
            </div>
            <div className="field">
              <label htmlFor="prix-min">Marge minimum</label>
              <input id="prix-min" inputMode="decimal"
                     value={modifs.marge_minimum ?? String(reglages.marge_minimum * 100)}
                     onChange={(e) => setModifs((m) => ({ ...m, marge_minimum: e.target.value }))} />
              <p className="field-hint">% — en dessous, on refuse de servir</p>
            </div>
            <p className="muted small">
              La durée est arrondie à la demi-heure supérieure — c’est là qu’est
              la marge de sécurité, et il n’en faut pas d’autre.
            </p>
          </section>

          {apercu?.success && (
            <section className="admin-section">
              <div className="admin-section-head">
                <div>
                  <h2>Sur une mission type</h2>
                  <p className="muted small">
                    600 m², 20 000 articles, textile, un mardi à 20:00 — calculé
                    par la base, avec la version en vigueur.
                  </p>
                </div>
              </div>
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <tbody>
                    <tr><td>Durée calculée</td><td className="num">{duree(apercu.duree_minutes ?? 0)}</td></tr>
                    <tr>
                      <td>Équipe</td>
                      <td className="num">
                        {apercu.inventoristes} + {apercu.responsable ? 1 : 0}
                      </td>
                    </tr>
                    <tr><td>Versé à l’équipe</td><td className="num">{euros((apercu.equipe_cents ?? 0) / 100)}</td></tr>
                    <tr><td>Frais fixes</td><td className="num">{euros((apercu.frais_cents ?? 0) / 100)}</td></tr>
                    <tr><td><b>Prix affiché</b></td><td className="num"><b>{euros((apercu.prix_cents ?? 0) / 100)}</b></td></tr>
                    <tr>
                      <td>Marge</td>
                      <td className="num">{((apercu.marge ?? 0) * 100).toFixed(1).replace('.', ',')} %</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="admin-section">
            <h2>Le calcul vit en base</h2>
            <p className="muted">
              Le navigateur affiche, le serveur calcule. Un prix qui viendrait de
              la page laisserait réserver à un centime.
            </p>
            <p style={{ marginTop: 18 }}>
              <button type="button" className="btn btn-primary" disabled={occupe || !aChange}
                      onClick={poser}>
                {occupe ? 'Enregistrement…' : 'Poser une nouvelle version'}
              </button>
            </p>
            <p className="muted small" style={{ marginTop: 10 }}>
              Chaque changement est daté et signé dans le journal des actions.
              La version actuelle reste lisible : les missions vendues la gardent.
            </p>
          </section>
        </>
      )}
    </AppShell>
  )
}
