import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { mfaPending } from '@/lib/mfa'
import { registerForPushNotifications } from '@/lib/push'
import { cacheProfile, getCachedProfile } from '@/lib/offline'
import type { Tables } from '@/types/database.types'

type Profile = Tables<'profiles'>

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  /**
   * La session est ouverte au mot de passe seul alors que le compte a un
   * second facteur : il manque le code. Tant que c'est vrai, rien d'autre que
   * l'écran de connexion ne doit s'afficher — sinon activer la double
   * authentification depuis le téléphone ne protégerait que le site.
   */
  mfaRequired: boolean
  /** Relit le niveau d'authentification (après saisie du code). */
  recheckMfa: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string, role: 'employee' | 'supervisor') => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [mfaRequired, setMfaRequired] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        void recheckMfa()
        fetchProfile(session.user.id)
      } else {
        setMfaRequired(false)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        setLoading(true)   // show spinner while profile is being fetched
        void recheckMfa()
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setMfaRequired(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * Profil du compte connecté, avec repli sur le dernier connu.
   *
   * Le profil vient de la base. Au redémarrage sans réseau, la requête échoue
   * et le profil restait `null` : l'écran de comptage n'enregistrait plus rien
   * (l'identifiant du compteur alimente `counted_by`), sans le moindre message.
   * Le compteur voyait sa caméra fonctionner et ses scans disparaître.
   *
   * La session Supabase, elle, est déjà persistée sur le disque : c'est donc
   * bien le même compte qui reprend. Servir le profil mis en cache est sûr.
   */
  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      setProfile(data)
      void cacheProfile(data)
      setLoading(false)
      void registerForPushNotifications()
      return
    }

    const cached = await getCachedProfile<Profile>()
    // On ne sert le cache que s'il correspond au compte réellement connecté.
    setProfile(cached && cached.id === userId ? cached : null)
    setLoading(false)
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string, fullName: string, role: 'employee' | 'supervisor') {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  /**
   * Relit le niveau d'authentification de la session.
   *
   * Appelée à l'ouverture et à chaque changement d'état : une session reprise
   * du disque peut très bien être restée au mot de passe seul, si l'app a été
   * fermée entre le mot de passe et le code.
   */
  async function recheckMfa() {
    setMfaRequired(await mfaPending())
  }

  // Reload the profile from the DB (e.g. after creating/joining a company so
  // company_id is reflected in context and the routing gate lets the user in).
  async function refreshProfile() {
    if (session) await fetchProfile(session.user.id)
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, mfaRequired, recheckMfa, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
