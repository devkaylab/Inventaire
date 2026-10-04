import Link from 'next/link'
import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { FaqJsonLd } from '@/components/DonneesStructurees'
import { traduction, type Langue } from '@/lib/traduction'

/**
 * « La démarque inconnue » — page de RÉFÉRENCEMENT, 3 octobre 2026.
 *
 * ⚠️ `/inventaire` en parle déjà, en une section : un chiffre et quatre
 * causes. Cette page ne la recopie pas, elle creuse ce que la section ne peut
 * pas porter :
 *   · la distinction démarque CONNUE / INCONNUE, qui est la première chose
 *     qu'un gérant cherche et que la section n'aborde pas ;
 *   · LE CALCUL, avec un exemple chiffré déroulé — c'est la requête
 *     « calcul démarque inconnue », et c'est de l'arithmétique vérifiable ;
 *   · ce qu'on peut faire, action par action.
 *
 * ⚠️ AUCUNE STATISTIQUE INVENTÉE. L'exemple chiffré est présenté comme un
 * exemple (« prenons un magasin »), jamais comme une moyenne du secteur. Le
 * seul ordre de grandeur du site vit sur `/inventaire`, avec sa réserve
 * (« selon les études du secteur ») ; le répéter ici en l'affirmant plus fort
 * serait inventer une source.
 *
 * ⚠️ LE SENS DU SIGNE EST EXPLIQUÉ, pas choisi en silence. Le rapport affiche
 * l'écart dans l'autre sens (compté − théorique, donc −30 quand il manque
 * trente articles) ; la démarque, elle, se compte en perte positive. Deux
 * pages du même site qui posent la soustraction à l'envers sans le dire
 * passent pour une erreur.
 */

const DEUX_DEMARQUES = [
  {
    titre: 'La démarque connue',
    texte: 'Les pertes que vous avez enregistrées : la casse saisie, les invendus jetés et sortis du stock, les produits périmés, les démarques commerciales. Elles sont désagréables mais maîtrisées — vous savez ce qui est parti, et pourquoi.',
  },
  {
    titre: 'La démarque inconnue',
    texte: 'Ce qui manque sans explication. La marchandise figure encore au stock théorique, elle n’est plus en rayon, et aucune écriture ne dit où elle est passée. On ne la découvre qu’en comptant : c’est l’inventaire qui la révèle, jamais le logiciel de gestion.',
  },
]

const CAUSES = [
  {
    marque: 'Vol',
    titre: 'Le vol à l’étalage',
    texte: 'La cause à laquelle on pense d’abord. Elle se concentre sur des familles d’articles précises : petit volume, forte valeur, revente facile.',
  },
  {
    marque: 'Interne',
    titre: 'Le vol interne',
    texte: 'Plus discret, et souvent plus coûteux à l’unité. Il laisse une trace particulière : des écarts répétés sur les mêmes zones ou les mêmes horaires.',
  },
  {
    marque: 'Casse',
    titre: 'La casse non enregistrée',
    texte: 'Un produit tombé, abîmé, périmé, jeté dans la benne sans passer par une sortie de stock. C’est de la démarque connue qui devient inconnue faute de saisie.',
  },
  {
    marque: 'Saisie',
    titre: 'Les erreurs administratives',
    texte: 'Une réception validée pour une quantité jamais livrée, un retour fournisseur non déduit, un code-barres qui encaisse un article pour un autre. Rien n’a disparu : c’est l’écriture qui est fausse.',
  },
]

const REDUIRE = [
  {
    titre: 'Compter plus souvent',
    texte: 'Un écart découvert douze mois après n’a plus de cause identifiable. Repéré dans le mois, il se relie à une livraison, à une zone, à une période.',
  },
  {
    titre: 'Compter deux fois',
    texte: 'Une seconde passe sur les rayons sensibles sépare la vraie perte de l’erreur de comptage. Sans elle, on traite des causes qui n’existent pas.',
  },
  {
    titre: 'Corriger les écritures',
    texte: 'Avant d’accuser le vol, reprenez les réceptions, les retours et les sorties de casse. C’est la part la moins visible, et souvent la plus simple à récupérer.',
  },
  {
    titre: 'Cibler ce qui bouge',
    texte: 'Les familles qui ressortent chaque fois méritent un comptage dédié, plus fréquent, et des mesures en rayon. Le reste n’a pas besoin du même effort.',
  },
]

export function DemarqueInconnue({ langue }: { langue: Langue }) {
  const { t, lien } = traduction(langue)

  const QUESTIONS = [
    {
      q: 'Qu’est-ce que la démarque inconnue ?',
      r: 'La marchandise qui figure encore à votre stock théorique mais n’est plus en magasin, sans qu’aucune écriture n’explique sa disparition. Elle se mesure en comparant le stock compté au stock théorique, donc uniquement lors d’un inventaire.',
    },
    {
      q: 'Comment calcule-t-on la démarque inconnue ?',
      r: 'En valeur : stock théorique moins stock compté, valorisé au prix d’achat. En taux : cette valeur divisée par le chiffre d’affaires hors taxes de la période, multipliée par cent.',
    },
    {
      q: 'Quelle différence avec la démarque connue ?',
      r: 'La démarque connue est enregistrée : casse saisie, périmés sortis du stock, démarques commerciales. La démarque inconnue n’a pas d’écriture — c’est précisément ce qui la rend inconnue.',
    },
    {
      q: 'Au prix d’achat ou au prix de vente ?',
      r: 'Au prix d’achat pour mesurer la perte réelle sur la valeur du stock, et c’est le calcul de référence. Au prix de vente, on mesure le chiffre d’affaires manqué : le chiffre est plus gros, et les deux ne se comparent pas entre eux.',
    },
    {
      q: 'À quelle fréquence faut-il la mesurer ?',
      r: 'Aussi souvent que vous comptez. Un inventaire annuel ne donne qu’un chiffre par an, sans cause rattachable ; un inventaire tournant en donne un par zone et par passage, ce qui permet d’agir.',
    },
    {
      q: 'Un taux élevé signifie-t-il qu’on nous vole ?',
      r: 'Pas forcément, et c’est l’erreur la plus fréquente. Les erreurs de réception et de caisse pèsent souvent autant que le vol. Reprenez les écritures avant de conclure : la correction y est plus rapide, et moins coûteuse.',
    },
  ]

  const FAQ = QUESTIONS.map((item) => ({ question: t(item.q), reponse: t(item.r) }))

  return (
    <>
      <SiteHeader langue={langue} />
      <main>
        <section className="hero">
          <div className="container">
            <h1 data-reveal="1">{t('La démarque inconnue')}</h1>
            <p className="lead" data-reveal="2">
              {t('La marchandise qui manque sans explication : ce qu’elle est, comment on la calcule, d’où elle vient et par quoi commencer pour la réduire.')}
            </p>
          </div>
        </section>

        {/* ── La distinction d'abord : c'est ce qu'on vient chercher ── */}
        <section className="section dq-section-haut">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Démarque connue, démarque inconnue')}</h2>
              <p className="iv-note">{t('Les deux font baisser le stock. Une seule est un angle mort.')}</p>
            </div>
            <div className="iv-causes">
              {DEUX_DEMARQUES.map((d, i) => (
                <div className="iv-cause" data-reveal={i + 1} key={d.titre}>
                  <h3>{t(d.titre)}</h3>
                  <p>{t(d.texte)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Le calcul, puis l'exemple déroulé ── */}
        <section className="section bande-surface">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Comment on la calcule')}</h2>
              <p className="iv-note">{t('Deux opérations : la perte en valeur, puis le taux qui la rend comparable d’une année sur l’autre.')}</p>
            </div>
            {/* ⚠️ THÉORIQUE MOINS COMPTÉ, dans cet ordre : une démarque est une
                PERTE, donc un nombre positif. Le rapport de l'outil pose la
                soustraction dans l'autre sens (compté − théorique = −30), ce
                qui est la même information avec le signe opposé. La note
                ci-dessous le dit, pour qu'une page n'ait pas l'air de
                contredire l'autre. */}
            <div className="iv-calcul" data-reveal="1">
              <div className="iv-terme">
                <strong>{t('Stock théorique')}</strong>
                <span>{t('Ce que votre logiciel croit avoir')}</span>
              </div>
              <b className="iv-signe" aria-hidden="true">−</b>
              <div className="iv-terme">
                <strong>{t('Stock compté')}</strong>
                <span>{t('Ce qui est vraiment là')}</span>
              </div>
              <b className="iv-signe" aria-hidden="true">=</b>
              <div className="iv-terme iv-terme-resultat">
                <strong>{t('La démarque')}</strong>
                <span>{t('En quantités, puis valorisée au prix d’achat')}</span>
              </div>
            </div>
            <p className="iv-rappel" data-reveal="2">
              {t('Le rapport de Quantinvo affiche l’écart dans l’autre sens — compté moins théorique, donc −30 quand il manque trente articles. C’est la même information : la démarque est cet écart compté comme une perte.')}
            </p>
            <div className="iv-causes" data-reveal="3">
              <div className="iv-cause">
                <h3>{t('Le taux de démarque inconnue')}</h3>
                <p>{t('Valeur de la démarque, divisée par le chiffre d’affaires hors taxes de la période, multipliée par cent. C’est ce taux qui se suit d’une année sur l’autre, et se compare d’un magasin à l’autre.')}</p>
              </div>
              <div className="iv-cause">
                <h3>{t('Un exemple')}</h3>
                <p>{t('Prenons un magasin à 1 200 000 € de chiffre d’affaires hors taxes. L’inventaire laisse 14 400 € de marchandise manquante au prix d’achat. Le taux est de 14 400 / 1 200 000 × 100, soit 1,2 %.')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Les causes, développées ── */}
        <section className="section bande-encre">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('D’où elle vient')}</h2>
              <p className="iv-note">{t('Quatre causes, et deux d’entre elles ne sont pas des vols.')}</p>
            </div>
            <div className="iv-anomalies">
              {CAUSES.map((c, i) => (
                <div className="iv-anomalie" data-reveal={i + 1} key={c.titre}>
                  <span className="iv-marque">{t(c.marque)}</span>
                  <h3>{t(c.titre)}</h3>
                  <p>{t(c.texte)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Ce qu'on peut faire, dans l'ordre ── */}
        <section className="section bande-surface">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Comment la réduire')}</h2>
            </div>
            <ol className="iv-methode">
              {REDUIRE.map((r, i) => (
                <li data-reveal={i + 1} key={r.titre}>
                  <span className="iv-temps" aria-hidden="true">{i + 1}</span>
                  <h3>{t(r.titre)}</h3>
                  <p>{t(r.texte)}</p>
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
              <Link href={lien('/inventaire-tournant')} className="dq-lien" data-reveal="2">
                <h3>{t('L’inventaire tournant')}</h3>
                <p>{t('Compter une zone par semaine : la méthode, les fréquences, la mise en place.')}</p>
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
            <h2>{t('Mesurez votre démarque avec Quantinvo')}</h2>
            <p>{t('Zones et balises, double comptage, écarts en unités et en valeur dans le rapport.')}</p>
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
