import { useEffect, useRef } from 'react'
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { ActivityIndicator, View } from 'react-native'
import { useTheme } from '@/lib/theme'
import { Font } from '@/constants/ink'
import { HelpModal, useHelpModal } from '@/components/HelpModal'
import { HeaderActions } from '@/components/HeaderActions'
import { hasSeenHelp } from '@/lib/firstRun'

export default function EmployeeLayout() {
  const { profile, loading } = useAuth()
  const theme = useTheme()
  const help = useHelpModal()
  const checkedFirstTime = useRef(false)

  // Auto-open the tutorial on first ever login
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

  if (!profile) return <Redirect href="/login" />

  const headerBase = {
    headerStyle: { backgroundColor: theme.headerBg },
    headerTintColor: theme.headerText,
    headerTitleStyle: { fontFamily: Font.bold, color: theme.headerText },
    contentStyle: { backgroundColor: theme.background },
  }

  const helpRight = () => <HeaderActions onHelp={help.open} />

  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Rejoindre une session', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/index" options={{ title: 'Ma progression', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/scan" options={{ title: 'Comptage', ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/counted" options={{ title: "Balises comptées", ...headerBase, headerRight: helpRight }} />
        <Stack.Screen name="[sessionId]/pending" options={{ title: "Balises en attente", ...headerBase, headerRight: helpRight }} />
      </Stack>
      <HelpModal visible={help.visible} onClose={help.close} isFirstTime={help.isFirstTime} />
    </>
  )
}
