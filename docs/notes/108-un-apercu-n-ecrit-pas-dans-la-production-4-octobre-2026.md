# Un aperçu n'écrit pas dans la production — 4 octobre 2026

## Le défaut

`web/lib/supabaseClient.ts` porte une adresse de repli **écrite en dur**, et
c'était un bon réflexe : une preview dont la portée « Preview » n'était pas
cochée dans Vercel se construisait sans configuration, tapait sur une URL
inexistante, et affichait « e-mail ou mot de passe incorrect » à chaque
tentative — une piste entièrement fausse, coûteuse à remonter.

Sauf que **le repli, c'est la base de production**. Un aperçu qui tombe dessus
ne casse rien : il marche, et il écrit chez les vrais clients. Mesuré ce jour
dans le bundle servi par l'aperçu On-Demand — il contient
`heabesqvlinzarqenymj.supabase.co`, la production.

Le seul signal existant était un `console.warn`, dans une console que personne
n'ouvre. Le drapeau `usingFallbackConfig` existait déjà et **n'était lu nulle
part** : deux occurrences dans tout le site, les deux dans le fichier qui le
déclare.

## Ce qui est posé

`web/lib/apercuSansBase.ts` dit si le déploiement est un **aperçu tombé sur le
repli**. `web/components/GardeApercu.tsx` refuse alors d'ouvrir l'app : il
**remplace** tout l'arbre — providers compris — par un écran qui nomme les deux
variables manquantes et la portée à cocher. Pas de champ, pas de bouton, pas de
client Supabase : aucune écriture possible.

## Les deux signaux, et pourquoi il en faut deux

- `NEXT_PUBLIC_VERCEL_ENV` vaut `preview` sur un aperçu. Vercel la pose seule,
  **mais seulement si « Automatically expose System Environment Variables » est
  coché**. Décoché, elle est vide — et un garde qui n'y tiendrait qu'elle
  laisserait passer sans rien dire, c'est-à-dire reproduirait exactement le
  défaut qu'il répare.
- Le **nom d'hôte** : un aperçu répond sur `*.vercel.app`. Celui-là ne dépend
  d'aucun réglage, mais ne se lit que dans le navigateur.

Le second se mesure par **suffixe**, jamais par `includes` :
`vercel.app.quantinvo.com` resterait la production.

## ⚠️ Ce qui compte le plus : ne pas pouvoir éteindre la production

Un refus trop large arrêterait le site en ligne — bien pire que le défaut
réparé. Trois choses l'empêchent, et chacune a sa garde :

1. **Le repli seul ne bloque rien.** La production tourne elle aussi sur le
   repli, volontairement. Il faut repli **et** aperçu.
2. **Une production qui se nomme n'est jamais bloquée.** Le site est aussi
   joignable par son adresse `*.vercel.app` : quand Vercel annonce
   `production`, le garde sort avant de regarder l'hôte.
3. **Le domaine du site n'est pas un aperçu**, et c'est vérifié sur la vraie
   fonction, pas sur une expression régulière lue dans le fichier.

## `useSyncExternalStore`, pas un `useEffect`

Le serveur ne connaît pas le nom d'hôte, le navigateur si : les deux rendus
diffèrent **légitimement**. Un `useEffect` qui pose un état marchait, mais
déclenchait l'avertissement `react-hooks/set-state-in-effect` — un
avertissement neuf dans un dossier qui en compte 51, tous antérieurs. Le hook
prévu pour ça prend un instantané serveur et un instantané navigateur, sans
discordance d'hydratation ni rendu en cascade.

## Vérifié

- **Les deux états regardés**, pas seulement le refus : aperçu simulé
  (variables vidées, `NEXT_PUBLIC_VERCEL_ENV=preview`) → l'accueil **et**
  `/login` rendent l'écran d'arrêt, le formulaire de connexion a disparu ; dev
  normal → accueil et `/login` inchangés, aucune erreur de console.
- **Six sabotages, six morsures** : le repli seul qui bloque, `includes` au
  lieu du suffixe, la sortie production retirée, un bandeau par-dessus l'app au
  lieu d'un remplacement, un morceau de l'arbre sorti du garde, deux lectures
  de `process.env` au lieu d'une.
- 1 565 tests du site au vert, lint 0 erreur et **aucun avertissement neuf**.

## Ce qui reste à faire côté Vercel

Le garde dit ce qui manque ; il ne le pose pas. Pour que l'aperçu On-Demand
redevienne utilisable, il lui faut `NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_ANON_KEY` **de portée Preview uniquement**, pointant sur
un projet Supabase à lui — celui qui n'est pas encore créé.
