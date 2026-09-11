/**
 * Les deux drapeaux du sélecteur de langue, dessinés.
 *
 * ⚠️ PAS D'ÉMOJI. `🇫🇷` et `🇬🇧` ne s'affichent comme des drapeaux que sur Apple
 * et Android : sur Windows, la police système n'a pas les caractères régionaux
 * et le navigateur rend deux lettres — « FR », « GB ». Un visiteur sur PC, donc
 * la majorité, verrait un code là où on annonce un drapeau. Deux SVG de
 * quelques rectangles coûtent moins que ce défaut.
 */
export function Drapeau({ langue }: { langue: 'fr' | 'en' }) {
  if (langue === 'fr') {
    return (
      <svg className="drapeau" viewBox="0 0 18 12" aria-hidden="true" focusable="false">
        <rect width="18" height="12" rx="1.5" fill="#FFFFFF" />
        <path d="M1.5 0H6v12H1.5A1.5 1.5 0 0 1 0 10.5v-9A1.5 1.5 0 0 1 1.5 0Z" fill="#002654" />
        <path d="M12 0h4.5A1.5 1.5 0 0 1 18 1.5v9a1.5 1.5 0 0 1-1.5 1.5H12V0Z" fill="#ED2939" />
      </svg>
    )
  }
  // L'Union Jack, simplifié à ce qu'on en voit à 18 px de large : le champ
  // bleu, les diagonales blanches puis rouges, la croix blanche puis rouge.
  return (
    <svg className="drapeau" viewBox="0 0 18 12" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="drapeau-en"><rect width="18" height="12" rx="1.5" /></clipPath>
      </defs>
      <g clipPath="url(#drapeau-en)">
        <rect width="18" height="12" fill="#012169" />
        <path d="M0 0 18 12M18 0 0 12" stroke="#FFFFFF" strokeWidth="2.4" />
        <path d="M0 0 18 12M18 0 0 12" stroke="#C8102E" strokeWidth="1.2" />
        <path d="M9 0v12M0 6h18" stroke="#FFFFFF" strokeWidth="4" />
        <path d="M9 0v12M0 6h18" stroke="#C8102E" strokeWidth="2.2" />
      </g>
    </svg>
  )
}
