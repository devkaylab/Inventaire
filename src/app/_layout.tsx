import { useCallback, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
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
import { AuthProvider, useAuth } from '@/lib/auth'
import { useNotificationRouting } from '@/lib/push'
import { ThemeProvider } from '@/lib/theme'
import { SplashAnimation } from '@/components/SplashAnimation'
import { OfflineTopBanner } from '@/components/OfflineTopBanner'
import { PorteBienvenue } from '@/components/PorteBienvenue'

// Hold the native splash until fonts are ready; our animated splash takes over from there.
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
})

/**
 * Toucher « Nouvel inventaire » ouvrait l'accueil : rien n'écoutait la
 * réponse aux notifications. Le branchement vit ici, sous AuthProvider —
 * c'est le seul endroit monté en permanence qui connaisse le rôle, et le rôle
 * décide de la pile à ouvrir.
 */
function RoutageNotifications() {
  const { profile } = useAuth()
  useNotificationRouting(profile?.role)
  return null
}

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
          {/* Racine des gestes : sans elle, le balayage d'une tuile
              d'inventaire ne recevrait rien. Elle doit envelopper toute
              l'application, pas seulement l'écran concerné. */}
          <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
            {/* Header bar is near-black in both themes → light status bar text */}
            <StatusBar style="light" />
            {/* Au-dessus de la pile : le bandeau doit coiffer l'en-tête de
                chaque écran, et rester visible quelle que soit la page. */}
            <OfflineTopBanner />
            <RoutageNotifications />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
              <Stack.Screen name="company-setup" />
              <Stack.Screen name="(compte)" />
              <Stack.Screen name="(supervisor)" />
              <Stack.Screen name="(employee)" />
            </Stack>
            {/* Au-dessus de la pile, sous le splash : l'écran de bienvenue
                couvre l'atterrissage le temps d'être lu, une fois par
                appareil et par compte. */}
            <PorteBienvenue />
            {showSplash && <SplashAnimation onFinish={() => setShowSplash(false)} />}
          </GestureHandlerRootView>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
