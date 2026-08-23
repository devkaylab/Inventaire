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
import { StoreBadges } from '@/components/StoreBadges'
import { signOut, type Profile } from '@/hooks/useAuthGuard'

type Onglet = { href: string; label: string }

/** Les onglets d'un profil, dans l'ordre où ce profil en a besoin. */
export function ongletsPour(profile: Profile): Onglet[] {
  if (profile.is_admin) {
    return [
      { href: '/admin', label: 'Tableau de bord' },
      { href: '/admin/entreprises', label: 'Entreprises' },
      // Ce que les clients font du produit, tout le parc d'un coup. Distinct
      // des entreprises : on n'y entre pas par un client, on y cherche.
      { href: '/admin/usage', label: 'Usage' },
      { href: '/admin/console', label: 'Console' },
    ]
  }
  const superviseur = profile.role === 'supervisor'
  if (!superviseur) return []
  // L'administrateur d'entreprise a la charpente d'une console : l'état de
  // l'entreprise, puis son patrimoine, ses personnes, le travail, la trace.
  // Compter n'est pas son métier — les inventaires sont ceux de ses
  // superviseurs, et « Boîte à outils » descend sous son avatar : imprimer des
  // balises est un geste de terrain, occasionnel pour lui.
  if (profile.is_company_admin) {
    return [
      { href: '/entreprise', label: 'Tableau de bord' },
      { href: '/magasins', label: 'Magasins' },
      { href: '/equipe', label: 'Équipe' },
      { href: '/dashboard', label: 'Inventaires' },
      { href: '/journal', label: 'Journal' },
    ]
  }
  return [
    { href: '/dashboard', label: 'Inventaires' },
    { href: '/equipe', label: 'Mon équipe' },
    { href: '/magasins', label: 'Magasins' },
    { href: '/outils', label: 'Boîte à outils' },
  ]
}

/**
 * Le chevron du menu de compte.
 *
 * C'était le caractère « ▾ » à 11 px : à cette taille il ne se lisait plus,
 * il ressemblait à un point. Un tracé SVG reste net à toute taille, prend la
 * couleur du texte autour, et peut pivoter à l'ouverture du menu.
 */
function ChevronBas() {
  return (
    <svg
      className="who-caret" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
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

  // Sous le nom : à qui on appartient, et à quel titre. Les deux vont
  // ensemble — « Entreprise C » seul ne dit pas ce qu'on y fait, et le rôle
  // seul ne dit pas où. L'administrateur Quantinvo n'a pas d'entreprise :
  // c'est Quantinvo même.
  const roleCourt = profile.is_admin || profile.is_company_admin
    ? 'Administrateur'
    : profile.role === 'supervisor' ? 'Superviseur' : 'Compteur'
  const appartenance = `${companyName ?? (profile.is_admin ? 'Quantinvo' : '')} · ${roleCourt}`
    .replace(/^ · /, '')

  async function partir() {
    await signOut()
    router.replace('/login')
  }

  return (
    <>
      {/* Sous 720 px, c'est tout ce qui s'affiche : la barre et le contenu
          sont masqués par la feuille de style. Le rendu reste le même côté
          serveur — pas de mesure d'écran en JavaScript, donc pas de bascule
          visible au chargement. */}
      <EcranOrdinateur
        nom={profile.full_name}
        appartenance={appartenance}
        onPartir={partir}
      />

      <header className="appbar">
        <div className="appbar-inner">
          <Link href="/" className="brand" title="Retour au site Quantinvo">
            <Logo size={38} />
            <span>
              Quantinvo
              <span className="brand-retour">← retour au site</span>
            </span>
          </Link>

          <nav className="appbar-tabs" aria-label="Navigation principale">
            {onglets.map((o) => {
              // /admin ne doit pas s'allumer sur /admin/entreprises : on
              // n'accepte l'égalité stricte que pour la racine d'un espace.
              // /dashboard fait exception : ses sous-pages (un inventaire,
              // la création) sont bien « Inventaires », et l'onglet doit le
              // dire pendant qu'on y travaille.
              const actif = pathname === o.href ||
                (o.href !== '/admin' && pathname.startsWith(o.href + '/'))
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
                <span className="who-co">{appartenance}</span>
              </span>
              <span className="who-avatar">{initiales(profile.full_name)}</span>
              <ChevronBas />
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
                {/* La boîte à outils a quitté la barre de l'administrateur
                    d'entreprise : imprimer des balises est un geste de terrain,
                    occasionnel pour lui. Elle reste atteignable d'un clic. */}
                {profile.is_company_admin && (
                  <Link href="/outils" role="menuitem" className="who-menu-item" onClick={() => setMenuOuvert(false)}>
                    Boîte à outils
                  </Link>
                )}
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

/**
 * L'espace connecté ne s'ouvre pas sur un petit écran.
 *
 * Décision de Julien, 21 août 2026 : « il y a une app, investir du temps dans
 * la version mobile du site n'a pas de sens ». Le site est l'outil du
 * superviseur — tableaux, imports de fichiers, rapports — et compter se fait
 * dans l'application. Une mise en page qui fait semblant coûterait cher et
 * servirait mal ; on le dit franchement, et on laisse deux sorties : revenir
 * au site public, ou se déconnecter.
 *
 * La porte ne ferme que ce que cette coquille enveloppe. Les pages publiques
 * — connexion, `/bienvenue`, `/reinitialisation`, `/inventaire`, `/open` —
 * restent utilisables au téléphone : les liens d'invitation arrivent par
 * e-mail, donc sur un téléphone.
 */
function EcranOrdinateur({
  nom, appartenance, onPartir,
}: {
  nom: string | null
  appartenance: string
  onPartir: () => void
}) {
  return (
    <div className="ordinateur-requis">
      <Link href="/" className="brand">
        <Logo size={38} gradientId="qbg-ordinateur" />
        <span>Quantinvo</span>
      </Link>

      <h1>Cet espace se pilote depuis un ordinateur</h1>
      <p>
        Le tableau de bord montre des tableaux d’articles, des imports de fichiers et
        des rapports à télécharger. Ouvrez <strong>www.quantinvo.com</strong> sur un
        ordinateur — ou agrandissez cette fenêtre.
      </p>

      <div className="ordinateur-requis-app">
        Sur le téléphone, c’est <strong>l’application Quantinvo</strong> qui sert :
        c’est là qu’on scanne et qu’on compte.
        <StoreBadges />
      </div>

      <div className="ordinateur-requis-actions">
        <Link href="/" className="btn btn-ghost">Retour au site</Link>
        <button type="button" className="btn btn-ghost" onClick={onPartir}>
          Se déconnecter
        </button>
      </div>

      <div className="ordinateur-requis-qui">
        Connecté en tant que {nom || 'vous'}{appartenance ? ` — ${appartenance}` : ''}
      </div>
    </div>
  )
}
