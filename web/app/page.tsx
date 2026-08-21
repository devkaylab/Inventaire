import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { AuthLink } from '@/components/AuthLink'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { IconScan, IconZones, IconStore, IconAudit, IconReport, IconTeam } from '@/components/icons'

const FEATURES = [
  { icon: <IconScan />, title: 'Scan rapide', desc: 'Le téléphone devient la douchette : caméra, bouton virtuel et scan automatique. Fluide, sans friction.' },
  { icon: <IconZones />, title: 'Zones & balises', desc: 'Le comptage s’organise par emplacement : on scanne une balise pour ouvrir une zone, on compte, on clôture.' },
  { icon: <IconStore />, title: 'Multi-magasins', desc: 'Plusieurs magasins par entreprise, un inventaire lancé pour chacun en quelques secondes.' },
  { icon: <IconAudit />, title: 'Audit & écarts', desc: 'Double comptage, audit et arbitrage : le stock validé est un chiffre auquel on peut se fier.' },
  { icon: <IconReport />, title: 'Rapports', desc: 'Export Excel des résultats, des écarts en valeur et du détail par zone. Prêt pour l’analyse et la correction du stock.' },
  { icon: <IconTeam />, title: 'Équipes', desc: 'Un superviseur, plusieurs compteurs. Chacun rejoint la session avec un numéro et un code de sécurité, sans formation.' },
]

const RYTHMES = [
  { title: 'Tournant', desc: 'Une zone après l’autre, au fil des semaines : le stock reste juste sans jamais fermer le magasin.' },
  { title: 'Ciblé', desc: 'Un rayon sensible, la réserve, une famille d’articles : vous comptez là où ça bouge.' },
  { title: 'Complet', desc: 'Le grand comptage de fin d’exercice, préparé et mené comme les autres — juste plus grand.' },
]

const CONFIANCE = [
  { title: 'Données en Europe', desc: 'Toutes les données résident dans l’Union européenne, chez des prestataires déclarés dans notre politique de confidentialité.' },
  { title: 'Conforme RGPD', desc: 'Les droits sont outillés dans le produit : chaque personne peut télécharger ses données ou demander la suppression de son compte.' },
  { title: 'Zéro traceur', desc: 'Aucun cookie publicitaire, aucune mesure d’audience. Le suivi d’un inventaire est agrégé : on pilote le travail, pas les personnes.' },
]

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="hero">
          <div className="container">
            <div className="logo-glow" data-reveal="0" style={{ display: 'inline-block' }}>
              <Logo size={84} />
            </div>
            <div data-reveal="1"><span className="eyebrow">Outil d&apos;inventaire</span></div>
            <h1 data-reveal="2">La simplicité<br /><span className="grad">en main.</span></h1>
            <p className="lead" data-reveal="3">
              Un stock fiable toute l&apos;année, compté par vos propres équipes : elles scannent,
              vous suivez l&apos;avancement en direct, et l&apos;écart se voit avant de coûter.
            </p>
            <div className="cta" data-reveal="4">
              <Link href="/inscription" className="btn btn-primary">Inscrire mon entreprise</Link>
              <AuthLink className="btn btn-ghost" loggedOutLabel="Se connecter" loggedInLabel="Accéder à mon espace" />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <h2>Comptez quand vous voulez</h2>
              <p>
                Plus besoin d&apos;attendre la fermeture annuelle : vous choisissez la date,
                le périmètre et la fréquence de chaque inventaire.
              </p>
            </div>
            <div className="grid">
              {RYTHMES.map((r, i) => (
                <div className="card" data-reveal={i + 1} key={r.title}>
                  <h3>{r.title}</h3>
                  <p>{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="fonctionnalites">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <h2>Tout pour un inventaire maîtrisé</h2>
              <p>Du premier scan au rapport final, sans rien installer côté bureau.</p>
            </div>
            <div className="grid">
              {FEATURES.map((f, i) => (
                <div className="card" data-reveal={(i % 3) + 1} key={f.title}>
                  <div className="ico">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head" data-reveal="0">
              <h2>Pensé pour l&apos;entreprise</h2>
              <p>Votre stock est votre principal actif : l&apos;outil qui le compte doit être irréprochable.</p>
            </div>
            <div className="grid">
              {CONFIANCE.map((c, i) => (
                <div className="card" data-reveal={i + 1} key={c.title}>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="cta-band" data-reveal="0">
              <h2>Équipez votre magasin</h2>
              <p>
                Une licence annuelle par magasin, au volume de votre stock — inventaires et compteurs
                illimités. Déposez votre demande : nous revenons vers vous avec un devis, puis
                vos codes entreprise et magasins. Votre entreprise utilise déjà Quantinvo ?
                Son administrateur vous ouvre l&apos;accès depuis son espace.
              </p>
              <Link href="/inscription" className="btn btn-primary">Inscrire mon entreprise</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
