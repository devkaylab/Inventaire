'use client'

import { useState } from 'react'

/**
 * Les six raisons de « Pourquoi nous choisir », en onglets : la liste à
 * gauche, l'écran et ses trois points à droite (refonte du 19 septembre 2026).
 *
 * ⚠️ UNE RAISON À LA FOIS, ET LES SIX TITRES TOUJOURS VISIBLES. Les six blocs
 * empilés se lisaient comme un mur ; ici on voit d'un coup d'œil tout ce que
 * la page affirme, et on n'ouvre que ce qui intéresse. Rien ne tourne tout
 * seul : c'est le lecteur qui choisit.
 *
 * ⚠️ SOUS 900 px LA LISTE DEVIENT UNE RANGÉE QUI DÉFILE au-dessus du panneau,
 * sinon six titres empilés repousseraient l'écran hors de la vue.
 *
 * Les textes arrivent déjà traduits, comme pour `Carrousel`.
 */
export type Raison = {
  titre: string
  points: string[]
  image: { src: string; alt: string; large?: boolean }
}

export function OngletsRaisons({ raisons, libelle }: { raisons: Raison[]; libelle: string }) {
  const [courante, setCourante] = useState(0)
  const r = raisons[courante]

  const clavier = (e: React.KeyboardEvent) => {
    const pas = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!pas) return
    e.preventDefault()
    const i = (courante + pas + raisons.length) % raisons.length
    setCourante(i)
    document.getElementById(`raison-onglet-${i}`)?.focus()
  }

  return (
    <div className="raisons">
      <div className="raisons-liste" role="tablist" aria-label={libelle} aria-orientation="vertical" onKeyDown={clavier}>
        {raisons.map((x, i) => (
          <button
            key={x.titre}
            id={`raison-onglet-${i}`}
            type="button"
            role="tab"
            aria-selected={i === courante}
            aria-controls="raison-panneau"
            tabIndex={i === courante ? 0 : -1}
            className={i === courante ? 'actif' : undefined}
            onClick={() => setCourante(i)}
          >
            {x.titre}
          </button>
        ))}
      </div>
      <div
        className={'raisons-panneau' + (r.image.large ? ' raisons-panneau-large' : '')}
        id="raison-panneau"
        role="tabpanel"
        aria-labelledby={`raison-onglet-${courante}`}
        key={courante}
      >
        <div className="raisons-dire">
          <h3>{r.titre}</h3>
          <ul>
            {r.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
        <div className="raisons-vue">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.image.src} alt={r.image.alt} />
        </div>
      </div>
    </div>
  )
}
