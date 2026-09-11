import { Superviseur } from '@/components/vitrine/Superviseur'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.superviseur('fr')

export default function Page() {
  return <Superviseur langue="fr" />
}
