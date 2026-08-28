import Svg, { Circle, Path, Rect } from 'react-native-svg'

/**
 * Les icônes des lignes de menu.
 *
 * ⚠️ **Au trait, jamais en aplat.** À 21 px, une icône pleine devient une
 * tache : on voit une forme colorée, pas un objet. Le trait garde la silhouette
 * lisible, et il prend la couleur du rang — donc il rougit avec « Se
 * déconnecter » sans qu'on ait à dessiner une seconde version.
 *
 * Toutes sont réglées sur la même grille de 24 et la même épaisseur de trait
 * (1,7). Une icône qui n'y serait pas se remarquerait immédiatement dans une
 * colonne : c'est l'alignement des traits qui fait tenir une liste, pas le
 * dessin de chacune.
 *
 * Le vocabulaire, à respecter si on en ajoute une : un contour fermé pour un
 * lieu ou un objet (magasin, carte d'identité, bouclier), un trait ouvert pour
 * un mouvement (téléchargement, sortie).
 */

export type NomIcone =
  | 'magasin'
  | 'equipe'
  | 'outils'
  | 'profil'
  | 'donnees'
  | 'reperes'
  | 'sortie'
  | 'nom'
  | 'cle'
  | 'bouclier'
  | 'corbeille'

export function MenuIcon({ nom, color, size = 21 }: { nom: NomIcone; color: string; size?: number }) {
  const t = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {nom === 'magasin' && (
        <>
          <Path d="M3 9l1.6-5h14.8L21 9" {...t} />
          <Path d="M4 9v11h16V9" {...t} />
          <Path d="M9.5 20v-6h5v6" {...t} />
        </>
      )}
      {nom === 'equipe' && (
        <>
          <Circle cx={9} cy={8} r={3} {...t} />
          <Path d="M3 20a6 6 0 0 1 12 0" {...t} />
          <Path d="M16 5.5a3 3 0 0 1 0 5.9" {...t} />
          <Path d="M17.5 14.5A5.5 5.5 0 0 1 21 20" {...t} />
        </>
      )}
      {nom === 'outils' && (
        <>
          <Path d="M14.7 6.3a3.5 3.5 0 0 0 4.6 4.6l-9 9a2.1 2.1 0 0 1-3-3z" {...t} />
          <Path d="M15 9l-1.5-1.5" {...t} />
        </>
      )}
      {nom === 'profil' && (
        <>
          <Circle cx={12} cy={12} r={9} {...t} />
          <Circle cx={12} cy={10} r={3} {...t} />
          <Path d="M6.4 18.5a6.2 6.2 0 0 1 11.2 0" {...t} />
        </>
      )}
      {nom === 'donnees' && (
        <>
          <Path d="M12 3v11" {...t} />
          <Path d="M8 10.5l4 4 4-4" {...t} />
          <Path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" {...t} />
        </>
      )}
      {nom === 'reperes' && (
        <>
          <Path d="M9.5 18h5" {...t} />
          <Path d="M10 21h4" {...t} />
          <Path d="M12 3a6 6 0 0 1 3.6 10.8c-.6.5-.9 1-1 1.7h-5.2c-.1-.7-.4-1.2-1-1.7A6 6 0 0 1 12 3z" {...t} />
        </>
      )}
      {nom === 'sortie' && (
        <>
          <Path d="M9.5 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3h4" {...t} />
          <Path d="M15.5 16.5L20 12l-4.5-4.5" {...t} />
          <Path d="M20 12H9" {...t} />
        </>
      )}
      {nom === 'nom' && (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2.5} {...t} />
          <Circle cx={9} cy={11} r={2.2} {...t} />
          <Path d="M5.8 16.2a3.6 3.6 0 0 1 6.4 0" {...t} />
          <Path d="M15 10h4" {...t} />
          <Path d="M15 14h4" {...t} />
        </>
      )}
      {nom === 'cle' && (
        <>
          <Circle cx={8} cy={12} r={3.5} {...t} />
          <Path d="M11.5 12H21" {...t} />
          <Path d="M18 12v3" {...t} />
          <Path d="M15 12v2.2" {...t} />
        </>
      )}
      {nom === 'bouclier' && (
        <>
          <Path d="M12 3l7.5 3v5.5c0 4.3-3 8-7.5 9.5-4.5-1.5-7.5-5.2-7.5-9.5V6z" {...t} />
          <Path d="M9 12.2l2.1 2.1L15.4 10" {...t} />
        </>
      )}
      {nom === 'corbeille' && (
        <>
          <Path d="M4 7h16" {...t} />
          <Path d="M9.5 7V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4A1.3 1.3 0 0 1 14.5 4.8V7" {...t} />
          <Path d="M6.5 7l.9 12.2A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7" {...t} />
        </>
      )}
    </Svg>
  )
}
