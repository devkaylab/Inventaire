import type { Metadata } from 'next'
import { PageOnDemand } from '@/components/vitrine/PageOnDemand'

/**
 * ⚠️ PAS DE JUMELLE SOUS `/en`, et donc pas dans `CHEMINS_VITRINE` : l'équipe
 * ne se déplace qu'à Paris et en Île-de-France, à Lyon et à Lille.
 * `lienVitrine` laisse l'adresse telle quelle quand elle n'est pas dans cette
 * liste — un visiteur anglophone arrive donc sur la page française plutôt que
 * sur un 404. La formule « logiciel seul », elle, marche partout : le jour où
 * on la vend hors de France, cette page méritera sa jumelle.
 *
 * ⚠️ `noindex` TANT QUE LE PRODUIT N'EST PAS OUVERT, comme `/reserver` : faire
 * venir des gens par une recherche avant de savoir servir une seule mission,
 * c'est les décevoir.
 */
export const metadata: Metadata = {
  title: 'On-demand',
  description:
        // ⚠️ « ou notre équipe chez vous » est parti (4 octobre 2026) : la formule
    // équipe est fermée, et cette phrase promettait un service qu'on ne rend
    // pas. Une description de page se lit dans un résultat de recherche et dans
    // un aperçu de partage — c'est une promesse publique.
    'Un inventaire le jour où vous en avez besoin : Quantinvo à disposition le temps d’un comptage, un prix ferme, sans devis.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <PageOnDemand />
}
