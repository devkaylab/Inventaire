import type { Metadata } from 'next'
import { PageDevenirInventoriste } from '@/components/vitrine/PageDevenirInventoriste'

/**
 * ⚠️ En français seul, hors du plan du site et `noindex`, comme les deux autres
 * pages On-Demand : on ne recrute pas d'inventoristes tant qu'il n'y a pas de
 * missions à leur proposer. Le vivier se constitue quand la première mission
 * est vendue, pas avant (`docs/entreprise/on-demand/07-par-ou-on-commence.md`).
 */
export const metadata: Metadata = {
  title: 'Réaliser des inventaires',
  description:
    'Un profil vérifié une fois, des missions près de chez vous, une rémunération annoncée avant d’accepter.',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <PageDevenirInventoriste />
}
