'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { venteOuverte } from '@/lib/legal'

type Props = {
  className?: string
  children: React.ReactNode
  /**
   * Ce que le lien dit quand la vente est fermée. Par défaut « Nous écrire ».
   * ⚠️ Un bouton qui annonce « Inscrire mon entreprise » et mène à « ce n'est
   * pas encore ouvert » fait cliquer pour rien : il est pire que pas de bouton.
   */
  ferme?: React.ReactNode
}

/**
 * Lien vers /inscription, qui disparaît dès qu'une session est ouverte : une
 * personne connectée appartient déjà à une entreprise, lui proposer d'en
 * inscrire une n'a pas de sens. Rendu côté client pour que la page d'accueil
 * reste statique ; avant la réponse, le lien est affiché (cas le plus courant
 * sur la vitrine : un visiteur non connecté).
 */
export function InscriptionLink({ className, children, ferme }: Props) {
  const [connecte, setConnecte] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && session) setConnecte(true)
    })
    return () => { active = false }
  }, [])

  if (connecte) return null
  // ⚠️ TANT QUE LA VENTE EST FERMÉE, ON NE PROMET PAS UNE INSCRIPTION. La porte
  // reste `/inscription`, qui explique et donne l'adresse — une seule porte, un
  // seul message. Tranché par Julien le 5 septembre 2026.
  const libelle = venteOuverte() ? children : (ferme ?? 'Nous écrire')
  return <Link href="/inscription" className={className}>{libelle}</Link>
}
