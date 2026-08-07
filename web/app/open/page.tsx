'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

// Schéma de l'app mobile (app.json → "scheme": "quantinvo").
const APP_SCHEME = 'quantinvo://'

export default function OpenAppPage() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    const mobile = /iphone|ipad|ipod|android/i.test(ua)
    setIsMobile(mobile)
    if (mobile) {
      // Tente d'ouvrir l'application installée.
      window.location.href = APP_SCHEME
    }
  }, [])

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="head">
          <Link href="/"><Logo size={56} /></Link>
          <h1>Quantinvo</h1>
          {isMobile === false ? (
            <p className="sub">
              Pour compter et auditer, ouvrez l&apos;application Quantinvo sur votre téléphone.
              Les superviseurs peuvent aussi accéder à leur tableau de bord sur le web.
            </p>
          ) : (
            <p className="sub">Ouverture de l&apos;application Quantinvo…</p>
          )}
        </div>

        {isMobile === false ? (
          <Link href="/login" className="btn btn-primary btn-block">Accéder à mon espace</Link>
        ) : (
          <a href={APP_SCHEME} className="btn btn-primary btn-block">Ouvrir l&apos;application</a>
        )}

        {isMobile && (
          <p className="sub" style={{ marginTop: 16, fontSize: 13 }}>
            Si rien ne se passe, installez d&apos;abord l&apos;application Quantinvo, puis rouvrez ce lien.
          </p>
        )}

        <div className="center-link" style={{ marginTop: 16 }}>
          <Link href="/login">Continuer sur le web</Link>
        </div>
      </div>
    </div>
  )
}
