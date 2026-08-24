/**
 * La porte : décide s'il faut montrer l'écran de bienvenue, et se retire.
 *
 * Posée en surcouche depuis le layout racine plutôt qu'en route à part : le
 * routage par rôle existe déjà et fonctionne, on ne s'y insère pas. Quand la
 * porte se referme, la personne est exactement là où l'app l'avait menée.
 *
 * ⚠️ **Le bouton doit mener quelque part, TOUJOURS.** Deux fois le contraire
 * a été livré :
 *
 * - 23 août 2026 — « Préparer mon premier inventaire » se contentait de
 *   refermer la porte, donc retombait sur la liste sans rien préparer. Le
 *   libellé ET la destination se calculent depuis l'état réel du compte
 *   depuis ce jour-là.
 * - 24 août 2026 — il restait deux branches à action vide (« Voir mes
 *   inventaires », « Commencer »). Au **premier lancement** ça ne se voyait
 *   pas : l'application avait déjà déposé la personne sur son accueil, et
 *   refermer la porte suffisait. Mais « Revoir les repères » rejoue la porte
 *   **depuis Mon compte** — et là, rien ne ramenait à l'accueil. Constat de
 *   Julien : « Voir mes inventaires mène juste à l'écran du profil ».
 *
 * D'où la règle : aucune branche ne rend une fonction vide. Un test de garde
 * le vérifie. `replace` et non `push`, pour ne pas empiler un second accueil
 * au-dessus de Mon compte ni laisser une flèche de retour qui y revient.
 */
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { useRepere } from '@/lib/reperes'
import { getMyAssignedStores, getMyCompany, getSessions } from '@/lib/queries'
import { Bienvenue, type RoleBienvenue } from '@/components/Bienvenue'

export function PorteBienvenue() {
  const { profile, mfaRequired } = useAuth()
  const { aVoir, marquerVu } = useRepere('bienvenue', profile?.id)

  // On ne demande le contexte que si l'écran va s'afficher : inutile de faire
  // ces requêtes à chaque lancement pour un écran vu une fois.
  const magasinsQ = useQuery({ queryKey: ['bienvenue-magasins'], queryFn: getMyAssignedStores, enabled: aVoir })
  const entrepriseQ = useQuery({ queryKey: ['bienvenue-entreprise'], queryFn: getMyCompany, enabled: aVoir })
  const sessionsQ = useQuery({ queryKey: ['bienvenue-sessions'], queryFn: getSessions, enabled: aVoir })

  if (!profile || mfaRequired || !aVoir) return null

  // ⚠️ On attend les trois réponses avant d'afficher. Sans cela, l'écran
  // s'ouvrait sur « Vous supervisez un magasin. » puis basculait sur le vrai
  // nom une fraction de seconde plus tard — et le bouton changeait de
  // libellé sous le doigt.
  if (magasinsQ.isPending || entrepriseQ.isPending || sessionsQ.isPending) return null

  const role: RoleBienvenue = profile.is_company_admin
    ? 'company_admin'
    : profile.role === 'supervisor' ? 'supervisor' : 'employee'

  // Un administrateur d'entreprise a tous les magasins de son entreprise :
  // en nommer un serait arbitraire. C'est l'entreprise qui le situe.
  const magasins = magasinsQ.data ?? []
  const magasin = role === 'company_admin' ? null : (magasins.length === 1 ? magasins[0].name : null)

  const sessions = sessionsQ.data ?? []
  const miennes = sessions.filter(s => s.created_by === profile.id)

  /** Le libellé dit ce qui va se passer, et le geste le fait. */
  const { libelle, aller } = (() => {
    if (role === 'company_admin') {
      return { libelle: 'Voir mes magasins', aller: () => router.push('/(compte)/stores') }
    }
    if (role === 'supervisor') {
      return miennes.length === 0
        ? { libelle: 'Préparer mon premier inventaire', aller: () => router.push('/(supervisor)/new-session') }
        : { libelle: 'Voir mes inventaires', aller: () => router.replace('/(supervisor)/') }
    }
    // Un compteur qui n'a qu'un inventaire n'a rien à choisir : on l'ouvre.
    return sessions.length === 1
      ? { libelle: 'Ouvrir mon inventaire', aller: () => router.push(`/(employee)/${sessions[0].id}`) }
      : { libelle: 'Commencer', aller: () => router.replace('/(employee)/') }
  })()

  return (
    <Bienvenue
      prenom={profile.first_name?.trim() || null}
      role={role}
      magasin={magasin}
      entreprise={entrepriseQ.data?.name ?? null}
      action={libelle}
      onCommencer={() => { marquerVu(); aller() }}
      onPlusTard={marquerVu}
    />
  )
}
