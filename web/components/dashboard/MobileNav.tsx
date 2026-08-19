'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Navigation mobile du tableau de bord : sur petit écran, la barre d'onglets
 * cède la place à un bouton burger qui ouvre un panneau latéral avec les
 * mêmes sections, plus les liens d'en-tête (Mes inventaires, Mon compte)
 * masqués à cette taille. Le bouton comme le panneau n'existent qu'en dessous
 * du point de bascule (voir globals.css) — au-dessus, ce composant est
 * invisible et la barre d'onglets reprend la main.
 */
export function MobileNav({ tabs, active, onSelect }: {
  tabs: { key: string; label: string }[]
  active: string
  onSelect: (key: string) => void
}) {
  const [open, setOpen] = useState(false)

  // Échap referme, et la page derrière le panneau ne défile pas.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <BurgerIcon />
      </button>

      {open && (
        <div className="mobile-nav-overlay" onClick={() => setOpen(false)}>
          <nav
            className="mobile-nav"
            aria-label="Sections de l’inventaire"
            onClick={e => e.stopPropagation()}
          >
            <div className="mobile-nav-head">
              <span className="dash-section-label">Sections</span>
              <button
                type="button"
                className="mobile-nav-close"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            {tabs.map(t => (
              <button
                key={t.key}
                type="button"
                className={`mobile-nav-item${active === t.key ? ' active' : ''}`}
                aria-current={active === t.key ? 'page' : undefined}
                onClick={() => { onSelect(t.key); setOpen(false) }}
              >
                {t.label}
              </button>
            ))}

            <div className="mobile-nav-sep" />
            <Link href="/dashboard" className="mobile-nav-item">← Mes inventaires</Link>
            <Link href="/account" className="mobile-nav-item">Mon compte</Link>
          </nav>
        </div>
      )}
    </>
  )
}

function BurgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  )
}
