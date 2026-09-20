import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { Font } from '@/constants/ink'
import { contenuColonne } from '@/constants/layout'
import { monEspace } from '@/lib/onDemand'

/**
 * L'espace de l'inventoriste indépendant.
 *
 * ⚠️ **IL N'A PAS D'ENTREPRISE, ET C'EST LA RAISON D'ÊTRE DE CE GROUPE.**
 * `(supervisor)` exige `role === 'supervisor'`, `(employee)` suppose qu'on
 * compte pour son employeur. Un inventoriste est `employee` SANS
 * `company_id` : son appartenance à un inventaire ne vient pas de son profil
 * mais de `mission_access`, une mission à la fois.
 *
 * ⚠️ **ET LA PORTE EST L'EXISTENCE D'UN PROFIL, PAS UN RÔLE.** Demander
 * `role === 'provider'` aurait voulu dire écrire un rôle de plus dans
 * `profiles`, donc décider de ce que quelqu'un a le droit de faire au moment
 * de créer son compte — exactement ce que le produit refuse de faire.
 */
export default function ProviderLayout() {
  const { profile, loading } = useAuth()
  const theme = useTheme()
  const { data: espace, isLoading } = useQuery({
    queryKey: ['espace-inventoriste'],
    queryFn: monEspace,
    enabled: Boolean(profile),
  })

  if (loading || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    )
  }

  if (!profile) return <Redirect href="/login" />
  // Pas de profil inventoriste : ce groupe n'est pas le sien. On ne l'enferme
  // pas ici, on le renvoie à la racine qui saura où il va.
  if (espace && !espace.profil) return <Redirect href="/" />

  const entete = {
    headerStyle: { backgroundColor: theme.headerBg },
    headerTintColor: theme.headerText,
    headerTitleStyle: { fontFamily: Font.bold, color: theme.headerText },
    contentStyle: { backgroundColor: theme.background },
    headerBackButtonDisplayMode: 'minimal' as const,
  }

  return (
    <Stack screenOptions={{ contentStyle: contenuColonne }}>
      <Stack.Screen name="index" options={{ title: 'Missions', ...entete }} />
      <Stack.Screen name="[missionId]" options={{ title: 'La mission', ...entete }} />
      <Stack.Screen name="planning" options={{ title: 'Mes disponibilités', ...entete }} />
      <Stack.Screen name="revenus" options={{ title: 'Mes revenus', ...entete }} />
      <Stack.Screen name="profil" options={{ title: 'Mon profil', ...entete }} />
    </Stack>
  )
}
