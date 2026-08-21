import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { Font } from '@/constants/ink'
import { HeaderActions } from '@/components/HeaderActions'

/**
 * Les écrans du compte, communs à tous les rôles.
 *
 * Ils vivaient sous `(supervisor)`, donc un compteur ne pouvait pas les
 * atteindre : la garde de ce groupe renvoie tout ce qui n'est pas superviseur
 * vers la connexion. Or changer son mot de passe ou récupérer ses données ne
 * dépend pas du rôle — c'est le compte de la personne. Le site n'a qu'une
 * page « Mon compte » pour tout le monde ; l'app fait pareil.
 *
 * Seule condition d'entrée : un profil, et une session complète. Un compte
 * resté au mot de passe seul alors qu'il a un second facteur n'entre pas —
 * sans quoi on pourrait retirer sa double authentification à moitié
 * authentifié.
 */
export default function CompteLayout() {
  const { profile, loading, mfaRequired } = useAuth()
  const theme = useTheme()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    )
  }

  if (!profile || mfaRequired) return <Redirect href="/login" />

  const headerBase = {
    headerStyle: { backgroundColor: theme.headerBg },
    headerTintColor: theme.headerText,
    headerTitleStyle: { fontFamily: Font.bold, color: theme.headerText },
    contentStyle: { backgroundColor: theme.background },
  }

  const actionsRight = () => <HeaderActions />

  return (
    <Stack>
      <Stack.Screen name="account" options={{ title: 'Mon compte', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="password" options={{ title: 'Mot de passe', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="mfa" options={{ title: 'Double authentification', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="my-data" options={{ title: 'Mes données', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="name" options={{ title: 'Mon nom', ...headerBase, headerRight: actionsRight }} />
    </Stack>
  )
}
