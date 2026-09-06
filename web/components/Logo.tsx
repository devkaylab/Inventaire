/**
 * Le cube Quantinvo.
 *
 * `gradientId` existe parce qu'un identifiant SVG doit être **unique dans la
 * page**. Tant qu'il n'y avait qu'un logo par écran, personne ne le voyait ;
 * la barre de l'espace connecté et l'écran « ordinateur requis » en posent
 * deux. Avec le même identifiant, le navigateur résout les deux vers le
 * premier dégradé rencontré : ça marche tant que le premier est là, et le
 * second perd son fond dès qu'il disparaît. Passer un identifiant distinct
 * dès qu'une page porte deux logos.
 */
/**
 * ⚠️ LE CUBE EST PASSÉ DU VIOLET AU VERT FORÊT LE 6 SEPTEMBRE 2026, sur
 * décision de Julien, en même temps que la palette « Ardoise ». L'indigo était
 * devenu le seul objet violet d'une interface verte — dans la barre et dans le
 * héros, deux accents se disputaient l'écran.
 *
 * ⚠️ ET LE LOGO NE VIT PAS QUE DANS CE FICHIER. Trois autres supports le
 * portent, et tant qu'ils ne sont pas refaits la marque a deux visages :
 *   · `web/public/email/logo-quantinvo.png` — l'image du bandeau des e-mails,
 *     servie par le site à toutes les fonctions edge ;
 *   · l'icône des applications (`assets/`), qui n'entre en vigueur qu'au
 *     prochain build iOS et Android ;
 *   · les trois decks de `docs/entreprise/`.
 *
 * Les valeurs gardent l'échelonnement de l'original — une face claire, une
 * moyenne, une sombre — sinon le cube cesse de se lire comme un volume. Le
 * filet de scan reste la seule note froide, dans le cyan minéral d'Ardoise.
 */
export function Logo({ size = 40, gradientId = 'qbg' }: { size?: number; gradientId?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-label="Quantinvo">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4E9B79" />
          <stop offset="0.52" stopColor="#23604A" />
          <stop offset="1" stopColor="#0E241C" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="500" height="500" rx="116" fill={`url(#${gradientId})`} />
      <polygon points="256,146 352,196 256,246 160,196" fill="#A8D6C1" />
      <polygon points="160,196 256,246 256,366 160,316" fill="#63AE8C" />
      <polygon points="352,196 352,316 256,366 256,246" fill="#35745B" />
      <rect x="92" y="282" width="328" height="12" rx="6" fill="#4FB6CF" />
    </svg>
  )
}
