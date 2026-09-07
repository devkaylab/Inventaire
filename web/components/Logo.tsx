/**
 * La marque Quantinvo — « la zone ».
 *
 * Un plan de magasin réduit à son minimum : le cadre, trois allées, et celle
 * qu'on est en train de compter, pleine. C'est le différenciateur du produit —
 * une zone par semaine, pas un grand week-end par an — et c'est la seule chose
 * que le symbole raconte.
 *
 * ⚠️ LE CUBE ISOMÉTRIQUE A DISPARU LE 6 SEPTEMBRE 2026, sur décision de
 * Julien, et avec lui l'indigo puis le vert forêt qu'il aura porté une
 * journée. La marque est MONOCHROME : elle prend la couleur du texte qui
 * l'entoure (`currentColor`) et ne porte aucun accent. C'est cohérent avec
 * Ardoise, où l'accent ne sert qu'à ce qui engage — un logo n'engage rien,
 * il nomme.
 *
 * ⚠️ LA GÉOMÉTRIE EST CELLE DE LA PLANCHE, AU DIXIÈME PRÈS, ET C'EST UN CHOIX
 * DE JULIEN — repris tel quel après qu'une version épaissie lui a été
 * présentée. Ce qu'il faut savoir avant d'y toucher, parce que c'est mesuré et
 * que ça ne se voit qu'aux petites tailles :
 *   · le bloc plein (x 3→11) et la première allée fine (x 11→14) SE TOUCHENT.
 *     Ils se lisent donc comme une seule forme de 11 de large dès 192 px. La
 *     seconde paire (14→22 et 22→25) fait pareil quand l'allée pleine s'y
 *     déplace ;
 *   · les allées font 3 unités sur 36, soit un douzième — à 16 px, la taille
 *     du favicon, il en reste 1,3 px et la marque devient une tache.
 * Le favicon garde donc sa tuile, qui lui donne un fond et un peu de tenue,
 * et rien d'autre dans le produit ne connaît cette géométrie : elle se corrige
 * ici, en un seul endroit.
 *
 * `gradientId` n'a plus d'objet — il n'y a plus de dégradé — mais le paramètre
 * reste accepté : une dizaine d'écrans le passent encore, et les casser tous
 * pour une propriété devenue inerte ne rendrait service à personne.
 */
export function Logo({
  size = 40,
  anime = false,
}: {
  size?: number
  gradientId?: string
  /**
   * Fait balayer l'allée pleine d'une position à l'autre, pour les moments
   * d'attente. Voir `.logo-allee` dans `globals.css` — l'animation est en CSS
   * et non en SMIL, précisément pour qu'elle s'arrête sous
   * `prefers-reduced-motion`.
   */
  anime?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Quantinvo"
    >
      {/* Le magasin. */}
      <rect x="1.5" y="1.5" width="33" height="33" fill="none" stroke="currentColor" strokeWidth="3" />
      {/* Les deux allées qu'on ne compte pas maintenant. */}
      <rect x="11" y="3" width="3" height="30" fill="currentColor" />
      <rect x="22" y="3" width="3" height="30" fill="currentColor" />
      {/* Celle qu'on compte. En dernier : elle passe au-dessus des autres
          quand elle se déplace. */}
      <rect x="3" y="3" width="8" height="30" fill="currentColor" className={anime ? 'logo-allee' : undefined} />
    </svg>
  )
}
