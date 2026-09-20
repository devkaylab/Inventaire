import type { Metadata } from 'next'
import { PageReserver } from '@/components/vitrine/PageReserver'

/**
 * ⚠️ PAS DE JUMELLE SOUS `/en`, ET PAS DANS `CHEMINS_VITRINE`. On-Demand ne se
 * vend qu'à Paris et en Île-de-France, à Lyon et à Lille : une page anglaise
 * promettrait un service qu'on ne rend pas. Même traitement que `/devis`.
 *
 * ⚠️ `noindex` TANT QUE LE PRODUIT N'EST PAS OUVERT. Une page de réservation
 * indexée avant qu'on sache servir une seule mission ferait venir des gens
 * qu'on décevrait — et le lancement de Quantinvo OS passe d'abord
 * (`docs/entreprise/on-demand/07-par-ou-on-commence.md`).
 */
export const metadata: Metadata = {
  title: 'Réserver un inventaire',
  description:
    'Trois questions, un prix ferme, une équipe d’inventoristes chez vous. Sans devis.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <PageReserver />
}
