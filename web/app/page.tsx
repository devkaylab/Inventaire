import { Accueil } from '@/components/vitrine/Accueil'
import { META_VITRINE } from '@/lib/metaVitrineTextes'

export const metadata = META_VITRINE.accueil('fr')

export default function Home() {
  return <Accueil langue="fr" />
}
