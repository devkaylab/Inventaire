import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { HeaderActions } from '@/components/HeaderActions'
import { MenuMobile } from '@/components/MenuMobile'
import { LIENS_PUBLICS } from '@/lib/navigation'
import { RevealObserver } from '@/components/RevealObserver'
import { EnTeteAuDefilement } from '@/components/EnTeteAuDefilement'
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
    <EnTeteAuDefilement />
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
          {LIENS_PUBLICS.map((l) => (
            <Link href={l.href} key={l.href}>{l.libelle}</Link>
          ))}
        </nav>
        <HeaderActions />
        {/* ⚠️ Sous 780 px, `.nav-links` passe en display:none : sans ce burger,
            les quatre liens du site n'ont plus AUCUNE porte sur un téléphone.
            C'est le motif de Qonto, mesuré sur sa version mobile le
            5 septembre 2026 — mot-symbole, un bouton, le reste au menu. */}
        <MenuMobile />
      </div>
    </header>
    {/* ⚠️ Sous 780 px la barre est FIXE : elle ne prend plus sa place dans le
        flux, et cet espaceur la lui rend. Sans lui, la première section de
        chaque page passerait sous la barre. */}
    <div className="site-header-espace" aria-hidden="true" />
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
