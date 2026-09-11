import { Inventaire } from '@/components/vitrine/Inventaire'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.inventaire('en')

export default function Page() {
  return <Inventaire langue="en" />
}
