'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabaseClient'

type ProfileInfo = { full_name: string | null; role: string | null; is_admin: boolean | null }

export default function AccountPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string>('')
  const [profile, setProfile] = useState<ProfileInfo | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      setEmail(session.user.email ?? '')
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, is_admin')
        .eq('id', session.user.id)
        .maybeSingle()
      if (active) {
        setProfile(data as ProfileInfo | null)
        setLoading(false)
      }
    })()
    return () => { active = false }
  }, [router])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  const isAdmin = !!profile?.is_admin

  return (
    <div className="account">
      <div className="row">
        <Link href="/" className="brand"><Logo size={28} /><span>Quantinvo</span></Link>
        <button className="btn btn-ghost" onClick={signOut}>Déconnexion</button>
      </div>

      <span className="pill">{isAdmin ? 'Administrateur' : profile?.role === 'supervisor' ? 'Superviseur' : 'Membre'}</span>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.6px', marginTop: 12 }}>
        Bonjour {profile?.full_name || ''}
      </h1>
      <p className="muted" style={{ marginTop: 4 }}>{email}</p>

      {isAdmin ? (
        <div className="panel">
          <h3>Espace administrateur</h3>
          <p>Gérez vos entreprises, vos magasins et les demandes de suppression de compte.</p>
          <Link href="/admin" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
            Ouvrir le tableau de bord
          </Link>
        </div>
      ) : (
        <div className="panel">
          <h3>Votre espace</h3>
          <p>
            Le suivi de vos inventaires en ligne arrive bientôt. En attendant, utilisez l'application mobile Quantinvo.
          </p>
        </div>
      )}
    </div>
  )
}
