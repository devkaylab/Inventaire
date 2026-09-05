'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { venteOuverte } from '@/lib/legal'
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

  const ouverte = venteOuverte()

  return (
    <div className="header-actions">
      <Link href="/login" className="header-lien">Se connecter</Link>
      {/*
        ⚠️ DEUX LIBELLÉS, UN SEUL AFFICHÉ — voir `.libelle-court` dans
        globals.css. Sur un téléphone, « Inscrire mon entreprise » passait à
        trois lignes et sortait de la barre (constat de Julien, 5 septembre
        2026). « Inscription » reste EXPLICITE : c'est le nom de la page où le
        bouton mène, et la barre doit rester un repère de navigation, jamais un
        argument — c'est ce qui la distingue du bouton du héros.
      */}
      {/*
        ⚠️ TANT QUE LA VENTE EST FERMÉE, LE BOUTON NE PROMET PAS UNE
        INSCRIPTION. Julien, 5 septembre 2026 : « on ferme en attendant
        l'immatriculation ». Un bouton qui annonce « Inscrire mon entreprise »
        et mène à « ce n'est pas encore ouvert » est pire que pas de bouton :
        il fait cliquer pour rien. Il mène toujours à `/inscription`, qui
        explique et donne l'adresse — une seule porte, un seul message.
      */}
      <Link href="/inscription" className="btn btn-primary btn-sm">
        <span className="libelle-long">{ouverte ? 'Inscrire mon entreprise' : 'Nous écrire'}</span>
        <span className="libelle-court">{ouverte ? 'Inscription' : 'Écrire'}</span>
      </Link>
    </div>
  )
}
