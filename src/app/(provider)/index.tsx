import { useCallback, useState } from 'react'
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import { signaler } from '@/lib/dialogue'
import { errorMessage } from '@/lib/errors'
import { BarreInventoriste } from '@/components/BarreInventoriste'
import {
  ceQuiManque, duree, euros, mesPropositions, monEspace, quand, repondre,
  type Proposition,
} from '@/lib/onDemand'

/**
 * Mes missions — ce qu'on me propose, et ce que j'ai accepté.
 *
 * Maquette : Prestataire-Missions.
 *
 * ⚠️ **LA RÉMUNÉRATION EST SUR LA PREMIÈRE LIGNE, EN GRAND.** C'est la seule
 * information qui décide, et elle ne se négocie pas : l'afficher en petit sous
 * la date ferait croire qu'elle se discute.
 *
 * ⚠️ **ET IL N'Y A PAS D'ADRESSE AVANT D'ACCEPTER** — la ville suffit pour
 * savoir si on peut s'y rendre. C'est la base qui le tient : `mes_propositions`
 * n'en rend pas.
 */
export default function MissionsScreen() {
  const theme = useTheme()
  const styles = faireStyles(theme)
  const qc = useQueryClient()
  const [occupe, setOccupe] = useState<string | null>(null)

  const espace = useQuery({ queryKey: ['espace-inventoriste'], queryFn: monEspace })
  const propositions = useQuery({ queryKey: ['propositions'], queryFn: mesPropositions })

  const rafraichir = useCallback(() => {
    espace.refetch(); propositions.refetch()
  }, [espace, propositions])

  const repondreA = async (p: Proposition, accepte: boolean) => {
    setOccupe(p.mission_id)
    try {
      const r = await repondre(p.mission_id, accepte)
      if (!r.success) {
        signaler.erreur(
          'Réponse impossible',
          r.code === 'place_prise'
            ? 'Cette place vient d’être pourvue. Nous vous en proposerons une autre.'
            : r.code === 'trop_tard'
              ? 'Cette mission a déjà commencé.'
              : 'Réponse impossible pour le moment.',
        )
      }
      await qc.invalidateQueries({ queryKey: ['propositions'] })
      await qc.invalidateQueries({ queryKey: ['espace-inventoriste'] })
    } catch (e) {
      signaler.erreur('Réponse impossible', errorMessage(e))
    } finally {
      setOccupe(null)
    }
  }

  const profil = espace.data?.profil ?? null
  const manques = profil ? ceQuiManque(profil) : []
  const enAttente = propositions.data ?? []
  const acceptees = espace.data?.missions ?? []
  const chargement = espace.isLoading || propositions.isLoading

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.contenu}
        refreshControl={
          <RefreshControl refreshing={espace.isRefetching} onRefresh={rafraichir} tintColor={theme.accent} />
        }
      >
        {chargement && <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.xxl }} />}

        {/* ⚠️ Le blocage passe AVANT les missions. Quelqu'un dont le dossier
            n'est pas complet ne reçoit rien : le lui dire après une liste vide
            le laisserait croire qu'il n'y a pas de travail. */}
        {profil && manques.length > 0 && (
          <Pressable style={styles.blocage} onPress={() => router.push('/(provider)/profil')}>
            <Text style={styles.blocageTitre}>Il reste une étape</Text>
            <Text style={styles.blocageTexte}>
              Tant qu’elle n’est pas faite, nous ne pouvons pas vous proposer de
              mission — ni vous payer.
            </Text>
            {manques.map((m) => (
              <Text key={m} style={styles.blocagePoint}>· {m}</Text>
            ))}
          </Pressable>
        )}

        {enAttente.length > 0 && (
          <>
            <Text style={styles.chapeau}>
              {enAttente.length === 1
                ? 'Une mission tient dans vos disponibilités.'
                : `${enAttente.length} missions tiennent dans vos disponibilités.`}
            </Text>
            {enAttente.map((p) => (
              <View key={p.mission_id} style={styles.carte}>
                <View style={styles.ligneTete}>
                  <Text style={styles.titre}>Inventaire {p.secteur}</Text>
                  <Text style={[styles.paie, tabular]}>{euros(p.remuneration_cents)}</Text>
                </View>
                <Text style={styles.detail}>
                  {p.ville}{p.code_postal ? ` · ${p.code_postal}` : ''}
                </Text>
                <Text style={styles.detail}>
                  {quand(p.debut_prevu)} · {duree(p.duree_minutes)} environ
                </Text>
                {p.role === 'responsable' && (
                  <Text style={styles.role}>Comme responsable d’équipe</Text>
                )}
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.bouton, styles.accepter, occupe === p.mission_id && styles.occupe]}
                    disabled={occupe !== null}
                    onPress={() => repondreA(p, true)}
                  >
                    <Text style={styles.accepterTexte}>Accepter</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.bouton, styles.refuser]}
                    disabled={occupe !== null}
                    onPress={() => repondreA(p, false)}
                  >
                    <Text style={styles.refuserTexte}>Refuser</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Text style={styles.note}>
              La rémunération est fixée par Quantinvo et ne se négocie pas. Une
              fois acceptée, elle ne bouge plus.
            </Text>
          </>
        )}

        {acceptees.length > 0 && (
          <>
            <Text style={styles.chapeau}>Vos missions</Text>
            {acceptees.map((m) => (
              <Pressable key={m.mission_id} style={styles.carte}
                         onPress={() => router.push(`/(provider)/${m.mission_id}`)}>
                <View style={styles.ligneTete}>
                  <Text style={styles.titre}>{m.magasin}</Text>
                  <Text style={[styles.paie, tabular]}>{euros(m.remuneration_cents)}</Text>
                </View>
                <Text style={styles.detail}>
                  {quand(m.debut_prevu)} · {duree(m.duree_minutes)} environ
                </Text>
                <Text style={styles.detail}>
                  {m.pointe_le ? 'Vous avez pointé' : 'Vous êtes attendu quinze minutes avant'}
                </Text>
              </Pressable>
            ))}
          </>
        )}

        {!chargement && enAttente.length === 0 && acceptees.length === 0 && manques.length === 0 && (
          <View style={styles.vide}>
            <Text style={styles.videTitre}>Aucune mission pour l’instant</Text>
            <Text style={styles.videTexte}>
              Nous ne proposons que des missions qui tiennent dans vos
              disponibilités. Les élargir en fait venir davantage.
            </Text>
            <Pressable style={[styles.bouton, styles.accepter, { alignSelf: 'flex-start' }]}
                       onPress={() => router.push('/(provider)/planning')}>
              <Text style={styles.accepterTexte}>Mes disponibilités</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      <BarreInventoriste />
    </SafeAreaView>
  )
}

const faireStyles = (theme: Theme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  contenu: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  chapeau: { color: theme.textSecondary, fontFamily: Font.medium, fontSize: 14, marginTop: Spacing.md },
  carte: { backgroundColor: theme.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: 6 },
  ligneTete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.md },
  titre: { color: theme.textPrimary, fontFamily: Font.semibold, fontSize: 16, flexShrink: 1 },
  paie: { color: theme.textPrimary, fontFamily: Font.bold, fontSize: 20 },
  detail: { color: theme.textSecondary, fontSize: 13.5 },
  role: { color: theme.accent, fontFamily: Font.medium, fontSize: 13 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  bouton: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: Radius.bouton, alignItems: 'center' },
  accepter: { backgroundColor: theme.accent, flexGrow: 1 },
  accepterTexte: { color: theme.onAccent, fontFamily: Font.semibold, fontSize: 15 },
  refuser: { borderWidth: 1, borderColor: theme.border },
  refuserTexte: { color: theme.textSecondary, fontFamily: Font.medium, fontSize: 15 },
  occupe: { opacity: 0.6 },
  note: { color: theme.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: Spacing.xs },
  blocage: { backgroundColor: theme.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: 6 },
  blocageTitre: { color: theme.warning, fontFamily: Font.bold, fontSize: 16 },
  blocageTexte: { color: theme.textSecondary, fontSize: 13.5, lineHeight: 19 },
  blocagePoint: { color: theme.textPrimary, fontSize: 13.5 },
  vide: { backgroundColor: theme.surface, borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md },
  videTitre: { color: theme.textPrimary, fontFamily: Font.bold, fontSize: 17 },
  videTexte: { color: theme.textSecondary, fontSize: 14, lineHeight: 20 },
})
