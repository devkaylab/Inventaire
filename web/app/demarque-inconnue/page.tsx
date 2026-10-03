import { DemarqueInconnue } from '@/components/vitrine/DemarqueInconnue'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.demarqueInconnue('fr')

export default function Page() {
  return <DemarqueInconnue langue="fr" />
}
