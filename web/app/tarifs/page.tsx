import { Tarifs } from '@/components/vitrine/Tarifs'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.tarifs('fr')

export default function Page() {
  return <Tarifs langue="fr" />
}
