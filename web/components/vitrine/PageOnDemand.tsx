'use client'

/**
 * « On-demand » — le concept, puis le choix.
 *
 * ⚠️ **LE PRODUIT S'APPELLE ON-DEMAND, MÊME EN FRANÇAIS** (Julien, 21
 * septembre 2026, après que j'eus lu sa consigne à l'envers). « Même en
 * français » voulait dire : le nom ne se traduit pas.
 *
 * ⚠️ **ET L'ADRESSE SUIT LE NOM** : `/on-demand`. J'avais proposé de garder
 * `/a-la-demande` pour ne pas casser de liens ; Julien a tranché l'inverse, et
 * il a raison — deux noms pour la même chose, dont un dans la barre d'adresse,
 * c'est la même incohérence un cran plus bas. Une redirection permanente
 * couvre les liens de préversion déjà partagés (`web/next.config.mjs`).
 *
 * Maquette : la planche Main.
 *
 * ⚠️ **ELLE EXISTE PARCE QUE RIEN NE MENAIT À LA RÉSERVATION.** Constat de
 * Julien, 20 septembre 2026 : « depuis le site quantinvo, je n'ai aucun bouton
 * qui mène vers on demand ». Le tunnel `/reserver` était construit et
 * inatteignable — une porte sans couloir.
 *
 * ⚠️ **ET SA PREMIÈRE VERSION ENVOYAIT « VOUS, AVEC VOTRE ÉQUIPE » VERS UN
 * ABONNEMENT ANNUEL.** Second constat de Julien, le même jour : « si le client
 * n'a pas besoin de compteurs quantinvo, on lui propose l'abonnement quantinvo
 * os ce qui n'est pas logique, il peut y aller directement par l'offre
 * quantinvo ». Une page « à la demande » qui propose douze mois d'engagement
 * propose l'inverse de ce qu'on est venu y chercher. Les deux colonnes mènent
 * donc maintenant au MÊME tunnel, et ce qui les sépare est ce que Julien a
 * demandé de mettre au milieu : qui tient le téléphone.
 *
 * ⚠️ **LE CONCEPT VIENT AVANT LE CHOIX** (Julien, 20 septembre 2026 : « tu
 * présenteras le concept avant de proposer le choix »). Demander « vous ou
 * nous ? » à quelqu'un qui ne sait pas encore ce qu'on vend, c'est lui
 * demander d'arbitrer entre deux choses qu'il ne connaît pas.
 *
 * ⚠️ **AUCUN PRIX N'EST ÉCRIT DANS CE FICHIER.** Les deux « à partir de » sont
 * calculés par la chaîne, sur la plus petite tranche d'articles. Un prix
 * recopié a déjà survécu à une revalorisation sur trois pages (31 août 2026).
 */
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { useTraduction } from '@/lib/i18n'
import { euros } from '@/lib/offres'
import { TRANCHES_ARTICLES, chaine } from '@/lib/prixOnDemand'

function Coche({ accent = false }: { accent?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
         stroke={accent ? 'var(--accent-2)' : 'var(--text-2)'} strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 12 9.5 17.5 20 6.5" />
    </svg>
  )
}

export function PageOnDemand() {
  const { lien } = useTraduction()

  // ⚠️ LE PRIX D'APPEL SE DÉDUIT DE LA CHAÎNE, il ne se recopie pas — et la
  // plus petite tranche se déduit de la liste, elle ne se cite pas non plus.
  const plusPetite = TRANCHES_ARTICLES.reduce((a, b) => (b.max < a.max ? b : a))
  const departLogiciel = chaine(plusPetite.max, 1, 'logiciel_seul').prixCents / 100
  const departEquipe = chaine(plusPetite.max, 1, 'equipe_quantinvo').prixCents / 100

  return (
    <>
      <SiteHeader langue="fr" />
      <main className="container ald-page">
        <header className="ald-tete">
          <h1>Un inventaire, le jour où vous en avez besoin</h1>
          <p>
            Vous répondez à trois questions — où, quand, combien d’articles — et
            votre prix s’affiche. Pas de devis, pas d’abonnement, pas de rendez‑vous
            commercial&nbsp;: <b>le prix affiché est le prix payé</b>.
          </p>
        </header>

        {/* ⚠️ Trois phrases, pas une liste d'arguments : ce bloc répond à
            « c'est quoi ? », et quelqu'un qui ne sait pas encore ce qu'on vend
            ne peut pas trier des arguments. */}
        <section className="ald-concept">
          <div>
            <h2>Vous réservez une date</h2>
            <p className="muted">
              Comme on réserve une salle. Vous choisissez le jour et l’heure,
              vous payez le montant affiché, c’est réservé. Annulation sans
              frais jusqu’à trois jours avant.
            </p>
          </div>
          <div>
            <h2>Le logiciel est prêt le jour J</h2>
            <p className="muted">
              Import de votre stock, découpage du magasin en zones, comptage,
              seconde passe d’audit, rapport d’écarts. C’est Quantinvo, celui
              que les enseignes utilisent toute l’année.
            </p>
          </div>
          <div>
            <h2>Vous repartez avec le rapport</h2>
            <p className="muted">
              Écarts référence par référence, export Excel, et de quoi justifier
              vos chiffres. Il est à vous, que vous ayez compté vous‑même ou non.
            </p>
          </div>
        </section>

        {/* ⚠️ LE CHOIX ARRIVE ICI, ET PAS AVANT. Les deux colonnes sont au même
            rang : une page qui pousse l'équipe dirait à quelqu'un qui a du
            personnel qu'il s'est trompé, et une page qui la relègue en ferait
            un service de dépannage. */}
        <h2 className="ald-question">Qui tient le téléphone&nbsp;?</h2>

        <div className="ald-choix">
          <section className="ald-carte">
            <h3>Vous, avec votre équipe</h3>
            <p className="muted">
              Vos collaborateurs comptent sur leurs téléphones. Nous vous
              ouvrons Quantinvo <b>le temps de cet inventaire</b> — rien à
              installer, rien à résilier.
            </p>
            <ul>
              <li><Coche />Comptage, audit en seconde passe, rapport d’écarts</li>
              <li><Coche />Autant d’appareils que votre magasin en demande</li>
              <li><Coche />Partout en France, et même pour ce soir</li>
            </ul>
            <div className="ald-pied">
              <p className="muted">
                À partir de <b>{euros(departLogiciel)}</b> pour un inventaire
              </p>
              <Link href="/reserver?formule=logiciel" className="btn btn-ghost">
                Réserver le logiciel
              </Link>
            </div>
          </section>

          <section className="ald-carte">
            <h3>Nous, avec la nôtre</h3>
            <p className="muted">
              Nous venons avec les inventoristes et les téléphones. Vous suivez
              l’avancement depuis votre bureau et vous recevez le rapport.
            </p>
            <ul>
              <li><Coche accent />Une équipe formée, un responsable sur place</li>
              <li><Coche accent />Contrôle des écarts et second comptage compris</li>
              <li><Coche accent />Personne à recruter, personne à former</li>
            </ul>
            <div className="ald-pied">
              <p className="muted">
                À partir de <b>{euros(departEquipe)}</b> pour un inventaire
              </p>
              {/* ⚠️ `/reserver` n'est pas une page de vitrine : elle reste en
                  français quelle que soit la langue de celle-ci, parce que le
                  service ne couvre que la France. `lien()` la laisse donc
                  telle quelle, et c'est voulu. */}
              <Link href="/reserver?formule=equipe" className="btn btn-primary">
                Réserver une équipe
              </Link>
            </div>
          </section>
        </div>

        {/* ⚠️ C'est ICI que la question « et si je compte toute l'année ? » se
            pose, une fois les deux formules lues — pas avant, où elle aurait
            détourné quelqu'un venu pour un seul inventaire. */}
        <p className="ald-note muted">
          Vous comptez plusieurs fois par an, ou toute l’année&nbsp;?
          L’abonnement revient moins cher dès le troisième inventaire.{' '}
          <Link href={lien('/decouvrir')}>Découvrir Quantinvo OS</Link>.
        </p>

        <p className="ald-note muted">
          Déjà abonné&nbsp;? Vous réservez une équipe depuis votre tableau de
          bord, avec vos magasins et vos coordonnées de facturation — sans
          recréer de compte.
        </p>

        {/* ⚠️ C'est ICI que quelqu'un qui vient de lire « nous venons avec les
            inventoristes » se demande comment en devenir un. Le mettre au seul
            pied de page, c'est le mettre là où on ne le cherche pas. */}
        <p className="ald-note muted">
          Vous comptez sur le terrain&nbsp;?{' '}
          <Link href="/devenir-inventoriste">Réaliser des inventaires pour Quantinvo</Link>.
        </p>
      </main>
      <SiteFooter langue="fr" />
    </>
  )
}
