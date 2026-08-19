import { createClient } from '@supabase/supabase-js'

// Valeurs publiques de repli.
//
// L'URL du projet et la clé « publishable » de Supabase sont faites pour être
// publiques : Next les fige dans le bundle à la construction (préfixe
// `NEXT_PUBLIC_`), donc elles sont déjà servies à chaque visiteur du site en
// ligne. Ce qui protège les données, ce sont les règles RLS de la base, pas le
// secret de cette clé — voir les policies scopées par participant.
//
// Pourquoi un repli plutôt que la seule configuration Vercel : les variables
// `NEXT_PUBLIC_*` sont lues **au moment du build**. Une preview dont la portée
// « Preview » n'était pas cochée dans le tableau de bord se construisait donc
// sans configuration, démarrait en tapant sur une URL inexistante, et affichait
// « e-mail ou mot de passe incorrect » à chaque tentative de connexion — une
// piste entièrement fausse, coûteuse à remonter.
//
// Les variables d'environnement restent prioritaires quand elles existent : la
// production garde les siennes, et pointer un déploiement sur un autre projet
// Supabase reste possible sans toucher à ce fichier.
//
// À maintenir : si la clé publishable est révoquée ou tournée côté Supabase,
// mettre à jour la constante ci-dessous.
const FALLBACK_URL = 'https://heabesqvlinzarqenymj.supabase.co'
const FALLBACK_ANON_KEY = 'sb_publishable_J857c9oNhoSphjsKD6bM1Q_Cvw7t8B2'

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const url = envUrl || FALLBACK_URL
const anonKey = envAnonKey || FALLBACK_ANON_KEY

/** `true` quand le déploiement tourne sur le repli faute de variables d'environnement. */
export const usingFallbackConfig = !envUrl || !envAnonKey

if (usingFallbackConfig && typeof window !== 'undefined') {
  console.warn(
    'Supabase : NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY absentes ' +
      'de ce build — repli sur les valeurs publiques par défaut du projet.',
  )
}

// ── Durée de vie de la session : celle du navigateur, pas plus ──────────────
//
// Par défaut, supabase-js range le jeton dans `localStorage` : fermer le
// navigateur ne déconnecte pas, et n'importe qui rouvrant le poste retrouve la
// session — inacceptable sur les ordinateurs partagés d'un magasin. On range
// donc la session dans `sessionStorage` : fermer le navigateur (ou l'onglet)
// la termine, et chaque nouvel onglet demande une connexion.
//
// Les versions précédentes ont laissé des jetons dans `localStorage` : on les
// purge au chargement, sinon ces sessions dormantes survivraient au correctif.
const projectRef = new URL(url).hostname.split('.')[0]

if (typeof window !== 'undefined') {
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith(`sb-${projectRef}-`)) window.localStorage.removeItem(key)
  }
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Au prérendu (pas de `window`), supabase-js retombe sur son adaptateur
    // par défaut, qui ne fait rien hors navigateur.
    ...(typeof window !== 'undefined' ? { storage: window.sessionStorage } : {}),
  },
})
