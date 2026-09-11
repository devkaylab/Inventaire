import { PageOuvrir } from '@/components/vitrine/PageOuvrir'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.open('fr')

export default function Page() {
  return <PageOuvrir />
}
