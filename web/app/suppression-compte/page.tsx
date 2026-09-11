import { SuppressionCompte } from '@/components/vitrine/SuppressionCompte'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.suppression('fr')

export default function Page() {
  return <SuppressionCompte langue="fr" />
}
