import { InventaireTournant } from '@/components/vitrine/InventaireTournant'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.inventaireTournant('fr')

export default function Page() {
  return <InventaireTournant langue="fr" />
}
