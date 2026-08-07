'use client'

import { useEffect, useState } from 'react'

type Pref = 'system' | 'light' | 'dark'
const KEY = 'quantinvo-theme'
const NEXT: Record<Pref, Pref> = { system: 'light', light: 'dark', dark: 'system' }

function resolveDark(pref: Pref) {
  return pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
}
function apply(pref: Pref) {
  document.documentElement.dataset.theme = resolveDark(pref) ? 'dark' : 'light'
}

function ThemeGlyph({ pref }: { pref: Pref }) {
  if (pref === 'light') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2.5" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="21.5" />
        <line x1="2.5" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="21.5" y2="12" />
        <line x1="5.2" y1="5.2" x2="7" y2="7" /><line x1="17" y1="17" x2="18.8" y2="18.8" />
        <line x1="18.8" y1="5.2" x2="17" y2="7" /><line x1="7" y1="17" x2="5.2" y2="18.8" />
      </svg>
    )
  }
  if (pref === 'dark') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 14.4A8.2 8.2 0 1 1 9.6 4a6.6 6.6 0 0 0 10.4 10.4z" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <line x1="8.5" y1="20.5" x2="15.5" y2="20.5" /><line x1="12" y1="16.5" x2="12" y2="20.5" />
    </svg>
  )
}

export function ThemeToggle() {
  const [pref, setPref] = useState<Pref>('system')

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Pref | null) ?? 'system'
    setPref(stored)
    // Suivre les changements système quand la préférence est « système ».
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (((localStorage.getItem(KEY) as Pref | null) ?? 'system') === 'system') apply('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function cycle() {
    const next = NEXT[pref]
    setPref(next)
    localStorage.setItem(KEY, next)
    apply(next)
  }

  const label = pref === 'system' ? 'Système' : pref === 'light' ? 'Clair' : 'Sombre'

  return (
    <button className="theme-toggle" onClick={cycle} aria-label={`Thème : ${label}`} title={`Thème : ${label} (cliquer pour changer)`}>
      <ThemeGlyph pref={pref} />
    </button>
  )
}
