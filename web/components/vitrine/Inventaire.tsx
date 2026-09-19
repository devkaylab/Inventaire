import Link from 'next/link'
import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { RythmesAnnee } from '@/components/RythmesAnnee'
import { traduction, type Langue } from '@/lib/traduction'

/**
 * « L'inventaire, expliqué simplement », refondue le 19 septembre 2026
 * (demande de Julien : « refais la page en t'inspirant de Découvrir, pas en
 * faisant un copier-coller »). Cinq blocs de trois ou quatre paragraphes
 * deviennent des figures qu'on lit d'un coup d'œil.
 *
 * ⚠️ CHAQUE SECTION A LA FORME DE SON IDÉE, et c'est ce qui la distingue de
 * Découvrir :
 *   · qu'est-ce qu'un inventaire → une SOUSTRACTION (compté − théorique = écart) ;
 *   · la démarque inconnue → UN CHIFFRE, puis ses quatre causes ;
 *   · ce que l'écart révèle → quatre anomalies, chacune avec sa marque ;
 *   · annuel, tournant, ciblé → l'ANNÉE DESSINÉE, semaine par semaine ;
 *   · la méthode → QUATRE TEMPS, numérotés parce que c'est une vraie suite.
 *
 * ⚠️ PAGE DE RÉFÉRENCEMENT (« inventaire magasin ») : les termes que l'on
 * cherche — stock théorique, démarque inconnue, inventaire tournant — restent
 * dans les titres et les tuiles, même si le texte a fondu.
 */

/**
 * ⚠️ AU-DELÀ DE L'OBLIGATION : trois raisons qu'un gérant reconnaît. L'article
 * d'avant les disait en un paragraphe (« le stock est le principal actif d'un
 * magasin, et toutes les décisions du quotidien reposent sur son exactitude »).
 */
const RAISONS_INVENTAIRE = [
  { titre: 'Une valeur de stock sincère', texte: 'Le stock est souvent le premier actif du magasin : au bilan, sa valeur doit être juste.' },
  { titre: 'Des décisions sur des chiffres justes', texte: 'Commandes, réassort, promotions : tout repose sur le stock affiché.' },
  { titre: 'Des pertes mises au jour', texte: 'Chaque écart a une cause : vol, casse, erreur de réception.' },
]

const CAUSES = [
  { titre: 'Vol externe', texte: 'À l’étalage, dans les rayons.' },
  { titre: 'Vol interne', texte: 'Dans le magasin lui-même.' },
  { titre: 'Casse et perte', texte: 'Produits abîmés, périmés, jetés sans être enregistrés.' },
  { titre: 'Erreurs administratives', texte: 'Réceptions mal saisies, erreurs de caisse, retours non déduits.' },
]

const ANOMALIES = [
  { marque: '−3', titre: 'Les stocks négatifs', texte: 'Physiquement impossible : une erreur de saisie ou de code-barres.' },
  { marque: '0 vente', titre: 'Les références fantômes', texte: 'Toujours au catalogue, elles gonflent la valeur du stock.' },
  { marque: 'Rayon ?', titre: 'Les articles déplacés', texte: 'Présents mais introuvables, donc réassortis pour rien.' },
  { marque: 'EAN ?', titre: 'Les codes-barres inconnus', texte: 'Des produits bien réels que votre référentiel ignore.' },
]

const TOUTES = Array.from({ length: 52 }, (_, i) => i)
const RYTHMES = [
  {
    titre: 'Annuel',
    texte: 'Le grand comptage complet, souvent à la clôture de l’exercice.',
    semaines: [50],
    legende: '1 semaine sur 52',
  },
  {
    titre: 'Tournant',
    texte: 'Une zone chaque semaine : le magasin ne ferme jamais, chaque rayon est vérifié plusieurs fois par an.',
    semaines: TOUTES,
    legende: '52 semaines sur 52',
  },
  {
    titre: 'Ciblé',
    texte: 'Les rayons sensibles, les meilleures ventes, ou une zone tirée au hasard.',
    semaines: [3, 9, 15, 22, 30, 37, 44],
    legende: '7 semaines sur 52',
  },
]

const METHODE = [
  { titre: 'Préparer', texte: 'Un référentiel à jour, et un stock théorique arrêté au moment du comptage.' },
  { titre: 'Découper', texte: 'Des zones claires, chacune ouverte, comptée, puis clôturée.' },
  { titre: 'Vérifier', texte: 'Un double comptage sur les zones sensibles, et les écarts tranchés sur place.' },
  { titre: 'Corriger', texte: 'Recaler le stock théorique, et traiter les causes.' },
]

export function Inventaire({ langue }: { langue: Langue }) {
  const { t, lien } = traduction(langue)
  return (
    <>
      <SiteHeader langue={langue} />
      <main>
        <section className="hero dq-heros">
          <div className="container dq-heros-grille">
            <div className="dq-heros-texte">
              <h1 data-reveal="1">{t('L’inventaire')}</h1>
            </div>
            <figure className="dq-heros-photo" data-reveal="2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/vitrine/photos/reserve-760.webp"
                srcSet="/vitrine/photos/reserve-380.webp 380w, /vitrine/photos/reserve-760.webp 760w"
                sizes="(min-width: 900px) 520px, calc(100vw - 48px)"
                width={760}
                height={510}
                alt={t('Deux personnes relèvent le stock d’une réserve, l’une au téléphone, l’autre sur papier')}
              />
            </figure>
          </div>
        </section>

        {/*
          ── Pourquoi faire un inventaire : on commence par l'obligation ──
          ⚠️ LA PAGE S'OUVRE SUR L'OBLIGATION (Julien, sur la maquette du
          19 septembre 2026 : « commence par cette phrase, c'est un point
          important, et développe pourquoi faire un inventaire »). Un gérant
          qui arrive ici se demande d'abord s'il DOIT le faire ; la définition
          vient après.
        */}
        <section className="section dq-section-haut">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Pourquoi faire un inventaire ?')}</h2>
            </div>
            <div className="iv-pourquoi">
              <div className="iv-obligation" data-reveal="1">
                <span className="iv-obligation-chiffre">{t('1 fois')}<small>{t('tous les 12 mois, au moins')}</small></span>
                <h3>{t('C’est une obligation')}</h3>
                <p>{t('Tout commerçant doit contrôler son stock par inventaire au moins une fois tous les douze mois.')}</p>
                <small className="iv-source">{t('Code de commerce, article L123-12')}</small>
              </div>
              <div className="iv-raisons">
                {RAISONS_INVENTAIRE.map((r, i) => (
                  <div className="iv-raison" data-reveal={i + 2} key={r.titre}>
                    <h3>{t(r.titre)}</h3>
                    <p>{t(r.texte)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Une soustraction, et c'est la définition ── */}
        <section className="section bande-surface">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Qu’est-ce qu’un inventaire ?')}</h2>
              <p className="iv-note">{t('Le comptage de ce qui est vraiment en rayon et en réserve, comparé au stock attendu.')}</p>
            </div>
            <div className="iv-calcul" data-reveal="1">
              {/* ⚠️ COMPTÉ MOINS THÉORIQUE, dans cet ordre : c'est le signe
                  du rapport (39 attendus, 9 comptés → −30). À l'envers, la
                  page annonçait +30 là où le produit affiche −30 ; relevé par
                  la relecture des decks le 19 septembre 2026. */}
              <div className="iv-terme">
                <strong>{t('Stock compté')}</strong>
                <span>{t('Ce qui est vraiment là')}</span>
              </div>
              <b className="iv-signe" aria-hidden="true">−</b>
              <div className="iv-terme">
                <strong>{t('Stock théorique')}</strong>
                <span>{t('Ce que votre logiciel croit avoir')}</span>
              </div>
              <b className="iv-signe" aria-hidden="true">=</b>
              <div className="iv-terme iv-terme-resultat">
                <strong>{t('L’écart')}</strong>
                <span>{t('La vraie information : chaque différence a une cause')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Un chiffre, puis ses causes ── */}
        <section className="section">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('La démarque inconnue')}</h2>
              <p className="iv-note">{t('La marchandise qui figure au stock théorique, mais n’est plus en rayon.')}</p>
            </div>
            <div className="iv-demarque">
              <div className="iv-chiffre" data-reveal="1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/vitrine/photos/reserve-sombre-760.webp"
                  srcSet="/vitrine/photos/reserve-sombre-380.webp 380w, /vitrine/photos/reserve-sombre-760.webp 760w"
                  sizes="(min-width: 900px) 420px, calc(100vw - 48px)"
                  width={760}
                  height={510}
                  alt={t('Deux personnes comptent au téléphone dans une réserve mal éclairée')}
                />
                <div className="iv-chiffre-dire">
                  <strong>{t('1 à 2 %')}</strong>
                  <span>{t('du chiffre d’affaires du commerce de détail, selon les études du secteur. Souvent plus que la marge nette.')}</span>
                </div>
              </div>
              <div className="iv-causes">
                {CAUSES.map((c, i) => (
                  <div className="iv-cause" data-reveal={i + 1} key={c.titre}>
                    <h3>{t(c.titre)}</h3>
                    <p>{t(c.texte)}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="iv-rappel" data-reveal="2">
              {t('Compter une fois par an, c’est la découvrir douze mois trop tard. Compter souvent, c’est agir dès les premiers signaux.')}
            </p>
          </div>
        </section>

        {/* ── Les anomalies, sur l'encre ── */}
        <section className="section bande-encre">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Ce que l’écart révèle d’autre')}</h2>
            </div>
            <div className="iv-anomalies">
              {ANOMALIES.map((a, i) => (
                <div className="iv-anomalie" data-reveal={i + 1} key={a.titre}>
                  <span className="iv-marque">{t(a.marque)}</span>
                  <h3>{t(a.titre)}</h3>
                  <p>{t(a.texte)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── L'année dessinée ── */}
        <section className="section">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Annuel, tournant, ciblé : trois façons de compter')}</h2>
              <p className="iv-note">{t('Les trois se combinent : le tournant et le ciblé toute l’année, l’annuel pour la photographie complète.')}</p>
            </div>
            <div data-reveal="1">
              <RythmesAnnee
                libelle={t('Trois façons de compter')}
                mois={[t('Janvier'), t('Avril'), t('Juillet'), t('Octobre'), t('Décembre')]}
                rythmes={RYTHMES.map((r) => ({
                  titre: t(r.titre),
                  texte: t(r.texte),
                  semaines: r.semaines,
                  legende: t(r.legende),
                }))}
              />
            </div>
          </div>
        </section>

        {/* ── La méthode : une vraie suite, donc numérotée ── */}
        <section className="section bande-surface">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Bien compter, en quatre temps')}</h2>
            </div>
            <ol className="iv-methode">
              {METHODE.map((m, i) => (
                <li data-reveal={i + 1} key={m.titre}>
                  <span className="iv-temps" aria-hidden="true">{i + 1}</span>
                  <h3>{t(m.titre)}</h3>
                  <p>{t(m.texte)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section bande-accent final">
          <div className="container" data-reveal="0">
            <h2>{t('Fiabilisez votre stock avec Quantinvo')}</h2>
            <p>{t('Zones et balises, double comptage, écarts tranchés en direct : l’outil de cette méthode.')}</p>
            <div className="cta">
              <InscriptionLink className="btn btn-clair">Fiabiliser mon stock</InscriptionLink>
              <Link href={lien('/pourquoi-nous-choisir')} className="btn btn-encre">{t('Pourquoi nous choisir ?')}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter langue={langue} />
    </>
  )
}
