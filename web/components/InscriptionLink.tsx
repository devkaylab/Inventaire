'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Props = { className?: string; children: React.ReactNode }

/**
 * Lien vers /inscription, qui disparaît dès qu'une session est ouverte : une
 * personne connectée appartient déjà à une entreprise, lui proposer d'en
 * inscrire une n'a pas de sens. Rendu côté client pour que la page d'accueil
 * reste statique ; avant la réponse, le lien est affiché (cas le plus courant
 * sur la vitrine : un visiteur non connecté).
 */
export function InscriptionLink({ className, children }: Props) {
  const [connecte, setConnecte] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && session) setConnecte(true)
    })
    return () => { active = false }
  }, [])

  if (connecte) return null
  return <Link href="/inscription" className={className}>{children}</Link>
}
