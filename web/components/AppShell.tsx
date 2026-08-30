'use client'

// Le rail de navigation de l'espace connecté (30 août 2026).
//
// La barre d'onglets du haut est devenue un rail d'icônes à gauche — décision
// de Julien sur la maquette du tableau de bord : « en finalité on ne gardera
// que le rail ». Un seul système de navigation pour tout l'espace connecté,
// pas un par page.
//
// Ce que le rail porte, et pourquoi :
// · le logo ramène au site public — le retour qui manquait avant la barre ;
// · les onglets ne montrent QUE le travail, dans l'ordre du rôle, en icônes ;
//   chaque icône dit son nom (title + aria-label) — pas d'icône muette ;
// · tout ce qui concerne la personne (son compte, sa déconnexion) est sous
//   son avatar, en bas du rail, là où on va le chercher.

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StoreBadges } from '@/components/StoreBadges'
import { Notifications } from '@/components/Notifications'
import { MessageAdmin } from '@/components/dashboard/MessageAdmin'
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
      // L'état de la machine, à côté de ce que les clients en font.
      { href: '/admin/capacite', label: 'Capacité' },
      { href: '/admin/console', label: 'Console' },
      // Ce que les entreprises clientes nous écrivent.
      { href: '/messages', label: 'Messages' },
    ]
  }
  const superviseur = profile.role === 'supervisor'
  if (!superviseur) return []
  // L'administrateur d'entreprise a la charpente d'une console : l'état de
  // l'entreprise, puis son patrimoine, ses personnes, le travail, la trace.
  // Compter n'est pas son métier — les inventaires sont ceux de ses
  // superviseurs, et « Boîte à outils » reste sous son avatar.
  if (profile.is_company_admin) {
    return [
      { href: '/entreprise', label: 'Tableau de bord' },
      { href: '/magasins', label: 'Magasins' },
      { href: '/equipe', label: 'Équipe' },
      { href: '/inventaires', label: 'Inventaires' },
      // Ce que ses superviseurs lui écrivent.
      { href: '/messages', label: 'Messages' },
      { href: '/journal', label: 'Journal' },
    ]
  }
  return [
    { href: '/dashboard', label: 'Tableau de bord' },
    { href: '/inventaires', label: 'Inventaires' },
    { href: '/equipe', label: 'Mon équipe' },
    { href: '/magasins', label: 'Magasins' },
    { href: '/outils', label: 'Boîte à outils' },
  ]
}

/**
 * L'icône de chaque destination — au trait, sur la grille de 24, comme
 * toutes les icônes du produit. Une entrée par href : un onglet sans icône
 * dépareille immédiatement dans un rail, un test le vérifie.
 */
function IconeOnglet({ href }: { href: string }) {
  const d = (chemins: React.ReactNode) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {chemins}
    </svg>
  )
  switch (href) {
    case '/dashboard':
    case '/entreprise':
    case '/admin':
      return d(<>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </>)
    case '/inventaires':
      return d(<>
        <path d="M4 8V6a2 2 0 0 1 2-2h2" />
        <path d="M16 4h2a2 2 0 0 1 2 2v2" />
        <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
        <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
        <line x1="4" y1="12" x2="20" y2="12" />
      </>)
    case '/equipe':
      return d(<>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.4a3 3 0 0 1 0 5.6" />
        <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 20" />
      </>)
    case '/magasins':
    case '/admin/entreprises':
      return d(<>
        <path d="M3.5 9 5 4.5A1 1 0 0 1 6 4h12a1 1 0 0 1 .95.68L20.5 9" />
        <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
        <path d="M9.5 20v-5h5v5" />
      </>)
    case '/outils':
      return d(<>
        <path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8z" />
        <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="4" y1="13" x2="20" y2="13" />
      </>)
    case '/messages':
      return d(<>
        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.9-.9L3 20l1.2-4.3A8 8 0 0 1 3.5 11.5a8.38 8.38 0 0 1 8.5-8.3 8.38 8.38 0 0 1 9 8.3z" />
      </>)
    case '/journal':
      return d(<>
        <path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </>)
    case '/admin/usage':
      return d(<>
        <path d="M4 4v16h16" />
        <rect x="7" y="12" width="2.6" height="5" rx="0.5" />
        <rect x="11.7" y="8" width="2.6" height="9" rx="0.5" />
        <rect x="16.4" y="5" width="2.6" height="12" rx="0.5" />
      </>)
    case '/admin/capacite':
      return d(<>
        <path d="M5 17a8 8 0 1 1 14 0" />
        <line x1="12" y1="13" x2="15.5" y2="8.5" />
        <circle cx="12" cy="14" r="1.4" />
      </>)
    case '/admin/console':
      return d(<>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9l3 3-3 3" />
        <line x1="12" y1="15" x2="16" y2="15" />
      </>)
    default:
      return d(<circle cx="12" cy="12" r="8" />)
  }
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
  /** Nom de l'entreprise, affiché dans le menu de la personne. */
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
      {/* Sous 720 px, c'est tout ce qui s'affiche : le rail et le contenu
          sont masqués par la feuille de style. Le rendu reste le même côté
          serveur — pas de mesure d'écran en JavaScript, donc pas de bascule
          visible au chargement. */}
      <EcranOrdinateur
        nom={profile.full_name}
        appartenance={appartenance}
        onPartir={partir}
      />

      <nav className="app-rail" aria-label="Navigation principale">
        <Link href="/" className="rail-logo" title="Retour au site Quantinvo">
          <Logo size={40} />
        </Link>

        <div className="rail-onglets">
          {onglets.map((o) => {
            // /admin ne doit pas s'allumer sur /admin/entreprises : on
            // n'accepte l'égalité stricte que pour la racine d'un espace.
            // Les sous-pages d'un inventaire (/dashboard/<id>, /dashboard/new)
            // allument « Inventaires » : on y travaille sur un inventaire,
            // pas sur le tableau de bord.
            const actif = pathname === o.href
              || (o.href === '/inventaires' && pathname.startsWith('/dashboard/'))
              || (o.href !== '/admin' && o.href !== '/dashboard' && pathname.startsWith(o.href + '/'))
            return (
              <Link
                key={o.href}
                href={o.href}
                className="rail-onglet"
                title={o.label}
                aria-label={o.label}
                aria-current={actif ? 'page' : undefined}
              >
                <IconeOnglet href={o.href} />
              </Link>
            )
          })}
        </div>

        <div className="rail-fin">
          {/* Le message et la cloche vivent ici, côte à côte, et pas sur une
              page : écrire à qui l'on rend compte ne dépend pas de l'écran où
              l'on se trouve. Chacun écrit un cran au-dessus — le superviseur à
              l'administrateur de son entreprise, l'administrateur à Quantinvo.
              L'administrateur Quantinvo n'a personne au-dessus : pas de
              bouton. */}
          {profile.role === 'supervisor' && !profile.is_admin && (
            <MessageAdmin destinataire={profile.is_company_admin ? 'quantinvo' : 'entreprise'} />
          )}
          <Notifications />
          <div className="rail-qui" ref={menuRef}>
          <button
            type="button"
            className={`who-btn${surMonCompte ? ' who-btn-actif' : ''}`}
            title={profile.full_name || 'Mon compte'}
            aria-label="Mon compte et déconnexion"
            aria-haspopup="menu"
            aria-expanded={menuOuvert}
            onClick={() => setMenuOuvert((v) => !v)}
          >
            <span className="who-avatar">{initiales(profile.full_name)}</span>
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
              {/* La boîte à outils n'est pas dans le rail de l'administrateur
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
      </nav>

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
