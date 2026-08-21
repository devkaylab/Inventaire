'use client'

// Barre de navigation de l'espace connecté.
//
// Avant, chaque page portait ses propres boutons de sortie et « Mon compte »
// servait de carrefour : dix blocs empilés, le tableau de bord accessible
// par un bouton au milieu de la page, et aucun retour au site public. La
// navigation vit désormais ici, une seule fois, pour toutes les pages.
//
// Ce que la barre porte, et pourquoi :
// · le logo ramène au site public — c'est le retour qui manquait ;
// · les onglets ne montrent QUE le travail, dans l'ordre du rôle : on ouvre
//   le site pour compter (superviseur) ou pour gérer les accès (admin
//   d'entreprise), et le premier onglet le dit ;
// · le nom de la personne et son entreprise se lisent ensemble, en haut à
//   droite — l'entreprise n'a plus à occuper un bloc en milieu de page ;
// · tout ce qui concerne la personne (son compte, sa déconnexion) est sous
//   son avatar, là où on va le chercher.

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { signOut, type Profile } from '@/hooks/useAuthGuard'

type Onglet = { href: string; label: string }

/** Les onglets d'un profil, dans l'ordre où ce profil en a besoin. */
export function ongletsPour(profile: Profile): Onglet[] {
  if (profile.is_admin) {
    return [
      { href: '/admin', label: 'Tableau de bord' },
      { href: '/admin/entreprises', label: 'Entreprises' },
      { href: '/admin/console', label: 'Console' },
    ]
  }
  const superviseur = profile.role === 'supervisor'
  if (!superviseur) return []
  const travail: Onglet[] = [
    { href: '/dashboard', label: 'Inventaires' },
    { href: '/equipe', label: 'Mon équipe' },
    { href: '/magasins', label: 'Magasins' },
    { href: '/outils', label: 'Boîte à outils' },
  ]
  // Un administrateur d'entreprise ouvre le site pour gérer ses accès :
  // l'inventaire descend après ses magasins et sa boîte à outils.
  if (profile.is_company_admin) {
    return [travail[1], travail[2], travail[3], travail[0]]
  }
  return travail
}

function initiales(nom: string | null): string {
  const mots = (nom ?? '').trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase()
}

export function AppShell({
  profile, companyName, children,
}: {
  profile: Profile
  /** Nom de l'entreprise, affiché sous celui de la personne. */
  companyName?: string | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuOuvert, setMenuOuvert] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Un clic ailleurs ou Échap referme : sans cela le menu reste ouvert
  // pendant qu'on travaille derrière.
  useEffect(() => {
    if (!menuOuvert) return
    function auClic(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOuvert(false)
    }
    function auClavier(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOuvert(false)
    }
    document.addEventListener('mousedown', auClic)
    document.addEventListener('keydown', auClavier)
    return () => {
      document.removeEventListener('mousedown', auClic)
      document.removeEventListener('keydown', auClavier)
    }
  }, [menuOuvert])

  const onglets = ongletsPour(profile)
  const surMonCompte = pathname === '/account'
  const roleLisible = profile.is_admin
    ? 'Administrateur Quantinvo'
    : profile.is_company_admin
      ? 'Administrateur d’entreprise'
      : profile.role === 'supervisor' ? 'Superviseur' : 'Compteur'

  async function partir() {
    await signOut()
    router.replace('/login')
  }

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <Link href="/" className="brand" title="Retour au site Quantinvo">
            <Logo size={30} />
            <span>
              Quantinvo
              <span className="brand-retour">← retour au site</span>
            </span>
          </Link>

          <nav className="appbar-tabs" aria-label="Navigation principale">
            {onglets.map((o) => {
              // /admin ne doit pas s'allumer sur /admin/entreprises : on
              // n'accepte l'égalité stricte que pour la racine d'un espace.
              const actif = pathname === o.href ||
                (o.href !== '/admin' && o.href !== '/dashboard' && pathname.startsWith(o.href + '/'))
              return (
                <Link
                  key={o.href}
                  href={o.href}
                  className="appbar-tab"
                  aria-current={actif ? 'page' : undefined}
                >
                  {o.label}
                </Link>
              )
            })}
          </nav>

          <div className="appbar-who" ref={menuRef}>
            <button
              type="button"
              className={`who-btn${surMonCompte ? ' who-btn-actif' : ''}`}
              aria-haspopup="menu"
              aria-expanded={menuOuvert}
              onClick={() => setMenuOuvert((v) => !v)}
            >
              <span className="who-text">
                <span className="who-name">{profile.full_name || 'Mon compte'}</span>
                {companyName && <span className="who-co">{companyName}</span>}
              </span>
              <span className="who-avatar">{initiales(profile.full_name)}</span>
              <span className="who-caret" aria-hidden="true">▾</span>
            </button>

            {menuOuvert && (
              <div className="who-menu" role="menu">
                <div className="who-menu-head">
                  <div className="who-menu-nom">{profile.full_name || '—'}</div>
                  <div className="who-menu-role">
                    {roleLisible}{companyName ? ` — ${companyName}` : ''}
                  </div>
                </div>
                <Link href="/account" role="menuitem" className="who-menu-item" onClick={() => setMenuOuvert(false)}>
                  Mon compte
                </Link>
                <button type="button" role="menuitem" className="who-menu-item who-menu-sortie" onClick={partir}>
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </>
  )
}
