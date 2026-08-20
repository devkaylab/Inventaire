'use client'

// Apparitions au défilement des pages vitrines.
//
// Le principe : les éléments portent data-reveal (avec un rang optionnel
// pour le décalage au sein d'un groupe), et ce composant — monté par
// SiteHeader, donc présent sur toutes les pages publiques — leur pose la
// classe .reveal puis .reveal-in quand ils entrent dans le champ.
//
// Un écouteur de défilement throttlé par requestAnimationFrame plutôt qu'un
// IntersectionObserver : à vingt éléments par page le coût est négligeable,
// et le comportement est identique partout — y compris dans les navigateurs
// embarqués où l'observateur s'est montré capricieux.
//
// Deux garde-fous, volontairement côté client :
// - sans JavaScript, la classe .reveal n'est jamais posée : rien n'est
//   masqué, la page reste entièrement lisible ;
// - si la personne préfère réduire les animations, on ne pose rien non plus.

import { useEffect } from 'react'

const STEP_MS = 60      // décalage entre éléments d'un même groupe
const MAX_STEPS = 6     // au-delà, tout part ensemble : pas de traîne
const MARGE_PX = 40     // l'élément doit dépasser d'autant le bas de l'écran

export function RevealObserver() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const restants = new Set(
      Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]')),
    )
    if (restants.size === 0) return

    for (const el of restants) {
      const step = Math.min(parseInt(el.dataset.reveal || '0', 10) || 0, MAX_STEPS)
      if (step > 0) el.style.setProperty('--reveal-delay', `${step * STEP_MS}ms`)
      el.classList.add('reveal')
    }

    let timer: ReturnType<typeof setTimeout> | null = null
    function balayer() {
      timer = null
      const seuil = window.innerHeight - MARGE_PX
      for (const el of restants) {
        if (el.getBoundingClientRect().top < seuil) {
          el.classList.add('reveal-in')
          restants.delete(el)
        }
      }
      if (restants.size === 0) detacher()
    }
    // Throttle par minuterie (une passe toutes les ~80 ms au plus) : simple,
    // suffisant pour un fondu, et fiable partout — requestAnimationFrame
    // s'est montré gelé dans certains navigateurs embarqués.
    function demander() {
      if (timer !== null) return
      timer = setTimeout(balayer, 80)
    }
    function detacher() {
      if (timer !== null) clearTimeout(timer)
      clearInterval(veille)
      window.removeEventListener('scroll', demander)
      window.removeEventListener('resize', demander)
    }

    window.addEventListener('scroll', demander, { passive: true })
    window.addEventListener('resize', demander)
    // Filet de sécurité : une passe périodique tant qu'il reste des éléments
    // masqués. Elle couvre les défilements qui n'émettent pas d'événement
    // (ancres, restauration de position, navigateurs embarqués) et s'arrête
    // d'elle-même — detacher() est appelé quand tout est révélé.
    const veille = setInterval(balayer, 250)
    // Premier balayage après un court délai, pour que l'état masqué soit
    // peint avant la transition — sinon le fondu d'arrivée saute.
    timer = setTimeout(balayer, 60)

    return detacher
  }, [])

  return null
}
