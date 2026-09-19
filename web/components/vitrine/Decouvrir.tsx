import Link from 'next/link'
import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { Carrousel } from '@/components/Carrousel'
import { IconAudit, IconReport, IconStore } from '@/components/icons'
import { OFFRES, euros } from '@/lib/offres'
import { traduction, type Langue } from '@/lib/traduction'

/**
 * « Qu'est-ce que Quantinvo ? » — la page qui DÉFINIT le produit (demande de
 * Julien, 19 septembre 2026) : « pas un langage trop technique, un ton
 * professionnel, pas de paragraphes ni de blocs de texte ; des diaporamas ou
 * des tuiles ».
 *
 * ⚠️ LA HIÉRARCHIE EST CELLE DE QONTO, relevée dans son Chrome sur la page
 * « compte pro des commerçants » le même jour, section par section :
 *
 *   héros à gauche, deux boutons ........ héros
 *   « Plus qu'un compte pro. » (mosaïque) « Plus qu'une douchette. »
 *   « Adapté à votre métier » ........... « Adapté à chaque rôle »
 *   bande noire, cartes qui défilent .... « Du fichier au rapport »
 *   « Votre caisse et votre terminal » .. « Votre logiciel et Quantinvo »
 *   « Grandissez sans perdre le contrôle » « Un magasin, puis tout le réseau »
 *   « Pour aller plus loin » ............ les trois autres pages
 *   foire aux questions, titre à gauche . « Quantinvo en questions »
 *
 * ⚠️ DEUX SECTIONS DE QONTO N'ONT PAS D'ÉQUIVALENT, ET C'EST VOULU : les logos
 * de clients et le témoignage. Nous n'avons encore aucun client, et une fausse
 * référence se paie cher (même règle que les preuves de l'accueil).
 *
 * ⚠️ UNE PHRASE PAR TUILE. Le détail vit sur « Pourquoi nous choisir » et
 * « L'inventaire » ; cette page dit ce qu'est le produit, en un coup d'œil.
 *
 * ⚠️ AUCUNE CAPTURE NE SERT DEUX FOIS SUR LA PAGE — même règle que l'accueil.
 */

const MOSAIQUE_COMPTAGE = {
  src: '/vitrine/comptage-encadre.png',
  alt: 'L’écran de comptage de l’application, dans un rayon',
}
const MOSAIQUE_BALISE = {
  src: '/vitrine/scanner-balise-encadre.png',
  alt: 'L’écran qui ouvre une zone : on vise l’étiquette du rayon',
}

const ROLES = [
  {
    titre: 'Le compteur',
    texte: 'Il rejoint l’inventaire avec un code, et compte sa zone.',
    image: {
      src: '/vitrine/bienvenue-compteur-encadre.png',
      alt: 'La première ouverture de l’application par un compteur : les trois gestes à faire',
    },
  },
  {
    titre: 'Le superviseur',
    texte: 'Il prépare l’inventaire, le suit en direct et tranche les écarts.',
    image: {
      src: '/vitrine/inventaire-superviseur-encadre.png',
      alt: 'La fiche d’un inventaire dans l’application : progression, balises restantes et actions',
    },
  },
  {
    titre: 'L’administrateur',
    texte: 'Il ouvre les magasins, invite les équipes et gère l’abonnement.',
    paysage: true,
    image: {
      src: '/vitrine/suivi.png',
      alt: 'Le suivi d’un inventaire sur le site : progression, avancement par zone et derniers scans',
    },
  },
]

const ETAPES = [
  {
    titre: 'Importez votre stock',
    texte: 'Le fichier de votre logiciel, tel quel, en CSV ou en Excel.',
    image: { src: '/vitrine/importer-encadre.png', alt: 'L’écran d’import : les deux fichiers attendus et les noms de colonnes reconnus' },
  },
  {
    titre: 'Imprimez les balises',
    texte: 'Une planche d’étiquettes QR, qui sert à tous vos inventaires.',
    image: { src: '/vitrine/creer-balises-encadre.png', alt: 'La création d’une série de balises : numérotation, premier numéro, nombre' },
  },
  {
    titre: 'Rangez-les par zone',
    texte: 'La surface de vente, la réserve : chaque balise a sa place.',
    image: { src: '/vitrine/zones-encadre.png', alt: 'L’écran Zones et balises : une plage de balises affectée à un emplacement' },
  },
  {
    titre: 'Arbitrez les écarts',
    texte: 'Comptage et audit se comparent, vous retenez le bon chiffre.',
    image: { src: '/vitrine/audit-encadre.png', alt: 'Les écarts d’audit : le compte du compteur, celui de l’auditeur, et la quantité retenue' },
  },
  {
    titre: 'Sortez le rapport',
    texte: 'Stock attendu, stock compté, et l’écart en valeur.',
    image: { src: '/vitrine/rapport-encadre.png', alt: 'Le rapport d’inventaire : stock théorique, stock compté, écart en unités et en valeur' },
  },
]

/**
 * ⚠️ UN RAPPORT DESSINÉ, PAS UNE CAPTURE, et il le montre : quatre lignes aux
 * références génériques, dans la typographie du Registre. Une capture du vrai
 * rapport est dans les cartes qui défilent plus bas ; ici, la tuile n'a la place
 * que de quelques lignes, et c'est l'écart qu'on veut faire voir.
 */
const LIGNES_RAPPORT = [
  { ref: 'Article A', attendu: 24, compte: 24 },
  { ref: 'Article B', attendu: 12, compte: 9 },
  { ref: 'Article C', attendu: 40, compte: 41 },
  { ref: 'Article D', attendu: 6, compte: 6 },
]

/** Les magasins du dessin « Un magasin, puis tout le réseau » : génériques. */
const MAGASINS = [
  { nom: 'Magasin du centre', etat: 'Comptage en cours', avance: 68 },
  { nom: 'Magasin de la zone commerciale', etat: 'Clôturé', avance: 100 },
  { nom: 'Entrepôt', etat: 'À planifier', avance: 0 },
]

const RESEAU = [
  ['Une licence par magasin', ', choisie selon la taille de son équipe'],
  ['Un administrateur', ' qui voit tous les magasins de l’entreprise'],
  ['Des rôles séparés', ' : superviseur et compteur'],
  ['Un rapport par inventaire', ', et un rapport consolidé par magasin'],
] as const

export function Decouvrir({ langue }: { langue: Langue }) {
  const { t, lien } = traduction(langue)

  const QUESTIONS = [
    {
      q: 'Qu’est-ce que Quantinvo ?',
      r: 'Un outil d’inventaire pour le commerce : une application pour compter, un site pour préparer, suivre et exporter.',
    },
    {
      q: 'À qui s’adresse Quantinvo ?',
      r: 'Aux magasins et aux réseaux de magasins qui comptent leur stock, de la boutique à l’entrepôt.',
    },
    {
      q: 'Faut-il acheter du matériel ?',
      r: 'Un téléphone ou une tablette, iPhone ou Android, par personne qui compte.',
    },
    {
      q: 'Quantinvo existe-t-il en anglais ?',
      r: 'Oui : l’application et le site parlent français et anglais.',
    },
    {
      q: 'Où sont nos données ?',
      r: 'Dans l’Union européenne, sans traceur publicitaire. Chacun peut télécharger ses données ou supprimer son compte.',
    },
    {
      q: 'Combien coûte Quantinvo ?',
      r: t('Une licence par magasin, à partir de %{prix} par mois. Les comptes et les inventaires sont illimités.', {
        prix: euros(Math.min(...OFFRES.map((o) => o.mois))),
      }),
      traduite: true,
    },
  ]

  return (
    <>
      <SiteHeader langue={langue} />
      <main>
        {/* ── Le héros : à gauche, deux boutons, et la photo du geste ── */}
        <section className="hero dq-heros">
          <div className="container dq-heros-grille">
            <div className="dq-heros-texte">
              <h1 data-reveal="1">{t('L’inventaire de votre magasin, au bout du téléphone.')}</h1>
              <p className="lead" data-reveal="2">
                {t('Quantinvo fait compter votre stock en équipe, montre l’avancement en direct et rend un chiffre fiable.')}
              </p>
              <div className="cta" data-reveal="3">
                <InscriptionLink className="btn btn-primary">Fiabiliser mon stock</InscriptionLink>
                <Link href={lien('/tarifs')} className="btn btn-ghost">{t('Voir nos offres')}</Link>
              </div>
            </div>
            <figure className="dq-heros-photo" data-reveal="2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/vitrine/photos/etiquette-1264.webp"
                srcSet="/vitrine/photos/etiquette-640.webp 640w, /vitrine/photos/etiquette-1264.webp 1264w"
                sizes="(min-width: 900px) 520px, calc(100vw - 48px)"
                width={1264}
                height={632}
                alt={t('Une étiquette QR imprimée, collée sur la glissière d’un rayon, et un téléphone qui la vise')}
              />
            </figure>
          </div>
        </section>

        {/* ── Ce que c'est : une mosaïque, une idée par tuile ── */}
        <section className="section dq-section-haut">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Plus qu’une douchette.')}</h2>
            </div>
            <div className="dq-mosaique">
              <div className="dq-tuile dq-tuile-image dq-t-a" data-reveal="1">
                <h3>{t('Le téléphone devient la douchette')}</h3>
                <p>{t('Caméra, douchette Bluetooth ou clavier : chacun compte avec ce qu’il a.')}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MOSAIQUE_COMPTAGE.src} alt={t(MOSAIQUE_COMPTAGE.alt)} loading="lazy" />
              </div>
              <div className="dq-tuile dq-t-b" data-reveal="2">
                <h3>{t('Les écarts, en quantité et en valeur')}</h3>
                <p>{t('Le stock compté se compare au stock attendu, article par article.')}</p>
              </div>
              <div className="dq-tuile dq-tuile-image dq-t-c" data-reveal="3">
                <h3>{t('Chaque rayon s’ouvre d’un scan')}</h3>
                <p>{t('Une étiquette par emplacement : on la scanne, on compte, on clôture.')}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MOSAIQUE_BALISE.src} alt={t(MOSAIQUE_BALISE.alt)} loading="lazy" />
              </div>
              <div className="dq-tuile dq-tuile-filet dq-t-d" data-reveal="2">
                <h3>{t('Même sans réseau')}</h3>
                <p>{t('En réserve, les scans attendent sur le téléphone et partent au retour du réseau.')}</p>
              </div>
              <div className="dq-tuile dq-t-e" data-reveal="1">
                <div className="dq-t-e-dire">
                  <h3>{t('Un rapport qui fait foi')}</h3>
                  <p>{t('L’export Excel des écarts, prêt pour votre logiciel de gestion.')}</p>
                </div>
                <table className="dq-rapport" aria-label={t('Extrait de rapport d’inventaire')}>
                  <thead>
                    <tr>
                      <th scope="col">{t('Article')}</th>
                      <th scope="col">{t('Attendu')}</th>
                      <th scope="col">{t('Compté')}</th>
                      <th scope="col">{t('Écart')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LIGNES_RAPPORT.map((l) => {
                      const ecart = l.compte - l.attendu
                      return (
                        <tr key={l.ref}>
                          <td>{t(l.ref)}</td>
                          <td className="num">{l.attendu}</td>
                          <td className="num">{l.compte}</td>
                          <td className={'num' + (ecart < 0 ? ' dq-moins' : ecart > 0 ? ' dq-plus' : '')}>
                            {ecart > 0 ? `+${ecart}` : ecart}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pour qui : trois rôles, trois tuiles ── */}
        <section className="section bande-surface">
          <div className="container">
            <div className="dq-tete dq-tete-action" data-reveal="0">
              <h2>{t('Adapté à chaque rôle')}</h2>
              <InscriptionLink className="btn btn-primary">Fiabiliser mon stock</InscriptionLink>
            </div>
            <div className="dq-roles">
              {ROLES.map((r, i) => (
                <div className={'dq-role' + (r.paysage ? ' dq-role-paysage' : '')} data-reveal={i + 1} key={r.titre}>
                  <h3>{t(r.titre)}</h3>
                  <p>{t(r.texte)}</p>
                  <div className="dq-role-vue">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.image.src} alt={t(r.image.alt)} loading="lazy" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Le parcours, sur l'encre : des cartes qui défilent ── */}
        <section className="section bande-encre dq-encre">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Tout l’inventaire, du fichier au rapport')}</h2>
            </div>
            <Carrousel
              precedent={t('Précédent')}
              suivant={t('Suivant')}
              aller={t('Aller à la carte %{n}')}
              cartes={ETAPES.map((e) => ({
                titre: t(e.titre),
                texte: t(e.texte),
                image: { src: e.image.src, alt: t(e.image.alt) },
              }))}
            />
          </div>
        </section>

        {/* ── Ce que Quantinvo laisse à votre logiciel ── */}
        <section className="section">
          <div className="container dq-duo">
            <div className="dq-flux" data-reveal="1" aria-hidden="true">
              <div className="dq-flux-case">
                <span>{t('Votre logiciel de gestion')}</span>
                <small>{t('Fichier CSV ou Excel')}</small>
              </div>
              <div className="dq-flux-trait" />
              <div className="dq-flux-case dq-flux-centre">
                <span>Quantinvo</span>
                <small>{t('Comptage, audit, écarts')}</small>
              </div>
              <div className="dq-flux-trait" />
              <div className="dq-flux-case">
                <span>{t('Votre logiciel de gestion')}</span>
                <small>{t('Export Excel, stock corrigé')}</small>
              </div>
            </div>
            <div className="dq-duo-dire" data-reveal="2">
              <h2>{t('Votre logiciel et Quantinvo, côte à côte')}</h2>
              <p>{t('Quantinvo lit le fichier de votre logiciel, et lui rend un export prêt à corriger le stock.')}</p>
              <div className="cta">
                <Link href={lien('/inventaire')} className="btn btn-ghost">{t('L’inventaire, expliqué')}</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Le réseau : des points courts, et un dessin ── */}
        <section className="section bande-surface">
          <div className="container dq-duo dq-duo-inverse">
            <div className="dq-duo-dire" data-reveal="1">
              <h2>{t('Un magasin, puis tout le réseau')}</h2>
              <ul className="dq-points">
                {RESEAU.map(([fort, suite]) => (
                  <li key={fort}><strong>{t(fort)}</strong>{t(suite)}</li>
                ))}
              </ul>
              <div className="cta">
                <Link href={lien('/tarifs')} className="btn btn-ghost">{t('Voir nos offres')}</Link>
              </div>
            </div>
            <div className="dq-magasins" data-reveal="2" aria-hidden="true">
              {MAGASINS.map((m) => (
                <div className="dq-magasin" key={m.nom}>
                  <div className="dq-magasin-ligne">
                    <span>{t(m.nom)}</span>
                    <small>{t(m.etat)}</small>
                  </div>
                  <div className="dq-jauge"><i style={{ width: `${m.avance}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pour aller plus loin ── */}
        <section className="section">
          <div className="container">
            <div className="dq-tete" data-reveal="0">
              <h2>{t('Pour aller plus loin')}</h2>
            </div>
            <div className="dq-liens">
              <Link href={lien('/pourquoi-nous-choisir')} className="dq-lien" data-reveal="1">
                <div className="ico"><IconAudit /></div>
                <h3>{t('Six raisons de nous choisir')}</h3>
                <p>{t('Chacune montre l’écran dont elle parle.')}</p>
              </Link>
              <Link href={lien('/inventaire')} className="dq-lien" data-reveal="2">
                <div className="ico"><IconReport /></div>
                <h3>{t('L’inventaire, expliqué simplement')}</h3>
                <p>{t('Annuel, tournant, ciblé : ce que révèle un écart de stock.')}</p>
              </Link>
              <Link href={lien('/tarifs')} className="dq-lien" data-reveal="3">
                <div className="ico"><IconStore /></div>
                <h3>{t('Un prix par magasin')}</h3>
                <p>{t('Trois offres, affichées, sans devis.')}</p>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Les questions : titre à gauche, réponses à droite ── */}
        <section className="section bande-surface">
          <div className="container dq-faq">
            <h2 data-reveal="0">{t('Quantinvo en questions')}</h2>
            <div className="dq-faq-liste" data-reveal="1">
              {QUESTIONS.map((item) => (
                <details className="collapsible" key={item.q}>
                  <summary>{t(item.q)}</summary>
                  <p className="collapsible-body">{item.traduite ? item.r : t(item.r)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* L'accent ne sert qu'une fois, à la fin. */}
        <section className="section bande-accent final">
          <div className="container" data-reveal="0">
            <h2>{t('Voyez Quantinvo sur votre propre stock')}</h2>
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
