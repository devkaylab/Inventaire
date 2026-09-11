'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * La vidéo de fond du héros.
 *
 * ⚠️ ELLE NE CHANGE PAS LA HAUTEUR DE LA SECTION. Elle est posée en absolu sur
 * toute la surface et recadrée (`object-fit: cover`) : c'est la vidéo qui
 * s'ajuste au héros, jamais l'inverse.
 *
 * ⚠️ DEUX FICHIERS, ET C'EST LA LARGEUR QUI CHOISIT. Le grand fait 1920 px et
 * 2,1 Mo, le petit 960 px et 0,86 Mo. Elle jouait d'abord sur le seul bureau —
 * je l'avais bridée pour ne pas imposer deux mégaoctets en 4G. Julien la veut
 * sur mobile aussi (11 septembre 2026) : elle y va, avec le fichier taillé pour
 * lui. Un téléphone de 390 px n'a rien à faire d'une source en 1920.
 *
 * ⚠️ LA SEULE CHOSE QUI L'EMPÊCHE ENCORE DE PARTIR, c'est « moins d'animation ».
 * Ce n'est pas une économie de données, c'est une préférence d'accessibilité :
 * une vidéo qui tourne est exactement ce qu'elle vise. Il reste alors l'image
 * d'attente, 130 Ko, qui dit la même chose.
 */
export function FondVideo({
  src,
  srcMobile,
  poster,
}: {
  src: string
  srcMobile: string
  poster: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [source, setSource] = useState<string | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setSource(window.innerWidth < 900 ? srcMobile : src)
  }, [src, srcMobile])

  useEffect(() => {
    if (!source) return
    // `play()` peut être refusée (onglet en arrière-plan, économie d'énergie) :
    // ce n'est pas une erreur, l'image d'attente reste affichée.
    ref.current?.play().catch(() => {})
  }, [source])

  return (
    <video
      ref={ref}
      className="hero-film"
      poster={poster}
      src={source ?? undefined}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      tabIndex={-1}
    />
  )
}
