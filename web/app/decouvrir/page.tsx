import { Decouvrir } from '@/components/vitrine/Decouvrir'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.decouvrir('fr')

export default function Page() {
  return <Decouvrir langue="fr" />
}
