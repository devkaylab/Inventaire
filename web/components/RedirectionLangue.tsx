'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { langueEnregistree } from '@/lib/i18n'
import { cheminDansLangue, langueDuChemin } from '@/lib/vitrine'

/**
 * La détection automatique sur la vitrine (11 septembre 2026).
 *
 * Un visiteur dont le navigateur est en anglais, et qui n'a jamais choisi,
 * arrive sur `/tarifs` : on l'emmène sur `/en/tarifs`. Décision de Julien —
 * « tu peux garder la détection auto ». Ce qui borne le geste :
 *
 * - ⚠️ SEULEMENT DU FRANÇAIS VERS L'ANGLAIS, et seulement si la préférence
 *   enregistrée (cookie, sinon navigateur) dit « en ». Quelqu'un qui a choisi
 *   le français au bouton n'est jamais renvoyé ; quelqu'un qui ouvre `/en`
 *   depuis un lien reste sur `/en` — l'adresse qu'on lui a donnée fait foi ;
 * - ⚠️ JAMAIS POUR UN ROBOT. Un moteur qui explore `/tarifs` doit y trouver
 *   la page française, pas une redirection : les deux versions sont liées par
 *   `hreflang`, c'est à lui de choisir laquelle servir ;
 * - `replace`, pas `push` : le retour arrière ne doit pas retomber sur la page
 *   qui redirige.
 */
export function RedirectionLangue() {
  const chemin = usePathname()
  const router = useRouter()
  useEffect(() => {
    if (langueDuChemin(chemin) !== 'fr') return
    if (/bot|crawl|spider|slurp|preview|lighthouse/i.test(navigator.userAgent)) return
    if (langueEnregistree() !== 'en') return
    router.replace(cheminDansLangue(chemin ?? '/', 'en'))
  }, [chemin, router])
  return null
}
