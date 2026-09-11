import { PageOuvrir } from '@/components/vitrine/PageOuvrir'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.open('en')

export default function Page() {
  return <PageOuvrir />
}
