import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { EDITEUR, HEBERGEUR, mentionsCompletes, mentionsManquantes, type Mention } from '@/lib/legal'
import { PRIVACY_URL } from '@/lib/links'

/**
 * Mentions légales — obligation de la LCEN (art. 6 III), indépendante du RGPD.
 *
 * Tant qu'une mention requise manque, la page est en `noindex` et le pied de
 * page de l'accueil ne l'annonce pas : elle reste consultable pour qui la
 * cherche, mais n'est pas présentée comme une identification valable.
 */
export const metadata: Metadata = {
  alternates: { canonical: '/mentions-legales' },
  title: 'Mentions légales',
  description: "Informations légales relatives à l'éditeur et à l'hébergeur du site Quantinvo.",
  robots: mentionsCompletes() ? undefined : { index: false, follow: false },
}

function Bloc({ titre, mentions }: { titre: string; mentions: Mention[] }) {
  const publiees = mentions.filter(m => m.valeur?.trim() || m.requis)
  return (
    <section>
      <h2>{titre}</h2>
      <dl className="legal-list">
        {publiees.map(m => (
          <div key={m.libelle}>
            <dt>{m.libelle}</dt>
            <dd>
              {m.valeur?.trim()
                ? m.valeur
                : <span className="legal-todo" title={m.aide}>à compléter</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default function MentionsLegalesPage() {
  const manquantes = mentionsManquantes()

  return (
    <div className="legal-wrap">
      <header className="legal-head">
        <Link href="/" className="brand"><Logo size={38} /><span>Quantinvo</span></Link>
      </header>

      <main className="legal">
        <h1>Mentions légales</h1>

        {manquantes.length > 0 && (
          <p className="legal-avis">
            Cette page est en cours de constitution : l’activité éditrice n’est pas encore
            immatriculée. Les informations manquantes sont signalées ci-dessous et seront
            publiées dès qu’elles seront disponibles.
          </p>
        )}

        <Bloc titre="Éditeur du site" mentions={EDITEUR} />
        <Bloc titre="Hébergeur du site" mentions={HEBERGEUR} />

        <section>
          <h2>Hébergement des données</h2>
          <p>
            Les données des inventaires sont hébergées par Supabase, dans l’Union européenne
            (région <code>eu-west-1</code>, Irlande). Les courriers électroniques de service
            (invitations, liens de connexion) sont acheminés par Resend.
          </p>
        </section>

        <section>
          <h2>Données personnelles</h2>
          <p>
            Le traitement des données personnelles, les finalités poursuivies et les droits dont
            vous disposez sont décrits dans notre{' '}
            <a href={PRIVACY_URL} target="_blank" rel="noreferrer">politique de confidentialité</a>.
          </p>
        </section>

        <section>
          <h2>Propriété intellectuelle</h2>
          <p>
            Le nom Quantinvo, le logo, l’interface du site et de l’application ainsi que leurs
            contenus sont protégés par le droit d’auteur. Toute reproduction ou représentation,
            totale ou partielle, sans autorisation préalable, est interdite.
          </p>
          <p>
            Les données d’inventaire saisies ou importées par une entreprise cliente restent sa
            propriété ; Quantinvo n’en fait aucun autre usage que la fourniture du service.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Pour toute question relative au site ou à ces mentions :{' '}
            <a href="mailto:contact@quantinvo.com">contact@quantinvo.com</a>.
          </p>
        </section>
      </main>

      <footer className="legal-pied">
        <Link href="/">Retour à l’accueil</Link>
      </footer>
    </div>
  )
}
