import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { SplashAnimation } from '@/components/SplashAnimation'

// Hold the native splash until fonts are ready; our animated splash takes over from there.
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
})

export default function RootLayout() {
  // Load Inter; render nothing until ready so we never flash the system font.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  })
  const [showSplash, setShowSplash] = useState(true)

  // Reveal our JS content (and the animated splash overlay) by hiding the native splash.
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
            {/* Header bar is near-black in both themes → light status bar text */}
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
              <Stack.Screen name="(supervisor)" />
              <Stack.Screen name="(employee)" />
            </Stack>
            {showSplash && <SplashAnimation onFinish={() => setShowSplash(false)} />}
          </View>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
