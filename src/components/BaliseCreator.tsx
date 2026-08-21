import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { exportBaliseSheet } from '@/lib/balises'
import type { BaliseSeries } from '@/lib/baliseSeries'
import { errorMessage } from '@/lib/errors'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { BaliseSheetModal } from './BaliseSheetModal'
import { GeneratingOverlay } from './GeneratingOverlay'

interface Props {
  /** Contexte : la phrase d'accroche et la troisième étape s'adaptent. */
  context: 'profile' | 'zones'
}

/**
 * Bloc « Créer des balises » : mode d'emploi en trois étapes + bouton qui
 * ouvre le formulaire (numérotation, premier numéro, nombre) puis imprime.
 * Réutilisé sur le profil et sur l'écran Zones d'un inventaire, pour que la
 * création des balises se trouve là où on en a besoin.
 */
export function BaliseCreator({ context }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [open, setOpen] = useState(false)

  const print = useMutation({
    mutationFn: (series: BaliseSeries) =>
      exportBaliseSheet(`${series.from}-${series.to}`, series.codes.map((code) => ({ code }))),
    onSuccess: (r) => { if (!r.shared) Alert.alert('PDF généré', `Le fichier ${r.filename} a été créé.`) },
    onError: (e) => Alert.alert('Erreur', errorMessage(e)),
  })

  const steps = [
    ['Imprimez', 'la planche sur des feuilles d’étiquettes autocollantes Avery L7160, à 100 % (taille réelle).'],
    ['Collez', 'les balises dans le magasin, dans l’ordre des numéros : 1 à 10 dans la réserve, 11 à 30 en surface de vente, par exemple.'],
    ['Indiquez', context === 'zones'
      ? 'ci-dessous quelles balises sont à quel endroit.'
      : 'dans chaque inventaire (écran Zones) quelles balises sont à quel endroit.'],
  ]

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Créer des balises</Text>
      <Text style={styles.intro}>
        {context === 'zones'
          ? 'Avant de compter, chaque emplacement reçoit des balises : des étiquettes QR numérotées que les compteurs scannent pour dire où ils sont.'
          : 'Les balises sont des étiquettes QR numérotées, collées dans le magasin, que les compteurs scannent pour dire où ils sont. Elles s’impriment une fois et servent pour tous vos inventaires.'}
      </Text>
      {steps.map(([verb, rest], i) => (
        <View key={verb} style={styles.step}>
          <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
          <Text style={styles.stepText}>
            <Text style={styles.stepVerb}>{verb}</Text> {rest}
          </Text>
        </View>
      ))}
      <Pressable style={styles.btn} onPress={() => setOpen(true)} disabled={print.isPending}>
        {print.isPending
          ? <ActivityIndicator color={theme.onAccent} />
          : <Text style={styles.btnText}>Créer et imprimer des balises</Text>}
      </Pressable>

      <BaliseSheetModal visible={open} onClose={() => setOpen(false)} onSubmit={(s) => print.mutate(s)} />
      <GeneratingOverlay
        visible={print.isPending}
        message="Préparation de l’impression…"
        sub="Création du PDF des balises"
      />
    </View>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.surface, borderRadius: Radius.lg, padding: Spacing.lg,
      borderWidth: 1, borderColor: t.hairline, gap: Spacing.sm, ...t.shadowCard,
    },
    title: { fontSize: 16, fontFamily: Font.bold, color: t.textPrimary },
    intro: { fontSize: 13, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 18 },
    step: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
    stepNum: {
      width: 24, height: 24, borderRadius: 12, backgroundColor: t.accentSoft,
      alignItems: 'center', justifyContent: 'center', marginTop: 1,
    },
    stepNumText: { fontSize: 12, fontFamily: Font.bold, color: t.accent },
    stepText: { flex: 1, fontSize: 13, color: t.textSecondary, fontFamily: Font.regular, lineHeight: 18 },
    stepVerb: { color: t.textPrimary, fontFamily: Font.semibold },
    btn: {
      marginTop: Spacing.xs, backgroundColor: t.accent, borderRadius: Radius.md,
      paddingVertical: 12, alignItems: 'center', justifyContent: 'center', ...t.shadowButton,
    },
    btnText: { color: t.onAccent, fontSize: 15, fontFamily: Font.bold },
  })
}
