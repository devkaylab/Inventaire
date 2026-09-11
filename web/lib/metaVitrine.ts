import type { Metadata } from 'next'
import type { Langue } from '@/lib/traduction'
import { lienVitrine } from '@/lib/vitrine'

export type TexteMeta = { title: string; description: string }

/**
 * Les métadonnées d'une page de la vitrine, dans les deux langues.
 *
 * ⚠️ LES DEUX ADRESSES SE DÉCLARENT L'UNE L'AUTRE (`hreflang`), et
 * `x-default` pointe sur le français : c'est ce qui dit à un moteur que
 * `/tarifs` et `/en/tarifs` sont la même page en deux langues, et non un
 * contenu dupliqué. Sans ces balises, la version anglaise concurrencerait la
 * française au lieu de la compléter.
 */
export function metaVitrine(langue: Langue, cheminFr: string, fr: TexteMeta, en: TexteMeta): Metadata {
  const cheminEn = lienVitrine('en', cheminFr)
  const texte = langue === 'en' ? en : fr
  return {
    // ⚠️ L'accueil porte déjà « — Quantinvo » dans son titre : le gabarit du
    // layout racine (`%s — Quantinvo`) le doublerait. `absolute` le court-circuite.
    title: cheminFr === '/' ? { absolute: texte.title } : texte.title,
    description: texte.description,
    alternates: {
      canonical: langue === 'en' ? cheminEn : cheminFr,
      languages: { fr: cheminFr, en: cheminEn, 'x-default': cheminFr },
    },
    openGraph: {
      locale: langue === 'en' ? 'en_GB' : 'fr_FR',
      title: texte.title,
      description: texte.description,
    },
  }
}
