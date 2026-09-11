import Link from 'next/link'
import { InscriptionLink } from '@/components/InscriptionLink'
import { LangueToggle } from '@/components/LangueToggle'
import { Logo } from '@/components/Logo'
import { traduction, type Langue } from '@/lib/traduction'

/**
 * Ancien formulaire public de demande d'accès superviseur, éteint le
 * 21 août 2026 : les accès sont désormais ouverts par l'administrateur de
 * l'entreprise (parcours /equipe).
 *
 * La page reste — elle ne disparaît pas. L'application mobile installée sur
 * les téléphones partage encore cette adresse avec le code magasin ; la
 * supprimer enverrait ces personnes sur une erreur. Elle n'est plus qu'une
 * explication : aucun formulaire, aucune collecte, donc aucune mention
 * d'information à afficher.
 */
export function Superviseur({ langue }: { langue: Langue }) {
  const { t, lien } = traduction(langue)
  return (
    <div className="auth-wrap">
      <LangueToggle />
      <div className="auth-card">
        <div className="head">
          <Link href={lien('/')}><Logo size={56} /></Link>
          <h1>{t('Obtenir un accès superviseur')}</h1>
          <p className="sub">
            {t('Les accès ne se demandent plus depuis le site : c’est votre entreprise qui les ouvre.')}
          </p>
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <h3>{t('Votre entreprise utilise déjà Quantinvo')}</h3>
          <p>
            {t('Demandez à l’administrateur Quantinvo de votre entreprise de vous ajouter comme superviseur. Il le fait en une minute depuis son espace « Mon équipe », et vous recevez un e-mail pour choisir votre mot de passe.')}
          </p>
        </div>

        <div className="panel">
          <h3>{t('Votre entreprise n’a pas encore d’administrateur')}</h3>
          <p>
            {t('Écrivez-nous : nous ouvrons l’accès administrateur de votre entreprise, qui pourra ensuite gérer ses superviseurs lui-même.')}
          </p>
          <a href="mailto:jthiongkay@gmail.com?subject=Acc%C3%A8s%20superviseur%20Quantinvo"
             className="btn btn-primary" style={{ marginTop: 14, display: 'inline-flex' }}>
            {t('Nous écrire')}
          </a>
        </div>

        <div className="panel">
          <h3>{t('Votre entreprise n’est pas encore cliente')}</h3>
          <p>
            {t('L’inscription se fait au nom de l’entreprise : vous répondez à quelques questions, vous voyez votre offre, et vos codes entreprise et magasins s’ouvrent au règlement.')}
          </p>
          <InscriptionLink className="btn btn-ghost">Inscrire mon entreprise</InscriptionLink>
        </div>

        <div className="center-link">
          <Link href="/login">{t("J'ai déjà un compte")}</Link>
        </div>
        <div className="center-link">
          <Link href={lien('/')}>{t("← Retour à l'accueil")}</Link>
        </div>
      </div>
    </div>
  )
}
