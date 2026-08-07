import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { registerPushToken } from '@/lib/queries'

// Afficher les notifications même quand l'app est au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/**
 * Demande la permission de notification, récupère le jeton Expo push et
 * l'enregistre en base pour l'utilisateur courant. Best-effort : n'interrompt
 * jamais la connexion en cas d'échec (simulateur, permission refusée, etc.).
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) return // pas de push sur simulateur

    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      status = req.status
    }
    if (status !== 'granted') return

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Général',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )
    if (tokenResp.data) await registerPushToken(tokenResp.data, Platform.OS)
  } catch {
    // best-effort
  }
}
