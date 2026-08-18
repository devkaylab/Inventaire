import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { mentionsCompletes } from '@/lib/legal'
import { PRIVACY_URL } from '@/lib/links'
import { AuthLink } from '@/components/AuthLink'
import { IconScan, IconZones, IconStore, IconAudit, IconReport, IconTeam } from '@/components/icons'

const FEATURES = [
  { icon: <IconScan />, title: 'Scan rapide', desc: 'Comptez au code-barres avec la caméra, un bouton virtuel et le scan automatique. Fluide, sans friction.' },
  { icon: <IconZones />, title: 'Zones & balises', desc: 'Organisez le comptage par emplacement : on scanne une balise pour ouvrir une zone, on compte, on clôture.' },
  { icon: <IconStore />, title: 'Multi-magasins', desc: 'Gérez plusieurs magasins par entreprise et lancez un inventaire pour chacun en quelques secondes.' },
  { icon: <IconAudit />, title: 'Audit & écarts', desc: 'Double comptage, audit et arbitrage : repérez les écarts avant de valider votre stock.' },
  { icon: <IconReport />, title: 'Rapports', desc: 'Export Excel des résultats, des écarts en valeur et du détail par zone. Prêt pour votre compta.' },
  { icon: <IconTeam />, title: 'Équipes', desc: 'Un superviseur, plusieurs compteurs. Chacun rejoint la session avec un numéro et un code de sécurité.' },
]

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="container inner">
          <Link href="/" className="brand">
            <Logo size={30} />
            <span>Quantinvo</span>
          </Link>
          <nav className="nav-links">
            <a href="#fonctionnalites">Fonctionnalités</a>
            <AuthLink className="btn btn-ghost" style={{ padding: '8px 16px' }} loggedOutLabel="Se connecter" loggedInLabel="Mon espace" />
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container">
            <div className="logo-glow" style={{ display: 'inline-block' }}>
              <Logo size={84} />
            </div>
            <div><span className="eyebrow">Application d&apos;inventaire</span></div>
            <h1>La simplicité<br /><span className="grad">en main.</span></h1>
            <p className="lead">
              Quantinvo aide vos équipes à compter, auditer et fiabiliser les stocks en magasin —
              du scan à l&apos;écart de comptage, jusqu&apos;au rapport.
            </p>
            <div className="cta">
              <Link href="/inscription" className="btn btn-primary">Inscrire mon entreprise</Link>
              <AuthLink className="btn btn-ghost" loggedOutLabel="Se connecter" loggedInLabel="Accéder à mon espace" />
            </div>
          </div>
        </section>

        <section className="section" id="fonctionnalites">
          <div className="container">
            <div className="section-head">
              <h2>Tout pour un inventaire maîtrisé</h2>
              <p>Du terrain au rapport final, Quantinvo couvre chaque étape du comptage.</p>
            </div>
            <div className="grid">
              {FEATURES.map((f) => (
                <div className="card" key={f.title}>
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
            <div className="cta-band">
              <h2>Prêt à fiabiliser vos inventaires ?</h2>
              <p>
                Déposez votre demande : nous revenons vers vous avec un devis, puis vos codes
                entreprise et magasins. Superviseur déjà attendu par votre entreprise ?
                {' '}<Link href="/superviseur">Demandez votre accès</Link>.
              </p>
              <Link href="/inscription" className="btn btn-primary">Inscrire mon entreprise</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container inner">
          <div className="brand"><Logo size={24} /><span>Quantinvo</span></div>
          <div className="links">
            <a href="#fonctionnalites">Fonctionnalités</a>
            <Link href="/login">Se connecter</Link>
            <a href={PRIVACY_URL} target="_blank" rel="noreferrer">Confidentialité</a>
            {/* Une identification à trous ne vaut pas mieux que pas de page : on
                ne l'annonce qu'une fois les mentions requises renseignées. */}
            {mentionsCompletes() && <Link href="/mentions-legales">Mentions légales</Link>}
          </div>
          <span className="muted">© 2026 Devkaylab · Quantinvo</span>
        </div>
      </footer>
    </>
  )
}
