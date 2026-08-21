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
export function Logo({ size = 40, gradientId = 'qbg' }: { size?: number; gradientId?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-label="Quantinvo">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7466F4" />
          <stop offset="0.52" stopColor="#4636B0" />
          <stop offset="1" stopColor="#1C153F" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="500" height="500" rx="116" fill={`url(#${gradientId})`} />
      <polygon points="256,146 352,196 256,246 160,196" fill="#A99CFA" />
      <polygon points="160,196 256,246 256,366 160,316" fill="#6E5DEC" />
      <polygon points="352,196 352,316 256,366 256,246" fill="#4A3AA8" />
      <rect x="92" y="282" width="328" height="12" rx="6" fill="#38C9FF" />
    </svg>
  )
}
