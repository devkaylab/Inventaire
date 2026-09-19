import Link from 'next/link'
import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { OngletsRaisons } from '@/components/OngletsRaisons'
import { OFFRES, euros } from '@/lib/offres'
import { traduction, type Langue } from '@/lib/traduction'

/**
 * « Pourquoi nous choisir », refondue le 19 septembre 2026 (demande de
 * Julien : « refais la page en t'inspirant de Découvrir, pas en faisant un
 * copier-coller »).
 *
 * ⚠️ CE QUI VIENT DE DÉCOUVRIR : titres à gauche, une phrase par idée, des
 * fonds qui alternent, l'accent une seule fois à la fin. CE QUI EST PROPRE À
 * CETTE PAGE : la page affirme six choses, donc elle les montre TOUTES d'un
 * coup d'œil (six onglets) et ne déplie qu'une raison à la fois, avec l'écran
 * qui la prouve ; puis un face-à-face « d'habitude / avec Quantinvo », qui
 * est la question qu'on se pose en comparant.
 *
 * ⚠️ CHAQUE RAISON MONTRE L'ÉCRAN DONT ELLE PARLE (règle du 12 septembre) :
 * l'import nomme les variantes de colonnes, « Mon compte » porte le bouton
 * « Télécharger mes données ». Une capture qui illustre vaguement ne prouve
 * rien.
 */
const RAISONS = [
  {
    titre: 'Vos équipes suffisent',
    image: {
      src: '/vitrine/bienvenue-compteur-encadre.png',
      alt: 'La première ouverture de l’application par un compteur : les trois gestes à faire',
    },
    points: [
      'Le téléphone de chacun devient le scanner.',
      'Un code pour rejoindre l’inventaire, et on compte, sans formation.',
      'Plusieurs compteurs en même temps, chacun dans sa zone.',
    ],
  },
  {
    titre: 'Vos fichiers, tels quels',
    image: {
      src: '/vitrine/importer-encadre.png',
      alt: 'L’écran d’import : les deux fichiers attendus et les noms de colonnes reconnus',
    },
    points: [
      'CSV ou Excel, sans retravailler le fichier.',
      'Vos noms de colonnes sont reconnus : SKU, EAN, Gencod, Qté…',
      'À la sortie, un export Excel prêt pour l’analyse.',
    ],
  },
  {
    titre: 'Un chiffre auquel se fier',
    image: {
      src: '/vitrine/rapport-encadre.png',
      alt: 'Le rapport d’inventaire : stock théorique, stock compté, écart en unités et en valeur',
    },
    points: [
      'Chaque zone est ouverte, comptée, puis clôturée.',
      'Double comptage et arbitrage, article par article.',
      'Chaque ligne garde la trace de qui l’a comptée.',
    ],
  },
  {
    titre: 'Un suivi en direct',
    image: {
      src: '/vitrine/suivi.png',
      alt: 'Le suivi d’un inventaire sur le site : progression, avancement par zone et derniers scans',
      large: true,
    },
    points: [
      'L’avancement zone par zone, pendant le comptage.',
      'Les écarts se tranchent le jour même.',
      'On suit le travail, pas les personnes.',
    ],
  },
  {
    titre: 'Libre, toute l’année',
    image: {
      src: '/vitrine/accueil-superviseur-encadre.png',
      alt: 'L’accueil d’un superviseur : ses inventaires, et le bouton pour en lancer un autre',
    },
    points: [
      'Tournant, ciblé ou complet : vous choisissez.',
      'Autant d’inventaires que vous voulez, au même prix.',
      'Chaque magasin garde ses codes et ses équipes.',
    ],
  },
  {
    titre: 'Sérieux jusque dans les coulisses',
    image: {
      src: '/vitrine/mon-compte-encadre.png',
      alt: 'L’écran « Mon compte » : profil, téléchargement de ses données, déconnexion',
    },
    points: [
      'Données hébergées dans l’Union européenne, sans traceur publicitaire.',
      'Rôles séparés, double authentification pour qui administre.',
      'Chacun télécharge ses données ou supprime son compte.',
    ],
  },
]

/**
 * ⚠️ « D'HABITUDE », PAS « LES AUTRES ». On compare à une pratique que le
 * lecteur connaît, jamais à un concurrent qu'on nommerait ou dénigrerait.
 */
const FACE_A_FACE = [
  { sujet: 'Le matériel', avant: 'Des terminaux à acheter ou à louer, qui ne servent qu’aux inventaires', avec: 'Le téléphone de chacun' },
  { sujet: 'Les fichiers', avant: 'Une ressaisie avant chaque import', avec: 'Le fichier de votre logiciel, tel quel' },
  { sujet: 'Les écarts', avant: 'Découverts plusieurs jours après', avec: 'Tranchés le jour même' },
  { sujet: 'Le rythme', avant: 'Un grand comptage par an', avec: 'Autant d’inventaires que vous voulez' },
]

export function Pourquoi({ langue }: { langue: Langue }) {
  const { t, lien } = traduction(langue)
  const prix = euros(Math.min(...OFFRES.map((o) => o.mois)))
  return (
    <>
      <SiteHeader langue={langue} />
      <main>
        <section className="hero pq-heros">
          <div className="container">
            <h1 data-reveal="1">{t('Six raisons de compter avec Quantinvo.')}</h1>
          </div>
        </section>

        <section className="section pq-section-raisons">
          <div className="container" data-reveal="0">
            <OngletsRaisons
              libelle={t('Les six raisons')}
              raisons={RAISONS.map((r) => ({
                titre: t(r.titre),
                points: r.points.map((p) => t(p)),
                image: { ...r.image, alt: t(r.image.alt) },
              }))}
            />
          </div>
        </section>

        <section className="section bande-encre">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('D’habitude, et avec Quantinvo')}</h2>
            </div>
            <div className="pq-face" data-reveal="1">
              <div className="pq-face-tete" aria-hidden="true">
                <span />
                <span>{t('D’habitude')}</span>
                <span>{t('Avec Quantinvo')}</span>
              </div>
              {FACE_A_FACE.map((f) => (
                <div className="pq-face-ligne" key={f.sujet}>
                  <strong>{t(f.sujet)}</strong>
                  <span className="pq-avant"><em>{t('D’habitude')}</em>{t(f.avant)}</span>
                  <span className="pq-avec"><em>{t('Avec Quantinvo')}</em>{t(f.avec)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section bande-accent final">
          <div className="container" data-reveal="0">
            <h2>{t('Fiabilisez votre stock avec Quantinvo')}</h2>
            <p>{t('Un prix par magasin, à partir de %{prix} par mois. Inscription en ligne, sans devis.', { prix })}</p>
            <div className="cta">
              <InscriptionLink className="btn btn-clair">Fiabiliser mon stock</InscriptionLink>
              <Link href={lien('/tarifs')} className="btn btn-encre">{t('Voir nos offres')}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter langue={langue} />
    </>
  )
}
