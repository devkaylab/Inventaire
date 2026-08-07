import { Alert, Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { registerPushToken } from '@/lib/queries'

// Identifiant du projet EAS (issu de `eas init`, aussi dans app.json).
// Repli en dur : sur un projet iOS versionné (sans prebuild récent), la config
// embarquée peut être antérieure à `eas init` et ne pas contenir ce projectId.
const EAS_PROJECT_ID = 'a362e9eb-3972-47d4-8761-b10c93388c58'

// Mettre à true pour afficher les erreurs de configuration push à l'écran (debug).
const PUSH_DEBUG = false

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
 * l'enregistre en base pour l'utilisateur courant.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) {
      if (PUSH_DEBUG) Alert.alert('Push', 'Les notifications ne fonctionnent que sur un vrai appareil (pas sur simulateur).')
      return
    }

    const { status: existing } = await Notifications.getPermissionsAsync()
    let status = existing
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync()
      status = req.status
    }
    if (status !== 'granted') {
      if (PUSH_DEBUG) Alert.alert('Push', 'Autorisation des notifications refusée. Activez-les dans Réglages > Quantinvo > Notifications.')
      return
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Général',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      EAS_PROJECT_ID

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId })
    if (tokenResp.data) {
      await registerPushToken(tokenResp.data, Platform.OS)
    } else if (PUSH_DEBUG) {
      Alert.alert('Push', 'Aucun jeton renvoyé par Expo.')
    }
  } catch (e) {
    if (PUSH_DEBUG) {
      Alert.alert('Push — erreur', e instanceof Error ? e.message : String(e))
    }
  }
}
