import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createSession, getMyAssignedStores } from '@/lib/queries'
import { errorMessage } from '@/lib/errors'
import { CocheIcon } from '@/components/ui/Icones'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, type Theme } from '@/constants/ink'
import { signaler } from '@/lib/dialogue'

function generateCode(): string {
  return Math.random().toString(36).toUpperCase().slice(2, 8)
}

export default function NewSessionScreen() {
  const queryClient = useQueryClient()
  const theme = useTheme()
  const styles = makeStyles(theme)
  const [name, setName] = useState('')
  const [storeId, setStoreId] = useState<string | null>(null)
  const [securityCode, setSecurityCode] = useState(generateCode())
  // Le comptage par balises est le mode par défaut (décision du 23 août 2026),
  // comme sur le site — l'app était le seul écran à partir sans. Le
  // superviseur reste libre de l'éteindre : c'est son choix, pas une règle.
  const [usesZones, setUsesZones] = useState(true)
  const [loading, setLoading] = useState(false)

  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ['my-stores'],
    queryFn: getMyAssignedStores,
  })

  async function handleCreate() {
    // ⚠️ Une saisie incomplète n'est pas une erreur : on dit ce qu'il manque,
    // sans titrer « Erreur ». C'est le premier inventaire de quelqu'un qui
    // découvre l'app — le ton compte.
    if (!name.trim()) {
      signaler.erreur('Nom manquant', "Donnez un nom à l'inventaire.")
      return
    }
    // Le bouton est déjà inactif dans ce cas : garde silencieuse, pas d'alerte.
    if (!storeId) return
    if (securityCode.trim().length < 4) {
      signaler.erreur('Code trop court', 'Le code de sécurité doit comporter au moins 4 caractères.')
      return
    }
    setLoading(true)
    try {
      const result = await createSession(name.trim(), storeId, securityCode.trim(), usesZones)
      if (!result.success) {
        signaler.erreur('Erreur', result.error ?? 'Impossible de créer l’inventaire.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      // ⚠️ **Pas de confirmation à valider.** Elle annonçait le numéro, le code
      // et l'étape suivante — pour ensuite faire exactement ce qu'elle
      // annonçait : deux appuis pour arriver là où le bouton menait déjà.
      // Rien ne se perd : le numéro et le code se lisent sur la fiche
      // (« Identifiants », avec Copier et Partager), et l'étape « compteurs »
      // les remet sous les yeux au moment où l'on veut les transmettre.
      //
      // Enchaînement guidé : (zones si activées) → fichiers → compteurs.
      const sid = result.session_id
      if (usesZones) router.replace(`/(supervisor)/${sid}/zones?from=new`)
      else router.replace(`/(supervisor)/${sid}/import?from=new`)
    } catch (e: unknown) {
      console.error('[new-session] createSession', e)
      signaler.erreur('Erreur', errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const noStores = !storesLoading && (stores?.length ?? 0) === 0

  // ⚠️ Un seul magasin : il n'y a rien à choisir, on le choisit.
  //
  // Sans cela, la liste affichait le magasin comme un champ déjà rempli — mais
  // rien n'était sélectionné, et « Créer l'inventaire » répondait « Choisissez
  // un magasin » en le montrant à l'écran. Bloquant, et c'est la PREMIÈRE
  // étape de l'onboarding d'un superviseur (constaté au simulateur le 23 août
  // 2026). Un superviseur a désormais toujours au moins un magasin, donc le
  // cas est la règle, pas l'exception.
  useEffect(() => {
    if (!storeId && stores?.length === 1) setStoreId(stores[0].id)
  }, [stores, storeId])

  /** Plusieurs magasins et aucun retenu : il reste un geste à faire. */
  const choixAttendu = !storeId && (stores?.length ?? 0) > 1

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Informations de l&apos;inventaire</Text>

          <Text style={styles.label}>{"Nom de l'inventaire"}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Inventaire annuel 2026"
            placeholderTextColor={theme.textMuted}
          />

          {/* Le libellé porte la consigne plutôt qu'une alerte après coup :
              « Magasin » ne dit pas qu'il y a un geste à faire. Avec un seul
              magasin il est déjà choisi, donc le titre reste neutre. */}
          <Text style={[styles.label, choixAttendu && styles.labelConsigne]}>
            {choixAttendu ? 'Choisissez un magasin' : 'Magasin'}
          </Text>
          {storesLoading ? (
            <ActivityIndicator color={theme.accent} style={{ marginVertical: Spacing.md }} />
          ) : noStores ? (
            <Text style={styles.emptyStores}>
              Aucun magasin ne vous est affecté. Contactez votre administrateur pour être rattaché à un magasin.
            </Text>
          ) : (
            <View style={styles.storeList}>
              {stores!.map(s => {
                const active = storeId === s.id
                return (
                  <Pressable
                    key={s.id}
                    style={[styles.storeRow, active && styles.storeRowActive]}
                    onPress={() => setStoreId(s.id)}
                  >
                    <Text style={[styles.storeName, active && styles.storeNameActive]}>{s.name}</Text>
                    {active && <CocheIcon color={theme.accent} size={16} />}
                  </Pressable>
                )
              })}
            </View>
          )}

          <Text style={styles.label}>Code inventaire</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={securityCode}
              onChangeText={v => setSecurityCode(v.toUpperCase())}
              autoCapitalize="characters"
              maxLength={10}
              placeholder="XXXXXX"
              placeholderTextColor={theme.textMuted}
            />
            <Pressable style={styles.regenBtn} onPress={() => setSecurityCode(generateCode())}>
              <Text style={styles.regenText}>Générer</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            {"Communiquez ce code à tous les membres de l'équipe pour qu'ils rejoignent cet inventaire."}
          </Text>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Utiliser des zones / balises</Text>
              <Text style={styles.hint}>
                {"Le comptage s'organise par zones ouvertes en scannant une balise (sticker). Vous définirez les plages de balises après la création."}
              </Text>
            </View>
            <Switch
              value={usesZones}
              onValueChange={setUsesZones}
              trackColor={{ false: theme.borderStrong, true: theme.accent }}
              thumbColor={theme.onAccent}
            />
          </View>

          <Pressable style={[styles.button, (loading || noStores || choixAttendu) && styles.buttonDisabled]} onPress={handleCreate} disabled={loading || noStores || choixAttendu}>
            {loading ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.buttonText}>Créer l&apos;inventaire</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { padding: Spacing.lg, gap: Spacing.md },
    sectionTitle: { fontSize: 18, fontFamily: Font.bold, color: t.textPrimary, marginBottom: Spacing.xs, letterSpacing: -0.3 },
    label: { fontSize: 13, fontFamily: Font.semibold, color: t.textSecondary },
    input: { borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 13, fontSize: 16, backgroundColor: t.surface, color: t.textPrimary, fontFamily: Font.regular },
    storeList: { gap: Spacing.sm },
    storeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 14, backgroundColor: t.surface },
    storeRowActive: { borderColor: t.accent, backgroundColor: t.accentSoft },
    storeName: { fontSize: 15, color: t.textPrimary, fontFamily: Font.medium },
    storeNameActive: { color: t.accent, fontFamily: Font.bold },
    labelConsigne: { color: t.accent },
    emptyStores: { fontSize: 14, color: t.textMuted, fontFamily: Font.regular, lineHeight: 20, backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, padding: Spacing.lg },
    codeRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    regenBtn: { backgroundColor: t.accentSoft, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 13 },
    regenText: { color: t.accent, fontFamily: Font.semibold, fontSize: 14 },
    hint: { fontSize: 13, color: t.textSecondary, lineHeight: 18, fontFamily: Font.regular },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline, borderRadius: Radius.md, padding: Spacing.lg, marginTop: Spacing.xs },
    switchLabel: { fontSize: 15, fontFamily: Font.semibold, color: t.textPrimary, marginBottom: 2 },
    button: { backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.lg, ...t.shadowButton },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: t.onAccent, fontSize: 16, fontFamily: Font.bold },
  })
}
