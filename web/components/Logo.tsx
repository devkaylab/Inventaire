/**
 * La marque Quantinvo — « la zone ».
 *
 * Un plan de magasin réduit à deux formes : le cadre, et l'allée qu'on est en
 * train de compter. C'est le différenciateur du produit — une zone par
 * semaine, pas un grand week-end par an — et c'est la seule chose que le
 * symbole raconte.
 *
 * ⚠️ LE CUBE ISOMÉTRIQUE A DISPARU LE 6 SEPTEMBRE 2026, sur décision de
 * Julien, et avec lui l'indigo puis le vert forêt qu'il avait porté une
 * journée. La marque est désormais MONOCHROME : elle prend la couleur du
 * texte qui l'entoure (`currentColor`), et ne porte aucun accent. C'est
 * cohérent avec Ardoise, où l'accent ne sert qu'à ce qui engage — un logo
 * n'engage rien, il nomme.
 *
 * ⚠️ ET LE DESSIN A ÉTÉ ÉPAISSI PAR RAPPORT À LA PLANCHE D'ORIGINE. Celle-ci
 * portait trois allées de 3 unités sur 36, avec la première collée au bloc
 * plein et toutes collées au cadre : mesuré à 16 px — la taille du favicon —
 * il n'en restait qu'une tache, et les deux formes de gauche fusionnaient dès
 * 192 px. Ici tout fait au moins 4,5 unités sur 36, soit un huitième de la
 * largeur, et rien ne se touche : le cadre garde 6 unités d'air à gauche de
 * l'allée, 12 à droite. La marque se dégrade proprement — à 16 px il reste un
 * cadre et une barre, ce qui est encore vrai.
 *
 * Pour revenir au dessin d'origine, c'est ce bloc-ci qu'on remplace ; rien
 * d'autre dans le produit ne connaît la géométrie.
 *
 * `gradientId` n'a plus d'objet — il n'y a plus de dégradé — mais le
 * paramètre reste accepté : une dizaine d'écrans le passent encore, et les
 * casser tous pour une propriété devenue inerte ne rendrait service à
 * personne. Il sera retiré quand ces appels le seront.
 */
export function Logo({ size = 40 }: { size?: number; gradientId?: string }) {
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
      <rect x="2.25" y="2.25" width="31.5" height="31.5" fill="none" stroke="currentColor" strokeWidth="4.5" />
      {/* L'allée qu'on compte. Décentrée : une zone n'est pas au milieu. */}
      <rect x="10.5" y="4.5" width="9" height="27" fill="currentColor" />
    </svg>
  )
}
