'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Le diaporama de l'accueil : le rayon, puis le bureau.
 *
 * Deux temps, un visuel et ce qu'il montre — les points apparaissent un par
 * un, une seconde entre chacun, parce qu'une liste qui s'affiche d'un bloc se
 * saute et qu'un point à la fois se lit.
 *
 * ⚠️ IL N'AVANCE PAS TOUT SEUL. Une section qui tourne pendant qu'on la lit se
 * referme souvent avant qu'on ait fini son point. C'est le lecteur qui change
 * de diapositive, par les pastilles ou les flèches.
 *
 * ⚠️ LES TEXTES ARRIVENT DÉJÀ TRADUITS. Ce composant est client, et la langue
 * de la vitrine vient de l'ADRESSE (`/` ou `/en`), pas d'un cookie : c'est donc
 * la page — serveur — qui applique `t()` et passe le résultat. Rien à traduire
 * ici, donc rien qui puisse diverger d'une langue à l'autre.
 */

export type Point = { titre: string; texte: string }
export type Diapo = {
  titre: string
  intro: string
  image: { src: string; alt: string }
  /** Le visuel est-il un paysage (le tableau de bord) plutôt qu'un téléphone ? */
  paysage?: boolean
  points: Point[]
}

const PAS_MS = 1000
const PREMIER_MS = 220

export function DiaporamaProduit({
  diapos,
  precedent,
  suivant,
}: {
  diapos: Diapo[]
  precedent: string
  suivant: string
}) {
  const [courante, setCourante] = useState(0)
  const [vus, setVus] = useState(0)
  const minuteries = useRef<ReturnType<typeof setTimeout>[]>([])

  const aller = useCallback((i: number) => {
    setCourante(((i % diapos.length) + diapos.length) % diapos.length)
  }, [diapos.length])

  useEffect(() => {
    // ⚠️ On nettoie AVANT de reprogrammer : sans ça, changer vite de
    // diapositive laisse les minuteries de la précédente révéler des points
    // sur la nouvelle.
    minuteries.current.forEach(clearTimeout)
    minuteries.current = []

    const douce = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const total = diapos[courante].points.length

    if (douce) { setVus(total); return }

    setVus(0)
    for (let i = 0; i < total; i++) {
      minuteries.current.push(
        setTimeout(() => setVus((n) => Math.max(n, i + 1)), PREMIER_MS + i * PAS_MS),
      )
    }
    return () => {
      minuteries.current.forEach(clearTimeout)
      minuteries.current = []
    }
  }, [courante, diapos])

  return (
    <div className="diaporama">
      {diapos.map((d, n) => (
        <div
          className={`duo${d.paysage ? ' duo--paysage' : ''}`}
          key={d.titre}
          hidden={n !== courante}
        >
          {/*
            ⚠️ LE PAYSAGE PREND TOUTE LA LARGEUR, ET SON TEXTE PASSE DESSOUS.
            Les deux visuels ne peuvent pas avoir la même hauteur en restant
            côte à côte avec leur texte : le téléphone fait 718 px de haut, et
            la capture, deux fois plus large que haute, demanderait 1 500 px de
            large pour l'égaler — plus que la section entière. À pleine largeur
            elle fait 703 px : les deux diapositives ont enfin la même taille.
            Constat de Julien, 11 septembre 2026 : « ça fait trop bizarre
            d'avoir deux tailles ».
          */}
          {d.paysage ? (
            <>
              <Visuel diapo={d} />
              <Propos diapo={d} vus={vus} />
            </>
          ) : (
            <>
              <Visuel diapo={d} />
              <Propos diapo={d} vus={vus} />
            </>
          )}
        </div>
      ))}

      <div className="diaporama-barre">
        <button type="button" className="diaporama-nav" onClick={() => aller(courante - 1)}>
          {precedent}
        </button>
        <div className="diaporama-pastilles">
          {diapos.map((d, n) => (
            <button
              type="button"
              key={d.titre}
              className="diaporama-pastille"
              aria-current={n === courante}
              aria-label={d.titre}
              onClick={() => aller(n)}
            />
          ))}
        </div>
        <button type="button" className="diaporama-nav" onClick={() => aller(courante + 1)}>
          {suivant}
        </button>
      </div>
      <p className="diaporama-legende">{diapos[courante].titre}</p>
    </div>
  )
}

function Visuel({ diapo }: { diapo: Diapo }) {
  return (
    <figure className={diapo.paysage ? 'duo-ecran' : 'duo-tel'}>
      {/*
        <img> et non next/image : ces PNG sont servis à la taille où ils
        s'affichent et jamais redimensionnés côté serveur — même raison que le
        guide de prise en main.

        ⚠️ LE TÉLÉPHONE EST LA CAPTURE ENCADRÉE, sur fond TRANSPARENT : c'est le
        corps du téléphone qui fait le cadre, et `.duo-tel img` ne porte donc ni
        filet, ni ombre, ni rayon. Le tableau de bord, lui, est une capture
        rectangulaire de l'écran réel : celui-là porte un filet.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={diapo.image.src} alt={diapo.image.alt} />
    </figure>
  )
}

function Propos({ diapo, vus }: { diapo: Diapo; vus: number }) {
  return (
    <div className="duo-propos">
      <h3>{diapo.titre}</h3>
      <p className="duo-intro">{diapo.intro}</p>
      <ul className="duo-points">
        {diapo.points.map((p, i) => (
          <li key={p.titre} className={i < vus ? 'vu' : undefined}>
            <span className="duo-coche" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <span><strong>{p.titre}</strong>{p.texte}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
