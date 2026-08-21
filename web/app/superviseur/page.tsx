import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = {
  title: 'Accès superviseur — Quantinvo',
  description:
    'Un accès superviseur Quantinvo est ouvert par l’administrateur de votre entreprise, ou par Quantinvo pour les entreprises qui n’en ont pas encore.',
}

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
export default function SuperviseurPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="head">
          <Link href="/"><Logo size={56} /></Link>
          <h1>Obtenir un accès superviseur</h1>
          <p className="sub">
            Les accès ne se demandent plus depuis le site&nbsp;: c’est votre entreprise qui les ouvre.
          </p>
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <h3>Votre entreprise utilise déjà Quantinvo</h3>
          <p>
            Demandez à l’administrateur Quantinvo de votre entreprise de vous ajouter
            comme superviseur. Il le fait en une minute depuis son espace
            «&nbsp;Mon équipe&nbsp;», et vous recevez un e-mail pour choisir votre mot de passe.
          </p>
        </div>

        <div className="panel">
          <h3>Votre entreprise n’a pas encore d’administrateur</h3>
          <p>
            Écrivez-nous&nbsp;: nous ouvrons l’accès administrateur de votre entreprise, qui
            pourra ensuite gérer ses superviseurs lui-même.
          </p>
          <a href="mailto:jthiongkay@gmail.com?subject=Acc%C3%A8s%20superviseur%20Quantinvo"
             className="btn btn-primary" style={{ marginTop: 14, display: 'inline-flex' }}>
            Nous écrire
          </a>
        </div>

        <div className="panel">
          <h3>Votre entreprise n’est pas encore cliente</h3>
          <p>
            L’inscription se fait au nom de l’entreprise&nbsp;: nous revenons vers vous avec
            un devis, puis vos codes entreprise et magasins.
          </p>
          <Link href="/inscription" className="btn btn-ghost" style={{ marginTop: 14, display: 'inline-flex' }}>
            Inscrire mon entreprise
          </Link>
        </div>

        <div className="center-link">
          <Link href="/login">J&apos;ai déjà un compte</Link>
        </div>
        <div className="center-link">
          <Link href="/">← Retour à l&apos;accueil</Link>
        </div>
      </div>
    </div>
  )
}
