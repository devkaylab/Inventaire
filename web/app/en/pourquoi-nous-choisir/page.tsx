import { Pourquoi } from '@/components/vitrine/Pourquoi'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.pourquoi('en')

export default function Page() {
  return <Pourquoi langue="en" />
}
