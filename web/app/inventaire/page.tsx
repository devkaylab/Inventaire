import { Inventaire } from '@/components/vitrine/Inventaire'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.inventaire('fr')

export default function Page() {
  return <Inventaire langue="fr" />
}
