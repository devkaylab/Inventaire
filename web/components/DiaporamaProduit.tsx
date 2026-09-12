'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  AUTO_MS,
  PAS_MS,
  PREMIER_MS,
  avanceAutorisee,
  suivante,
} from '../lib/diaporama'

/**
 * Le diaporama de l'accueil : le rayon, puis le bureau.
 *
 * Deux temps, un visuel et ce qu'il montre — les points apparaissent un par
 * un, une seconde entre chacun, parce qu'une liste qui s'affiche d'un bloc se
 * saute et qu'un point à la fois se lit.
 *
 * ⚠️ IL AVANCE TOUT SEUL, ET S'ARRÊTE POUR DE BON AU PREMIER GESTE. Demande de
 * Julien, 12 septembre 2026. Le risque d'une section qui tourne, c'est qu'elle
 * se referme avant qu'on ait fini de lire : quatre garde-fous l'en empêchent —
 * elle ne tourne que lorsqu'elle est À L'ÉCRAN, se met en pause au survol et au
 * clavier, s'arrête définitivement dès qu'on touche une flèche ou une pastille
 * (reprendre la main sur quelqu'un qui vient de choisir serait pire que tout),
 * et ne démarre pas si « moins d'animation » est demandé au système.
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

export function DiaporamaProduit({
  diapos,
  precedent,
  suivant,
  pause,
  lecture,
}: {
  diapos: Diapo[]
  precedent: string
  suivant: string
  pause: string
  lecture: string
}) {
  const [courante, setCourante] = useState(0)
  const [vus, setVus] = useState(0)
  const minuteries = useRef<ReturnType<typeof setTimeout>[]>([])

  /** Le lecteur a demandé la pause — bouton, ou navigation à la main. */
  const [pauseDemandee, setPauseDemandee] = useState(false)
  /** La section est-elle à l'écran, dans un onglet au premier plan ? */
  const [actif, setActif] = useState(false)
  /** Survol de la barre ou focus clavier : on suspend le temps qu'on regarde. */
  const [survol, setSurvol] = useState(false)
  /**
   * ⚠️ TENU EN ÉTAT plutôt que lu au moment de décider, parce que le BOUTON en
   * dépend : sans mouvement automatique, il n'y a rien à mettre en pause, et un
   * bouton qui ne fait rien vaut moins que pas de bouton.
   */
  const [mouvementReduit, setMouvementReduit] = useState(false)
  const scene = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const maj = () => setMouvementReduit(mq.matches)
    maj()
    mq.addEventListener('change', maj)
    return () => mq.removeEventListener('change', maj)
  }, [])

  const aller = useCallback((i: number) => {
    // ⚠️ C'est ICI que l'avance se suspend, et pas dans les gestionnaires de
    // clic : toute navigation volontaire passe par cette fonction, donc aucune
    // commande ajoutée plus tard ne pourra oublier de le faire. Le bouton, lui,
    // permet de la relancer — on ne confisque plus l'avance à qui a touché une
    // flèche.
    setPauseDemandee(true)
    setCourante(((i % diapos.length) + diapos.length) % diapos.length)
  }, [diapos.length])

  // ⚠️ NE TOURNER QUE QUAND ON EST REGARDÉ. Sans ça, la section défile pendant
  // qu'on lit ailleurs sur la page, et on y arrive sur une diapositive prise au
  // hasard. L'onglet en arrière-plan compte pour la même raison.
  useEffect(() => {
    const el = scene.current
    if (!el) return
    let visible = false
    const maj = () => setActif(visible && !document.hidden)
    const obs = new IntersectionObserver(([e]) => { visible = e.isIntersecting; maj() },
      { threshold: 0.35 })
    obs.observe(el)
    document.addEventListener('visibilitychange', maj)
    return () => { obs.disconnect(); document.removeEventListener('visibilitychange', maj) }
  }, [])

  // L'avance elle-même. `courante` est en dépendance : chaque changement
  // réarme le compte à rebours, d'où qu'il vienne.
  useEffect(() => {
    if (!avanceAutorisee({ pauseDemandee, actif, survol, mouvementReduit })) return
    const t = setTimeout(
      () => setCourante((c) => suivante(c, diapos.length)),
      AUTO_MS,
    )
    return () => clearTimeout(t)
  }, [pauseDemandee, actif, survol, mouvementReduit, courante, diapos.length])

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
    <div
      className="diaporama"
      ref={scene}
      /* ⚠️ LE SURVOL DE LA SCÈNE NE MET PAS EN PAUSE, et c'est un correctif :
         cette section fait la hauteur de l'écran et toute sa largeur, donc le
         curseur s'y trouve presque toujours après le défilement qui l'amène.
         La pause y devenait permanente et l'avance n'existait pas — constat de
         Julien, 12 septembre 2026 : « le slideshow ne défile pas ». Elle est
         gardée là où elle veut dire quelque chose : sur la barre de commandes,
         qu'on survole quand on s'apprête à cliquer.
         Le clavier, lui, met toujours en pause : on ne fait pas défiler la
         section sous les doigts de qui la parcourt à la tabulation. */
      onFocusCapture={() => setSurvol(true)}
      onBlurCapture={() => setSurvol(false)}
    >
      {/*
        ⚠️ LES DEUX DIAPOSITIVES SONT EMPILÉES, PAS AFFICHÉES TOUR À TOUR.
        Elles occupent la même cellule de grille et glissent l'une vers
        l'autre — c'est ce qui permet la transition demandée par Julien le
        12 septembre 2026. Une bascule par l'attribut `hidden` poserait
        `display: none`, et il n'y a rien à animer sur un élément qui
        n'occupe plus de place.

        ⚠️ CELLE QU'ON NE VOIT PAS EST RETIRÉE DU CLAVIER ET DES LECTEURS
        D'ÉCRAN (`inert` + `aria-hidden`). Sans ça, la tabulation traverse des
        liens invisibles et une voix de synthèse lit les deux diapositives à
        la suite. C'est ce que `hidden` faisait gratuitement.
      */}
      {diapos.map((d, n) => (
        <div
          className={[
            'duo',
            d.paysage ? 'duo--paysage' : '',
            'diapo',
            n === courante ? 'diapo-active' : n < courante ? 'diapo-avant' : 'diapo-apres',
          ].filter(Boolean).join(' ')}
          key={d.titre}
          aria-hidden={n !== courante}
          inert={n !== courante}
        >
          <Visuel diapo={d} />
          <Propos diapo={d} vus={vus} />
        </div>
      ))}

      <div
        className="diaporama-barre"
        onMouseEnter={() => setSurvol(true)}
        onMouseLeave={() => setSurvol(false)}
      >
        <button type="button" className="diaporama-nav" onClick={() => aller(courante - 1)}>
          {precedent}
        </button>
        <div className="diaporama-centre">
          {/*
            ⚠️ PAS DE BOUTON QUAND RIEN NE BOUGE. « Moins d'animation » coupe
            l'avance : proposer « Pause » n'aurait rien à suspendre, et
            « Lecture » ne relancerait rien.
          */}
          {!mouvementReduit && (
            <button
              type="button"
              className="diaporama-pause"
              onClick={() => setPauseDemandee((p) => !p)}
              aria-label={pauseDemandee ? lecture : pause}
              title={pauseDemandee ? lecture : pause}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {pauseDemandee
                  ? <path d="M8 5v14l11-7z" />
                  : <><rect x="7" y="5" width="3.4" height="14" rx="1" /><rect x="13.6" y="5" width="3.4" height="14" rx="1" /></>}
              </svg>
            </button>
          )}
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
        </div>
        <button type="button" className="diaporama-nav" onClick={() => aller(courante + 1)}>
          {suivant}
        </button>
      </div>
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
