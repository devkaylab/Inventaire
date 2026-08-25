import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { registerPushToken } from '@/lib/queries'
import { signaler } from '@/lib/dialogue'

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
      if (PUSH_DEBUG) signaler.info('Push', 'Les notifications ne fonctionnent que sur un vrai appareil (pas sur simulateur).')
      return
    }

    const perm = await Notifications.getPermissionsAsync()
    let status = perm.status
    if (status !== 'granted') {
      // Même règle que la caméra : après un refus définitif, iOS ne rouvre
      // plus la boîte. Redemander serait inerte — et masquerait le fait que
      // seul un passage par les Réglages peut débloquer.
      if (!perm.canAskAgain) return
      const req = await Notifications.requestPermissionsAsync()
      status = req.status
    }
    if (status !== 'granted') {
      if (PUSH_DEBUG) signaler.info('Push', 'Autorisation des notifications refusée. Activez-les dans Réglages > Quantinvo > Notifications.')
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
      signaler.info('Push', 'Aucun jeton renvoyé par Expo.')
    }
  } catch (e) {
    if (PUSH_DEBUG) {
      signaler.erreur('Push — erreur', e instanceof Error ? e.message : String(e))
    }
  }
}

/**
 * Demande les notifications au moment où elles ont un objet : l'ouverture
 * d'un inventaire. Avant, la boîte système partait juste après la connexion,
 * sans explication et avant le moindre écran.
 *
 * L'appel est sans effet s'il a déjà eu lieu, si l'autorisation est acquise,
 * ou si le système ne veut plus poser la question.
 */
export function useNotificationsSurInventaire() {
  useEffect(() => {
    void registerForPushNotifications()
  }, [])
}

/**
 * Toucher la notification « Nouvel inventaire » ouvrait l'accueil : rien
 * n'écoutait la réponse. `useLastNotificationResponse` couvre les deux cas —
 * l'app réveillée et l'app lancée depuis la notification.
 *
 * Le rôle décide de la pile : un compteur et un superviseur n'ouvrent pas le
 * même écran pour le même inventaire.
 */
export function useNotificationRouting(role: string | null | undefined) {
  const reponse = Notifications.useLastNotificationResponse()
  const dejaOuvert = useRef<string | null>(null)

  useEffect(() => {
    if (!role || !reponse) return
    const data = reponse.notification.request.content.data as { sessionId?: string } | undefined
    const sessionId = typeof data?.sessionId === 'string' ? data.sessionId : null
    if (!sessionId) return
    // Sans ce garde, revenir sur l'app rejouerait la dernière réponse et
    // rouvrirait l'inventaire alors qu'on venait d'en sortir.
    if (dejaOuvert.current === reponse.notification.request.identifier) return
    dejaOuvert.current = reponse.notification.request.identifier
    const groupe = role === 'supervisor' ? '(supervisor)' : '(employee)'
    router.push(`/${groupe}/${sessionId}` as never)
  }, [reponse, role])
}
