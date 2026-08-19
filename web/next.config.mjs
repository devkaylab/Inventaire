/**
 * En-têtes de sécurité (constat M1 de l'audit du 13 août 2026).
 *
 * Le site n'en envoyait aucun : le navigateur appliquait ses réglages par
 * défaut, permissifs. Rien n'empêchait par exemple d'afficher le tableau de
 * bord dans un cadre invisible sur un autre site pour détourner les clics d'un
 * superviseur.
 *
 * Ces en-têtes sont posés ici plutôt que dans `vercel.json` : Next les applique
 * aussi bien en développement qu'en production, donc une règle trop stricte se
 * voit tout de suite au lieu d'apparaître au déploiement.
 */

// Même repli que `lib/supabaseClient.ts` : la politique doit décrire le
// projet réellement joint, y compris quand la variable d'environnement manque.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://heabesqvlinzarqenymj.supabase.co'
const SUPABASE_WS = SUPABASE_URL.replace(/^https:/, 'wss:')

const csp = [
  "default-src 'self'",

  // `unsafe-inline` est ici une concession assumée, pas un oubli : le routeur
  // d'application de Next injecte ses propres scripts en ligne pour
  // l'hydratation, et `layout.tsx` en pose un pour appliquer le thème avant le
  // premier affichage. S'en passer demande un nonce par requête, donc un
  // middleware — au prix du rendu statique des pages publiques. À arbitrer.
  // Même sans lui, la règle bloque déjà l'essentiel : aucun script d'un autre
  // domaine ne peut s'exécuter.
  //
  // `unsafe-eval` n'est accordé qu'au serveur de développement : le runtime de
  // `next dev` (rafraîchissement à chaud, source maps) passe par `eval()`, et
  // sans lui aucune page ne se charge — les tests Playwright tournent sur ce
  // serveur. Le build de production n'en a pas besoin, et le test de garde
  // (`tests/entetes-securite.test.ts`, exécuté hors développement) vérifie
  // qu'il n'y figure jamais.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,

  // Next injecte également ses styles en ligne.
  "style-src 'self' 'unsafe-inline'",

  // `blob:` sert au téléchargement du rapport (`URL.createObjectURL`).
  "img-src 'self' data: blob:",
  "font-src 'self' data:",

  // Les seules destinations réseau légitimes : la base et son canal temps réel.
  `connect-src 'self' ${SUPABASE_URL} ${SUPABASE_WS}`,

  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",

  // Le cœur du correctif : personne ne peut encadrer ces pages.
  "frame-ancestors 'none'",

  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },

  // Deux ans, sous-domaines compris. `preload` est volontairement omis : il
  // suppose une inscription à la liste des navigateurs, que rien n'a faite.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },

  // Redondant avec `frame-ancestors`, gardé pour les navigateurs anciens.
  { key: 'X-Frame-Options', value: 'DENY' },

  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Le site n'utilise ni caméra, ni micro, ni géolocalisation — vérifié dans le
  // code. On le déclare, pour qu'un script injecté ne puisse pas les demander.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
