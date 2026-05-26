import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { ActivityIndicator, View } from 'react-native'
import { Colors } from '@/constants/colors'

export default function EmployeeLayout() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (!profile) return <Redirect href="/login" />

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Rejoindre une session', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } }} />
      <Stack.Screen name="[sessionId]/index" options={{ title: 'Ma progression', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff' }} />
      <Stack.Screen name="[sessionId]/scan" options={{ title: 'Scanner', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff' }} />
    </Stack>
  )
}
