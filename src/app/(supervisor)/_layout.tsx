import { useEffect, useRef } from 'react'
import { Redirect, router, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { ActivityIndicator, View } from 'react-native'
import { useTheme } from '@/lib/theme'
import { Font } from '@/constants/ink'
import { HelpModal, useHelpModal } from '@/components/HelpModal'
import { HeaderActions } from '@/components/HeaderActions'
import { hasSeenHelp } from '@/lib/firstRun'

export default function SupervisorLayout() {
  const { profile, loading } = useAuth()
  const theme = useTheme()
  const help = useHelpModal()
  const checkedFirstTime = useRef(false)

  // Auto-open the tutorial on first ever login (any role)
  useEffect(() => {
    if (checkedFirstTime.current) return
    if (loading || !profile) return
    checkedFirstTime.current = true
    hasSeenHelp().then((seen) => {
      if (!seen) help.openFirstTime()
    })
  }, [loading, profile, help])

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
  }

  const helpRight = () => <HeaderActions onHelp={help.open} />
  const helpProfileRight = () => (
    <HeaderActions onHelp={help.open} onProfile={() => router.push('/(supervisor)/profile')} />
  )

  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Sessions', ...headerBase, headerRight: helpProfileRight }} />
        <Stack.Screen name="profile" options={{ title: 'Mon profil', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="new-member" options={{ title: 'Ajouter un membre', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="new-session" options={{ title: 'Nouvelle session', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/index" options={{ title: 'Session', ...headerBase, headerRight: helpProfileRight }} />
        <Stack.Screen name="[sessionId]/invite" options={{ title: 'Inviter une personne', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/import" options={{ title: 'Importer les données', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/zones" options={{ title: 'Zones & balises', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/scan" options={{ title: 'Comptage', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/audits" options={{ title: 'Audits & écarts', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/results" options={{ title: 'Résultats', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/missing" options={{ title: 'Balises manquantes', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/pending" options={{ title: "Balises en attente", ...headerBase, headerRight: helpRight }} />
      </Stack>
      <HelpModal visible={help.visible} onClose={help.close} isFirstTime={help.isFirstTime} />
    </>
  )
}
