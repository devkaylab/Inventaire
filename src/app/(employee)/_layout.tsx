import { Redirect, router, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { ActivityIndicator, View } from 'react-native'
import { useTheme } from '@/lib/theme'
import { Font } from '@/constants/ink'
import { HeaderActions } from '@/components/HeaderActions'

export default function EmployeeLayout() {
  const { profile, loading } = useAuth()
  const theme = useTheme()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    )
  }

  if (!profile) return <Redirect href="/login" />

  const headerBase = {
    headerStyle: { backgroundColor: theme.headerBg },
    headerTintColor: theme.headerText,
    headerTitleStyle: { fontFamily: Font.bold, color: theme.headerText },
    contentStyle: { backgroundColor: theme.background },
  }

  const actionsRight = () => <HeaderActions />
  // Le compteur avait « Déconnexion » posé en haut de son écran d'accueil et
  // rien d'autre. Il a le même bouton profil que le superviseur : son compte
  // se gère au même endroit, avec les mêmes gestes.
  const actionsProfileRight = () => (
    <HeaderActions onProfile={() => router.push('/(compte)/account')} />
  )

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Rejoindre une session', ...headerBase, headerRight: actionsProfileRight }} />
      <Stack.Screen name="[sessionId]/index" options={{ title: 'Ma progression', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/scan" options={{ title: 'Comptage', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/counted" options={{ title: "Balises comptées", ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/pending" options={{ title: "Balises en attente", ...headerBase, headerRight: actionsRight }} />
    </Stack>
  )
}
