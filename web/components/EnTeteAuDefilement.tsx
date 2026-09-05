'use client'

import { useEffect } from 'react'
import { barreRetiree, retenirPosition } from '@/lib/enTete'

/**
 * La barre s'efface quand on descend, revient quand on remonte.
 *
 * Demande de Julien, 5 septembre 2026 : « je veux qu'ils disparaissent quand on
 * descend et que ça revienne quand on remonte la page, smooth fading in and
 * fading out ». Sur un téléphone, 64 px de barre valent deux lignes de texte —
 * et on ne lit pas la barre pendant qu'on lit la page.
 *
 * Ce composant ne fait que poser une classe ; le mouvement est entièrement en
 * CSS (`transform` et `opacity`, les deux seules propriétés qu'un navigateur
 * anime sans repeindre la page), et `prefers-reduced-motion` le neutralise
 * là-bas. **La décision, elle, vit dans `lib/enTete.ts`** — un onglet masqué ne
 * produit aucune frame, donc aucun `requestAnimationFrame` : une règle laissée
 * ici ne serait pas vérifiable.
 */
export function EnTeteAuDefilement() {
  useEffect(() => {
    const barre = document.querySelector<HTMLElement>('.site-header')
    if (!barre) return

    let precedent = window.scrollY
    let enAttente = false

    const juger = () => {
      enAttente = false
      const etat = {
        y: window.scrollY,
        precedent,
        largeur: window.innerWidth,
        menuOuvert: document.documentElement.classList.contains('menu-ouvert'),
        retiree: barre.classList.contains('retiree'),
      }
      barre.classList.toggle('retiree', barreRetiree(etat))
      if (retenirPosition(etat)) precedent = etat.y
    }

    const auDefilement = () => {
      // Une lecture par image, jamais une par événement : `scrollY` lu dans le
      // gestionnaire force un recalcul de mise en page à chaque pixel.
      if (enAttente) return
      enAttente = true
      requestAnimationFrame(juger)
    }

    window.addEventListener('scroll', auDefilement, { passive: true })
    window.addEventListener('resize', auDefilement, { passive: true })
    return () => {
      window.removeEventListener('scroll', auDefilement)
      window.removeEventListener('resize', auDefilement)
      // Une barre laissée retirée par une navigation ne reviendrait jamais.
      barre.classList.remove('retiree')
    }
  }, [])

  return null
}
