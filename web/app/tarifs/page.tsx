import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader, SiteFooter } from '@/components/SiteChrome'
import { CubeFilaire } from '@/components/Parallaxe'
import { TarifsGrille } from '@/components/TarifsGrille'
import { CONTACT_EMAIL } from '@/lib/contact'
import { MENTION_TVA, TVA_APPLICABLE } from '@/lib/offres'

export const metadata: Metadata = {
  alternates: { canonical: '/tarifs' },
  title: 'Tarifs',
  description:
    'Un prix par magasin, calé sur le nombre de personnes qui comptent en même temps. Essential 89 €/mois, Advanced 310 €, Enterprise 890 € — sans engagement, sans déclaration de stock et sans terminal à acheter.',
}

/** Ce que le prix comprend, quelle que soit l'offre. */
const COMPRIS = [
  { titre: 'Les mises à jour', texte: 'Toutes, tout le temps. Il n’y a pas de version ancienne à racheter.' },
  { titre: 'Les terminaux', texte: 'Vos équipes comptent avec les téléphones qu’elles ont déjà en poche.' },
  { titre: 'Les inventaires', texte: 'Autant que vous voulez dans l’année. Compter plus souvent ne coûte pas un euro de plus.' },
  { titre: 'Les comptes', texte: 'Créez-en autant que nécessaire. Seuls les appareils qui comptent en même temps sont décomptés.' },
]

const QUESTIONS = [
  {
    q: 'Qu’est-ce qu’un « appareil qui compte » ?',
    r: 'Un téléphone ou une tablette qui scanne, en même temps que les autres, pendant un inventaire. Nous mesurons le maximum atteint, pas le nombre de téléphones que vous possédez : changer d’appareil ne change rien à votre facture.',
  },
  {
    q: 'Que se passe-t-il si nous dépassons le jour de l’inventaire ?',
    r: 'Rien ce jour-là. Nous ne refusons jamais un appareil pendant un comptage — vous verriez votre équipe bloquée à 22 h, ce qui n’a aucun sens. Le dépassement se règle au renouvellement.',
  },
  {
    q: 'Une licence couvre-t-elle plusieurs magasins ?',
    r: 'Non. Chaque magasin prend sa licence, choisie selon la taille de son équipe : un entrepôt qui compte à trente et une boutique qui compte à deux ne prennent pas la même. Si vous en équipez plusieurs, nous établissons un devis pour l’ensemble.',
  },
  {
    q: 'Faut-il déclarer notre stock ?',
    r: 'Non. Vous n’avez rien à déclarer, rien à justifier, et rien à régulariser en fin d’année. C’est précisément ce que cette façon de facturer supprime.',
  },
  {
    q: 'Puis-je résilier ?',
    r: 'Au mois, oui, quand vous voulez : vous arrêtez, le mois en cours va à son terme et rien n’est prélevé ensuite. À l’année, la licence court douze mois — vous pouvez y mettre fin, mais l’année reste due et vous gardez l’accès complet jusqu’au terme. C’est la contrepartie du prix réduit.',
  },
  {
    q: 'Mensuel ou annuel, qu’est-ce qui change ?',
    r: 'Le service est le même. Le paiement mensuel étale la dépense sur douze prélèvements ; le paiement à l’année se règle en une fois et coûte moins cher — de 90 à 900 € selon l’offre.',
  },
]

export default function TarifsPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero" style={{ paddingBottom: 24 }}>
          <div className="plx hero-cube-int-a" data-plx="0.22" aria-hidden="true">
            <div className="flotte"><CubeFilaire size={110} /></div>
          </div>
          <div className="plx hero-cube-int-b" data-plx="0.5" aria-hidden="true">
            <div className="flotte-lent"><CubeFilaire size={70} /></div>
          </div>
          <div className="container">
            <div data-reveal="0"><span className="eyebrow">Tarifs</span></div>
            <h1 data-reveal="1" style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>
              Découvrez l’offre <span className="grad">Quantinvo.</span>
            </h1>
            <p className="lead" data-reveal="2">
              Sans engagement et résiliable à tout moment.
            </p>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container tarifs-bloc">
            <TarifsGrille />
          </div>
        </section>

        <section className="section" style={{ paddingTop: 8 }}>
          <div className="container">
            <div className="card tarifs-licence" data-reveal="0">
              <div>
                <h2>Une licence, un magasin</h2>
                <p>
                  Le nombre d’appareils est celui qui compte dans ce magasin. Un second
                  magasin prend sa propre licence, choisie selon la taille de son
                  équipe : un entrepôt qui compte à trente et une boutique qui compte à
                  deux ne prennent pas la même.
                </p>
              </div>
              <Link href="/inscription" className="btn btn-ghost">
                Équiper plusieurs magasins
              </Link>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 8 }}>
          <div className="plx deco-cube deco-droite deco-accent" data-plx="0.3" aria-hidden="true">
            <CubeFilaire size={110} />
          </div>
          <div className="container">
            <h2 className="tarifs-titre" data-reveal="0">Ce qui n’est facturé nulle part</h2>
            <p className="tarifs-sous-titre" data-reveal="0">
              Le prix affiché est complet. Voici ce que d’autres facturent en supplément
              et que nous ne facturons pas.
            </p>
            <div className="tarifs-compris" data-reveal="1">
              {COMPRIS.map((c) => (
                <div key={c.titre}>
                  <h3>{c.titre}</h3>
                  <p>{c.texte}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 8 }}>
          <div className="container">
            <h2 className="tarifs-titre" data-reveal="0">Les questions qu’on nous pose</h2>
            <div className="tarifs-faq" data-reveal="1">
              {QUESTIONS.map((item) => (
                <details className="collapsible" key={item.q}>
                  <summary>{item.q}</summary>
                  <p className="collapsible-body">{item.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="cta-band" data-reveal="0">
              <div className="plx band-glow" data-plx="0.35" aria-hidden="true" />
              <h2>Un doute sur l’offre qui vous correspond ?</h2>
              <p>
                Dites-nous combien de personnes comptent chez vous un jour d’inventaire.
                C’est la seule chose que nous avons besoin de savoir.
              </p>
              {/* Un texte qui invite à écrire donne l'adresse, ou se tait : sans
                  NEXT_PUBLIC_CONTACT_EMAIL, on renvoie vers le formulaire. */}
              {CONTACT_EMAIL ? (
                <a className="btn btn-primary" href={`mailto:${CONTACT_EMAIL}`}>Nous écrire</a>
              ) : (
                <Link className="btn btn-primary" href="/inscription">Déposer une demande</Link>
              )}
            </div>
          </div>
        </section>

        <p className="tarifs-pied">
          <span>
            {TVA_APPLICABLE ? 'Prix hors taxes, par magasin.' : `Prix par magasin. ${MENTION_TVA}.`}
          </span>
          <span>Mensuel sans engagement ; annuel dû jusqu’à son terme.</span>
          <span>Aucun matériel à acheter.</span>
        </p>
      </main>
      <SiteFooter />
    </>
  )
}
