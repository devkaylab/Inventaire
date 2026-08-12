'use client'

// Garde d'accès unique pour les pages authentifiées.
//
// Avant, chacune des quatre pages protégées (dashboard, détail, admin, compte)
// refaisait sa propre séquence `getSession()` → lecture de `profiles` →
// `router.replace()`, avec à chaque fois un aller-retour de plus et un flash de
// contenu avant la redirection. Tout passe désormais par ce hook.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { homePathForRole } from '@/lib/auth'

export type Profile = {
  id: string
  full_name: string | null
  role: string | null
  is_admin: boolean | null
  company_id: string | null
}

/** Ce que la page exige de l'utilisateur pour s'afficher. */
export type Requirement = 'auth' | 'supervisor' | 'admin'

export type GuardState =
  | { status: 'loading'; profile: null; userId: null }
  | { status: 'ready'; profile: Profile; userId: string }

function satisfies(profile: Profile, requirement: Requirement): boolean {
  switch (requirement) {
    case 'auth':
      return true
    case 'admin':
      return !!profile.is_admin
    case 'supervisor':
      // Un administrateur est légitime sur les écrans superviseur : avant, il
      // était renvoyé vers /account et ne pouvait atteindre aucun inventaire.
      return profile.role === 'supervisor' || !!profile.is_admin
  }
}

export function useAuthGuard(requirement: Requirement = 'auth'): GuardState {
  const router = useRouter()
  const [state, setState] = useState<GuardState>({ status: 'loading', profile: null, userId: null })

  useEffect(() => {
    let active = true

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) { router.replace('/login'); return }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_admin, company_id')
        .eq('id', session.user.id)
        .maybeSingle()
      if (!active) return

      if (error || !data) { router.replace('/login'); return }
      const profile = data as Profile

      if (!satisfies(profile, requirement)) {
        // On renvoie vers l'espace auquel la personne a droit, pas vers une
        // page d'erreur : c'est une redirection, pas un refus.
        router.replace(homePathForRole(profile))
        return
      }

      setState({ status: 'ready', profile, userId: profile.id })
    })()

    return () => { active = false }
  }, [router, requirement])

  return state
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
