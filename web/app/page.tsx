import { Logo } from '@/components/Logo'
import { LogicielJsonLd } from '@/components/DonneesStructurees'
import { AuthLink } from '@/components/AuthLink'
import Link from 'next/link'
import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { CubeFilaire } from '@/components/Parallaxe'
import { ApercuTableauDeBord } from '@/components/ApercuTableauDeBord'
import { IconScan, IconZones, IconStore, IconAudit, IconReport, IconTeam } from '@/components/icons'
import { OFFRES, OFFRE_PHARE, euros } from '@/lib/offres'

/**
 * ⚠️ UNE PHRASE PAR IDÉE — c'est la règle qui gouverne tout ce fichier.
 *
 * La vitrine annonce, elle n'explique pas : le détail vit sur les pages
 * dédiées (/pourquoi-nous-choisir, /tarifs, /inventaire). Les descriptions
 * faisaient jusqu'à quatre lignes ; elles en font une. Constat de Julien le
 * 5 septembre 2026 : « les sections se ressemblent toutes, on aurait dit une
 * page brouillon » — un mur de texte uniforme ne se lit pas, il se saute.
 */
const FEATURES = [
  { icon: <IconScan />, title: 'Scan rapide', desc: 'Le téléphone devient la douchette.' },
  { icon: <IconZones />, title: 'Zones & balises', desc: 'On scanne une étiquette, on compte, on clôture.' },
  { icon: <IconStore />, title: 'Multi-magasins', desc: 'Un inventaire par magasin, lancé en quelques secondes.' },
  { icon: <IconAudit />, title: 'Audit & écarts', desc: 'Double comptage, puis arbitrage. Le chiffre est fiable.' },
  { icon: <IconReport />, title: 'Rapports', desc: 'Export Excel des écarts, en quantité et en valeur.' },
  { icon: <IconTeam />, title: 'Équipes', desc: 'Un superviseur, autant de compteurs qu’il faut.' },
]

const RYTHMES = [
  { title: 'Tournant', desc: 'Une zone après l’autre, au fil des semaines.' },
  { title: 'Ciblé', desc: 'Un rayon sensible, la réserve, une famille d’articles.' },
  { title: 'Complet', desc: 'Le grand comptage de fin d’exercice, mené comme les autres.' },
]

const CONFIANCE = [
  { title: 'Données en Europe', desc: 'Hébergées dans l’Union européenne, chez des prestataires déclarés.' },
  { title: 'Conforme RGPD', desc: 'Chacun télécharge ses données ou supprime son compte, depuis le produit.' },
  { title: 'Zéro traceur', desc: 'Aucun cookie publicitaire. Le suivi décrit le travail, pas les personnes.' },
]

/**
 * ⚠️ QUATRE FAITS MESURÉS, ET AUCUN CLIENT INVENTÉ.
 *
 * Qonto ouvre sur « +600 000 clients » ; nous n'en avons pas encore un seul, et
 * une fausse référence se paie cher. Ce qu'on peut prouver, ce sont des mesures
 * du produit — d'où ces quatre-là.
 *
 * ⚠️ ET ON N'ANNONCE JAMAIS LE PLAFOND. 400 000 références est la limite
 * MESURÉE le 3 septembre 2026 : l'écrire ici, c'est vendre le point de rupture.
 * 100 000 est confortable et reste sous le seuil de 150 000 à partir duquel le
 * produit nous alerte lui-même. « Jusqu'à 100 compteurs » est vrai sur un
 * inventaire ordinaire — sur un inventaire de 400 000 références, le treizième
 * appel simultané dépasse déjà le délai serveur : c'est « jusqu'à » qui dit le
 * plafond sans promettre les deux ensemble.
 */
const PREUVES = [
  { chiffre: '100 000', quoi: 'références par inventaire' },
  { chiffre: 'Jusqu’à 100', quoi: 'compteurs en même temps' },
  { chiffre: '1 outil', quoi: 'pour tous vos inventaires' },
  { chiffre: 'Toute l’année', quoi: 'comptez sans fermer le magasin' },
]

/**
 * ⚠️ À L'IMPÉRATIF, ET SANS NÉGATION. « Préparez », « Comptez », « Arbitrez » —
 * jamais « Vous préparez » ni « L'équipe compte ». Une vitrine dit ce qu'on
 * gagne, jamais ce qu'on évite.
 */
const ETAPES = [
  { title: 'Préparez', desc: 'Un fichier de stock, des étiquettes imprimées.' },
  { title: 'Comptez', desc: 'Chacun scanne avec son téléphone, chacun dans son rayon.' },
  { title: 'Arbitrez', desc: 'Comptage et audit se comparent. Vous tranchez sur le bon compte, puis vous exportez.' },
]

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main>
        <LogicielJsonLd />
        <section className="hero hero-plein">
          <div className="plx hero-voile" data-plx="0.45" aria-hidden="true" />
          <div className="plx cube-a" data-plx="0.18" aria-hidden="true">
            <div className="flotte"><CubeFilaire size={150} /></div>
          </div>
          <div className="plx cube-b" data-plx="0.5" aria-hidden="true">
            <div className="flotte-lent"><CubeFilaire size={104} /></div>
          </div>
          <div className="plx cube-c" data-plx="0.3" aria-hidden="true">
            <div className="flotte"><CubeFilaire size={64} /></div>
          </div>
          <div className="plx scan-trait" data-plx="0.62" aria-hidden="true" />
          <div className="container" data-hero-exit>
            <div className="logo-glow" data-reveal="0" style={{ display: 'inline-block' }}>
              <Logo size={72} gradientId="logoHero" />
            </div>
            <div data-reveal="1"><span className="eyebrow">Outil d&apos;inventaire</span></div>
            <h1 data-reveal="2">La simplicité<br /><span className="grad">en main.</span></h1>
            {/*
              Trois prestations plutôt qu'une phrase : elles se lisent en un coup
              d'œil et méritent le poids d'un sous-titre, pas celui d'un
              paragraphe.
            */}
            <p className="lead lead-trois" data-reveal="3">
              Inventaire tournant. Comptage en équipe. Écarts en direct.
            </p>
            {/*
              ⚠️ LE BOUTON DIT LE BÉNÉFICE, PAS LA DÉMARCHE. Personne ne se lève
              le matin pour « inscrire une entreprise ». La barre du haut, elle,
              garde le libellé explicite : c'est un repère de navigation, pas un
              argument.
            */}
            <div className="cta" data-reveal="4">
              <InscriptionLink className="btn btn-primary">Fiabiliser mon stock</InscriptionLink>
              <Link href="/tarifs" className="btn btn-ghost">Voir nos offres</Link>
            </div>
          </div>
          <a className="scroll-cue" href="#en-pratique">
            <svg width="22" height="34" viewBox="0 0 22 34" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="20" height="32" rx="10" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="11" cy="10" r="2.5" fill="currentColor" />
            </svg>
          </a>
        </section>

        {/* La preuve, tout de suite : quatre faits, avant le premier argument. */}
        <div className="preuve">
          {PREUVES.map((p) => (
            <div key={p.chiffre}>
              <strong>{p.chiffre}</strong>
              <span>{p.quoi}</span>
            </div>
          ))}
        </div>

        <section className="section" id="en-pratique">
          <div className="plx deco-cube deco-droite deco-accent" data-plx="0.28" aria-hidden="true">
            <CubeFilaire size={230} />
          </div>
          <div className="container">
            <div className="section-head" data-reveal="0">
              <span className="eyebrow">En pratique</span>
              <h2>Trois gestes, et c&apos;est parti</h2>
            </div>
            <div className="etapes">
              {ETAPES.map((e, i) => (
                <div className="etape" data-reveal={i + 1} key={e.title}>
                  <span className="etape-no">{i + 1}</span>
                  <h3>{e.title}</h3>
                  <p>{e.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Le produit se voit — la moitié terrain, la moitié bureau. */}
        <section className="section bande-surface">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <h2>Du rayon au tableau de bord</h2>
            </div>
            <div className="duo">
              <figure className="duo-tel" data-reveal="1">
                {/*
                  <img> et non next/image : ce PNG est servi en demi-résolution
                  et jamais redimensionné côté serveur — même raison que le
                  guide de prise en main.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/prise-en-main/comptage.png" alt="L’écran de comptage de l’application, dans un rayon" />
                <figcaption>Du scan dans le rayon</figcaption>
              </figure>
              <figure className="duo-ecran" data-reveal="2">
                <ApercuTableauDeBord />
                <figcaption>Au suivi de l&apos;avancement de l&apos;inventaire zone par zone</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/*
          Le différenciateur, sur l'encre. Le bandeau sombre est le même dans les
          deux thèmes — celui de la charte, celui des e-mails, celui de l'app.
        */}
        <section className="section bande-encre" id="rythmes">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <span className="eyebrow">Ce qui nous distingue</span>
              <h2>Comptez sans fermer le magasin</h2>
              <p>Une zone par semaine plutôt qu&apos;un grand week-end par an. Le stock reste juste toute l&apos;année.</p>
            </div>
            <div className="grid">
              {RYTHMES.map((r, i) => (
                <div className="card" data-reveal={i + 1} key={r.title}>
                  <h3>{r.title}</h3>
                  <p>{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="fonctionnalites">
          <div className="plx deco-cube deco-gauche deco-cyan" data-plx="0.4" aria-hidden="true">
            <CubeFilaire size={190} />
          </div>
          <div className="container">
            <div className="section-head" data-reveal="0">
              <span className="eyebrow">Ce que ça fait</span>
              <h2>Tout pour un inventaire maîtrisé</h2>
              <p>Du premier scan au rapport final.</p>
            </div>
            <div className="grid">
              {FEATURES.map((f, i) => (
                <div className="card" data-reveal={(i % 3) + 1} key={f.title}>
                  <div className="ico">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/*
          ⚠️ LE PRIX EST SUR L'ACCUEIL. Il est public depuis le 30 août 2026 : le
          cacher derrière un lien fait douter. Les montants viennent tous de
          `lib/offres.ts` — jamais un chiffre écrit sur place, sinon la grille se
          met à exister en deux endroits.
        */}
        <section className="section bande-surface" id="offres">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <span className="eyebrow">Tarifs</span>
              <h2>Une licence par magasin</h2>
              <p>
                Le prix suit le nombre d&apos;appareils qui comptent en même temps.
                Comptes et inventaires illimités.
              </p>
            </div>
            <div className="offres-apercu">
              {OFFRES.map((o, i) => (
                <div
                  className={o.cle === OFFRE_PHARE ? 'offre-carte phare' : 'offre-carte'}
                  data-reveal={i + 1}
                  key={o.cle}
                >
                  <div className="offre-nom">
                    {o.nom}
                    {o.cle === OFFRE_PHARE && <span className="offre-pastille">Le plus courant</span>}
                  </div>
                  <div className="offre-prix">
                    {euros(o.mois)}<small> / mois</small>
                  </div>
                  <p className="offre-plage">{o.plage}</p>
                  {/*
                    ⚠️ LE LIEN PORTE L'OFFRE. Sans `?offre=`, les trois boutons
                    mènent au même écran et /souscrire retombe sur son offre par
                    défaut : « Commencer avec Enterprise » ouvrirait Essential.
                    C'est ce que fait déjà TarifsGrille — les deux chemins
                    doivent envoyer la même chose.
                  */}
                  <Link
                    href={`/souscrire?offre=${o.cle}`}
                    className={o.cle === OFFRE_PHARE ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  >
                    Commencer avec {o.nom}
                  </Link>
                </div>
              ))}
            </div>
            <p className="offres-lien" data-reveal="4">
              <Link href="/tarifs">Le détail des trois offres</Link>
            </p>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <span className="eyebrow">Pensé pour l&apos;entreprise</span>
              <h2>Votre stock est votre principal actif</h2>
              <p>L&apos;outil qui le compte doit être irréprochable.</p>
            </div>
            <div className="grid">
              {CONFIANCE.map((c, i) => (
                <div className="card" data-reveal={i + 1} key={c.title}>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* L'accent ne sert qu'une fois, à la fin. */}
        <section className="section bande-accent final">
          <div className="container" data-reveal="0">
            <h2>Comptez votre premier rayon cette semaine</h2>
            <p>Inscription en ligne, accès ouvert tout de suite.</p>
            <div className="cta">
              <InscriptionLink className="btn btn-clair">Fiabiliser mon stock</InscriptionLink>
              <AuthLink className="btn btn-encre" loggedOutLabel="Se connecter" loggedInLabel="Accéder à mon espace" />
            </div>
            <p className="final-note">
              Votre entreprise l&apos;utilise déjà&nbsp;? Son administrateur vous ouvre l&apos;accès.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
