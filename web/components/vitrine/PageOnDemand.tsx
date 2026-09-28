'use client'

/**
 * « On-demand » — l'offre.
 *
 * ⚠️⚠️ **CETTE PAGE EST LA PLANCHE `Main` DE LA MAQUETTE, PAS UNE VARIATION
 * DESSUS.** Elle a été refaite le 28 septembre 2026 après un reproche de
 * Julien qui portait juste : « je veux la même chose que l'artefact, tu me
 * proposes quelque chose sur lequel on a travaillé et tu codes autre chose ».
 * J'avais porté le TEXTE de la maquette dans l'ancienne charpente — hero,
 * bandeau de trois colonnes, « Qui tient le téléphone ? », une carte — et le
 * résultat n'avait rien à voir avec ce qui avait été validé écran par écran.
 *
 * **La règle qui en sort : quand une maquette a été validée, c'est elle qu'on
 * code, structure comprise.** Si quelque chose doit s'en écarter, ça se dit
 * avant, pas après.
 *
 * ⚠️ **CE QUE LA REFONTE A RETIRÉ**, et qu'on ne remet pas sans le décider :
 *   · « Un inventaire, le jour où vous en avez besoin » et sa promesse en
 *     trois lignes — le titre est maintenant l'offre elle-même ;
 *   · le bandeau « Vous réservez une date / Le logiciel est prêt le jour J /
 *     Vous repartez avec le rapport » — il expliquait le concept AVANT le
 *     choix, et il n'y a plus de choix à préparer ;
 *   · « Qui tient le téléphone ? », qui séparait les deux formules ;
 *   · les trois notes de bas de page (abonnement, déjà abonné, devenir
 *     inventoriste).
 *
 * ⚠️ **LE PRODUIT S'APPELLE ON-DEMAND, MÊME EN FRANÇAIS** (Julien, 21
 * septembre 2026) : le nom ne se traduit pas, et l'adresse suit le nom —
 * `/on-demand`, avec une redirection permanente depuis `/a-la-demande` pour
 * les liens de préversion déjà partagés (`web/next.config.mjs`).
 *
 * ⚠️ **AUCUN PRIX N'EST ÉCRIT DANS CE FICHIER.** Le « à partir de » se calcule
 * sur la plus petite tranche, qui se déduit de la liste. Un prix recopié a
 * déjà survécu à une revalorisation sur trois pages (31 août 2026).
 *
 * ⚠️ La formule équipe est fermée (`FORMULE_EQUIPE_OUVERTE`) : rien ne la
 * mentionne ici, et rien n'invite à devenir inventoriste — on recruterait pour
 * un service qu'on ne vend pas.
 */
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { euros } from '@/lib/offres'
import { REGLAGES, TRANCHES_ARTICLES, chaine } from '@/lib/prixOnDemand'

function Coche() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="var(--accent-2)" strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 12 9.5 17.5 20 6.5" />
    </svg>
  )
}

export function PageOnDemand() {
  const plusPetite = TRANCHES_ARTICLES.reduce((a, b) => (b.max < a.max ? b : a))
  const depart = chaine(plusPetite.max, 1, 'logiciel_seul').prixCents / 100

  return (
    <>
      <SiteHeader langue="fr" />
      <main className="container ald-page">
        <section className="ald-offre">
          {/* ⚠️ Le titre coupe en deux lignes, comme la maquette : « Ouvrez
              Quantinvo » puis « le temps d'un inventaire ». Le `<br>` ne tient
              que sur grand écran — sous 720 px la ligne se replie toute seule
              et la coupure forcée ferait un veuf. */}
          <h1>
            Ouvrez Quantinvo<br className="ald-coupe" />{' '}
            le temps d’un inventaire
          </h1>

          <p className="ald-promesse">
            Vos collaborateurs comptent sur leurs téléphones. Vous réservez le
            nombre d’appareils dont vous avez besoin, pour une semaine.
          </p>

          <ul className="ald-points">
            <li><Coche />Comptage, audit en seconde passe, rapport d’écarts</li>
            <li><Coche />{REGLAGES.fenetreJours === 7 ? 'Une semaine d’accès' : `${REGLAGES.fenetreJours} jours d’accès`}</li>
            {/* ⚠️ Formule de Julien (28 septembre 2026), en remplacement de
                « Partout en France, et même pour ce soir » : celle-là était un
                argument CONTRE la formule équipe, qui n'est plus sur la page,
                et personne ne s'attend à ce qu'un logiciel s'arrête à Lyon. */}
            <li><Coche />Un inventaire en autonomie et à votre rythme</li>
          </ul>

          <div className="ald-action">
            <Link href="/reserver?formule=logiciel" className="btn btn-primary">
              Réserver
            </Link>
            <span className="ald-depart">
              À partir de <b>{euros(depart)}</b>
            </span>
          </div>
        </section>
      </main>
      <SiteFooter langue="fr" />
    </>
  )
}
