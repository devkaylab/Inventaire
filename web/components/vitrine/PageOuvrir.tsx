'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StoreBadges } from '@/components/StoreBadges'
import { LangueToggle } from '@/components/LangueToggle'
import { useTraduction } from '@/lib/i18n'

// Schéma de l'app mobile (app.json → "scheme": "quantinvo").
const APP_SCHEME = 'quantinvo://'

export function PageOuvrir() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  const { t, langue, lien } = useTraduction()

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
      <LangueToggle />
      <div className="auth-card">
        <div className="head">
          <Link href={lien('/')}><Logo size={56} /></Link>
          <h1>Quantinvo</h1>
          {isMobile === false ? (
            <p className="sub">
              {t("Pour compter et auditer, ouvrez l'application Quantinvo sur votre téléphone. Les superviseurs peuvent aussi accéder à leur tableau de bord sur le web.")}
            </p>
          ) : (
            <p className="sub">{t("Ouverture de l'application Quantinvo…")}</p>
          )}
        </div>

        {isMobile === false ? (
          <Link href="/login" className="btn btn-primary btn-block">{t('Accéder à mon espace')}</Link>
        ) : (
          <a href={APP_SCHEME} className="btn btn-primary btn-block">{t("Ouvrir l'application")}</a>
        )}

        {/* Le cul-de-sac d'avant : « installez d'abord l'application », sans
            dire où la prendre. Les deux badges suivent `lib/appStores.ts` —
            recherche tant que l'app n'est pas publiée, fiche réelle ensuite. */}
        {isMobile && (
          <>
            <p className="sub" style={{ marginTop: 16, fontSize: 13 }}>
              {t("Si rien ne se passe, c'est que l'application n'est pas encore installée sur ce téléphone.")}
            </p>
            <StoreBadges langue={langue} />
          </>
        )}

        <div className="center-link" style={{ marginTop: 16 }}>
          <Link href="/login">{t('Continuer sur le web')}</Link>
        </div>
      </div>
    </div>
  )
}
