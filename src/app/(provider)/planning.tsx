import { useMemo, useState } from 'react'
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { signaler } from '@/lib/dialogue'
import { errorMessage } from '@/lib/errors'
import { BarreInventoriste } from '@/components/BarreInventoriste'
import { enregistrerDisponibilites, JOURS, monEspace, type Disponibilite } from '@/lib/onDemand'

/**
 * Mes disponibilités — la semaine type.
 *
 * Maquette : Prestataire-Disponibilites.
 *
 * ⚠️ **UN JOUR SANS CRÉNEAU EST UN JOUR INDISPONIBLE**, et rien d'autre.
 * L'alternative — un drapeau « disponible » par jour, plus des heures — donne
 * deux façons de dire non et un état où les deux se contredisent.
 *
 * ⚠️ **UN CRÉNEAU PEUT PASSER MINUIT**, et c'est le cas normal : un inventaire
 * après la fermeture commence à 20 h et finit après 1 h. « 20:00 – 02:00 » est
 * donc valide, et la base le sait (`fin` avant `debut` = le créneau passe
 * minuit). Refuser cette saisie écarterait la moitié des missions.
 */
export default function PlanningScreen() {
  const theme = useTheme()
  const styles = faireStyles(theme)
  const qc = useQueryClient()
  const espace = useQuery({ queryKey: ['espace-inventoriste'], queryFn: monEspace })
  const [occupe, setOccupe] = useState(false)

  /**
   * ⚠️ **LA SEMAINE SE DÉDUIT, ELLE NE SE RECOPIE PAS DANS UN ÉTAT.** Un effet
   * qui appelle `setState` pour aligner un formulaire sur ce qui vient du
   * serveur est refusé par le lint de cette application, et à raison : il
   * rerend une fois pour rien, et il faut un drapeau « déjà chargé » qui, lui,
   * finit par écraser une saisie en cours au premier rafraîchissement.
   *
   * Ici, `modifs` est `null` tant que la personne n'a rien touché : l'écran
   * affiche alors ce que la base dit, et suit un rafraîchissement. Dès qu'elle
   * touche quelque chose, c'est sa version qui gagne.
   */
  type Semaine = Record<number, { debut: string; fin: string }>
  const [modifs, setModifs] = useState<Semaine | null>(null)

  const enBase = useMemo<Semaine>(() => {
    const d: Semaine = {}
    for (const c of espace.data?.disponibilites ?? []) {
      d[c.jour] = { debut: c.debut.slice(0, 5), fin: c.fin.slice(0, 5) }
    }
    return d
  }, [espace.data])

  const semaine = modifs ?? enBase
  const setSemaine = (f: (s: Semaine) => Semaine) => setModifs((m) => f(m ?? enBase))

  const basculer = (jour: number) => {
    setSemaine((s) => {
      const copie = { ...s }
      if (copie[jour]) delete copie[jour]
      else copie[jour] = { debut: '20:00', fin: '02:00' }
      return copie
    })
  }

  const enregistrer = async () => {
    const creneaux: Disponibilite[] = Object.entries(semaine).map(([jour, c]) => ({
      jour: Number(jour), debut: c.debut, fin: c.fin,
    }))
    const mauvais = creneaux.find((c) => !/^\d{2}:\d{2}$/.test(c.debut) || !/^\d{2}:\d{2}$/.test(c.fin))
    if (mauvais) {
      signaler.erreur('Heure incomplète', 'Écrivez les heures sous la forme 20:00.')
      return
    }
    setOccupe(true)
    try {
      const r = await enregistrerDisponibilites(creneaux)
      if (!r.success) signaler.erreur('Enregistrement impossible', 'Réessayez dans un instant.')
      else { signaler.succes('Disponibilités enregistrées'); setModifs(null) }
      await qc.invalidateQueries({ queryKey: ['espace-inventoriste'] })
      await qc.invalidateQueries({ queryKey: ['propositions'] })
    } catch (e) {
      signaler.erreur('Enregistrement impossible', errorMessage(e))
    } finally {
      setOccupe(false)
    }
  }

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        {espace.isLoading && <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.xxl }} />}

        <Text style={styles.chapeau}>Chaque semaine</Text>

        {JOURS.map((nom, i) => {
          const jour = i + 1
          const c = semaine[jour]
          return (
            <View key={nom} style={styles.jour}>
              <Pressable style={styles.jourTete} onPress={() => basculer(jour)}>
                <Text style={styles.jourNom}>{nom}</Text>
                <Text style={[styles.jourEtat, c ? styles.jourDispo : null]}>
                  {c ? `${c.debut} – ${c.fin}` : 'Indisponible'}
                </Text>
              </Pressable>
              {c ? (
                <View style={styles.heures}>
                  <TextInput
                    style={styles.champ} value={c.debut} maxLength={5}
                    keyboardType="numbers-and-punctuation" placeholder="20:00"
                    placeholderTextColor={theme.textMuted}
                    onChangeText={(v) => setSemaine((s) => ({ ...s, [jour]: { ...s[jour], debut: v } }))}
                  />
                  <Text style={styles.tiret}>–</Text>
                  <TextInput
                    style={styles.champ} value={c.fin} maxLength={5}
                    keyboardType="numbers-and-punctuation" placeholder="02:00"
                    placeholderTextColor={theme.textMuted}
                    onChangeText={(v) => setSemaine((s) => ({ ...s, [jour]: { ...s[jour], fin: v } }))}
                  />
                </View>
              ) : null}
            </View>
          )
        })}

        <Text style={styles.note}>
          Nous ne proposons que des missions qui tiennent dans ces créneaux. Un
          inventaire peut se faire à l’ouverture, en journée ou après la
          fermeture — une fin avant le début veut dire que le créneau passe
          minuit.
        </Text>

        <Pressable style={[styles.bouton, occupe && styles.occupe]} disabled={occupe}
                   onPress={enregistrer}>
          <Text style={styles.boutonTexte}>{occupe ? 'Enregistrement…' : 'Enregistrer'}</Text>
        </Pressable>
      </ScrollView>
      <BarreInventoriste />
    </SafeAreaView>
  )
}

const faireStyles = (theme: Theme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  contenu: { padding: Spacing.xl, gap: Spacing.sm, paddingBottom: Spacing.xxxl },
  chapeau: { color: theme.textSecondary, fontFamily: Font.medium, fontSize: 14, marginBottom: Spacing.xs },
  jour: { backgroundColor: theme.surface, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  jourTete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jourNom: { color: theme.textPrimary, fontFamily: Font.semibold, fontSize: 15 },
  jourEtat: { color: theme.textMuted, fontSize: 14 },
  jourDispo: { color: theme.accent, fontFamily: Font.medium },
  heures: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  champ: {
    flexGrow: 1, backgroundColor: theme.background, borderRadius: Radius.md,
    paddingVertical: 10, paddingHorizontal: 12,
    color: theme.textPrimary, fontFamily: Font.regular, fontSize: 15,
  },
  tiret: { color: theme.textMuted, fontSize: 15 },
  note: { color: theme.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: Spacing.md },
  bouton: {
    backgroundColor: theme.accent, paddingVertical: 14,
    borderRadius: Radius.bouton, alignItems: 'center', marginTop: Spacing.md,
  },
  boutonTexte: { color: theme.onAccent, fontFamily: Font.semibold, fontSize: 16 },
  occupe: { opacity: 0.6 },
})
