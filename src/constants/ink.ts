// ─── Ardoise — les jetons de thème de l'application ──────────────────────────
//
// Deux palettes (clair + sombre). Les clés sont un sur-ensemble de l'ancien
// objet `Colors` : les styles existants continuent de marcher.
//
// ⚠️ ARDOISE A REMPLACÉ « INK » LE 6 SEPTEMBRE 2026, et l'application a suivi
// le site le même jour. Ce qui est parti, et il faut le savoir avant de croire
// à une régression : l'indigo (#4F46E5 / #6366F1), les fonds bleu nuit
// (#0B0F19, #151A27), Inter, les ombres sous les cartes et les rayons à 16.
//
// Les trois signes mesurés de l'air « fait par une IA », relevés sur qonto.com
// le 6 septembre : un accent qui revient partout, un contour sur chaque bloc,
// et une échelle typographique trop serrée. Ardoise s'y attaque par une règle
// simple — **l'accent ne sert qu'à ce qui ENGAGE** : le bouton principal, la
// passe de comptage. Partout ailleurs, de l'encre.
//
// ⚠️ LES DEUX PRODUITS PARTAGENT CES VALEURS. Elles sont la copie de
// `web/app/globals.css` (bloc `:root` et `:root[data-theme="light"]`) — le site
// et l'application ne compilent pas ensemble, comme `presence.ts`, `import.ts`
// et `report.ts`. Elles bougent ENSEMBLE, et un test compare les deux.

export type ThemeName = 'light' | 'dark'

export interface Theme {
  name: ThemeName
  // Surfaces & background
  background: string
  surface: string
  surfaceElevated: string
  // Header (near-black Ink bar)
  headerBg: string
  headerText: string
  headerSubtle: string
  headerBtnBg: string
  headerBtnBorder: string
  // Lines
  border: string          // = hairline (kept name for compat with old styles)
  hairline: string
  borderStrong: string
  // Text
  textPrimary: string
  textSecondary: string
  textMuted: string
  // Accent (indigo)
  primary: string         // kept name for compat → maps to accent
  primaryDark: string
  accent: string
  accentDark: string
  accentSoft: string
  onAccent: string
  // Semantic
  secondary: string       // success (kept name for compat)
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  // Pass colors
  passColors: { 1: string; 2: string; 3: string }
  // Camera backdrop
  cameraBg: string
  // Shadows (RN style objects)
  shadowCard: object
  shadowElevated: object
  shadowButton: object
}

/**
 * ⚠️ UNE CARTE N'A PLUS D'OMBRE, ET C'EST LE POINT D'ARDOISE.
 *
 * Elle ne se détache pas parce qu'on l'a détourée : elle se détache parce que
 * son fond diffère de celui de la page. Mesuré sur qonto.com le 6 septembre
 * 2026 — leurs cartes n'ont ni bordure ni ombre. Le contour sur chaque bloc
 * est l'un des trois signes du « fait par une IA ».
 *
 * ⚠️ CE QUI FLOTTE GARDE SA PROFONDEUR. Une feuille modale, un menu, un voile
 * posé par-dessus du contenu : là, l'ombre dit quelque chose de vrai — cet
 * objet est AU-DESSUS. `shadowElevated` reste, et lui seul.
 *
 * ⚠️ Et sur Android, `elevation` fait la même chose que l'ombre iOS : la
 * retirer des deux à la fois est nécessaire, sinon les cartes se détachent sur
 * un système et pas sur l'autre.
 */
const aucuneOmbre = {} as const

const lightShadowElevated = {
  shadowColor: '#14181A',
  shadowOpacity: 0.14,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
}
const darkShadowElevated = {
  shadowColor: '#000000',
  shadowOpacity: 0.42,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
}

export const lightTheme: Theme = {
  name: 'light',
  // Le papier d'Ardoise n'est ni blanc cassé ni crème : c'est un gris de
  // chantier, très légèrement vert. La surface reste franchement blanche —
  // c'est l'écart entre les deux qui découpe l'écran, maintenant qu'il n'y a
  // plus ni ombre ni bordure.
  background: '#F2F3F1',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  // ⚠️ LE BANDEAU EST SOMBRE DANS LES DEUX THÈMES, et ce n'est pas un défaut :
  // c'est le « bandeau encre » de la charte, comme sur le site. C'est
  // justement parce qu'il est volontairement sombre que le force-dark
  // d'Android le rendait BLANC (31 août 2026) — ne pas « corriger ».
  // L'encre d'Ardoise remplace le bleu nuit #0B0F19 (décision de Julien,
  // 6 septembre) : deux noirs différents ne se voient pas isolément, ils se
  // voient quand on pose le téléphone à côté de l'écran.
  headerBg: '#14181A',
  headerText: '#FFFFFF',
  headerSubtle: 'rgba(255,255,255,0.58)',
  headerBtnBg: 'rgba(255,255,255,0.12)',
  headerBtnBorder: 'rgba(255,255,255,0.18)',
  border: '#E2E5E1',
  hairline: '#E2E5E1',
  borderStrong: '#C6CCC7',
  textPrimary: '#14181A',
  textSecondary: '#575F5C',
  textMuted: '#8A918E',
  primary: '#1E4D3B',
  primaryDark: '#163D2E',
  accent: '#1E4D3B',
  accentDark: '#163D2E',
  accentSoft: '#E7EDE9',
  onAccent: '#FFFFFF',
  // ⚠️ LE SUCCÈS EST UN VERT PLUS CLAIR ET PLUS VIF QUE L'ACCENT. Depuis
  // qu'Ardoise a fait de l'accent un vert forêt, deux verts de même valeur sur
  // le même écran ne se distinguent plus — c'est pourquoi le bouton
  // « Exporter » a quitté le succès pour l'accent.
  secondary: '#15704F',
  success: '#15704F',
  successSoft: '#E6F0EB',
  warning: '#A06A12',
  warningSoft: '#F7F0E2',
  danger: '#96291D',
  dangerSoft: '#F6E9E7',
  passColors: { 1: '#1E4D3B', 2: '#15704F', 3: '#96291D' },
  cameraBg: '#0E1110',
  shadowCard: aucuneOmbre,
  shadowElevated: lightShadowElevated,
  shadowButton: aucuneOmbre,
}

export const darkTheme: Theme = {
  name: 'dark',
  background: '#141716',
  surface: '#1B1F1E',
  surfaceElevated: '#232827',
  headerBg: '#0B0D0C',
  headerText: '#FFFFFF',
  headerSubtle: 'rgba(255,255,255,0.55)',
  headerBtnBg: 'rgba(255,255,255,0.10)',
  headerBtnBorder: 'rgba(255,255,255,0.14)',
  border: '#262B29',
  hairline: '#262B29',
  borderStrong: '#3A413E',
  textPrimary: '#ECEFEC',
  textSecondary: '#9AA39E',
  textMuted: '#6E7772',
  primary: '#5FA88A',
  primaryDark: '#74B89B',
  accent: '#5FA88A',
  accentDark: '#74B89B',
  accentSoft: 'rgba(95,168,138,0.16)',
  onAccent: '#10201A',
  secondary: '#4FBF95',
  success: '#4FBF95',
  successSoft: 'rgba(79,191,149,0.14)',
  warning: '#D69A3C',
  warningSoft: 'rgba(214,154,60,0.14)',
  danger: '#D9695A',
  dangerSoft: 'rgba(217,105,90,0.15)',
  passColors: { 1: '#5FA88A', 2: '#4FBF95', 3: '#D9695A' },
  cameraBg: '#080A09',
  shadowCard: aucuneOmbre,
  shadowElevated: darkShadowElevated,
  shadowButton: aucuneOmbre,
}

export const themes: Record<ThemeName, Theme> = { light: lightTheme, dark: darkTheme }

// ─── Scales ───────────────────────────────────────────────────────────────────
export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const

/**
 * ⚠️ TROIS RAYONS, PAS DIX-SEPT. Un outil de travail n'a pas les coins ronds
 * d'une application grand public : le site est passé à 3 et 4 px, l'application
 * suit. Les clés gardent leurs noms — `sm`, `md`, `lg`, `xl` sont employés dans
 * une centaine de styles — mais elles ne portent plus que deux valeurs.
 * `pill` reste une capsule : c'est une FORME, pas un rayon.
 */
export const Radius = { sm: 3, md: 4, lg: 4, xl: 4, pill: 999 } as const

/**
 * Les polices — Archivo pour les titres et les nombres, Public Sans pour le
 * texte courant. Enregistrées dans `_layout.tsx` par expo-font.
 *
 * ⚠️ INTER EST PARTIE LE 6 SEPTEMBRE 2026, et ce n'est pas un caprice : c'est
 * l'une des deux valeurs par défaut de l'époque (avec Sora), et l'un des trois
 * signes mesurés de l'air « fait par une IA ». Le site l'a retirée le matin,
 * l'application l'après-midi.
 *
 * ⚠️ ET LE CHANGEMENT ALLÈGE L'APPLICATION. Mesuré : les cinq graisses d'Inter
 * pèsent **1 678 ko** de TTF à elles seules. Les quatre familles qui les
 * remplacent — Archivo (2), Public Sans (3), IBM Plex Mono (2), Newsreader (1)
 * — pèsent **792 ko** au total, soit **886 ko de MOINS** alors qu'on ajoute
 * deux familles.
 *
 * Deux raisons de terrain, en plus de la cohérence avec le site :
 * · Archivo a des chiffres tabulaires et une chasse étroite — sur l'écran de
 *   comptage, un libellé d'article tient sur une ligne là où Inter le casse
 *   en deux, et les quantités s'alignent en colonne ;
 * · `serif` et `mono` ne servent QUE sur les deux écrans qui font foi — le
 *   rapport et les écarts d'audit. Voir la piste « Registre ».
 */
export const Font = {
  regular: 'PublicSans_400Regular',
  medium: 'PublicSans_500Medium',
  semibold: 'PublicSans_600SemiBold',
  bold: 'Archivo_700Bold',
  extrabold: 'Archivo_800ExtraBold',
  /** Registre : le titre d'un document. Ne pas employer ailleurs. */
  serif: 'Newsreader_500Medium',
  /** Registre : tous les nombres d'un document. Ne pas employer ailleurs. */
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const

// Chiffres alignés en colonne — toute quantité, tout prix, tout code.
export const tabular = { fontVariant: ['tabular-nums' as const] }
