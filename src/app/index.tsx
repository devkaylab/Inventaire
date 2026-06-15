import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'

export default function Index() {
  const { session, profile, loading } = useAuth()
  const theme = useTheme()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    )
  }

  if (!session) return <Redirect href="/login" />
  if (!profile) return <Redirect href="/login" />

  if (profile.role === 'supervisor') return <Redirect href="/(supervisor)/" />
  return <Redirect href="/(employee)/" />
}
