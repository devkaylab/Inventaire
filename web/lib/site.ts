/**
 * L'adresse canonique du site, et les pages que les moteurs doivent connaître.
 *
 * ⚠️ **Une seule origine, et elle porte le `www`.** C'est celle que Vercel a
 * choisie à l'ajout du domaine : `quantinvo.com` redirige en 308 vers
 * `www.quantinvo.com`, et `quantinvo.vercel.app` reste servi en alias pour les
 * liens déjà envoyés par e-mail. Déclarer une autre origine ici ferait pointer
 * les balises canoniques et le plan du site vers des adresses qui redirigent —
 * c'est exactement ce qui dilue un référencement.
 */
export const SITE_URL = 'https://www.quantinvo.com'

/** Une page publique du plan du site. */
export interface PagePublique {
  chemin: string
  /** Poids relatif, de 0 à 1. L'accueil à 1, le reste en dessous. */
  priorite: number
  /** À quelle fréquence son contenu bouge réellement. */
  frequence: 'monthly' | 'yearly'
}

/**
 * ⚠️ **Ce qui n'est PAS ici est délibéré.** Le plan du site ne liste que des
 * pages qui ont un sens pour quelqu'un qui arrive d'un moteur :
 *
 * - `/login`, `/bienvenue`, `/reinitialisation`, `/mot-de-passe-oublie` :
 *   des étapes de parcours, sans contenu à indexer ;
 * - `/devis/<jeton>` : une page par prospect, derrière un jeton — l'indexer
 *   publierait des devis ;
 * - tout l'espace connecté : il ne s'ouvre même pas sous 720 px.
 *
 * `/mentions-legales` n'y figure pas non plus tant que l'activité éditrice
 * n'est pas immatriculée : la page se met elle-même en `noindex` dans ce cas
 * (voir `lib/legal.ts`), et annoncer dans le plan du site une page qui refuse
 * l'indexation est contradictoire.
 */
export const PAGES_PUBLIQUES: PagePublique[] = [
  { chemin: '/', priorite: 1.0, frequence: 'monthly' },
  { chemin: '/inventaire', priorite: 0.9, frequence: 'monthly' },
  { chemin: '/pourquoi-nous-choisir', priorite: 0.9, frequence: 'monthly' },
  { chemin: '/tarifs', priorite: 0.9, frequence: 'monthly' },
  { chemin: '/souscrire', priorite: 0.8, frequence: 'monthly' },
  { chemin: '/inscription', priorite: 0.7, frequence: 'monthly' },
  { chemin: '/open', priorite: 0.5, frequence: 'monthly' },
  { chemin: '/superviseur', priorite: 0.3, frequence: 'yearly' },
  { chemin: '/confidentialite', priorite: 0.3, frequence: 'yearly' },
  { chemin: '/suppression-compte', priorite: 0.3, frequence: 'yearly' },
]

export const url = (chemin: string) => new URL(chemin, SITE_URL).toString()
