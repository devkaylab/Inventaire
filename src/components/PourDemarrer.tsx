/**
 * « Pour démarrer » — la checklist du superviseur.
 *
 * Quatre étapes, **cochées par les faits**, jamais à la main : la session
 * existe, les zones sont définies, le référentiel a des lignes, l'inventaire a
 * des membres. C'est la règle Shopify / Intercom, et c'est ce qui rend la
 * disparition automatique honnête.
 *
 * ⚠️ **« Imprimer les balises » n'est pas une étape à part.** Une planche est
 * produite sur le téléphone depuis le 21 août 2026 et ne laisse **aucune
 * trace en base** : la case ne pourrait pas se cocher seule. L'impression est
 * donc fondue dans « Imprimer les balises et définir les zones », qui est le
 * même écran dans l'app — et dont les zones, elles, se vérifient.
 *
 * Seule la prochaine étape est dépliée. Le bloc s'efface de lui-même quand
 * tout est vrai ; « Masquer » le replie entre-temps.
 */
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { useTheme } from '@/lib/theme'
import { Font, Radius, Spacing, tabular, type Theme } from '@/constants/ink'
import type { PreparationInventaire } from '@/lib/queries'

export type EtapeDemarrage = {
  cle: 'inventaire' | 'zones' | 'fichiers' | 'membres'
  titre: string
  texte: string
  resume: string | null
  faite: boolean
  action: string
}

/**
 * L'ordre suit ce qui est possible, pas ce qui est confortable : les plages de
 * balises s'affectent **dans** un inventaire, et le référentiel y est rattaché
 * (`theoretical_stock.session_id`). Créer vient donc en premier.
 */
export function etapesDemarrage(
  prep: PreparationInventaire | undefined,
  opts: { inventaireExiste: boolean; utiliseZones: boolean },
): EtapeDemarrage[] {
  const p = prep ?? { zones: 0, articles: 0, stockTheorique: 0, membres: 0 }
  const etapes: EtapeDemarrage[] = [
    {
      cle: 'inventaire',
      titre: 'Créer un inventaire',
      texte: 'Un nom, un magasin, et le comptage par balises si vous les utilisez.',
      resume: null,
      faite: opts.inventaireExiste,
      action: 'Nouvel inventaire',
    },
  ]
  // Sans balises, la zone n'a pas d'objet : l'étape disparaît plutôt que de
  // rester cochée d'office, ce qui mentirait sur le travail restant.
  if (opts.utiliseZones) {
    etapes.push({
      cle: 'zones',
      titre: 'Imprimer les balises et définir les zones',
      texte: 'Quelles balises couvrent quel rayon. Sans plage affectée, vos compteurs scannent dans le vide.',
      resume: p.zones > 0 ? `${p.zones} zone${p.zones > 1 ? 's' : ''}` : null,
      faite: p.zones > 0,
      action: 'Zones et balises',
    })
  }
  etapes.push(
    {
      cle: 'fichiers',
      titre: 'Importer le référentiel et le stock théorique',
      texte: 'Deux fichiers Excel ou CSV. Sans stock théorique, le rapport ne montre que le compté.',
      resume: p.articles > 0
        ? `${p.articles.toLocaleString('fr-FR')} référence${p.articles > 1 ? 's' : ''}${p.stockTheorique > 0 ? ' · stock théorique importé' : ' · pas de stock théorique'}`
        : null,
      faite: p.articles > 0,
      action: 'Importer les données',
    },
    {
      cle: 'membres',
      titre: 'Ajouter vos compteurs à l’inventaire',
      // Le piège que la maquette a révélé : appartenir à l'équipe du magasin
      // ne donne aucun accès à un inventaire.
      texte: 'Être dans l’équipe du magasin ne suffit pas : il faut les ajouter ici, ou leur donner le code.',
      resume: p.membres > 0 ? `${p.membres} membre${p.membres > 1 ? 's' : ''}` : null,
      faite: p.membres > 0,
      action: 'Inviter une personne',
    },
  )
  return etapes
}

export function PourDemarrer({
  etapes, onAction, onMasquer,
}: {
  etapes: EtapeDemarrage[]
  onAction: (cle: EtapeDemarrage['cle']) => void
  onMasquer: () => void
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const faites = etapes.filter(e => e.faite).length
  // La première non faite, et elle seule, est dépliée.
  const ouverte = useMemo(() => etapes.find(e => !e.faite)?.cle ?? null, [etapes])

  if (!ouverte) return null

  return (
    <View style={styles.carte}>
      <View style={styles.entete}>
        <Text style={styles.titre}>Pour démarrer</Text>
        <Text style={[styles.compte, tabular]}>{faites} sur {etapes.length}</Text>
      </View>
      <View style={styles.barre}>
        <View style={[styles.barreRemplie, { width: `${Math.max(2, (faites / etapes.length) * 100)}%` }]} />
      </View>

      {etapes.map((e, i) => {
        const depliee = e.cle === ouverte
        return (
          <View key={e.cle} style={[styles.rang, i > 0 && styles.rangSep]}>
            <View style={[styles.puce, e.faite && styles.puceOk, depliee && styles.puceActive]}>
              {e.faite ? (
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={theme.success} strokeWidth={2.4}>
                  <Path d="M5 12l4 4L19 6" />
                </Svg>
              ) : depliee ? (
                <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth={2}>
                  {e.cle === 'inventaire' && <><Rect x="4" y="3" width="16" height="18" rx="2" /><Path d="M8 8h8M8 12h8M8 16h5" /></>}
                  {e.cle === 'zones' && <><Rect x="3" y="3" width="7" height="7" rx="1" /><Rect x="14" y="3" width="7" height="7" rx="1" /><Rect x="3" y="14" width="7" height="7" rx="1" /><Path d="M14 17.5h7M17.5 14v7" /></>}
                  {e.cle === 'fichiers' && <><Path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" /><Path d="M14 3v5h5M8 13h8M8 17h5" /></>}
                  {e.cle === 'membres' && <><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" /></>}
                </Svg>
              ) : (
                <Text style={styles.puceNum}>{i + 1}</Text>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.rangTitre, !depliee && styles.rangTitreEteint]}>{e.titre}</Text>
              {e.resume && <Text style={styles.rangResume}>{e.resume}</Text>}
              {depliee && (
                <>
                  <Text style={styles.rangTexte}>{e.texte}</Text>
                  <Pressable style={styles.btn} onPress={() => onAction(e.cle)}>
                    <Text style={styles.btnText}>{e.action}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )
      })}

      <Pressable style={styles.masquer} onPress={onMasquer}>
        <Text style={styles.masquerText}>Masquer ce guide</Text>
      </Pressable>
    </View>
  )
}

const makeStyles = (t: Theme) => StyleSheet.create({
  carte: {
    backgroundColor: t.surface, borderColor: t.accent, borderWidth: 1, borderRadius: Radius.lg,
    padding: Spacing.lg, marginHorizontal: Spacing.lg, marginTop: Spacing.lg,
  },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { color: t.textPrimary, fontSize: 16, fontFamily: Font.semibold },
  compte: { color: t.textSecondary, fontSize: 13, fontFamily: Font.medium },
  barre: { height: 6, borderRadius: 6, backgroundColor: t.border, overflow: 'hidden', marginTop: Spacing.md, marginBottom: Spacing.xs },
  barreRemplie: { height: '100%', borderRadius: 6, backgroundColor: t.accent },
  rang: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md },
  rangSep: { borderTopWidth: 1, borderTopColor: t.border },
  puce: { width: 34, height: 34, borderRadius: Radius.md, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center' },
  puceActive: { backgroundColor: t.accentSoft, borderColor: t.accent },
  puceOk: { backgroundColor: t.successSoft, borderColor: t.success },
  puceNum: { color: t.textMuted, fontSize: 13, fontFamily: Font.semibold },
  rangTitre: { color: t.textPrimary, fontSize: 14, fontFamily: Font.semibold },
  rangTitreEteint: { color: t.textSecondary },
  rangResume: { color: t.textMuted, fontSize: 12.5, fontFamily: Font.regular, marginTop: 1 },
  rangTexte: { color: t.textSecondary, fontSize: 13, fontFamily: Font.regular, lineHeight: 18, marginTop: Spacing.xs },
  btn: { height: 38, borderRadius: Radius.md, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, alignSelf: 'flex-start', marginTop: Spacing.md },
  btnText: { color: t.onAccent, fontSize: 13, fontFamily: Font.semibold },
  masquer: { alignItems: 'center', paddingTop: Spacing.md },
  masquerText: { color: t.textMuted, fontSize: 12.5, fontFamily: Font.medium },
})
