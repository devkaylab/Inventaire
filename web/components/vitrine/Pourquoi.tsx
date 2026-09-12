import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { IconScan, IconZones, IconStore, IconAudit, IconReport, IconTeam } from '@/components/icons'
import { traduction, type Langue } from '@/lib/traduction'

/**
 * ⚠️ CHAQUE RAISON MONTRE L'ÉCRAN DONT ELLE PARLE. Demande de Julien,
 * 12 septembre 2026 : « habille la page pourquoi nous choisir avec des
 * captures d'écran ». Six paragraphes empilés se lisaient comme un mur ; une
 * capture par raison donne un point d'appui au regard — et prouve ce que la
 * phrase affirme, ce qu'un texte seul ne fait pas.
 *
 * ⚠️ Le choix n'est pas décoratif : l'écran cité doit porter ce que les trois
 * points annoncent. « Vos fichiers, tels quels » montre l'import qui NOMME les
 * variantes de colonnes ; « Sérieux jusque dans les coulisses » montre le
 * bouton « Télécharger mes données ». Une capture qui illustre vaguement le
 * sujet ne prouve rien et se remarque.
 *
 * ⚠️ Les captures de téléphone sont ENCADRÉES, sur fond transparent : le corps
 * du téléphone est dans le PNG. `.bloc-vue img` ne porte donc aucun cadre.
 * Seule exception, `large: true` — le tableau de bord est une capture
 * RECTANGULAIRE du site, et celle-là porte un filet, comme dans le diaporama
 * de l'accueil.
 *
 * ⚠️ Le tableau de bord sert AUSSI sur l'accueil, et c'est assumé : c'est le
 * seul écran qui montre à la fois l'avancement par zone et les appareils
 * comptés sans nommer personne — les deux choses que cette raison affirme.
 * La règle « aucune capture deux fois » vaut DANS une page, pas entre deux.
 */
type Raison = {
  icon: React.ReactElement
  title: string
  /** `large` : capture rectangulaire du site, et non téléphone encadré. */
  image: { src: string; alt: string; large?: boolean }
  points: string[]
}

const RAISONS: Raison[] = [
  {
    icon: <IconScan />,
    title: 'Vos équipes suffisent',
    image: {
      src: '/vitrine/bienvenue-compteur-encadre.png',
      alt: 'La première ouverture de l’application par un compteur : les trois gestes à faire',
    },
    points: [
      'Le téléphone que chacun a en poche devient la douchette : scan caméra, bouton virtuel, scan automatique. Aucun terminal à acheter, entretenir ou recharger en urgence la veille du comptage.',
      'Un compteur démarre sans formation : il rejoint la session avec un numéro et un code de sécurité, scanne une balise pour ouvrir sa zone, et compte. La première fois ressemble à la centième.',
      'Plusieurs compteurs travaillent en parallèle, chacun dans sa zone — l’inventaire avance sur tous les fronts à la fois.',
    ],
  },
  {
    icon: <IconReport />,
    title: 'Vos fichiers, tels quels',
    image: {
      src: '/vitrine/importer-encadre.png',
      alt: 'L’écran d’import : les deux fichiers attendus et les noms de colonnes reconnus',
    },
    points: [
      'Importez votre référentiel articles et votre stock théorique en CSV ou Excel, sans les retravailler : Quantinvo reconnaît vos noms de colonnes — SKU, Code article, Référence, EAN, Code-barres, Gencod, Qté, Stock…',
      'Majuscules, accents, tirets, underscores : l’import est insensible à la mise en forme. Le fichier qui sort de votre logiciel de caisse entre dans Quantinvo.',
      'À la sortie, même exigence : l’export Excel des résultats, des écarts en valeur et du détail par zone est prêt pour l’analyse et la correction du stock.',
    ],
  },
  {
    icon: <IconAudit />,
    title: 'Un chiffre auquel se fier',
    image: {
      src: '/vitrine/rapport-encadre.png',
      alt: 'Le rapport d’inventaire : stock théorique, stock compté, écart en unités et en valeur',
    },
    points: [
      'Le comptage s’organise par zones et balises : chaque emplacement est ouvert, compté, clôturé. Rien n’est oublié, rien n’est compté deux fois.',
      'Les zones sensibles passent en double comptage puis en audit : les écarts entre les deux passes sont mis en évidence et arbitrés par le superviseur, article par article.',
      'Chaque comptage garde la trace de qui a compté quoi : quand un écart surprend, on peut remonter à la ligne près et trancher sur des faits.',
    ],
  },
  {
    icon: <IconTeam />,
    title: 'Un pilotage en direct, respectueux',
    image: {
      src: '/vitrine/suivi.png',
      alt: 'Le suivi d’un inventaire sur le site : progression, avancement par zone et derniers scans',
      large: true,
    },
    points: [
      'Le tableau de bord suit l’avancement zone par zone pendant que ça compte : vous voyez ce qui est terminé, ce qui est en cours, ce qui reste.',
      'Les écarts se traitent pendant l’inventaire, pas trois jours après : recompter une zone douteuse coûte dix minutes le jour même, une matinée la semaine suivante.',
      'Le suivi d’activité est agrégé : on pilote le travail, pas les personnes. Vos équipes comptent sans se sentir surveillées une à une.',
    ],
  },
  {
    icon: <IconStore />,
    title: 'Libre, toute l’année',
    image: {
      src: '/vitrine/accueil-superviseur-encadre.png',
      alt: 'L’accueil d’un superviseur : ses inventaires, et le bouton pour en lancer un autre',
    },
    points: [
      'Tournant, ciblé ou complet : vous choisissez la date, le périmètre et la fréquence. Un mardi matin en janvier vaut autant qu’une nuit de décembre.',
      'La licence est par magasin, calée sur le nombre de personnes qui comptent en même temps — et les comptages sont illimités. Compter plus souvent ne coûte pas un euro de plus.',
      'Un réseau équipe ses magasins un à un, au rythme qu’il choisit, et chaque magasin garde ses codes, ses équipes et ses inventaires.',
    ],
  },
  {
    icon: <IconZones />,
    title: 'Sérieux jusque dans les coulisses',
    image: {
      src: '/vitrine/mon-compte-encadre.png',
      alt: 'L’écran « Mon compte » : profil, téléchargement de ses données, déconnexion',
    },
    points: [
      'Vos données résident dans l’Union européenne, chez des prestataires déclarés dans notre politique de confidentialité. Aucun traceur publicitaire, aucune mesure d’audience.',
      'Les accès sont cloisonnés : rôles séparés superviseur / compteur, codes de session par magasin, double authentification pour les comptes qui administrent.',
      'Conformité RGPD outillée dans le produit : chaque personne peut télécharger ses données ou demander la suppression de son compte, sans formulaire papier ni délai.',
    ],
  },
]

export function Pourquoi({ langue }: { langue: Langue }) {
  const { t } = traduction(langue)
  return (
    <>
      <SiteHeader langue={langue} />
      <main>
        <section className="hero" style={{ paddingBottom: 40 }}>
          <div className="container">
            <h1 data-reveal="1" style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>
              {t('Six raisons de compter')}<br />{t('avec Quantinvo.')}
            </h1>
            <p className="lead" data-reveal="2">
              {t('L’accueil vous a donné l’essentiel. Voici le détail — ce que l’outil fait vraiment, et pourquoi ces choix comptent sur le terrain.')}
            </p>
          </div>
        </section>

        {/*
          ⚠️ LA CAPTURE ET LE TEXTE ALTERNENT DE CÔTÉ (`:nth-child(even)` dans la
          feuille), et le rang porte son rang dans le DOM : une rangée sur deux
          inversée en CSS seul laisserait l'ordre de lecture intact pour un
          lecteur d'écran, ce qui est précisément ce qu'on veut.
        */}
        <section className="section" style={{ paddingTop: 8 }}>
          <div className="container blocs-illustres blocs-illustres--alterne">
            {RAISONS.map((r, i) => (
              <div
                className={'card bloc-illustre' + (r.image.large ? ' bloc-illustre--large' : '')}
                data-reveal="0"
                key={r.title}
              >
                <figure className="bloc-vue">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image.src} alt={t(r.image.alt)} />
                </figure>
                <div className="bloc-dire">
                  <div className="ico">{r.icon}</div>
                  <h2>
                    <span className="raison-numero">{i + 1}.</span> {t(r.title)}
                  </h2>
                  {r.points.map((p) => (
                    <p key={p.slice(0, 24)}>{t(p)}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="cta-band" data-reveal="0">
              <div className="plx band-glow" data-plx="0.35" aria-hidden="true" />
              <h2>{t('Équipez votre magasin')}</h2>
              <p>
                {t('Trois offres, un prix par magasin, affiché : à partir de 89 € par mois. Déposez votre demande et nous ouvrons vos accès.')}
              </p>
              <InscriptionLink className="btn btn-primary">Inscrire mon entreprise</InscriptionLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter langue={langue} />
    </>
  )
}
