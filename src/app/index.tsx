import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { monEspace } from '@/lib/onDemand'

export default function Index() {
  const { session, profile, loading, mfaRequired } = useAuth()
  const theme = useTheme()

  /**
   * ⚠️ **UN INVENTORISTE EST `employee` SANS ENTREPRISE**, donc indiscernable
   * d'un compteur par le seul profil : sans cette lecture, il atterrirait dans
   * l'espace du compteur, qui ne sait rien de ses missions.
   *
   * ⚠️ **ET UNE LECTURE QUI ÉCHOUE NE BLOQUE PERSONNE.** Tant que les
   * migrations On-Demand ne sont pas appliquées, cette fonction n'existe pas :
   * `retry: false` et le repli sur le chemin d'avant. Une erreur ici fermerait
   * l'application à tout le monde, pour une porte que presque personne
   * n'emprunte.
   */
  const { data: espace, isLoading: espaceCharge } = useQuery({
    queryKey: ['espace-inventoriste'],
    queryFn: monEspace,
    enabled: Boolean(session && profile && !mfaRequired && !profile.company_id),
    retry: false,
  })

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    )
  }

  if (!session) return <Redirect href="/login" />
  if (!profile) return <Redirect href="/login" />

  // Session ouverte au mot de passe seul alors que le compte a un second
  // facteur : il manque le code. Sans ce renvoi, fermer l'app entre le mot de
  // passe et le code laisserait entrer à moitié authentifié.
  if (mfaRequired) return <Redirect href="/login" />

  // ⚠️ AVANT LA BRANCHE DU COMPTEUR, ET APRÈS CELLE DU SUPERVISEUR : quelqu'un
  // qui appartient à une entreprise n'est pas inventoriste indépendant, et la
  // requête ci-dessus ne part même pas dans ce cas.
  if (!profile.company_id && espaceCharge) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    )
  }
  if (espace?.profil) return <Redirect href="/(provider)/" />

  if (profile.role === 'supervisor') {
    // Un superviseur doit appartenir à une entreprise avant d'accéder à ses
    // inventaires (cloisonnement multi-entreprises).
    if (!profile.company_id) return <Redirect href="/company-setup" />
    return <Redirect href="/(supervisor)/" />
  }
  return <Redirect href="/(employee)/" />
}
