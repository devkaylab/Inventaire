import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { ActivityIndicator, View } from 'react-native'
import { Colors } from '@/constants/colors'

export default function SupervisorLayout() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (!profile || profile.role !== 'supervisor') {
    return <Redirect href="/login" />
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Sessions', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } }} />
      <Stack.Screen name="new-session" options={{ title: 'Nouvelle session', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff' }} />
      <Stack.Screen name="[sessionId]/index" options={{ title: 'Session', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff' }} />
      <Stack.Screen name="[sessionId]/import" options={{ title: 'Importer les données', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff' }} />
      <Stack.Screen name="[sessionId]/scan" options={{ title: 'Comptage', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff' }} />
      <Stack.Screen name="[sessionId]/audits" options={{ title: 'Audits & écarts', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff' }} />
      <Stack.Screen name="[sessionId]/results" options={{ title: 'Résultats', headerStyle: { backgroundColor: Colors.primary }, headerTintColor: '#fff' }} />
    </Stack>
  )
}
