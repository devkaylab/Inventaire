'use client'

// Parallaxe au défilement des pages vitrines.
//
// Le principe : les couches de décor portent data-plx (leur vitesse), et ce
// composant — monté par SiteHeader, comme RevealObserver — les décale à
// chaque défilement, proportionnellement à leur distance au centre de
// l'écran. Le contenu du héros plein écran porte data-hero-exit : il remonte
// et s'estompe quand on quitte le premier écran.
//
// La position de repos de chaque couche est mesurée une fois (transform
// neutralisé le temps de la mesure) : calculer depuis scrollY évite la
// boucle de rétroaction qu'introduirait une lecture du rectangle transformé.
//
// Mise à jour directe dans l'écouteur, sans requestAnimationFrame : les
// événements scroll sont déjà alignés sur les images dans les navigateurs
// modernes, et rAF s'est montré gelé dans certains navigateurs embarqués —
// même constat que RevealObserver.
//
// Deux garde-fous, les mêmes que les apparitions :
// - sans JavaScript, rien ne bouge mais tout le décor est visible à sa
//   position de repos ;
// - si la personne préfère réduire les animations, on ne bouge rien non plus.

import { useEffect } from 'react'

type Couche = { el: HTMLElement; vitesse: number; centre: number }

export function Parallaxe() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const heros = document.querySelector<HTMLElement>('[data-hero-exit]')
    let couches: Couche[] = []

    function mesurer() {
      couches = Array.from(document.querySelectorAll<HTMLElement>('[data-plx]')).map((el) => {
        const avant = el.style.transform
        el.style.transform = 'none'
        const r = el.getBoundingClientRect()
        el.style.transform = avant
        return {
          el,
          vitesse: parseFloat(el.dataset.plx || '') || 0.2,
          centre: r.top + window.scrollY + r.height / 2,
        }
      })
    }

    function peindre() {
      const y = window.scrollY
      const vh = window.innerHeight
      for (const c of couches) {
        const d = (y + vh / 2 - c.centre) * c.vitesse
        c.el.style.transform = `translate3d(0, ${d.toFixed(1)}px, 0)`
      }
      if (heros) {
        const k = Math.min(1, y / (vh * 0.9))
        heros.style.transform = `translate3d(0, ${(y * -0.28).toFixed(1)}px, 0)`
        heros.style.opacity = String(1 - k * 0.9)
      }
    }

    function surRedim() {
      mesurer()
      peindre()
    }

    mesurer()
    if (couches.length === 0 && !heros) return

    peindre()
    window.addEventListener('scroll', peindre, { passive: true })
    window.addEventListener('resize', surRedim)
    return () => {
      window.removeEventListener('scroll', peindre)
      window.removeEventListener('resize', surRedim)
    }
  }, [])

  return null
}

/**
 * Cube filaire décoratif des pages vitrines — l'esquisse du cube du logo,
 * au trait. Il prend la couleur de son conteneur (currentColor) : c'est la
 * classe du calque qui choisit le jeton, et le thème suit tout seul.
 */
export function CubeFilaire({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.6}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </svg>
  )
}
