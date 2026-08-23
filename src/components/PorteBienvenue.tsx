/**
 * La porte : décide s'il faut montrer l'écran de bienvenue, et se retire.
 *
 * Posée en surcouche depuis le layout racine plutôt qu'en route à part : le
 * routage par rôle existe déjà et fonctionne, on ne s'y insère pas. Quand la
 * porte se referme, la personne est exactement là où l'app l'avait menée.
 *
 * Trois conditions pour l'ouvrir — et `pret` compte autant que les autres :
 * sans lui, l'écran clignoterait à chaque lancement le temps de lire le
 * stockage local.
 */
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { useRepere } from '@/lib/reperes'
import { getMyAssignedStores, getMyCompany } from '@/lib/queries'
import { Bienvenue, type RoleBienvenue } from '@/components/Bienvenue'

export function PorteBienvenue() {
  const { profile, mfaRequired } = useAuth()
  const { aVoir, marquerVu } = useRepere('bienvenue', profile?.id)

  // On ne demande le contexte que si l'écran va s'afficher : inutile de faire
  // deux requêtes à chaque lancement pour un écran vu une fois.
  const { data: magasins } = useQuery({
    queryKey: ['bienvenue-magasins'],
    queryFn: getMyAssignedStores,
    enabled: aVoir,
  })
  const { data: entreprise } = useQuery({
    queryKey: ['bienvenue-entreprise'],
    queryFn: getMyCompany,
    enabled: aVoir,
  })

  if (!profile || mfaRequired || !aVoir) return null

  const role: RoleBienvenue = profile.is_company_admin
    ? 'company_admin'
    : profile.role === 'supervisor' ? 'supervisor' : 'employee'

  // Un administrateur d'entreprise a tous les magasins de son entreprise :
  // en nommer un serait arbitraire. C'est l'entreprise qui le situe.
  const magasin = role === 'company_admin'
    ? null
    : (magasins?.length === 1 ? magasins[0].name : null)

  return (
    <Bienvenue
      prenom={profile.first_name?.trim() || null}
      role={role}
      magasin={magasin}
      entreprise={entreprise?.name ?? null}
      onCommencer={() => {
        marquerVu()
        // Seul l'administrateur part ailleurs que sur son atterrissage : ses
        // magasins sont sa première action, pas un inventaire.
        if (role === 'company_admin') router.push('/(compte)/stores')
      }}
      onPlusTard={marquerVu}
    />
  )
}
