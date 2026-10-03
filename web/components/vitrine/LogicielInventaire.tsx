import Link from 'next/link'
import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { FaqJsonLd } from '@/components/DonneesStructurees'
import { OFFRES, euros } from '@/lib/offres'
import { traduction, type Langue } from '@/lib/traduction'

/**
 * « Logiciel d'inventaire pour magasin » — page de RÉFÉRENCEMENT, 3 octobre
 * 2026. C'est la requête commerciale que le site ne visait nulle part : la
 * vitrine parlait du produit par son nom (« Qu'est-ce que Quantinvo ? »,
 * « Pourquoi nous choisir »), donc elle ne pouvait répondre qu'à quelqu'un qui
 * connaissait déjà la marque.
 *
 * ⚠️ ELLE NE REFAIT PAS /pourquoi-nous-choisir. Celle-là compare Quantinvo à
 * l'habitude (« D'habitude, et avec Quantinvo ») et argumente la marque. Ici
 * on répond à une question posée AVANT de connaître les marques : comment
 * comptent les magasins aujourd'hui, qu'est-ce qu'un tel outil doit savoir
 * faire, que demander avant de choisir. Quantinvo n'arrive qu'à la fin.
 *
 * ⚠️ LES TERMES CHERCHÉS RESTENT DANS LES TITRES — « logiciel d'inventaire »,
 * « application d'inventaire », « inventaire magasin ». Une page de
 * référencement qui n'écrit nulle part ce qu'on tape ne se trouve pas.
 *
 * ⚠️ Elle fait partie d'un MOYEU : `/inventaire` est la page large, celle-ci
 * et ses deux sœurs (`/demarque-inconnue`, `/inventaire-tournant`) creusent
 * chacune un sujet et se renvoient l'une à l'autre. Deux pages qui traitent le
 * même sujet au même niveau se font concurrence au lieu de s'additionner.
 */

/** Comment les magasins comptent réellement, et ce que chaque façon coûte. */
const FACONS = [
  {
    marque: 'Papier',
    titre: 'La feuille et le crayon',
    texte: 'Gratuit, et personne n’a besoin d’être formé. Mais il faut ressaisir chaque ligne après coup, l’écriture se discute, et deux compteurs peuvent faire le même rayon sans le savoir.',
  },
  {
    marque: 'Tableur',
    titre: 'Le tableur partagé',
    texte: 'On y voit clair et on calcule. Il ne dit pas qui a compté quoi, ne détecte pas un article saisi deux fois, et un code-barres y perd ses zéros de tête dès l’ouverture.',
  },
  {
    marque: 'Terminal',
    titre: 'Les terminaux du prestataire',
    texte: 'Précis et robustes. Il faut les louer, les recevoir, les charger, les rendre — et le coût suit le nombre d’appareils, pas le besoin réel du magasin.',
  },
  {
    marque: 'Mobile',
    titre: 'L’application sur les téléphones de l’équipe',
    texte: 'L’appareil est déjà dans la poche, le scan lit le code-barres, et le rapport se calcule au fil du comptage. C’est la façon dont Quantinvo a été construit.',
  },
]

/**
 * Ce qu'il faut regarder, et pourquoi. ⚠️ Chaque point est quelque chose que
 * Quantinvo FAIT — une grille de comparaison qui décrit un produit qu'on
 * n'a pas est une publicité déguisée, et le prospect le voit.
 */
const CAPACITES = [
  {
    titre: 'Un découpage du magasin en zones',
    texte: 'Sans zones nommées, ouvertes puis clôturées une à une, rien ne garantit qu’un rayon n’a pas été oublié — ni compté deux fois par deux personnes.',
  },
  {
    titre: 'Un second comptage, et l’arbitrage des écarts',
    texte: 'Un chiffre compté une seule fois est une hypothèse. La seconde passe le vérifie, et l’écart entre les deux se tranche avant que l’équipe ne reparte.',
  },
  {
    titre: 'Le fonctionnement sans réseau',
    texte: 'Une réserve, un sous-sol, un entrepôt en tôle : le signal y tombe. Le comptage doit continuer et repartir tout seul au retour du réseau.',
  },
  {
    titre: 'Un import qui accepte vos fichiers',
    texte: 'Votre référentiel sort de votre logiciel de caisse ou de gestion dans le format qu’il veut. C’est à l’outil d’inventaire de s’y plier, pas à vous de reformater.',
  },
  {
    titre: 'Un rapport d’écarts exploitable',
    texte: 'En unités et en valeur, article par article, exportable en tableur. Un rapport qu’on ne peut pas ouvrir dans Excel ne circule pas dans l’entreprise.',
  },
  {
    titre: 'Des rôles séparés',
    texte: 'Celui qui compte et celui qui supervise ne font pas le même métier. Un saisonnier ne doit pas pouvoir clôturer un inventaire.',
  },
]

/** Les questions qui changent la facture ou le déroulé du jour J. */
const A_DEMANDER = [
  { fort: 'Sur quoi porte le prix ?', suite: ' Par magasin, par utilisateur, par appareil, par référence comptée ? C’est ce qui fait l’écart entre deux devis du même ordre.' },
  { fort: 'Faut-il acheter ou louer du matériel ?', suite: ' Et si la réponse est non, l’application tourne-t-elle sur les téléphones que vos équipes ont déjà ?' },
  { fort: 'Que se passe-t-il sans réseau ?', suite: ' Demandez ce qui est déjà compté quand le signal revient — pas si « ça marche hors ligne ».' },
  { fort: 'Qui voit l’avancement pendant le comptage ?', suite: ' Attendre le lendemain pour savoir qu’un rayon a été sauté coûte une seconde soirée.' },
  { fort: 'Comment sortent les données ?', suite: ' Un export tableur, sans intervention du fournisseur, est la différence entre vos données et les siennes.' },
  { fort: 'Où sont-elles hébergées ?', suite: ' Dans l’Union européenne ou ailleurs, et avec quelle durée de conservation.' },
]

export function LogicielInventaire({ langue }: { langue: Langue }) {
  const { t, lien } = traduction(langue)
  const prix = euros(Math.min(...OFFRES.map((o) => o.mois)))

  const QUESTIONS = [
    {
      q: 'Qu’est-ce qu’un logiciel d’inventaire ?',
      r: 'Un outil qui organise le comptage physique du stock, puis le compare au stock théorique de votre logiciel de caisse ou de gestion. Il découpe le magasin en zones, enregistre chaque article scanné et produit le rapport d’écarts.',
    },
    {
      q: 'Quelle différence avec un logiciel de gestion de stock ?',
      r: 'Un logiciel de gestion de stock tient le stock théorique au quotidien : il enregistre les réceptions et les ventes. Un logiciel d’inventaire sert à vérifier ce stock théorique en comptant ce qui est vraiment là. Les deux se complètent, aucun ne remplace l’autre.',
    },
    {
      q: 'Faut-il une douchette ou un terminal spécialisé ?',
      r: 'Non. L’appareil photo d’un téléphone lit les codes-barres. Une douchette Bluetooth reste utile quand on compte plusieurs heures d’affilée, mais ce n’est pas un prérequis.',
    },
    {
      q: 'Peut-on faire un inventaire avec un simple tableur ?',
      r: 'Oui, et beaucoup de magasins le font. Les limites apparaissent au volume : la ressaisie prend des heures, personne ne sait qui a compté quoi, et un code-barres perd ses zéros de tête à l’ouverture du fichier.',
      traduite: false,
    },
    {
      q: 'Combien coûte un logiciel d’inventaire ?',
      r: t('Cela dépend de ce qui est facturé — magasin, utilisateur, appareil ou référence. Chez Quantinvo, c’est une licence par magasin à partir de %{prix} par mois, calée sur le nombre d’appareils qui comptent en même temps.', { prix }),
      traduite: true,
    },
    {
      q: 'Combien de temps pour le mettre en place ?',
      r: 'Le temps d’importer votre référentiel articles et votre stock théorique, puis de découper le magasin en zones. Il n’y a pas d’installation à faire sur les téléphones autre que l’application elle-même.',
    },
  ]

  const FAQ = QUESTIONS.map((item) => ({
    question: t(item.q),
    reponse: item.traduite ? item.r : t(item.r),
  }))

  return (
    <>
      <SiteHeader langue={langue} />
      <main>
        <section className="hero">
          <div className="container">
            <h1 data-reveal="1">{t('Logiciel d’inventaire pour magasin')}</h1>
            <p className="lead" data-reveal="2">
              {t('Compter le stock d’un magasin, le comparer à ce que votre logiciel croit avoir, et sortir un rapport d’écarts : voici ce qu’un outil d’inventaire doit savoir faire, et ce qu’il faut vérifier avant d’en choisir un.')}
            </p>
          </div>
        </section>

        {/* ── Ce qui existe déjà, sans flatter personne ── */}
        <section className="section bande-encre">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Comment les magasins comptent aujourd’hui')}</h2>
            </div>
            <div className="iv-anomalies">
              {FACONS.map((f, i) => (
                <div className="iv-anomalie" data-reveal={i + 1} key={f.titre}>
                  <span className="iv-marque">{t(f.marque)}</span>
                  <h3>{t(f.titre)}</h3>
                  <p>{t(f.texte)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── La grille de lecture : six capacités, et à quoi elles servent ── */}
        <section className="section">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Ce qu’un logiciel d’inventaire doit savoir faire')}</h2>
              <p className="iv-note">{t('Six capacités qui se voient le jour du comptage, pas sur une plaquette.')}</p>
            </div>
            <div className="iv-causes">
              {CAPACITES.map((c, i) => (
                <div className="iv-cause" data-reveal={i + 1} key={c.titre}>
                  <h3>{t(c.titre)}</h3>
                  <p>{t(c.texte)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Ce qu'il faut demander, y compris à nous ── */}
        <section className="section bande-surface">
          <div className="container">
            <div className="dq-duo">
              <div className="dq-duo-dire" data-reveal="0">
                <h2>{t('Six questions à poser avant de choisir')}</h2>
                <p>
                  {t('Posez-les à chaque fournisseur, nous compris. Les réponses tiennent en une phrase, et ce sont elles qui font la différence entre deux offres du même prix.')}
                </p>
              </div>
              <ul className="dq-points" data-reveal="1">
                {A_DEMANDER.map((q) => (
                  <li key={q.fort}>
                    <strong>{t(q.fort)}</strong>
                    {t(q.suite)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Et nous, où on se situe : court, et vérifiable ── */}
        <section className="section">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Quantinvo, en une phrase')}</h2>
              <p className="iv-note">
                {t('Les équipes comptent avec leur téléphone, le superviseur suit l’avancement en direct depuis un ordinateur, et le rapport d’écarts s’exporte en tableur. Une licence par magasin, à partir de %{prix} par mois.', { prix })}
              </p>
            </div>
            <div className="dq-tete-action" data-reveal="1">
              <Link href={lien('/decouvrir')} className="btn btn-primary">{t('Voir l’outil en détail')}</Link>
              <Link href={lien('/tarifs')} className="btn btn-ghost">{t('Voir nos offres')}</Link>
            </div>
          </div>
        </section>

        {/* ── Les questions : titre à gauche, réponses à droite ── */}
        <section className="section bande-surface">
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
          {/* Les questions sont VISIBLES juste au-dessus : c'est la
              condition de Google pour une FAQPage. */}
          <FaqJsonLd items={FAQ} />
        </section>

        {/* ── Le moyeu : les trois autres pages du sujet ── */}
        <section className="section">
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
              <Link href={lien('/inventaire-tournant')} className="dq-lien" data-reveal="3">
                <h3>{t('L’inventaire tournant')}</h3>
                <p>{t('Compter une zone par semaine : la méthode, les fréquences, la mise en place.')}</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="section bande-accent final">
          <div className="container" data-reveal="0">
            <h2>{t('Fiabilisez votre stock avec Quantinvo')}</h2>
            <p>{t('Inscription en ligne, accès ouvert tout de suite.')}</p>
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
