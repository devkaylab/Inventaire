import { Redirect, router, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { ActivityIndicator, View } from 'react-native'
import { useTheme } from '@/lib/theme'
import { Font } from '@/constants/ink'
import { HeaderActions } from '@/components/HeaderActions'

export default function SupervisorLayout() {
  const { profile, loading } = useAuth()
  const theme = useTheme()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    )
  }

  if (!profile || profile.role !== 'supervisor') {
    return <Redirect href="/login" />
  }

  const headerBase = {
    headerStyle: { backgroundColor: theme.headerBg },
    headerTintColor: theme.headerText,
    headerTitleStyle: { fontFamily: Font.bold, color: theme.headerText },
    contentStyle: { backgroundColor: theme.background },
    // iOS reprend par défaut le titre de l'écran précédent — « Mon compte »,
    // « Session »… Un seul mot, toujours le même, se lit plus vite qu'un
    // libellé qui change à chaque écran, et ne risque pas d'être tronqué.
    headerBackTitle: 'Retour',
  }

  const actionsRight = () => <HeaderActions />
  const actionsProfileRight = () => (
    <HeaderActions onProfile={() => router.push('/(compte)/account')} />
  )

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Sessions', ...headerBase, headerRight: actionsProfileRight }} />
      <Stack.Screen name="new-session" options={{ title: 'Nouvelle session', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/index" options={{ title: 'Session', ...headerBase, headerRight: actionsProfileRight }} />
      <Stack.Screen name="[sessionId]/invite" options={{ title: 'Inviter une personne', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/import" options={{ title: 'Importer les données', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/zones" options={{ title: 'Zones & balises', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/scan" options={{ title: 'Comptage', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/audits" options={{ title: 'Audits & écarts', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/results" options={{ title: 'Résultats', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/missing" options={{ title: 'Balises manquantes', ...headerBase, headerRight: actionsRight }} />
      <Stack.Screen name="[sessionId]/pending" options={{ title: "Balises en attente", ...headerBase, headerRight: actionsRight }} />
    </Stack>
  )
}
