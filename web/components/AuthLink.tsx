'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMySpacePath } from '@/lib/auth'

type Props = {
  className?: string
  style?: React.CSSProperties
  /** Libellé affiché quand l'utilisateur n'est pas connecté. */
  loggedOutLabel: string
  /** Libellé affiché quand l'utilisateur est connecté. */
  loggedInLabel: string
}

/** Lien qui pointe vers /login si déconnecté, ou vers l'espace de l'utilisateur si connecté. */
export function AuthLink({ className, style, loggedOutLabel, loggedInLabel }: Props) {
  const [href, setHref] = useState('/login')
  const [label, setLabel] = useState(loggedOutLabel)

  useEffect(() => {
    let active = true
    getMySpacePath().then((path) => {
      if (!active || !path) return
      setHref(path)
      setLabel(loggedInLabel)
    })
    return () => { active = false }
  }, [loggedInLabel])

  return <Link href={href} className={className} style={style}>{label}</Link>
}
