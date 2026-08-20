'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Filet de sécurité applicatif. Sans lui, la moindre erreur de chargement de
 * données laissait une page blanche et un message dans la console : pour un
 * superviseur en magasin, c'est indiscernable d'une panne totale.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[app]', error) }, [error])

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="head">
          <h1>Une erreur est survenue</h1>
          <p className="sub">
            L’écran n’a pas pu s’afficher. Réessayez ; si le problème persiste, vérifiez votre
            connexion ou revenez à vos inventaires.
          </p>
        </div>

        {error.message && (
          <div className="error" role="alert">{error.message}</div>
        )}

        <button className="btn btn-primary btn-block" onClick={reset}>Réessayer</button>
        <div className="center-link">
          <Link href="/dashboard">Retour à mes inventaires</Link>
        </div>
      </div>
    </div>
  )
}
