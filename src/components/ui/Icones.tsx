/**
 * Les icônes de l'application — des tracés, jamais des emoji.
 *
 * ⚠️ **Un emoji n'est pas une icône.** Il est dessiné par le système, dans sa
 * propre palette : posé à côté d'icônes vectorielles à la couleur du thème, il
 * se lit comme une pièce rapportée. Même motif que la croix d'annulation d'une
 * invitation, passée en tracé le 22 août 2026 — et que le chevron des
 * `<details>` du site.
 *
 * Elles vivent ici, en un seul endroit, parce que plusieurs écrans s'en
 * servent : la corbeille est sur Zones comme sur la fiche d'un inventaire,
 * l'alerte et l'astuce sur l'import comme sur le scanner.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg'

export function CorbeilleIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

export function AlerteIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.6 1.8 20.4h20.4L12 3.6Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M12 10v4.4" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={12} cy={17.4} r={1.1} fill={color} />
    </Svg>
  )
}

/** L'astuce : une ampoule. */
export function AstuceIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1 1 1.7l.1.5h5l.1-.5c.1-.6.4-1.2 1-1.7A6 6 0 0 0 12 3Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M10 19h4M10.6 21h2.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  )
}

export function FichierIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M14 3H7a1.6 1.6 0 0 0-1.6 1.6v14.8A1.6 1.6 0 0 0 7 21h10a1.6 1.6 0 0 0 1.6-1.6V7.6L14 3Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M13.6 3.2v4.6h4.6M8.6 13h6.8M8.6 16.6h6.8" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  )
}

/** La torche du scanner — le seul bouton de l'écran de scan sans libellé. */
export function TorcheIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9 2h6v3.2l-1.4 2.2v13.2a1.4 1.4 0 0 1-1.4 1.4h-.4a1.4 1.4 0 0 1-1.4-1.4V7.4L9 5.2V2Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M9 5.4h6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  )
}

/** La coche des états réussis — remplace le caractère « ✓ ». */
export function CocheIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.5 12.8 9.5 18 19.5 6.5"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

/** Croix de fermeture ou de retrait — jamais le caractère « ✕ ». */
export function CroixIcon({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    </Svg>
  )
}

/** Gardé pour les encadrés qui n'ont qu'un fond à remplir. */
export function PastilleIcon({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 8 8">
      <Rect x={0} y={0} width={8} height={8} rx={4} fill={color} />
    </Svg>
  )
}
