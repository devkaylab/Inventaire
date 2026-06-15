import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '@/lib/theme'
import { Font } from '@/constants/ink'
import { markHelpSeen } from '@/lib/firstRun'
import { WelcomeScreen } from './help/WelcomeScreen'
import { StepPager } from './help/StepPager'
import type { Role } from './help/tutorialData'

// ─── Modal ────────────────────────────────────────────────────────────────────

interface HelpModalProps {
  visible: boolean
  onClose: () => void
  isFirstTime?: boolean
}

type View_ = { kind: 'welcome' } | { kind: 'role'; role: Role }

export function HelpModal({ visible, onClose, isFirstTime = false }: HelpModalProps) {
  const theme = useTheme()
  const [view, setView] = useState<View_>({ kind: 'welcome' })

  // Reset to welcome each time the modal opens
  useEffect(() => {
    if (visible) setView({ kind: 'welcome' })
  }, [visible])

  function handleClose() {
    // Always mark as seen on close — applies to manual and first-time opens
    markHelpSeen()
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      {/* A Modal renders outside the navigation tree, so it loses the parent
          SafeAreaProvider → top inset falls back to 0 and the title slides under
          the Dynamic Island. Wrapping in its own provider recomputes the insets. */}
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
          {view.kind === 'welcome' ? (
            <WelcomeScreen
              isFirstTime={isFirstTime}
              onPickRole={(role) => setView({ kind: 'role', role })}
              onSkip={handleClose}
              onClose={handleClose}
            />
          ) : (
            /* StepPager has its own header row that includes the close button */
            <StepPager
              role={view.role}
              onComplete={handleClose}
              onClose={handleClose}
              onExitToWelcome={() => setView({ kind: 'welcome' })}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  )
}

// ─── Trigger button ───────────────────────────────────────────────────────────

export function HelpButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.helpBtn}>
      <Text style={styles.helpBtnText}>?</Text>
    </Pressable>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHelpModal() {
  const [visible, setVisible] = useState(false)
  const [isFirstTime, setIsFirstTime] = useState(false)
  return {
    visible,
    isFirstTime,
    open: () => { setIsFirstTime(false); setVisible(true) },
    openFirstTime: () => { setIsFirstTime(true); setVisible(true) },
    close: () => setVisible(false),
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  helpBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 4,
  },
  helpBtnText: { color: '#fff', fontSize: 16, fontFamily: Font.extrabold },
})
