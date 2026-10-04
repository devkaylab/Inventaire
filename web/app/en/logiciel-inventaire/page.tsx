import { LogicielInventaire } from '@/components/vitrine/LogicielInventaire'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.logicielInventaire('en')

export default function Page() {
  return <LogicielInventaire langue="en" />
}
