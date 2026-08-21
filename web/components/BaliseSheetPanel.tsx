'use client'

import { useState } from 'react'
import { BALISE_FORMATS, baliseFormat, planBaliseSeries, type BaliseFormat } from '@/lib/baliseSeries'
import { downloadBaliseSheet } from '@/lib/balisePdf'

type Props = {
  /** Contexte d'affichage : la phrase d'accroche s'adapte. */
  context: 'account' | 'setup'
}

/**
 * Création d'une planche de balises, avec le mode d'emploi en trois étapes.
 * Pensé pour des personnes peu à l'aise : on dit ce qu'est une balise, ce
 * qu'il faut imprimer et ce qu'on en fait, avant de demander quoi que ce soit.
 * Aucun stock n'est tenu : le PDF se télécharge, c'est tout.
 */
export function BaliseSheetPanel({ context }: Props) {
  const [format, setFormat] = useState<BaliseFormat>('simple')
  const [start, setStart] = useState(String(baliseFormat('simple').defaultStart))
  const [count, setCount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  function pickFormat(id: BaliseFormat) {
    setFormat(id)
    setStart(String(baliseFormat(id).defaultStart))
    setError(null)
    setDone(null)
  }

  const preview = planBaliseSeries(format, start, count)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const r = planBaliseSeries(format, start, count)
    if (!r.ok) { setError(r.error); setDone(null); return }
    setError(null)
    setBusy(true)
    try {
      const filename = await downloadBaliseSheet(r.series.codes, r.series.from, r.series.to)
      setDone(`Planche téléchargée : ${filename}. Imprimez-la à 100 % (taille réelle) sur des planches Avery L7160.`)
    } catch {
      setError('La planche n’a pas pu être générée. Réessayez, ou créez-la depuis l’application.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel balise-panel">
      <h3>Créer des balises</h3>
      <p>
        {context === 'setup'
          ? 'Avant de compter, chaque emplacement du magasin reçoit des balises : des étiquettes QR numérotées, collées sur place, que les compteurs scannent pour dire où ils sont.'
          : 'Les balises sont des étiquettes QR numérotées, collées dans le magasin, que les compteurs scannent pour dire où ils sont. Elles s’impriment une fois et servent pour tous vos inventaires.'}
      </p>

      <ol className="balise-steps">
        <li>
          <strong>Imprimez</strong> la planche ci-dessous sur des feuilles d’étiquettes autocollantes
          Avery L7160 (21 par page), à 100 % — sans « ajuster à la page ».
        </li>
        <li>
          <strong>Collez</strong> les balises dans le magasin, dans l’ordre des numéros : c’est plus simple
          à retrouver ensuite (par exemple 1 à 10 dans la réserve, 11 à 30 en surface de vente).
        </li>
        <li>
          <strong>Indiquez</strong> dans l’inventaire quelles balises sont à quel endroit
          {context === 'setup' ? ' (juste en dessous)' : ' (onglet Set up de l’inventaire)'}.
        </li>
      </ol>

      <form onSubmit={onSubmit} noValidate>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Numérotation</label>
          <div className="balise-formats" role="radiogroup" aria-label="Numérotation">
            {BALISE_FORMATS.map(f => {
              const on = f.id === format
              return (
                <button
                  key={f.id} type="button" role="radio" aria-checked={on}
                  className={`balise-format${on ? ' on' : ''}`}
                  onClick={() => pickFormat(f.id)}
                >
                  <span>{f.label}</span>
                  <span className="num balise-format-ex">{f.example}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="balise-form">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="balise-start">Premier numéro</label>
            <input
              id="balise-start" className="num" inputMode="numeric" value={start}
              onChange={e => { setStart(e.target.value); setError(null); setDone(null) }}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="balise-count">Nombre de balises</label>
            <input
              id="balise-count" className="num" inputMode="numeric" value={count} placeholder="Ex : 50"
              onChange={e => { setCount(e.target.value); setError(null); setDone(null) }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Préparation…' : 'Télécharger la planche (PDF)'}
          </button>
        </div>

        {error ? (
          <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>
        ) : done ? (
          <p className="balise-done" role="status">{done}</p>
        ) : preview.ok ? (
          <p className="muted small num" style={{ marginTop: 10 }}>
            Balises {preview.series.from} à {preview.series.to} · {Math.ceil(preview.series.codes.length / 21)} page{preview.series.codes.length > 21 ? 's' : ''}
          </p>
        ) : (
          <p className="muted small" style={{ marginTop: 10 }}>
            Pour en ajouter plus tard, reprenez la série au numéro suivant.
          </p>
        )}
      </form>
    </section>
  )
}
