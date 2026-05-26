import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/lib/auth'
import { Colors } from '@/constants/colors'

export default function Index() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (!session) return <Redirect href="/login" />
  if (!profile) return <Redirect href="/login" />

  if (profile.role === 'supervisor') return <Redirect href="/(supervisor)/" />
  return <Redirect href="/(employee)/" />
}
