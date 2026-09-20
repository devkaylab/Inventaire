import type { Metadata } from 'next'
import { PageALaDemande } from '@/components/vitrine/PageALaDemande'

/**
 * ⚠️ PAS DE JUMELLE SOUS `/en`, et donc pas dans `CHEMINS_VITRINE` : On-Demand
 * ne se vend qu'à Paris et en Île-de-France, à Lyon et à Lille. `lienVitrine`
 * laisse l'adresse telle quelle quand elle n'est pas dans cette liste — un
 * visiteur anglophone arrive donc sur la page française plutôt que sur un 404.
 *
 * ⚠️ `noindex` TANT QUE LE PRODUIT N'EST PAS OUVERT, comme `/reserver` : faire
 * venir des gens par une recherche avant de savoir servir une seule mission,
 * c'est les décevoir.
 */
export const metadata: Metadata = {
  title: 'Qui fait votre inventaire ?',
  description:
    'Vos équipes comptent avec notre logiciel, ou les nôtres comptent pour vous. Un prix ferme, sans devis.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <PageALaDemande />
}
