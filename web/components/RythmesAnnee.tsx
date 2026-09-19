'use client'

import { useState } from 'react'

/**
 * « Annuel, tournant, ciblé » sur la page L'inventaire : trois onglets, et
 * pour chacun l'année dessinée en 52 semaines — les semaines où l'on compte
 * sont pleines (refonte du 19 septembre 2026).
 *
 * ⚠️ LE DESSIN EST LA DÉFINITION. L'annuel, c'est une case sur 52 ; le
 * tournant, une zone chaque semaine ; le ciblé, quelques semaines choisies.
 * Trois paragraphes disaient la même chose en quatre lignes chacun ; l'année
 * dessinée le dit avant qu'on ait lu.
 *
 * ⚠️ LES SEMAINES DU CIBLÉ SONT FIXES, pas tirées au hasard à chaque rendu :
 * le serveur et le navigateur dessineraient deux années différentes.
 */
/** `legende` : « 1 semaine comptée sur 52 », déjà traduite et accordée. */
export type Rythme = { titre: string; texte: string; semaines: number[]; legende: string }

export function RythmesAnnee({ rythmes, libelle, mois }: {
  rythmes: Rythme[]
  libelle: string
  /** Les repères sous l'année, déjà traduits (janvier, avril, juillet, octobre, décembre). */
  mois: string[]
}) {
  const [courant, setCourant] = useState(1)
  const r = rythmes[courant]

  return (
    <div className="rythmes">
      <div className="rythmes-onglets" role="tablist" aria-label={libelle}>
        {rythmes.map((x, i) => (
          <button key={x.titre} type="button" role="tab" id={`rythme-${i}`}
            aria-selected={i === courant} aria-controls="rythme-panneau"
            className={i === courant ? 'actif' : undefined} onClick={() => setCourant(i)}>
            {x.titre}
          </button>
        ))}
      </div>
      <div className="rythmes-panneau" id="rythme-panneau" role="tabpanel" aria-labelledby={`rythme-${courant}`}>
        <p>{r.texte}</p>
        <div className="annee" aria-hidden="true">
          {Array.from({ length: 52 }, (_, s) => (
            <i key={s} className={r.semaines.includes(s) ? 'pleine' : undefined} />
          ))}
        </div>
        <div className="annee-mois" aria-hidden="true">
          {mois.map((m) => <span key={m}>{m}</span>)}
        </div>
        <small>{r.legende}</small>
      </div>
    </div>
  )
}
