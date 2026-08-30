'use client'

import { useState } from 'react'
import Link from 'next/link'
import { OFFRES, OFFRE_PHARE, SUPPLEMENT, APPAREILS_MAX, economie, euros } from '@/lib/offres'

/**
 * Les trois offres, avec la bascule mensuel / annuel.
 *
 * ⚠️ Le mensuel est affiché par défaut — c'est le chiffre auquel un acheteur
 * compare. L'annuel est présenté comme une économie, en euros et jamais en
 * pourcentage : « vous économisez 900 € » pèse plus que « −11,5 % ».
 *
 * Seul ce bloc est client ; la page qui l'accueille reste rendue au serveur
 * (elle porte ses métadonnées).
 */
export function TarifsGrille() {
  const [annuel, setAnnuel] = useState(false)

  return (
    <>
      <div className="tarifs-bascule" role="group" aria-label="Rythme de paiement">
        <button
          type="button"
          className={annuel ? '' : 'actif'}
          aria-pressed={!annuel}
          onClick={() => setAnnuel(false)}
        >
          Par mois
        </button>
        <button
          type="button"
          className={annuel ? 'actif' : ''}
          aria-pressed={annuel}
          onClick={() => setAnnuel(true)}
        >
          À l’année
        </button>
      </div>

      {/* ⚠️ L'engagement diffère selon le rythme, et c'est ici qu'il se dit :
          le mensuel s'arrête quand on veut, l'annuel court jusqu'à son terme.
          Le taire sous un titre « sans engagement » serait trompeur. */}
      <p className="tarifs-note-bascule">
        {annuel
          ? 'Un seul règlement — de 90 à 900 € de moins selon l’offre. L’année est due jusqu’à son terme.'
          : 'Douze prélèvements, sans engagement : vous arrêtez quand vous voulez.'}
      </p>

      <div className="tarifs-grille">
        {OFFRES.map((o) => {
          const phare = o.cle === OFFRE_PHARE
          return (
            <div className={phare ? 'tarifs-carte phare' : 'tarifs-carte'} key={o.cle}>
              {phare && <span className="tarifs-marqueur">Le plus courant</span>}
              <h2>{o.nom}</h2>
              <p className="tarifs-pour">{o.pour}</p>

              <div className="tarifs-prix">
                <div className="montant">
                  <strong>{euros(annuel ? o.an : o.mois)}</strong>
                  <span>{annuel ? 'HT / an' : 'HT / mois'}</span>
                </div>
                <span className="tarifs-alt">
                  {annuel
                    ? `pour un magasin, ou ${euros(o.mois)} par mois`
                    : `pour un magasin, ou ${euros(o.an)} à l’année`}
                </span>
                <span className="tarifs-economie">
                  Vous économisez {euros(economie(o))} à l’année
                </span>
              </div>

              <div className="tarifs-plage">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <rect x="4.5" y="1.5" width="7" height="13" rx="1.6" />
                  <path d="M7 12.6h2" />
                </svg>
                <span>{o.plage}</span>
              </div>

              <ul className="tarifs-points">
                {o.points.map((p) => (
                  <li key={p}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 8.4 6.2 11.6 13 4.4" />
                    </svg>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/inscription"
                className={phare ? 'btn btn-primary' : 'btn btn-ghost'}
              >
                Choisir {o.nom}
              </Link>
            </div>
          )
        })}
      </div>

      <p className="tarifs-hors-grille">
        Plus de {APPAREILS_MAX} appareils dans un même magasin ? Comptez{' '}
        {euros(annuel ? SUPPLEMENT.an : SUPPLEMENT.mois)}{' '}
        {annuel ? 'par an' : 'par mois'} et par tranche de {SUPPLEMENT.par} appareils
        supplémentaires — <Link href="/inscription">parlons-en</Link>.
      </p>
    </>
  )
}
