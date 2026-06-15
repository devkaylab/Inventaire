import AsyncStorage from '@react-native-async-storage/async-storage'

// Bump the suffix to re-show the tutorial to all users after a major redesign.
const HELP_SEEN_KEY = 'help.seenWelcome.v1'

export async function hasSeenHelp(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(HELP_SEEN_KEY)
    return v === '1'
  } catch {
    return false
  }
}

export async function markHelpSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(HELP_SEEN_KEY, '1')
  } catch {
    // Non-critical — worst case the tutorial pops once more
  }
}
