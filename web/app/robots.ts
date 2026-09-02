import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/**
 * ⚠️ Le site n'avait AUCUN `robots.txt` avant le 2 septembre 2026 : les
 * moteurs exploraient donc aussi les pages de parcours et les devis.
 *
 * Ce qui est fermé l'est pour une raison, pas par précaution :
 * - `/devis/` : une page par prospect, derrière un jeton. L'indexer publierait
 *   des devis, avec des montants et des noms d'entreprise.
 * - `/bienvenue`, `/reinitialisation`, `/mot-de-passe-oublie` : des liens
 *   personnels reçus par e-mail, sans contenu à lire.
 * - `/dashboard`, `/inventaires`, `/entreprise`, `/equipe`, `/magasins`,
 *   `/journal`, `/messages`, `/admin`, `/outils`, `/account` : l'espace
 *   connecté. Il ne s'ouvre même pas sous 720 px.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: [
        '/devis/', '/bienvenue', '/reinitialisation', '/mot-de-passe-oublie',
        '/dashboard', '/inventaires', '/entreprise', '/equipe', '/magasins',
        '/journal', '/messages', '/admin', '/outils', '/account',
      ],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
