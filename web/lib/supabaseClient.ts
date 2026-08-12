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

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})
