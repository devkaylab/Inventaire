import type { Metadata } from 'next'
import { InscriptionLink } from '@/components/InscriptionLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { CubeFilaire } from '@/components/Parallaxe'
import { IconScan, IconZones, IconStore, IconAudit, IconReport, IconTeam } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Pourquoi choisir Quantinvo — l’outil d’inventaire pour le commerce',
  description:
    'Vos équipes comptent avec leur téléphone, vous pilotez en direct, le stock validé est fiable. Import sans reformater, audit des écarts, licence annuelle par magasin : les raisons de choisir Quantinvo.',
}

const RAISONS = [
  {
    icon: <IconScan />,
    title: 'Vos équipes suffisent',
    points: [
      'Le téléphone que chacun a en poche devient la douchette : scan caméra, bouton virtuel, scan automatique. Aucun terminal à acheter, entretenir ou recharger en urgence la veille du comptage.',
      'Un compteur démarre sans formation : il rejoint la session avec un numéro et un code de sécurité, scanne une balise pour ouvrir sa zone, et compte. La première fois ressemble à la centième.',
      'Plusieurs compteurs travaillent en parallèle, chacun dans sa zone — l’inventaire avance sur tous les fronts à la fois.',
    ],
  },
  {
    icon: <IconReport />,
    title: 'Vos fichiers, tels quels',
    points: [
      'Importez votre référentiel articles et votre stock théorique en CSV ou Excel, sans les retravailler : Quantinvo reconnaît vos noms de colonnes — SKU, Code article, Référence, EAN, Code-barres, Gencod, Qté, Stock…',
      'Majuscules, accents, tirets, underscores : l’import est insensible à la mise en forme. Le fichier qui sort de votre logiciel de caisse entre dans Quantinvo.',
      'À la sortie, même exigence : l’export Excel des résultats, des écarts en valeur et du détail par zone est prêt pour l’analyse et la correction du stock.',
    ],
  },
  {
    icon: <IconAudit />,
    title: 'Un chiffre auquel se fier',
    points: [
      'Le comptage s’organise par zones et balises : chaque emplacement est ouvert, compté, clôturé. Rien n’est oublié, rien n’est compté deux fois.',
      'Les zones sensibles passent en double comptage puis en audit : les écarts entre les deux passes sont mis en évidence et arbitrés par le superviseur, article par article.',
      'Chaque comptage garde la trace de qui a compté quoi : quand un écart surprend, on peut remonter à la ligne près et trancher sur des faits.',
    ],
  },
  {
    icon: <IconTeam />,
    title: 'Un pilotage en direct, respectueux',
    points: [
      'Le tableau de bord suit l’avancement zone par zone pendant que ça compte : vous voyez ce qui est terminé, ce qui est en cours, ce qui reste.',
      'Les écarts se traitent pendant l’inventaire, pas trois jours après : recompter une zone douteuse coûte dix minutes le jour même, une matinée la semaine suivante.',
      'Le suivi d’activité est agrégé : on pilote le travail, pas les personnes. Vos équipes comptent sans se sentir surveillées une à une.',
    ],
  },
  {
    icon: <IconStore />,
    title: 'Libre, toute l’année',
    points: [
      'Tournant, ciblé ou complet : vous choisissez la date, le périmètre et la fréquence. Un mardi matin en janvier vaut autant qu’une nuit de décembre.',
      'La licence est annuelle, par magasin, au volume de votre stock — et les comptages sont illimités. Compter plus souvent ne coûte pas un euro de plus.',
      'Un réseau équipe ses magasins un à un, au rythme qu’il choisit, et chaque magasin garde ses codes, ses équipes et ses inventaires.',
    ],
  },
  {
    icon: <IconZones />,
    title: 'Sérieux jusque dans les coulisses',
    points: [
      'Vos données résident dans l’Union européenne, chez des prestataires déclarés dans notre politique de confidentialité. Aucun traceur publicitaire, aucune mesure d’audience.',
      'Les accès sont cloisonnés : rôles séparés superviseur / compteur, codes de session par magasin, double authentification pour les comptes qui administrent.',
      'Conformité RGPD outillée dans le produit : chaque personne peut télécharger ses données ou demander la suppression de son compte, sans formulaire papier ni délai.',
    ],
  },
]

export default function PourquoiPage() {
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
            <div data-reveal="0"><span className="eyebrow">Pourquoi nous choisir ?</span></div>
            <h1 data-reveal="1" style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>
              Six raisons de compter<br /><span className="grad">avec Quantinvo.</span>
            </h1>
            <p className="lead" data-reveal="2">
              L’accueil vous a donné l’essentiel. Voici le détail — ce que l’outil fait
              vraiment, et pourquoi ces choix comptent sur le terrain.
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
            {RAISONS.map((r, i) => (
              <div className="card" data-reveal="0" style={{ padding: '30px 34px' }} key={r.title}>
                <div className="ico">{r.icon}</div>
                <h2 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.5px' }}>
                  <span className="raison-numero">{i + 1}.</span> {r.title}
                </h2>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {r.points.map((p) => (
                    <p key={p.slice(0, 24)} style={{ margin: 0, fontSize: 15.5 }}>{p}</p>
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
              <h2>Équipez votre magasin</h2>
              <p>
                Déposez votre demande : nous revenons vers vous avec un devis au volume de
                votre stock, puis vos codes entreprise et magasins.
              </p>
              <InscriptionLink className="btn btn-primary">Inscrire mon entreprise</InscriptionLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
