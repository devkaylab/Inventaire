import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { HeaderActions } from '@/components/HeaderActions'
import { MenuMobile } from '@/components/MenuMobile'
import { LIENS_PUBLICS } from '@/lib/navigation'
import { RevealObserver } from '@/components/RevealObserver'
import { EnTeteAuDefilement } from '@/components/EnTeteAuDefilement'
import { Parallaxe } from '@/components/Parallaxe'
import { PRIVACY_URL } from '@/lib/links'
import { mentionsCompletes, venteOuverte } from '@/lib/legal'
import { LangueToggle } from '@/components/LangueToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { StoreBadges } from '@/components/StoreBadges'
import { RedirectionLangue } from '@/components/RedirectionLangue'
import { traduction, type Langue } from '@/lib/traduction'

/**
 * En-tête et pied de page communs aux pages publiques du site (accueil,
 * Pourquoi Quantinvo, L'inventaire). Un seul endroit à modifier quand la
 * navigation évolue.
 */
export function SiteHeader({ langue = 'fr' }: { langue?: Langue }) {
  const { t, lien } = traduction(langue)
  return (
    <>
    <RevealObserver />
    <RedirectionLangue />
    <Parallaxe />
    <EnTeteAuDefilement />
    <header className="site-header">
      <div className="container inner">
        <Link href={lien('/')} className="brand">
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
            <Link href={lien(l.href)} key={l.href}>{t(l.libelle)}</Link>
          ))}
        </nav>
        {/* ⚠️ LA LANGUE EST DANS LA BARRE, PLUS UNE PASTILLE FLOTTANTE
            (demande de Julien, 11 septembre 2026, Qonto à l'appui). Une
            pastille posée dans un coin se prend pour un outil de l'agent ou un
            bouton d'aide ; dans la barre, elle se lit comme ce qu'elle est. */}
        <LangueToggle place="pose" />
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

export function SiteFooter({ langue = 'fr' }: { langue?: Langue }) {
  const { t, lien } = traduction(langue)
  return (
    <footer className="site-footer">
      <div className="container inner">
        {/* ⚠️ LE PIED EST PASSÉ EN DEUX BLOCS le 27 septembre 2026, jour de la
            publication sur l'App Store. Il était une rangée unique en
            espace-entre ; les boutiques y auraient été un cinquième objet
            parmi les liens, au même poids qu'une mention légale. Elles
            tiennent leur colonne, à droite, et le site garde la sienne. */}
        <div className="pied-site">
        <div className="brand"><Logo size={24} /><span>Quantinvo</span></div>
        <div className="links">
          {/* Même ordre que la barre (lib/navigation.ts). */}
          <Link href={lien('/inventaire')}>{t("L'inventaire")}</Link>
          <Link href={lien('/decouvrir')}>{t('Notre outil')}</Link>
          <Link href={lien('/pourquoi-nous-choisir')}>{t('Pourquoi nous choisir ?')}</Link>
          <Link href={lien('/tarifs')}>{t('Tarifs')}</Link>
          {/* ⚠️ TROIS PAGES RANGÉES ICI LE 3 OCTOBRE 2026 : elles étaient au
              plan du site et AUCUNE page ne pointait vers elles. Un moteur
              suit les liens avant tout — une page que rien ne cite a l'air de
              n'intéresser personne, et elle n'est explorée qu'en dernier.
              Le pied est le seul endroit qui couvre toute la vitrine. */}
          {/* ⚠️ « Souscrire » SUIT L'OUVERTURE DE LA VENTE, comme les mentions
              légales suivent leur complétude, trois lignes plus bas. Tant que
              `lib/legal.ts` est incomplet, la page répond « la souscription en
              ligne ouvre bientôt » : l'annoncer depuis chaque page du site
              reviendrait à mettre une porte fermée dans la vitrine. Le jour où
              la vente ouvre, le lien apparaît tout seul. */}
          {venteOuverte() && <Link href={lien('/souscrire')}>{t('Souscrire')}</Link>}
          <Link href="/login">{t('Se connecter')}</Link>
          <Link href={lien('/superviseur')}>{t('Accès superviseur')}</Link>
          <a href={PRIVACY_URL} target="_blank" rel="noreferrer">{t('Confidentialité')}</a>
          <Link href="/conditions-generales">{t('Conditions générales')}</Link>
          {/* ⚠️ Google Play EXIGE une adresse publique de suppression de
              compte, atteignable sans installer l'application. Elle l'était
              par son adresse ; elle l'est maintenant par un lien. */}
          <Link href={lien('/suppression-compte')}>{t('Supprimer son compte')}</Link>
          {/* Une identification à trous ne vaut pas mieux que pas de page : on
              ne l'annonce qu'une fois les mentions requises renseignées. */}
          {mentionsCompletes() && <Link href="/mentions-legales">{t('Mentions légales')}</Link>}
        </div>
        {/* Langue et thème vivent AUSSI au pied : c'est là qu'on va les
            chercher quand on ne les a pas vus en haut, et c'est la seule place
            possible pour le thème — la barre du haut porte déjà l'action
            commerciale, elle ne doit pas devenir un tableau de bord. */}
        <div className="pied-bas">
          <div className="pied-reglages">
            <LangueToggle place="pose" />
            <ThemeToggle place="pose" />
          </div>
          <span className="muted">© 2026 Devkaylab · Quantinvo</span>
        </div>
        </div>
        {/* Les boutons vivent dans `StoreBadges` : un seul endroit sait quelle
            boutique est ouverte, et ce qu'il faut dire de l'autre. */}
        <div className="pied-boutiques">
          <span className="pied-boutiques-titre">{t('L’application')}</span>
          <StoreBadges langue={langue} />
        </div>
      </div>
    </footer>
  )
}
