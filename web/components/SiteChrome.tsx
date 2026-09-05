import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { HeaderActions } from '@/components/HeaderActions'
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
        {/* ⚠️ LA NAVIGATION EST COLLÉE AU LOGO, LES ACTIONS SONT À DROITE.
            Les six liens étaient répartis d'un bord à l'autre, « Accueil » et
            « Se connecter » au même poids que le reste : rien ne disait où
            regarder ni ce qu'on attend du visiteur. C'est le motif de Qonto,
            et de la plupart des sites — parcourir à gauche, agir à droite.

            ⚠️ « Accueil » a disparu : le logo y mène, c'est une convention que
            tout le monde connaît, et le répéter coûtait une place à un lien
            qui, lui, apprend quelque chose. */}
        <nav className="nav-links">
          <Link href="/pourquoi-nous-choisir">Pourquoi nous choisir ?</Link>
          <Link href="/inventaire">L&apos;inventaire</Link>
          <Link href="/#fonctionnalites">Fonctionnalités</Link>
          <Link href="/tarifs">Tarifs</Link>
        </nav>
        <HeaderActions />
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
          <Link href="/tarifs">Tarifs</Link>
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
