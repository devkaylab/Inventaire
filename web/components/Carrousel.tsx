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
  /** « Aller à la carte %{n} », déjà traduit, où `%{n}` est remplacé ici. */
  aller: string
}) {
  const piste = useRef<HTMLDivElement>(null)
  const [courante, setCourante] = useState(0)

  useEffect(() => {
    const el = piste.current
    if (!el) return
    const maj = () => {
      const pas = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0
      // ⚠️ Arrivé au bout, la dernière carte ne peut pas venir à gauche : on
      // la désigne quand même, sinon sa pastille ne s'allumerait jamais.
      const auBout = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      setCourante(auBout ? cartes.length - 1 : Math.round(el.scrollLeft / (pas + gap)))
    }
    maj()
    el.addEventListener('scroll', maj, { passive: true })
    window.addEventListener('resize', maj)
    return () => { el.removeEventListener('scroll', maj); window.removeEventListener('resize', maj) }
  }, [cartes.length])

  const vers = (i: number) => {
    const el = piste.current
    const cible = el?.children[Math.max(0, Math.min(cartes.length - 1, i))] as HTMLElement | undefined
    if (!el || !cible) return
    el.scrollTo({ left: cible.offsetLeft - el.offsetLeft, behavior: 'smooth' })
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
          {cartes.map((c, i) => (
            <button type="button" key={c.titre} onClick={() => vers(i)}
              className={i === courante ? 'actif' : undefined}
              aria-label={aller.replace('%{n}', String(i + 1))}
              aria-current={i === courante ? 'true' : undefined} />
          ))}
        </div>
        <button type="button" className="carrousel-fleche" onClick={() => vers(courante + 1)}
          disabled={courante === cartes.length - 1} aria-label={suivant}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  )
}
