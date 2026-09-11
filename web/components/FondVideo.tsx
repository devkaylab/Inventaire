'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * La vidéo de fond du héros.
 *
 * ⚠️ ELLE NE CHANGE PAS LA HAUTEUR DE LA SECTION. Elle est posée en absolu sur
 * toute la surface et recadrée (`object-fit: cover`) : c'est la vidéo qui
 * s'ajuste au héros, jamais l'inverse.
 *
 * ⚠️ ET ELLE NE SE TÉLÉCHARGE PAS TOUJOURS. Deux mégaoctets imposés à quelqu'un
 * en 4G dans une réserve, pour un décor, ce serait le prendre en otage. La
 * source n'est posée qu'après le montage, et seulement si :
 *   · le visiteur n'a pas demandé « moins d'animation » — une vidéo qui tourne
 *     est exactement ce que cette préférence vise ;
 *   · l'écran est assez large pour que le décor serve à quelque chose.
 * Dans les deux autres cas il reste l'image d'attente, qui pèse 130 Ko et dit
 * la même chose.
 */
export function FondVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [source, setSource] = useState<string | null>(null)

  useEffect(() => {
    const douce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (douce || window.innerWidth < 900) return
    setSource(src)
  }, [src])

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
