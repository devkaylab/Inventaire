'use client'

import { useState } from 'react'
import Link from 'next/link'
import { OFFRES, OFFRE_PHARE, SUPPLEMENT, APPAREILS_MAX, PLAFOND_LIBRE_SERVICE, TVA_APPLICABLE, economie, euros } from '@/lib/offres'
import { venteOuverte } from '@/lib/legal'
import { useTraduction } from '@/lib/i18n'

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
  const ouverte = venteOuverte()
  const [annuel, setAnnuel] = useState(false)
  const { t, lien } = useTraduction()

  return (
    <>
      <div className="tarifs-bascule" role="group" aria-label={t('Rythme de paiement')}>
        <button
          type="button"
          className={annuel ? '' : 'actif'}
          aria-pressed={!annuel}
          onClick={() => setAnnuel(false)}
        >
          {t('Par mois')}
        </button>
        <button
          type="button"
          className={annuel ? 'actif' : ''}
          aria-pressed={annuel}
          onClick={() => setAnnuel(true)}
        >
          {t('À l’année')}
        </button>
      </div>

      {/* ⚠️ L'engagement diffère selon le rythme, et c'est ici qu'il se dit :
          le mensuel s'arrête quand on veut, l'annuel court jusqu'à son terme.
          Le taire sous un titre « sans engagement » serait trompeur. */}
      <p className="tarifs-note-bascule">
        {annuel
          ? t('Un seul règlement — de 90 à 900 € de moins selon l’offre. L’année est due jusqu’à son terme.')
          : t('Douze prélèvements, sans engagement : vous arrêtez quand vous voulez.')}
      </p>

      <div className="tarifs-grille">
        {OFFRES.map((o) => {
          const phare = o.cle === OFFRE_PHARE
          return (
            <div className={phare ? 'tarifs-carte phare' : 'tarifs-carte'} key={o.cle}>
              {phare && <span className="tarifs-marqueur">{t('Le plus courant')}</span>}
              <h2>{o.nom}</h2>
              <p className="tarifs-pour">{t(o.pour)}</p>

              <div className="tarifs-prix">
                <div className="montant">
                  <strong>{euros(annuel ? o.an : o.mois)}</strong>
                  <span>{annuel ? `${TVA_APPLICABLE ? t('HT') + ' ' : ''}/ ${t('an')}` : `${TVA_APPLICABLE ? t('HT') + ' ' : ''}/ ${t('mois')}`}</span>
                </div>
                <span className="tarifs-alt">
                  {annuel
                    ? t('pour un magasin, ou %{prix} par mois', { prix: euros(o.mois) })
                    : t('pour un magasin, ou %{prix} à l’année', { prix: euros(o.an) })}
                </span>
                <span className="tarifs-economie">
                  {t('Vous économisez %{prix} à l’année', { prix: euros(economie(o)) })}
                </span>
              </div>

              <div className="tarifs-plage">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <rect x="4.5" y="1.5" width="7" height="13" rx="1.6" />
                  <path d="M7 12.6h2" />
                </svg>
                <span>{t(o.plage)}</span>
              </div>

              <ul className="tarifs-points">
                {o.points.map((p) => (
                  <li key={p}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 8.4 6.2 11.6 13 4.4" />
                    </svg>
                    <span>{t(p)}</span>
                  </li>
                ))}
              </ul>

              {/* Le rythme voyage avec l'offre : la page de souscription
                  s'ouvre sur ce que le visiteur regardait.

                  ⚠️ LES PRIX RESTENT VISIBLES QUAND LA VENTE EST FERMÉE, et
                  c'est délibéré : ils sont publics et vrais depuis le 30 août,
                  les cacher ne protégerait rien et priverait un prospect de ce
                  qu'il est venu chercher. C'est le BOUTON qui change — on ne
                  fait pas cliquer sur « Commencer » pour arriver sur « pas
                  encore ouvert ». */}
              <Link
                href={lien(ouverte
                  ? `/souscrire?offre=${o.cle}${annuel ? '&rythme=annuel' : ''}`
                  : '/inscription')}
                className={phare ? 'btn btn-primary' : 'btn btn-ghost'}
              >
                {ouverte ? t('Commencer avec %{offre}', { offre: o.nom }) : t('Nous écrire')}
              </Link>
            </div>
          )
        })}
      </div>

      {/* ⚠️ « parlons-en » était un reste du monde du devis, supprimé le
          4 septembre 2026 : au-delà de cent appareils l'offre se prolonge et
          s'achète EN LIGNE, par tranches de dix. Et la grille s'arrête à 200
          (décision de Julien du 5 septembre) — le dire ici évite de le
          découvrir au moment de payer. */}
      <p className="tarifs-hors-grille">
        {t('Plus de %{max} appareils dans un même magasin ? L’offre se prolonge par tranches de %{par} appareils, à %{prix} %{rythme} la tranche, jusqu’à %{plafond} appareils. Au-delà, un magasin de plus prend sa propre licence.', {
          max: APPAREILS_MAX, par: SUPPLEMENT.par,
          prix: euros(annuel ? SUPPLEMENT.an : SUPPLEMENT.mois),
          rythme: annuel ? t('par an') : t('par mois'), plafond: PLAFOND_LIBRE_SERVICE,
        })}
      </p>
    </>
  )
}
