import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { CONTACT_EMAIL } from '@/lib/contact'
import { PRIVACY_URL } from '@/lib/links'

/**
 * Comment supprimer son compte — page publique.
 *
 * ⚠️ **Elle existe parce que Google Play l'exige.** La règle sur les données
 * utilisateur demande DEUX choses à toute application qui permet de créer un
 * compte : un chemin de suppression **dans l'application**, et un **lien web**
 * accessible sans installer l'application, déclaré dans le formulaire
 * « Sécurité des données » de la console. Le premier existe depuis longtemps
 * (Mon compte → Supprimer mon compte) ; le second, c'est cette page.
 *
 * ⚠️ **Elle doit rester publique et indexable.** Une page derrière une
 * connexion ne remplit pas la condition : la personne qui veut supprimer son
 * compte est justement celle qui n'arrive plus à entrer.
 *
 * ⚠️ **Et elle doit dire la vérité sur ce qui reste.** Les comptages ne sont
 * pas détruits : ils sont détachés de la personne (`on delete set null`), parce
 * qu'ils sont le résultat d'inventaire de l'entreprise cliente, pas une donnée
 * personnelle qui lui appartiendrait. C'est écrit tel quel dans la politique de
 * confidentialité, section 9 — les deux textes doivent rester d'accord.
 */
export const metadata: Metadata = {
  title: 'Supprimer son compte',
  description:
    'Comment demander la suppression de votre compte Quantinvo et des données associées, depuis l’application ou par courrier électronique.',
  alternates: { canonical: '/suppression-compte' },
}

export default function SuppressionComptePage() {
  return (
    <div className="legal-wrap">
      <header className="legal-head">
        <Link href="/" className="brand"><Logo size={38} /><span>Quantinvo</span></Link>
      </header>

      <main className="legal">
        <h1>Supprimer son compte</h1>

        <p>
          Votre compte Quantinvo peut être supprimé à tout moment, avec les données
          personnelles qui lui sont attachées. Deux chemins, au choix.
        </p>

        <section>
          <h2>Depuis l’application</h2>
          <p>
            C’est le plus rapide. Dans l’application Quantinvo : <strong>Mon compte</strong>,
            puis, tout en bas, <strong>Supprimer mon compte</strong>. Une confirmation vous est
            demandée, puis la demande part.
          </p>
          <p>
            Le même chemin existe sur ce site, page <strong>Mon compte</strong>, si vous vous
            connectez depuis un ordinateur.
          </p>
        </section>

        <section>
          <h2>Par courrier électronique</h2>
          <p>
            Si vous n’avez plus accès à l’application ou à votre compte, écrivez à{' '}
            {CONTACT_EMAIL
              ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              : <span>l’adresse de contact figurant dans nos mentions légales</span>}
            {' '}depuis l’adresse électronique de votre compte, en demandant sa suppression.
            Il vous sera répondu dans un délai d’un mois au plus.
          </p>
        </section>

        <section>
          <h2>Ce qui est supprimé</h2>
          <ul>
            <li>Votre compte et vos identifiants de connexion.</li>
            <li>Votre profil : prénom, nom, adresse électronique.</li>
            <li>Votre rattachement à votre entreprise et à vos magasins.</li>
            <li>Votre participation aux inventaires, et les invitations en attente.</li>
            <li>Le jeton qui permettait de vous envoyer des notifications.</li>
          </ul>
        </section>

        <section>
          <h2>Ce qui est conservé, et pourquoi</h2>
          <p>
            <strong>Les comptages que vous avez réalisés sont conservés, mais détachés de votre
            identité.</strong> Ils ne sont pas une donnée personnelle qui vous appartiendrait :
            ils sont le résultat d’inventaire de l’entreprise qui vous a confié le comptage, et
            les supprimer fausserait ses stocks. Après la suppression de votre compte, ces
            lignes n’indiquent plus qui les a saisies.
          </p>
          <p>
            Le journal des actions d’administration conserve, pendant un an, la trace des gestes
            faits sur les comptes — dont la suppression du vôtre. C’est une obligation de
            traçabilité, et il est purgé automatiquement à l’échéance.
          </p>
          <p>
            Si vous utilisez Quantinvo dans le cadre de votre travail, les données d’inventaire
            relèvent de votre employeur, qui en est responsable : une demande les concernant lui
            est relayée, et c’est lui qui en décide.
          </p>
        </section>

        <section>
          <h2>Avant de supprimer : récupérer vos données</h2>
          <p>
            Le bouton <strong>Télécharger mes données</strong> de la page Mon compte produit
            immédiatement une copie complète et réutilisable de ce qui est rattaché à votre
            compte. Une fois la suppression faite, elle n’est plus possible.
          </p>
        </section>

        <p className="legal-avis">
          Le détail des traitements, des durées de conservation et de vos droits figure dans la{' '}
          <a href={PRIVACY_URL}>politique de confidentialité</a>.
        </p>
      </main>

      <footer className="legal-pied">
        <Link href="/">Retour à l’accueil</Link>
      </footer>
    </div>
  )
}
