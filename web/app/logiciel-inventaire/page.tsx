import { LogicielInventaire } from '@/components/vitrine/LogicielInventaire'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.logicielInventaire('fr')

export default function Page() {
  return <LogicielInventaire langue="fr" />
}
