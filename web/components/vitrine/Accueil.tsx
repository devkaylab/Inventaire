import Link from 'next/link'
import { LogicielJsonLd } from '@/components/DonneesStructurees'
import { AuthLink } from '@/components/AuthLink'
import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { DiaporamaProduit } from '@/components/DiaporamaProduit'
import { FondVideo } from '@/components/FondVideo'
import { IconScan, IconZones, IconStore, IconAudit, IconReport, IconTeam } from '@/components/icons'
import { OFFRES, OFFRE_PHARE, euros } from '@/lib/offres'
import { traduction, type Langue } from '@/lib/traduction'

/**
 * La page d'accueil, rendue en français (`/`) et en anglais (`/en`) depuis le
 * 11 septembre 2026 : la langue vient de l'ADRESSE, et les textes français
 * restent la clé de traduction (voir `lib/traduction.ts`).
 *
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

export function Accueil({ langue }: { langue: Langue }) {
  const { t, lien } = traduction(langue)
  return (
    <>
      <SiteHeader langue={langue} />

      <main>
        <LogicielJsonLd langue={langue} />
        {/*
          ⚠️ LE HÉROS EST UNE BANDE ENCRE, dans les deux thèmes. Ce n'est pas une
          invention : la charte a déjà sa bande encre, et la vidéo de fond
          l'impose — elle ouvre et ferme sur un fondu au NOIR (1,5 s à
          l'ouverture, 1,3 s à la fermeture, mesurés). Sur un fond clair, ces
          fondus feraient deux éclairs noirs toutes les onze secondes ; sur
          l'encre, ils sont invisibles : le téléphone apparaît, montre
          l'inventaire, et se dissout dans le fond.
        */}
        <section className="hero hero-plein hero-film-fond">
          <FondVideo
            src="/vitrine/hero.mp4"
            srcMobile="/vitrine/hero-mobile.mp4"
            poster="/vitrine/hero-poster.jpg"
          />
          {/*
            ⚠️ RIEN N'EST CENTRÉ ICI, ET C'EST UNE DEMANDE (Julien, 11 septembre
            2026, capture annotée à l'appui) : « le texte doit être aligné à
            gauche ». Le bloc de texte se pose en bas à GAUCHE, les deux boutons
            en bas à DROITE. Tout centrer par défaut est l'un des tics qu'il a
            nommés le même jour ; et sur une vidéo, un bloc calé dans un angle
            laisse voir l'image au lieu de s'asseoir en plein milieu.

            ⚠️ LES TROIS PRESTATIONS PASSENT AU-DESSUS DU TITRE — c'est l'ordre
            qu'il a écrit dans l'annotation. Elles annoncent ce qu'on fait, le
            titre conclut ; à l'envers, la conclusion arrivait avant le sujet.
          */}
          <div className="container hero-accueil" data-hero-exit>
            <div className="hero-texte">
              {/*
                Trois prestations plutôt qu'une phrase : elles se lisent en un
                coup d'œil et méritent le poids d'un sous-titre, pas celui d'un
                paragraphe. ⚠️ Une ligne chacune — la coupure ne se laisse pas
                au hasard de la largeur, c'est ce qui en fait une liste.

                ⚠️ ET AUCUNE NE PORTE DE POINT. Julien a raccourci les deux
                premières le 11 septembre 2026 — « Inventaires », « En équipe ».
                Ce ne sont plus des phrases mais les trois mots d'une liste :
                garder le point sur la seule troisième aurait fait lire un
                mélange de deux grammaires, à 64 px et sur trois lignes.
              */}
              <p className="lead lead-trois" data-reveal="1">
                {t('Inventaires')}<br />
                {t('En équipe')}<br />
                {t('Écarts en direct')}
              </p>
              {/* ⚠️ NI SURTITRE NI DÉGRADÉ (demande de Julien, 11 septembre
                  2026). « Outil d'inventaire » répétait ce que la phrase
                  au-dessus dit mieux, et le dégradé sur « en main. » coupait le
                  titre en deux à l'endroit où il doit se lire d'un trait. Sur la
                  vidéo, un titre d'une seule encre se détache aussi mieux.

                  ⚠️ ET PLUS DE COUPURE NON PLUS. Le `<br />` avait été posé pour
                  un titre de 64 px ; depuis que les deux échelles sont
                  échangées, la signature en fait 21 et tient sur une ligne —
                  la couper en deux ne ferait que la hacher. */}
              <h1 data-reveal="2">{t('La simplicité au bout des doigts')}</h1>
            </div>
            {/*
              ⚠️ LE BOUTON DIT LE BÉNÉFICE, PAS LA DÉMARCHE. Personne ne se lève
              le matin pour « inscrire une entreprise ». La barre du haut, elle,
              garde le libellé explicite : c'est un repère de navigation, pas un
              argument.
            */}
            <div className="cta" data-reveal="3">
              <InscriptionLink className="btn btn-primary">Fiabiliser mon stock</InscriptionLink>
              <Link href={lien('/tarifs')} className="btn btn-ghost">{t('Voir nos offres')}</Link>
            </div>
          </div>
        </section>

        {/* La preuve, tout de suite : quatre faits, avant le premier argument. */}
        <div className="preuve">
          {PREUVES.map((p) => (
            <div key={p.chiffre}>
              <strong>{t(p.chiffre)}</strong>
              <span>{t(p.quoi)}</span>
            </div>
          ))}
        </div>

        <section className="section" id="en-pratique">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <h2>{t("Trois gestes, et c'est parti")}</h2>
            </div>
            <div className="etapes">
              {ETAPES.map((e, i) => (
                <div className="etape" data-reveal={i + 1} key={e.title}>
                  <span className="etape-no">{i + 1}</span>
                  <h3>{t(e.title)}</h3>
                  <p>{t(e.desc)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Le produit se voit — la moitié terrain, la moitié bureau. */}
        <section className="section bande-surface">
          <div className="container container-large">
            <div className="section-head" data-reveal="0">
              <h2>{t('Du rayon au tableau de bord')}</h2>
            </div>
            <DiaporamaProduit
              precedent={t('Précédent')}
              suivant={t('Suivant')}
              diapos={[
                {
                  titre: t('Du scan dans le rayon'),
                  intro: t('Un téléphone, une étiquette, et le comptage commence.'),
                  image: {
                    src: '/vitrine/comptage-encadre.png',
                    alt: t('L’écran de comptage de l’application, dans un rayon'),
                  },
                  points: [
                    { titre: t('La balise ouverte est nommée'), texte: t('Surface de vente, balise 1000 — on sait toujours où l’on compte.') },
                    { titre: t('Trois façons de scanner'), texte: t('La caméra, la saisie au clavier, ou une douchette Bluetooth.') },
                    { titre: t('Scan automatique'), texte: t('On vise, ça compte. Pas de bouton à presser entre deux articles.') },
                    { titre: t('Le réseau peut tomber'), texte: t('Le comptage continue en réserve et repart tout seul au retour.') },
                  ],
                },
                {
                  titre: t('Au suivi, en direct'),
                  intro: t('Pendant que l’équipe compte, le superviseur voit l’inventaire avancer.'),
                  paysage: true,
                  image: {
                    src: '/vitrine/suivi.png',
                    alt: t('Le suivi d’un inventaire : progression, avancement par zone et derniers scans'),
                  },
                  points: [
                    { titre: t('L’avancement balise par balise'), texte: t('Ce qui est compté, ce qui est audité, ce qui reste.') },
                    { titre: t('Chaque zone et sa progression'), texte: t('La surface de vente et la réserve ne vont jamais au même rythme.') },
                    { titre: t('Les appareils, jamais les personnes'), texte: t('On voit combien de téléphones comptent, pas qui compte.') },
                    { titre: t('Les derniers scans défilent'), texte: t('Comptage et audit mêlés, à la seconde près.') },
                  ],
                },
              ]}
            />
          </div>
        </section>

        {/*
          Le différenciateur, sur l'encre. Le bandeau sombre est le même dans les
          deux thèmes — celui de la charte, celui des e-mails, celui de l'app.
        */}
        <section className="section bande-encre" id="rythmes">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <h2>{t('Comptez sans fermer le magasin')}</h2>
              <p>{t("Une zone par semaine plutôt qu'un grand week-end par an. Le stock reste juste toute l'année.")}</p>
            </div>
            <div className="grid">
              {RYTHMES.map((r, i) => (
                <div className="card" data-reveal={i + 1} key={r.title}>
                  <h3>{t(r.title)}</h3>
                  <p>{t(r.desc)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="fonctionnalites">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <h2>{t('Tout pour un inventaire maîtrisé')}</h2>
              <p>{t('Du premier scan au rapport final.')}</p>
            </div>
            <div className="grid">
              {FEATURES.map((f, i) => (
                <div className="card" data-reveal={(i % 3) + 1} key={f.title}>
                  <div className="ico">{f.icon}</div>
                  <h3>{t(f.title)}</h3>
                  <p>{t(f.desc)}</p>
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
              <h2>{t('Une licence par magasin')}</h2>
              <p>
                {t("Le prix suit le nombre d'appareils qui comptent en même temps. Comptes et inventaires illimités.")}
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
                    {o.cle === OFFRE_PHARE && <span className="offre-pastille">{t('Le plus courant')}</span>}
                  </div>
                  <div className="offre-prix">
                    {euros(o.mois)}<small> / {t('mois')}</small>
                  </div>
                  <p className="offre-plage">{t(o.plage)}</p>
                  {/*
                    ⚠️ LE LIEN PORTE L'OFFRE. Sans `?offre=`, les trois boutons
                    mènent au même écran et /souscrire retombe sur son offre par
                    défaut : « Commencer avec Enterprise » ouvrirait Essential.
                    C'est ce que fait déjà TarifsGrille — les deux chemins
                    doivent envoyer la même chose.
                  */}
                  <Link
                    href={lien(`/souscrire?offre=${o.cle}`)}
                    className={o.cle === OFFRE_PHARE ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  >
                    {t('Commencer avec %{offre}', { offre: o.nom })}
                  </Link>
                </div>
              ))}
            </div>
            <p className="offres-lien" data-reveal="4">
              <Link href={lien('/tarifs')}>{t('Le détail des trois offres')}</Link>
            </p>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <h2>{t('Votre stock est votre principal actif')}</h2>
              <p>{t("L'outil qui le compte doit être irréprochable.")}</p>
            </div>
            <div className="grid">
              {CONFIANCE.map((c, i) => (
                <div className="card" data-reveal={i + 1} key={c.title}>
                  <h3>{t(c.title)}</h3>
                  <p>{t(c.desc)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* L'accent ne sert qu'une fois, à la fin. */}
        <section className="section bande-accent final">
          <div className="container" data-reveal="0">
            <h2>{t('Comptez votre premier rayon cette semaine')}</h2>
            <p>{t('Inscription en ligne, accès ouvert tout de suite.')}</p>
            <div className="cta">
              <InscriptionLink className="btn btn-clair">Fiabiliser mon stock</InscriptionLink>
              <AuthLink className="btn btn-encre" loggedOutLabel="Se connecter" loggedInLabel="Accéder à mon espace" />
            </div>
            <p className="final-note">
              {t("Votre entreprise l'utilise déjà ? Son administrateur vous ouvre l'accès.")}
            </p>
          </div>
        </section>
      </main>

      <SiteFooter langue={langue} />
    </>
  )
}
