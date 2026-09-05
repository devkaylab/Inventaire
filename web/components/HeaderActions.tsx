'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMySpacePath } from '@/lib/auth'

/**
 * Les actions de la barre publique — et leur HIÉRARCHIE.
 *
 * ⚠️ C'EST LE MANQUE QUE LA COMPARAISON AVEC QONTO A RENDU ÉVIDENT
 * (5 septembre 2026). Leur barre porte deux actions de rangs différents :
 * « Se connecter » en lien discret, puis « Ouvrir un compte » en bouton plein.
 * La nôtre n'en portait qu'une, « Se connecter » en bouton fantôme — autrement
 * dit **l'action commerciale principale était absente de la barre**, alors
 * qu'elle est la raison d'être des pages publiques. Un visiteur qui découvre le
 * site n'a rien à quoi cliquer ; un client qui revient, lui, est servi.
 *
 * ⚠️ Et les deux ne coexistent PAS une fois connecté : quelqu'un qui a déjà un
 * espace n'inscrit pas une seconde entreprise depuis la barre. Il ne reste
 * alors que « Mon espace », en bouton plein — c'est devenu son action première.
 */
export function HeaderActions() {
  const [espace, setEspace] = useState<string | null>(null)

  useEffect(() => {
    let actif = true
    getMySpacePath().then((chemin) => {
      if (actif && chemin) setEspace(chemin)
    })
    return () => { actif = false }
  }, [])

  if (espace) {
    return (
      <div className="header-actions">
        <Link href={espace} className="btn btn-primary btn-sm">Mon espace</Link>
      </div>
    )
  }

  return (
    <div className="header-actions">
      <Link href="/login" className="header-lien">Se connecter</Link>
      <Link href="/inscription" className="btn btn-primary btn-sm">Inscrire mon entreprise</Link>
    </div>
  )
}
