import Link from 'next/link'
import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { FaqJsonLd } from '@/components/DonneesStructurees'
import { traduction, type Langue } from '@/lib/traduction'

/**
 * « L'inventaire tournant » — page de RÉFÉRENCEMENT, 3 octobre 2026.
 *
 * ⚠️ `/inventaire` présente les trois rythmes côte à côte, avec l'année
 * dessinée. Cette page ne refait pas la comparaison : elle prend le tournant
 * seul et donne ce que la comparaison ne peut pas donner — le CLASSEMENT A/B/C
 * et ses fréquences, le découpage en zones, et un calendrier de mise en route.
 * C'est la requête « inventaire tournant méthode », pas « quel rythme
 * choisir ».
 *
 * ⚠️ LES FRÉQUENCES SONT DONNÉES COMME UN POINT DE DÉPART, jamais comme une
 * règle. Elles dépendent du secteur, de la rotation et de la valeur : un point
 * de vente de téléphonie et une jardinerie ne classent pas pareil. Une page
 * qui les énonce comme une norme se fait reprendre par le premier
 * professionnel qui la lit.
 */

const CONTRE_ANNUEL = [
  { titre: 'Un écart sans cause', texte: 'Douze mois après, plus personne ne peut relier un manquant à une livraison ou à une période.' },
  { titre: 'Une soirée pour tout le monde', texte: 'Le comptage complet mobilise l’équipe entière d’un coup, souvent après la fermeture.' },
  { titre: 'Onze mois à l’aveugle', texte: 'Entre deux inventaires, les commandes et le réassort tournent sur un stock que personne n’a vérifié.' },
]

/**
 * Le classement A/B/C. ⚠️ Les pourcentages décrivent la MÉTHODE (une petite
 * part des références fait l'essentiel de la valeur), pas une mesure du
 * marché : ils sont donnés comme un ordre de grandeur à recaler sur ses
 * propres ventes, et la quatrième tuile dit comment le recaler.
 */
const ABC = [
  {
    titre: 'A — ce qui fait le chiffre',
    texte: 'Une petite part de vos références, l’essentiel de la valeur vendue. Forte rotation, forte valeur, ou les deux. Un comptage par mois, ou par trimestre au minimum.',
  },
  {
    titre: 'B — le ventre du magasin',
    texte: 'Rotation moyenne, valeur moyenne. Deux à trois comptages par an suffisent à garder l’écart sous contrôle.',
  },
  {
    titre: 'C — la longue traîne',
    texte: 'Beaucoup de références, peu de valeur et peu de mouvement. Une fois par an, souvent à l’occasion de l’inventaire complet.',
  },
  {
    titre: 'Comment classer les vôtres',
    texte: 'Sortez de votre logiciel les ventes des douze derniers mois, triez par valeur vendue décroissante, et coupez là où la courbe s’aplatit. Ajoutez en A ce qui est sensible au vol, même si la valeur est faible.',
  },
]

const ZONES = [
  { marque: 'Taille', titre: 'Une zone se compte en une fois', texte: 'Si une personne ne peut pas la finir dans sa session, coupez-la. Une zone laissée à moitié est une zone qu’il faudra recommencer.' },
  { marque: 'Bornes', titre: 'Des limites qu’on voit', texte: 'Un rayon, une allée, une travée de réserve. Une frontière qu’on doit interpréter produit des doublons et des oublis.' },
  { marque: 'Stable', titre: 'Le même découpage à chaque passage', texte: 'C’est ce qui rend les écarts comparables d’un mois sur l’autre, et permet de voir qu’une zone dérive.' },
  { marque: 'Réserve', titre: 'La réserve en fait partie', texte: 'Elle concentre souvent les écarts, et c’est l’endroit où le réseau tombe. Le comptage doit tenir sans signal.' },
]

const DEMARRER = [
  { titre: 'Importer et classer', texte: 'Chargez le référentiel articles et le stock théorique, puis sortez vos ventes de l’année pour établir les familles A, B et C.' },
  { titre: 'Découper et nommer', texte: 'Tracez les zones sur le plan du magasin, imprimez leurs balises, et collez-les là où le compteur les verra.' },
  { titre: 'Compter une zone', texte: 'Une seule, sur une famille A, avec une personne. L’objectif n’est pas le chiffre : c’est de mesurer le temps réel d’une zone.' },
  { titre: 'Caler le rythme', texte: 'Le temps mesuré donne le nombre de zones par semaine. Posez-le au calendrier, et tenez-le : c’est la régularité qui fait le résultat.' },
]

export function InventaireTournant({ langue }: { langue: Langue }) {
  const { t, lien } = traduction(langue)

  const QUESTIONS = [
    {
      q: 'Qu’est-ce qu’un inventaire tournant ?',
      r: 'Un comptage par zones, étalé dans le temps : quelques rayons cette semaine, la réserve la semaine prochaine. Chaque zone est vérifiée plusieurs fois par an sans jamais fermer le magasin.',
    },
    {
      q: 'Remplace-t-il l’inventaire annuel ?',
      r: 'Il ne remplace pas l’obligation légale de contrôler son stock par inventaire au moins une fois tous les douze mois. En revanche, un magasin qui compte en tournant toute l’année arrive à son inventaire complet avec un stock déjà fiable, donc beaucoup moins d’écarts à traiter.',
    },
    {
      q: 'À quelle fréquence faut-il compter chaque zone ?',
      r: 'Selon ce qu’elle contient : les familles à forte rotation ou sensibles au vol une fois par mois ou par trimestre, le milieu de gamme deux à trois fois par an, la longue traîne une fois par an. Ce sont des points de départ, à recaler sur vos propres ventes.',
    },
    {
      q: 'Combien de temps prend une zone ?',
      r: 'Cela dépend de la densité du rayon et du nombre de références. C’est la raison pour laquelle on commence par en compter une seule, chronomètre en main : le temps mesuré donne le nombre de zones tenables par semaine.',
    },
    {
      q: 'Faut-il fermer le magasin ?',
      r: 'Non, et c’est l’intérêt principal. Une zone se compte pendant les heures creuses, pendant que le reste du magasin travaille normalement.',
    },
    {
      q: 'Comment éviter de compter deux fois la même chose ?',
      r: 'Par des zones aux limites visibles, ouvertes puis clôturées une à une. Dans Quantinvo, chaque zone porte une balise que le compteur scanne avant de commencer : c’est elle qui dit qui compte quoi, et ce qui reste à faire.',
    },
  ]

  const FAQ = QUESTIONS.map((item) => ({ question: t(item.q), reponse: t(item.r) }))

  return (
    <>
      <SiteHeader langue={langue} />
      <main>
        <section className="hero">
          <div className="container">
            <h1 data-reveal="1">{t('L’inventaire tournant')}</h1>
            <p className="lead" data-reveal="2">
              {t('Compter le magasin zone par zone, toute l’année, sans jamais le fermer : la méthode, le classement des articles, les fréquences, et comment s’y mettre en quatre semaines.')}
            </p>
          </div>
        </section>

        {/* ── Pourquoi on en vient là ── */}
        <section className="section dq-section-haut">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Ce que l’inventaire annuel seul ne donne pas')}</h2>
            </div>
            <div className="iv-pourquoi">
              <div className="iv-obligation" data-reveal="1">
                <span className="iv-obligation-chiffre">{t('1 photo')}<small>{t('du stock, par an')}</small></span>
                <h3>{t('Une image, pas un suivi')}</h3>
                <p>{t('L’inventaire complet dit où vous en êtes le soir du comptage. Il ne dit rien des onze mois qui précèdent, ni de ce qui a dérivé entre-temps.')}</p>
                <small className="iv-source">{t('L’obligation reste annuelle : le tournant s’y ajoute, il ne la remplace pas.')}</small>
              </div>
              <div className="iv-raisons">
                {CONTRE_ANNUEL.map((r, i) => (
                  <div className="iv-raison" data-reveal={i + 2} key={r.titre}>
                    <h3>{t(r.titre)}</h3>
                    <p>{t(r.texte)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Le classement : le cœur de la méthode ── */}
        <section className="section">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Classer les articles : A, B, C')}</h2>
              <p className="iv-note">{t('On ne compte pas tout à la même fréquence. Tout l’art du tournant est là.')}</p>
            </div>
            <div className="iv-causes">
              {ABC.map((a, i) => (
                <div className="iv-cause" data-reveal={i + 1} key={a.titre}>
                  <h3>{t(a.titre)}</h3>
                  <p>{t(a.texte)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Le découpage, sur l'encre ── */}
        <section className="section bande-encre">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Découper le magasin en zones')}</h2>
              <p className="iv-note">{t('Quatre règles, et elles se vérifient toutes sur le terrain, pas sur un plan.')}</p>
            </div>
            <div className="iv-anomalies">
              {ZONES.map((z, i) => (
                <div className="iv-anomalie" data-reveal={i + 1} key={z.titre}>
                  <span className="iv-marque">{t(z.marque)}</span>
                  <h3>{t(z.titre)}</h3>
                  <p>{t(z.texte)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── La mise en route ── */}
        <section className="section bande-surface">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Se mettre au tournant en quatre semaines')}</h2>
              <p className="iv-note">{t('Une semaine par étape, et la quatrième donne le rythme que votre magasin peut réellement tenir.')}</p>
            </div>
            <ol className="iv-methode">
              {DEMARRER.map((d, i) => (
                <li data-reveal={i + 1} key={d.titre}>
                  <span className="iv-temps" aria-hidden="true">{i + 1}</span>
                  <h3>{t(d.titre)}</h3>
                  <p>{t(d.texte)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="container dq-faq">
            <h2 data-reveal="0">{t('Les questions qu’on nous pose')}</h2>
            <div className="dq-faq-liste" data-reveal="1">
              {FAQ.map((item) => (
                <details className="collapsible" key={item.question}>
                  <summary>{item.question}</summary>
                  <p className="collapsible-body">{item.reponse}</p>
                </details>
              ))}
            </div>
          </div>
          <FaqJsonLd items={FAQ} />
        </section>

        <section className="section bande-surface">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Pour aller plus loin')}</h2>
            </div>
            <div className="dq-liens">
              <Link href={lien('/inventaire')} className="dq-lien" data-reveal="1">
                <h3>{t('L’inventaire')}</h3>
                <p>{t('Pourquoi compter son stock, ce que révèle l’écart, et les trois façons de compter.')}</p>
              </Link>
              <Link href={lien('/demarque-inconnue')} className="dq-lien" data-reveal="2">
                <h3>{t('La démarque inconnue')}</h3>
                <p>{t('Ce qu’elle est, comment on la calcule, et comment on la réduit.')}</p>
              </Link>
              <Link href={lien('/logiciel-inventaire')} className="dq-lien" data-reveal="3">
                <h3>{t('Les logiciels d’inventaire')}</h3>
                <p>{t('Ce qu’un tel outil doit savoir faire, et les questions à poser avant de choisir.')}</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="section bande-accent final">
          <div className="container" data-reveal="0">
            <h2>{t('Comptez en tournant avec Quantinvo')}</h2>
            <p>{t('Des zones, une balise par zone, et un rapport à chaque passage.')}</p>
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
