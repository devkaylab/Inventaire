import { PageInscription } from '@/components/vitrine/PageInscription'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.inscription('fr')

export default function Page() {
  return <PageInscription />
}
