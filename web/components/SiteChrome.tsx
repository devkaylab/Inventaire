import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { AuthLink } from '@/components/AuthLink'
import { RevealObserver } from '@/components/RevealObserver'
import { Parallaxe } from '@/components/Parallaxe'
import { PRIVACY_URL } from '@/lib/links'
import { mentionsCompletes } from '@/lib/legal'

/**
 * En-tête et pied de page communs aux pages publiques du site (accueil,
 * Pourquoi Quantinvo, L'inventaire). Un seul endroit à modifier quand la
 * navigation évolue.
 */
export function SiteHeader() {
  return (
    <>
    <RevealObserver />
    <Parallaxe />
    <header className="site-header">
      <div className="container inner">
        <Link href="/" className="brand">
          <Logo size={38} />
          <span>Quantinvo</span>
        </Link>
        <nav className="nav-links">
          <Link href="/">Accueil</Link>
          <Link href="/pourquoi-nous-choisir">Pourquoi nous choisir ?</Link>
          <Link href="/inventaire">L&apos;inventaire</Link>
          <Link href="/#fonctionnalites">Fonctionnalités</Link>
          <AuthLink className="btn btn-ghost" style={{ padding: '8px 16px' }} loggedOutLabel="Se connecter" loggedInLabel="Mon espace" />
        </nav>
      </div>
    </header>
    </>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container inner">
        <div className="brand"><Logo size={24} /><span>Quantinvo</span></div>
        <div className="links">
          <Link href="/pourquoi-nous-choisir">Pourquoi nous choisir ?</Link>
          <Link href="/inventaire">L&apos;inventaire</Link>
          <Link href="/login">Se connecter</Link>
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Confidentialité</a>
          {/* Une identification à trous ne vaut pas mieux que pas de page : on
              ne l'annonce qu'une fois les mentions requises renseignées. */}
          {mentionsCompletes() && <Link href="/mentions-legales">Mentions légales</Link>}
        </div>
        <span className="muted">© 2026 Devkaylab · Quantinvo</span>
      </div>
    </footer>
  )
}
