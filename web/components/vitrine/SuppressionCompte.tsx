import Link from 'next/link'
import { LangueToggle } from '@/components/LangueToggle'
import { traduction, type Langue } from '@/lib/traduction'
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
export function SuppressionCompte({ langue }: { langue: Langue }) {
  const { t, lien } = traduction(langue)
  return (
    <div className="legal-wrap">
      <LangueToggle />
      <header className="legal-head">
        <Link href={lien('/')} className="brand"><Logo size={38} /><span>Quantinvo</span></Link>
      </header>

      <main className="legal">
        <h1>{t('Supprimer son compte')}</h1>

        <p>
          {t('Votre compte Quantinvo peut être supprimé à tout moment, avec les données personnelles qui lui sont attachées. Deux chemins, au choix.')}
        </p>

        <section>
          <h2>{t('Depuis l’application')}</h2>
          <p>
            {t('C’est le plus rapide. Dans l’application Quantinvo :')} <strong>{t('Mon compte')}</strong>{t(', puis, tout en bas,')} <strong>{t('Supprimer mon compte')}</strong>{t('. Une confirmation vous est demandée, puis la demande part.')}
          </p>
          <p>
            {t('Le même chemin existe sur ce site, page')} <strong>{t('Mon compte')}</strong>{t(', si vous vous connectez depuis un ordinateur.')}
          </p>
        </section>

        <section>
          <h2>{t('Par courrier électronique')}</h2>
          <p>
            {t('Si vous n’avez plus accès à l’application ou à votre compte, écrivez à')}{' '}
            {CONTACT_EMAIL
              ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              : <span>{t('l’adresse de contact figurant dans nos mentions légales')}</span>}
            {' '}{t('depuis l’adresse électronique de votre compte, en demandant sa suppression. Il vous sera répondu dans un délai d’un mois au plus.')}
          </p>
        </section>

        <section>
          <h2>{t('Ce qui est supprimé')}</h2>
          <ul>
            <li>{t('Votre compte et vos identifiants de connexion.')}</li>
            <li>{t('Votre profil : prénom, nom, adresse électronique.')}</li>
            <li>{t('Votre rattachement à votre entreprise et à vos magasins.')}</li>
            <li>{t('Votre participation aux inventaires, et les invitations en attente.')}</li>
            <li>{t('Le jeton qui permettait de vous envoyer des notifications.')}</li>
          </ul>
        </section>

        <section>
          <h2>{t('Ce qui est conservé, et pourquoi')}</h2>
          <p>
            <strong>{t('Les comptages que vous avez réalisés sont conservés, mais détachés de votre identité.')}</strong>{' '}
            {t('Ils ne sont pas une donnée personnelle qui vous appartiendrait : ils sont le résultat d’inventaire de l’entreprise qui vous a confié le comptage, et les supprimer fausserait ses stocks. Après la suppression de votre compte, ces lignes n’indiquent plus qui les a saisies.')}
          </p>
          <p>
            {t('Le journal des actions d’administration conserve, pendant un an, la trace des gestes faits sur les comptes — dont la suppression du vôtre. C’est une obligation de traçabilité, et il est purgé automatiquement à l’échéance.')}
          </p>
          <p>
            {t('Si vous utilisez Quantinvo dans le cadre de votre travail, les données d’inventaire relèvent de votre employeur, qui en est responsable : une demande les concernant lui est relayée, et c’est lui qui en décide.')}
          </p>
        </section>

        <section>
          <h2>{t('Avant de supprimer : récupérer vos données')}</h2>
          <p>
            {t('Le bouton')} <strong>{t('Télécharger mes données')}</strong> {t('de la page Mon compte produit immédiatement une copie complète et réutilisable de ce qui est rattaché à votre compte. Une fois la suppression faite, elle n’est plus possible.')}
          </p>
        </section>

        <p className="legal-avis">
          {t('Le détail des traitements, des durées de conservation et de vos droits figure dans la')}{' '}
          <a href={PRIVACY_URL}>{t('politique de confidentialité')}</a>.
        </p>
      </main>

      <footer className="legal-pied">
        <Link href={lien('/')}>{t('Retour à l’accueil')}</Link>
      </footer>
    </div>
  )
}
