import type { MetadataRoute } from 'next'
import { PAGES_PUBLIQUES, url } from '@/lib/site'

/**
 * Le plan du site. La liste vit dans `lib/site.ts` — un test la compare aux
 * pages réellement présentes dans `app/`, pour qu'une page publique ajoutée un
 * jour ne reste pas invisible des moteurs sans que personne ne le voie.
 *
 * ⚠️ `lastModified` est la date de construction, pas une date inventée par
 * page. Un plan du site qui annonce des dates fausses est ignoré.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const maintenant = new Date()
  return PAGES_PUBLIQUES.map(p => ({
    url: url(p.chemin),
    lastModified: maintenant,
    changeFrequency: p.frequence,
    priority: p.priorite,
  }))
}
