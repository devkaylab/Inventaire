import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { CubeFilaire } from '@/components/Parallaxe'

export const metadata: Metadata = {
  alternates: { canonical: '/inventaire' },
  title: 'L’inventaire : pourquoi compter son stock, et comment bien le faire',
  description:
    'Inventaire annuel, tournant, ciblé : ce qu’est un inventaire, ce que révèle l’écart entre stock théorique et stock réel — démarque inconnue, vol, casse, erreurs de gestion — et comment fiabiliser son stock toute l’année.',
}

/**
 * Page de fond : le sujet que tapent vraiment les gérants de magasin.
 * Premier article de la feuille de route référencement de la charte —
 * l'inventaire tournant est le différenciateur de Quantinvo.
 */
export default function InventairePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero" style={{ paddingBottom: 40 }}>
          <div className="plx hero-cube-int-a" data-plx="0.22" aria-hidden="true">
            <div className="flotte"><CubeFilaire size={110} /></div>
          </div>
          <div className="plx hero-cube-int-b" data-plx="0.5" aria-hidden="true">
            <div className="flotte-lent"><CubeFilaire size={70} /></div>
          </div>
          <div className="container">
            <div data-reveal="0"><span className="eyebrow">Comprendre</span></div>
            <h1 data-reveal="1" style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>
              L’inventaire,<br /><span className="grad">expliqué simplement.</span>
            </h1>
            <p className="lead" data-reveal="2">
              Ce qu’est un inventaire, ce que révèle l’écart entre le stock que vous croyez
              avoir et celui que vous avez vraiment — et pourquoi compter plus souvent
              change la gestion d’un magasin.
            </p>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 8 }}>
          <div className="plx deco-cube deco-droite deco-accent" data-plx="0.3" aria-hidden="true">
            <CubeFilaire size={110} />
          </div>
          <div className="plx deco-cube deco-gauche deco-cyan" data-plx="0.42" aria-hidden="true">
            <CubeFilaire size={84} />
          </div>
          <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div className="card" data-reveal="0" style={{ padding: '30px 34px' }}>
              <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.5px' }}>Qu’est-ce qu’un inventaire ?</h2>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  Un inventaire, c’est le comptage physique de la marchandise réellement présente
                  en magasin et en réserve, article par article. On le compare ensuite au
                  <strong> stock théorique</strong> — celui que votre logiciel de caisse ou de
                  gestion croit connaître, alimenté par les réceptions et les ventes.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  L’écart entre les deux est la vraie information : chaque différence a une
                  cause — un vol, une casse non déclarée, une erreur de réception, un retour
                  jamais réintégré. L’inventaire ne sert pas seulement à obtenir un chiffre
                  juste ; il sert à découvrir ce qui, dans le quotidien du magasin, fabrique
                  du faux stock.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  C’est aussi une obligation : toute entreprise doit inventorier son stock au
                  moins une fois par exercice comptable. Mais s’arrêter à cette obligation,
                  c’est passer à côté de l’essentiel — le stock est le principal actif d’un
                  magasin, et toutes les décisions du quotidien reposent sur son exactitude.
                </p>
              </div>
            </div>

            <div className="card" data-reveal="0" style={{ padding: '30px 34px' }}>
              <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.5px' }}>La démarque inconnue : ce que le stock théorique cache</h2>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  La <strong>démarque inconnue</strong>, c’est la marchandise disparue sans
                  explication : elle figure au stock théorique, mais elle n’est plus en rayon.
                  Selon les études du secteur, elle coûte de l’ordre de 1 à 2 % du chiffre
                  d’affaires du commerce de détail — souvent plus que la marge nette du magasin.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  Ses causes se répartissent en quatre familles : le <strong>vol externe</strong>
                  (à l’étalage), le <strong>vol interne</strong>, la <strong>casse et la perte</strong>
                  (produits abîmés, périmés, jetés sans être enregistrés) et les
                  <strong> erreurs administratives</strong> — réceptions mal saisies, erreurs de
                  caisse, retours fournisseurs non déduits.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  Un magasin qui ne compte qu’une fois par an découvre sa démarque douze mois
                  trop tard, en un seul bloc, sans pouvoir dire ni où ni quand elle s’est
                  produite. Compter souvent, c’est transformer une perte annuelle subie en
                  signaux précoces sur lesquels on peut agir : renforcer un rayon, revoir une
                  procédure de réception, sécuriser une réserve.
                </p>
              </div>
            </div>

            <div className="card" data-reveal="0" style={{ padding: '30px 34px' }}>
              <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.5px' }}>Ce que l’inventaire révèle d’autre</h2>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  L’écart de comptage est un révélateur d’anomalies de gestion que rien
                  d’autre ne montre :
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  <strong>Les stocks négatifs</strong> — le logiciel affiche −3 sur une
                  référence : impossible physiquement, donc une erreur de saisie ou un
                  code-barres qui encaisse un article pour un autre. <strong>Les références
                  fantômes</strong> — jamais vendues, jamais comptées, mais toujours au
                  catalogue, qui gonflent la valeur de stock. <strong>Les articles
                  déplacés</strong> — présents mais introuvables, donc réassortis pour rien.
                  <strong> Les codes-barres inconnus</strong> — des produits bien réels que le
                  référentiel ne connaît pas, signe d’une réception passée à côté du système.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  Corriger ces anomalies, c’est l’autre moitié de la valeur d’un inventaire :
                  des commandes mieux calibrées, moins de ruptures fictives, une valeur de
                  stock sincère au bilan — et une équipe qui cesse de chercher des produits
                  qui n’existent plus.
                </p>
              </div>
            </div>

            <div className="card" data-reveal="0" style={{ padding: '30px 34px' }}>
              <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.5px' }}>Annuel, tournant, ciblé : les trois façons de compter</h2>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  <strong>L’inventaire annuel</strong> est le grand comptage complet, souvent
                  calé sur la clôture de l’exercice. Nécessaire, mais lourd : il se planifie
                  des mois à l’avance, mobilise tout le monde une soirée ou une nuit, et ne
                  donne qu’une photographie par an.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  <strong>L’inventaire tournant</strong> découpe le magasin en zones et les
                  compte une à une, au fil des semaines : quelques rayons ce mardi, la réserve
                  la semaine prochaine. Le magasin ne ferme jamais, l’effort se lisse, et
                  chaque zone est vérifiée plusieurs fois par an. C’est la méthode des
                  enseignes qui tiennent leur stock au plus près.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  <strong>L’inventaire ciblé ou aléatoire</strong> concentre le comptage là où
                  ça bouge : les rayons sensibles au vol, les meilleures ventes, une famille
                  d’articles dont les chiffres étonnent — ou une zone tirée au hasard, pour
                  l’effet de contrôle surprise. C’est le complément naturel du tournant.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  Les trois se combinent : le tournant et le ciblé toute l’année pour garder
                  un stock juste, l’annuel pour la photographie complète — d’autant plus
                  rapide que le stock est déjà fiable.
                </p>
              </div>
            </div>

            <div className="card" data-reveal="0" style={{ padding: '30px 34px' }}>
              <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.5px' }}>Bien compter : la méthode</h2>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  <strong>Préparer</strong> — un référentiel articles à jour et un stock
                  théorique arrêté au moment du comptage : sans point de comparaison fiable,
                  l’écart ne veut rien dire.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  <strong>Découper</strong> — des zones claires, chacune ouverte, comptée et
                  clôturée : c’est ce qui garantit que rien n’est oublié ni compté deux fois,
                  même à plusieurs compteurs en parallèle.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  <strong>Vérifier</strong> — un double comptage sur les zones sensibles, et
                  un arbitrage des écarts pendant que tout le monde est encore sur place :
                  recompter une étagère prend dix minutes le jour même.
                </p>
                <p style={{ margin: 0, fontSize: 15.5 }}>
                  <strong>Corriger</strong> — le résultat sert à recaler le stock théorique et
                  à traiter les causes. Un inventaire dont le rapport reste dans un tiroir n’a
                  servi qu’à fatiguer l’équipe.
                </p>
              </div>
            </div>

          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="cta-band" data-reveal="0">
              <div className="plx band-glow" data-plx="0.35" aria-hidden="true" />
              <h2>Comptez quand vous voulez</h2>
              <p>
                Quantinvo est l’outil de cette méthode : zones et balises, double comptage,
                écarts arbitrés en direct et rapport prêt pour la correction du stock —
                autant de fois par an que vous le décidez.
              </p>
              <Link href="/pourquoi-nous-choisir" className="btn btn-ghost" style={{ marginRight: 12 }}>Pourquoi nous choisir ?</Link>
              <Link href="/inscription" className="btn btn-primary">Inscrire mon entreprise</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
