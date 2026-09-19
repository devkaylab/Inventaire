'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Une rangée de cartes qui défile à l'horizontale, avec ses flèches et ses
 * pastilles — le motif de Qonto sur sa bande noire (« Tout pour gérer vos
 * finances »), relevé sur leur page commerçant le 19 septembre 2026.
 *
 * ⚠️ IL N'AVANCE PAS TOUT SEUL. Le diaporama de l'accueil le fait, avec quatre
 * garde-fous pour ne pas refermer une diapositive qu'on lit ; ici, cinq cartes
 * se voient déjà à moitié côte à côte, et c'est le lecteur qui fait défiler —
 * au doigt, à la molette ou par les flèches. Rien à mettre en pause, donc
 * rien qui puisse reprendre la main sur lui.
 *
 * ⚠️ LE DÉFILEMENT EST CELUI DU NAVIGATEUR (`scroll-snap`), pas une
 * translation calculée : le geste du doigt, le clavier et la molette marchent
 * sans une ligne de code, et la carte visible se DÉDUIT de la position au
 * lieu d'être tenue en double.
 *
 * Les textes arrivent déjà traduits, comme pour `DiaporamaProduit`.
 */
export type Carte = {
  titre: string
  texte: string
  image: { src: string; alt: string }
}

export function Carrousel({
  cartes,
  precedent,
  suivant,
  aller,
}: {
  cartes: Carte[]
  precedent: string
  suivant: string
  /** « Aller à la position %{n} », déjà traduit, où `%{n}` est remplacé ici. */
  aller: string
}) {
  const piste = useRef<HTMLDivElement>(null)
  /**
   * ⚠️ LES PASTILLES SONT LES POSITIONS ATTEIGNABLES, PAS LES CARTES. Arrivée
   * au bout de la rangée, les dernières cartes ne peuvent plus venir se caler
   * à gauche : elles partagent toutes la même position, celle de la fin. Une
   * pastille par carte faisait sauter du deuxième point au dernier, puis
   * bloquait le retour — la flèche visait une carte que le défilement ne peut
   * pas atteindre, et la position ne bougeait pas (constat de Julien,
   * 19 septembre 2026). C'est aussi ce que fait Qonto : deux pastilles pour
   * cinq cartes, quand il n'y a que deux positions.
   */
  const [positions, setPositions] = useState<number[]>([0])
  const [courante, setCourante] = useState(0)

  useEffect(() => {
    const el = piste.current
    if (!el) return
    let pos: number[] = [0]
    const mesurer = () => {
      const max = el.scrollWidth - el.clientWidth
      const debut = (el.children[0] as HTMLElement | undefined)?.offsetLeft ?? 0
      const brutes = [...el.children].map((c) => Math.min((c as HTMLElement).offsetLeft - debut, max))
      pos = brutes.filter((p, i) => i === 0 || p - brutes[i - 1] > 2)
      setPositions(pos)
      suivre()
    }
    const suivre = () => {
      let proche = 0
      pos.forEach((p, i) => { if (Math.abs(p - el.scrollLeft) < Math.abs(pos[proche] - el.scrollLeft)) proche = i })
      setCourante(proche)
    }
    mesurer()
    el.addEventListener('scroll', suivre, { passive: true })
    // La largeur de la piste change avec la fenêtre, mais aussi quand les
    // polices arrivent : la fenêtre seule ne suffit pas, l'observateur seul
    // non plus (il se tait dans un onglet en arrière-plan).
    const obs = new ResizeObserver(mesurer)
    obs.observe(el)
    window.addEventListener('resize', mesurer)
    return () => { el.removeEventListener('scroll', suivre); obs.disconnect(); window.removeEventListener('resize', mesurer) }
  }, [cartes.length])

  const vers = (i: number) => {
    const el = piste.current
    if (!el) return
    const cible = positions[Math.max(0, Math.min(positions.length - 1, i))]
    const douce = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: cible, behavior: douce ? 'smooth' : 'auto' })
    // La pastille suit tout de suite : sans ça, un second clic pendant le
    // glissement partirait de l'ancienne position.
    setCourante(Math.max(0, Math.min(positions.length - 1, i)))
  }

  return (
    <div className="carrousel">
      <div className="carrousel-piste" ref={piste}>
        {cartes.map((c) => (
          <article className="carrousel-carte" key={c.titre}>
            <h3>{c.titre}</h3>
            <p>{c.texte}</p>
            <div className="carrousel-vue">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image.src} alt={c.image.alt} loading="lazy" />
            </div>
          </article>
        ))}
      </div>
      <div className="carrousel-commandes">
        <button type="button" className="carrousel-fleche" onClick={() => vers(courante - 1)}
          disabled={courante === 0} aria-label={precedent}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="carrousel-points">
          {positions.map((p, i) => (
            <button type="button" key={p} onClick={() => vers(i)}
              className={i === courante ? 'actif' : undefined}
              aria-label={aller.replace('%{n}', String(i + 1))}
              aria-current={i === courante ? 'true' : undefined} />
          ))}
        </div>
        <button type="button" className="carrousel-fleche" onClick={() => vers(courante + 1)}
          disabled={courante >= positions.length - 1} aria-label={suivant}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}
