import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { BarreInventoriste } from '@/components/BarreInventoriste'
import { ceQuiManque, monEspace, NIVEAUX } from '@/lib/onDemand'

/**
 * Mon profil, et ce qu'il reste à faire vérifier.
 *
 * Maquette : Prestataire-Profil et Prestataire-Verification.
 *
 * ⚠️ **DEUX COLONNES DE VÉRIFICATION, ET LA SÉPARATION EST LE MESSAGE.**
 * Quantinvo relit le téléphone, l'e-mail, l'expérience et les secteurs ; Stripe
 * contrôle l'identité, le SIRET et le compte bancaire, parce que c'est lui
 * l'établissement de paiement et qu'il en a l'obligation. **Quantinvo ne voit
 * ni les papiers ni l'IBAN** — et si cet écran ne le dit pas, on nous les
 * envoie par e-mail, ce qui crée le risque qu'on avait justement évité.
 *
 * ⚠️ **LE SCORE N'EST PAS ICI, ET C'EST VOLONTAIRE.** Il n'y a pas encore de
 * missions pour le calculer (`03-matching-et-score.md` : il vient en dernier).
 * Afficher « — » sur cinq mesures donnerait l'impression d'un écran cassé ;
 * afficher des chiffres inventés serait pire.
 */
export default function ProfilScreen() {
  const theme = useTheme()
  const styles = faireStyles(theme)
  const espace = useQuery({ queryKey: ['espace-inventoriste'], queryFn: monEspace })

  const p = espace.data?.profil
  const manques = p ? ceQuiManque(p) : []
  const faites = espace.data?.missions_faites ?? 0

  return (
    <SafeAreaView style={styles.page} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.contenu}>
        {espace.isLoading && <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.xxl }} />}

        {p ? (
          <>
            <View style={styles.entete}>
              <View style={styles.pastille}>
                <Text style={styles.initiales}>
                  {(p.prenom[0] ?? '?') + (p.nom[0] ?? '')}
                </Text>
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.nom}>{p.prenom} {p.nom}</Text>
                <Text style={styles.detail}>
                  {NIVEAUX[p.niveau] ?? p.niveau} · {faites} mission{faites > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {manques.length > 0 && (
              <View style={styles.carte}>
                <Text style={styles.titreAlerte}>Il reste une étape</Text>
                <Text style={styles.detail}>
                  Tant qu’elle n’est pas faite, nous ne pouvons pas vous proposer
                  de mission — ni vous payer.
                </Text>
                {manques.map((m) => <Text key={m} style={styles.point}>· {m}</Text>)}
              </View>
            )}

            <View style={styles.carte}>
              <Text style={styles.etiquette}>Ce que Quantinvo vérifie</Text>
              <Ligne theme={theme} gauche="Expérience en inventaire"
                     droite={p.experience_annees != null ? `${p.experience_annees} ans` : 'à renseigner'} />
              <Ligne theme={theme} gauche="Secteurs"
                     droite={p.secteurs.length ? p.secteurs.join(', ') : 'à renseigner'} />
              <Ligne theme={theme} gauche="Langues"
                     droite={p.langues.length ? p.langues.join(', ') : 'à renseigner'} />
              <Ligne theme={theme} gauche="Mobilité"
                     droite={p.mobilite ? `${p.mobilite} — ${p.rayon_km} km` : `${p.rayon_km} km`} />
              <Ligne theme={theme} gauche="Forme juridique"
                     droite={p.forme_juridique ?? 'à renseigner'} />
            </View>

            <View style={styles.carte}>
              <Text style={styles.etiquette}>Ce que Stripe vérifie</Text>
              <Text style={styles.detail}>
                Stripe est notre prestataire de paiement. C’est lui qui contrôle
                votre identité et qui vous verse l’argent. Quantinvo ne voit ni
                vos papiers ni votre compte bancaire.
              </Text>
              <Ligne theme={theme} gauche="SIRET" droite={p.siret ?? 'à renseigner'} />
              <Ligne theme={theme} gauche="Pièce d’identité"
                     droite={p.compte_paiement_ouvert ? 'chez Stripe' : 'à faire'} />
              <Ligne theme={theme} gauche="Compte bancaire"
                     droite={p.paiements_ouverts ? 'validé' : 'à faire'} />
              {!p.paiements_ouverts && (
                <Pressable style={styles.bouton} onPress={() => {
                  // ⚠️ Le parcours Stripe Connect n'est pas branché : on ne
                  // fabrique pas un faux bouton qui ne fait rien. Il dira quoi
                  // faire le jour où l'adresse existera.
                  router.push('/(compte)/account')
                }}>
                  <Text style={styles.boutonTexte}>Continuer chez Stripe</Text>
                </Pressable>
              )}
              <Text style={styles.note}>Nous vous écrivons dès que tout est validé.</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
      <BarreInventoriste />
    </SafeAreaView>
  )
}

function Ligne({ theme, gauche, droite }: { theme: Theme; gauche: string; droite: string }) {
  const styles = faireStyles(theme)
  return (
    <View style={styles.ligne}>
      <Text style={styles.ligneGauche}>{gauche}</Text>
      <Text style={styles.ligneDroite}>{droite}</Text>
    </View>
  )
}

const faireStyles = (theme: Theme) => StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  contenu: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  entete: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pastille: {
    width: 52, height: 52, borderRadius: Radius.pill,
    backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  initiales: { color: theme.accent, fontFamily: Font.bold, fontSize: 18 },
  nom: { color: theme.textPrimary, fontFamily: Font.bold, fontSize: 19 },
  carte: { backgroundColor: theme.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: 8 },
  etiquette: { color: theme.textSecondary, fontFamily: Font.medium, fontSize: 12.5 },
  titreAlerte: { color: theme.warning, fontFamily: Font.bold, fontSize: 16 },
  detail: { color: theme.textSecondary, fontSize: 13.5, lineHeight: 19 },
  point: { color: theme.textPrimary, fontSize: 14 },
  ligne: {
    flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md,
    paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline,
  },
  ligneGauche: { color: theme.textSecondary, fontSize: 14, flexShrink: 1 },
  ligneDroite: { color: theme.textPrimary, fontFamily: Font.medium, fontSize: 14, textAlign: 'right', flexShrink: 1 },
  bouton: {
    backgroundColor: theme.accent, paddingVertical: 13,
    borderRadius: Radius.bouton, alignItems: 'center', marginTop: Spacing.sm,
  },
  boutonTexte: { color: theme.onAccent, fontFamily: Font.semibold, fontSize: 15 },
  note: { color: theme.textMuted, fontSize: 12.5 },
})
