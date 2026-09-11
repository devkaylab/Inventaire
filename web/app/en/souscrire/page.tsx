import { PageSouscrire } from '@/components/vitrine/PageSouscrire'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.souscrire('en')

export default function Page() {
  return <PageSouscrire />
}
