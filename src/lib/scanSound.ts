import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import * as Haptics from 'expo-haptics'

type PlayerEntry = { player: ReturnType<typeof createAudioPlayer> }

let beep: PlayerEntry | null = null
let error: PlayerEntry | null = null

export async function loadScanSound() {
  try {
    // Le bip est un retour de travail, pas un son d'agrément : une douchette
    // de magasin bipe, silencieux ou non. Avec `false`, un téléphone en
    // silencieux ne confirmait plus rien à l'oreille — et en rayon bruyant,
    // l'haptique seule passe inaperçue.
    //
    // `mixWithOthers` pour ne pas couper la musique ou le podcast de qui
    // compte pendant des heures : notre bip se superpose, il n'exproprie pas.
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' })
    beep  = { player: createAudioPlayer(require('../../assets/sounds/beep.wav')) }
    error = { player: createAudioPlayer(require('../../assets/sounds/error.wav')) }
  } catch {
    // Non-critical — silent if audio unavailable
  }
}

async function playEntry(entry: PlayerEntry | null) {
  try {
    if (!entry) return
    await entry.player.seekTo(0)
    entry.player.play()
  } catch {
    // Ignore playback errors
  }
}

export function playScanSound() {
  playEntry(beep)
  // Tactile confirmation even when device is muted
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

export function playErrorSound() {
  playEntry(error)
  // Distinct error vibration pattern
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
}

export function unloadScanSound() {
  try { beep?.player.remove() } catch {}
  try { error?.player.remove() } catch {}
  beep = null
  error = null
}
