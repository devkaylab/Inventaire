import { useState } from 'react'
import {
  ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { signaler } from '@/lib/dialogue'
import { errorMessage } from '@/lib/errors'
import { duree, euros, heure, monEspace, pointerArrivee, quand } from '@/lib/onDemand'

/**
 * La mission acceptée : où, quand, ce qu'il faut apporter, et le pointage.
 *
 * Maquette : Prestataire-Mission et Prestataire-Zone.
 *
 * ⚠️ **LE COMPTAGE EST L'APPLICATION QUANTINVO, PAS UN ÉCRAN D'ICI.** Quand la
 * mission démarre, l'inventaire apparaît dans la liste du compteur comme
 * n'importe quel inventaire — même scan, mêmes passes, mêmes écarts. Cet écran
 * ouvre la bonne porte, il ne refait pas ce qu'il y a derrière.
 *
 * ⚠️ **ET LE POINTAGE N'EST PAS UN BADGE D'EMBAUCHE.** Il sert au responsable
 * sur place à savoir qui est arrivé, et il déclenche l'attribution des zones.
 * Rien dans le produit ne le compte comme une heure travaillée : la
 * rémunération est celle qui a été annoncée, pour la durée annoncée.
 */
export default function MissionScreen() {
  const { missionId } = useLocalSearchParams<{ missionId: string }>()
  const theme = useTheme()
  const styles = faireStyles(theme)
  const qc = useQueryClient()
  const [occupe, setOccupe] = useState(false)

  const espace = useQuery({ queryKey: ['espace-inventoriste'], queryFn: monEspace })
  const m = (espace.data?.missions ?? []).find((x) => x.mission_id === missionId)

  const pointer = async () => {
    setOccupe(true)
    try {
      const r = await pointerArrivee(missionId)
      if (!r.success) {
        signaler.erreur('Pointage impossible',
          r.code === 'pas_le_moment'
            ? 'Le pointage s’ouvre le jour de la mission.'
            : 'Réessayez dans un instant.')
      } else {
        signaler.succes('Vous êtes pointé', 'Le responsable le voit sur son écran.')
      }
      await qc.invalidateQueries({ queryKey: ['espace-inventoriste'] })
    } catch (e) {
      signaler.erreur('Pointage impossible', errorMessage(e))
    } finally {
      setOccupe(false)
    }
  }

  if (espace.isLoading) {
    return (
      <SafeAreaView style={styles.page} edges={['bottom']}>
        <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.xxxl }} />
      </SafeAreaView>
    )
  }

  if (!m) {
    return (
      <SafeAreaView style={styles.page} edges={['bottom']}>
        <View style={styles.contenu}>
          <Text style={styles.titre}>Cette mission n’est plus la vôtre</Text>
          <Text style={styles.detail}>
            Elle a peut-être été annulée, ou la place reprise. Vos autres
            missions sont dans la liste.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const adresseComplete = [m.adresse, m.code_postal, m.ville].filter(Boolean).join(' ')
  const enCours = m.etat_mission === 'en_cours' || m.etat_mission === 'controle_qualite'

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.entete}>
          <Text style={styles.quand}>{quand(m.debut_prevu)}</Text>
          <Text style={styles.resume}>
            Inventaire {m.secteur} · {duree(m.duree_minutes)} environ ·{' '}
            <Text style={[styles.paie, tabular]}>{euros(m.remuneration_cents)}</Text>
          </Text>
        </View>

        <View style={styles.carte}>
          <Text style={styles.etiquette}>Vous êtes attendu à {heure(m.arrivee_prevue)}</Text>
          <Text style={styles.detail}>
            Un quart d’heure pour s’installer et recevoir votre zone.
          </Text>
        </View>

        <View style={styles.carte}>
          <Text style={styles.etiquette}>Adresse</Text>
          <Text style={styles.adresse}>{adresseComplete}</Text>
          {m.acces_sur_place ? <Text style={styles.detail}>{m.acces_sur_place}</Text> : null}
          <Pressable style={[styles.bouton, styles.secondaire]}
                     onPress={() => Linking.openURL(
                       `https://maps.apple.com/?q=${encodeURIComponent(adresseComplete)}`)}>
            <Text style={styles.secondaireTexte}>Y aller</Text>
          </Pressable>
        </View>

        <View style={styles.carte}>
          <Text style={styles.etiquette}>À prendre avec vous</Text>
          <Text style={styles.point}>· Votre téléphone chargé — c’est lui qui scanne</Text>
          <Text style={styles.point}>· Une pièce d’identité — le magasin la demande à l’entrée</Text>
          <Text style={styles.point}>· Des chaussures fermées, on monte à l’échelle</Text>
        </View>

        {enCours && m.inventory_session_id ? (
          <View style={styles.carte}>
            <Text style={styles.etiquette}>Votre zone</Text>
            <Text style={styles.detail}>
              C’est l’application Quantinvo, la même que celle des équipes de
              magasin — scan, passes, écarts. Votre accès s’ouvre au début de la
              mission et se ferme à la clôture. Vous n’y voyez que cet
              inventaire-ci.
            </Text>
            <Pressable style={[styles.bouton, styles.principal]}
                       onPress={() => router.push(`/(employee)/${m.inventory_session_id}/scan`)}>
              <Text style={styles.principalTexte}>Ouvrir le comptage</Text>
            </Pressable>
          </View>
        ) : null}

        {!m.pointe_le ? (
          <Pressable style={[styles.bouton, styles.principal, occupe && styles.occupe]}
                     disabled={occupe} onPress={pointer}>
            <Text style={styles.principalTexte}>
              {occupe ? 'Un instant…' : 'Pointer mon arrivée'}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.pointe}>Pointé à {heure(m.pointe_le)}</Text>
        )}

        {/* ⚠️ On dit le coût d'un désistement tardif SANS menacer. « Plus c'est
            tard, plus ça pèse » est vrai, vérifiable, et c'est ce qui fait
            prévenir tôt — une phrase comminatoire ferait surtout ne rien
            dire. */}
        <Text style={styles.note}>
          Un empêchement ? Prévenez-nous vite : plus c’est tard, plus ça pèse sur
          votre score.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const faireStyles = (theme: Theme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  contenu: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  entete: { gap: 4 },
  quand: { color: theme.textPrimary, fontFamily: Font.bold, fontSize: 22, letterSpacing: -0.4 },
  resume: { color: theme.textSecondary, fontSize: 14 },
  paie: { color: theme.textPrimary, fontFamily: Font.semibold },
  carte: { backgroundColor: theme.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: 8 },
  etiquette: { color: theme.textSecondary, fontFamily: Font.medium, fontSize: 12.5 },
  adresse: { color: theme.textPrimary, fontFamily: Font.semibold, fontSize: 16 },
  titre: { color: theme.textPrimary, fontFamily: Font.bold, fontSize: 18 },
  detail: { color: theme.textSecondary, fontSize: 13.5, lineHeight: 19 },
  point: { color: theme.textPrimary, fontSize: 14, lineHeight: 20 },
  bouton: { paddingVertical: 13, borderRadius: Radius.bouton, alignItems: 'center', marginTop: Spacing.xs },
  principal: { backgroundColor: theme.accent },
  principalTexte: { color: theme.onAccent, fontFamily: Font.semibold, fontSize: 16 },
  secondaire: { borderWidth: 1, borderColor: theme.border },
  secondaireTexte: { color: theme.textPrimary, fontFamily: Font.medium, fontSize: 15 },
  occupe: { opacity: 0.6 },
  pointe: { color: theme.success, fontFamily: Font.semibold, fontSize: 15, textAlign: 'center' },
  note: { color: theme.textMuted, fontSize: 12.5, lineHeight: 18 },
})
