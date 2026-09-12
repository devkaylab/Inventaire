import Link from 'next/link'
import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { traduction, type Langue } from '@/lib/traduction'

/* ⚠️ Une largeur de LECTURE, sur les blocs illustrés comme sur les autres :
   sans plafond, la ligne d'un bloc pleine largeur montait à 130 caractères —
   le double de ce qui se lit sans perdre le début de la ligne suivante. */
const P = { margin: 0, fontSize: 15.5, maxWidth: '62ch' } as const
const H2 = { fontSize: 23, fontWeight: 800, letterSpacing: '-0.5px' } as const
const CARTE = { padding: '30px 34px' } as const
const CORPS = { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 } as const

/**
 * Page de fond : le sujet que tapent vraiment les gérants de magasin.
 * Premier article de la feuille de route référencement de la charte —
 * l'inventaire tournant est le différenciateur de Quantinvo.
 *
 * Les paragraphes qui portent un mot en gras sont découpés en segments : le
 * français de chaque segment reste la clé, le gras reste du balisage.
 */
export function Inventaire({ langue }: { langue: Langue }) {
  const { t, lien } = traduction(langue)
  return (
    <>
      <SiteHeader langue={langue} />
      <main>
        <section className="hero" style={{ paddingBottom: 40 }}>
          <div className="container">
            <h1 data-reveal="1" style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>
              {t('L’inventaire,')}<br />{t('expliqué simplement.')}
            </h1>
            <p className="lead" data-reveal="2">
              {t('Ce qu’est un inventaire, ce que révèle l’écart entre le stock que vous croyez avoir et celui que vous avez vraiment — et pourquoi compter plus souvent change la gestion d’un magasin.')}
            </p>
          </div>
        </section>

        {/*
          ⚠️ UNE CAPTURE N'APPARAÎT QUE LÀ OÙ UN ÉCRAN MONTRE VRAIMENT CE QUE LE
          PARAGRAPHE DÉCRIT. Les deux blocs qui expliquent un PHÉNOMÈNE — la
          démarque inconnue, les anomalies de gestion — n'en portent pas :
          aucun écran ne montre un vol, une casse ou une erreur de réception,
          et une capture posée là illustrerait le produit, pas le sujet. Cette
          page est un article de fond, pas une brochure ; c'est ce qui la fait
          trouver sur « inventaire magasin », et la remplir de captures
          décoratives lui ferait perdre les deux.

          ⚠️ D'où l'ABSENCE d'alternance ici, contrairement à « Pourquoi nous
          choisir » : avec deux blocs sans capture au milieu, une rangée sur
          deux sauterait de côté sans raison lisible. La capture reste à
          gauche, comme une marge de figures.
        */}
        <section className="section" style={{ paddingTop: 8 }}>
          <div className="container blocs-illustres">

            <div className="card bloc-illustre" data-reveal="0" style={CARTE}>
              <figure className="bloc-vue">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/vitrine/scanner-balise-encadre.png" alt={t('L’écran de comptage de l’application : ouvrir une zone, puis scanner les articles')} />
              </figure>
              <div className="bloc-dire">
                <h2 style={H2}>{t('Qu’est-ce qu’un inventaire ?')}</h2>
                <div style={CORPS}>
                  <p style={P}>
                    {t('Un inventaire, c’est le comptage physique de la marchandise réellement présente en magasin et en réserve, article par article. On le compare ensuite au')}
                    <strong> {t('stock théorique')}</strong>{t(' — celui que votre logiciel de caisse ou de gestion croit connaître, alimenté par les réceptions et les ventes.')}
                  </p>
                  <p style={P}>
                    {t('L’écart entre les deux est la vraie information : chaque différence a une cause — un vol, une casse non déclarée, une erreur de réception, un retour jamais réintégré. L’inventaire ne sert pas seulement à obtenir un chiffre juste ; il sert à découvrir ce qui, dans le quotidien du magasin, fabrique du faux stock.')}
                  </p>
                  <p style={P}>
                    {t('C’est aussi une obligation : toute entreprise doit inventorier son stock au moins une fois par exercice comptable. Mais s’arrêter à cette obligation, c’est passer à côté de l’essentiel — le stock est le principal actif d’un magasin, et toutes les décisions du quotidien reposent sur son exactitude.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="card" data-reveal="0" style={CARTE}>
              <h2 style={H2}>{t('La démarque inconnue : ce que le stock théorique cache')}</h2>
              <div style={CORPS}>
                <p style={P}>
                  {t('La')} <strong>{t('démarque inconnue')}</strong>{t(', c’est la marchandise disparue sans explication : elle figure au stock théorique, mais elle n’est plus en rayon. Selon les études du secteur, elle coûte de l’ordre de 1 à 2 % du chiffre d’affaires du commerce de détail — souvent plus que la marge nette du magasin.')}
                </p>
                <p style={P}>
                  {t('Ses causes se répartissent en quatre familles : le')} <strong>{t('vol externe')}</strong>{t(' (à l’étalage), le')} <strong>{t('vol interne')}</strong>{t(', la')} <strong>{t('casse et la perte')}</strong>{t(' (produits abîmés, périmés, jetés sans être enregistrés) et les')}
                  <strong> {t('erreurs administratives')}</strong>{t(' — réceptions mal saisies, erreurs de caisse, retours fournisseurs non déduits.')}
                </p>
                <p style={P}>
                  {t('Un magasin qui ne compte qu’une fois par an découvre sa démarque douze mois trop tard, en un seul bloc, sans pouvoir dire ni où ni quand elle s’est produite. Compter souvent, c’est transformer une perte annuelle subie en signaux précoces sur lesquels on peut agir : renforcer un rayon, revoir une procédure de réception, sécuriser une réserve.')}
                </p>
              </div>
            </div>

            <div className="card" data-reveal="0" style={CARTE}>
              <h2 style={H2}>{t('Ce que l’inventaire révèle d’autre')}</h2>
              <div style={CORPS}>
                <p style={P}>
                  {t('L’écart de comptage est un révélateur d’anomalies de gestion que rien d’autre ne montre :')}
                </p>
                <p style={P}>
                  <strong>{t('Les stocks négatifs')}</strong>{t(' — le logiciel affiche −3 sur une référence : impossible physiquement, donc une erreur de saisie ou un code-barres qui encaisse un article pour un autre.')} <strong>{t('Les références fantômes')}</strong>{t(' — jamais vendues, jamais comptées, mais toujours au catalogue, qui gonflent la valeur de stock.')} <strong>{t('Les articles déplacés')}</strong>{t(' — présents mais introuvables, donc réassortis pour rien.')}
                  <strong> {t('Les codes-barres inconnus')}</strong>{t(' — des produits bien réels que le référentiel ne connaît pas, signe d’une réception passée à côté du système.')}
                </p>
                <p style={P}>
                  {t('Corriger ces anomalies, c’est l’autre moitié de la valeur d’un inventaire : des commandes mieux calibrées, moins de ruptures fictives, une valeur de stock sincère au bilan — et une équipe qui cesse de chercher des produits qui n’existent plus.')}
                </p>
              </div>
            </div>

            <div className="card bloc-illustre" data-reveal="0" style={CARTE}>
              <figure className="bloc-vue">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/vitrine/zones-encadre.png" alt={t('L’écran des zones : le magasin découpé en emplacements, chacun avec son avancement')} />
              </figure>
              <div className="bloc-dire">
                <h2 style={H2}>{t('Annuel, tournant, ciblé : les trois façons de compter')}</h2>
                <div style={CORPS}>
                  <p style={P}>
                    <strong>{t('L’inventaire annuel')}</strong>{t(' est le grand comptage complet, souvent calé sur la clôture de l’exercice. Nécessaire, mais lourd : il se planifie des mois à l’avance, mobilise tout le monde une soirée ou une nuit, et ne donne qu’une photographie par an.')}
                  </p>
                  <p style={P}>
                    <strong>{t('L’inventaire tournant')}</strong>{t(' découpe le magasin en zones et les compte une à une, au fil des semaines : quelques rayons ce mardi, la réserve la semaine prochaine. Le magasin ne ferme jamais, l’effort se lisse, et chaque zone est vérifiée plusieurs fois par an. C’est la méthode des enseignes qui tiennent leur stock au plus près.')}
                  </p>
                  <p style={P}>
                    <strong>{t('L’inventaire ciblé ou aléatoire')}</strong>{t(' concentre le comptage là où ça bouge : les rayons sensibles au vol, les meilleures ventes, une famille d’articles dont les chiffres étonnent — ou une zone tirée au hasard, pour l’effet de contrôle surprise. C’est le complément naturel du tournant.')}
                  </p>
                  <p style={P}>
                    {t('Les trois se combinent : le tournant et le ciblé toute l’année pour garder un stock juste, l’annuel pour la photographie complète — d’autant plus rapide que le stock est déjà fiable.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="card bloc-illustre" data-reveal="0" style={CARTE}>
              <figure className="bloc-vue">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/vitrine/creer-balises-encadre.png" alt={t('La création des étiquettes : numérotation, premier numéro et nombre de balises')} />
              </figure>
              <div className="bloc-dire">
                <h2 style={H2}>{t('Bien compter : la méthode')}</h2>
                <div style={CORPS}>
                  <p style={P}>
                    <strong>{t('Préparer')}</strong>{t(' — un référentiel articles à jour et un stock théorique arrêté au moment du comptage : sans point de comparaison fiable, l’écart ne veut rien dire.')}
                  </p>
                  <p style={P}>
                    <strong>{t('Découper')}</strong>{t(' — des zones claires, chacune ouverte, comptée et clôturée : c’est ce qui garantit que rien n’est oublié ni compté deux fois, même à plusieurs compteurs en parallèle.')}
                  </p>
                  <p style={P}>
                    <strong>{t('Vérifier')}</strong>{t(' — un double comptage sur les zones sensibles, et un arbitrage des écarts pendant que tout le monde est encore sur place : recompter une étagère prend dix minutes le jour même.')}
                  </p>
                  <p style={P}>
                    <strong>{t('Corriger')}</strong>{t(' — le résultat sert à recaler le stock théorique et à traiter les causes. Un inventaire dont le rapport reste dans un tiroir n’a servi qu’à fatiguer l’équipe.')}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="cta-band" data-reveal="0">
              <div className="plx band-glow" data-plx="0.35" aria-hidden="true" />
              <h2>{t('Comptez quand vous voulez')}</h2>
              <p>
                {t('Quantinvo est l’outil de cette méthode : zones et balises, double comptage, écarts arbitrés en direct et rapport prêt pour la correction du stock — autant de fois par an que vous le décidez.')}
              </p>
              <Link href={lien('/pourquoi-nous-choisir')} className="btn btn-ghost" style={{ marginRight: 12 }}>{t('Pourquoi nous choisir ?')}</Link>
              <InscriptionLink className="btn btn-primary">Inscrire mon entreprise</InscriptionLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter langue={langue} />
    </>
  )
}
