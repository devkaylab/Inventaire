/**
 * Les délais d'attente du réseau — et pourquoi il en fallait (9 octobre 2026).
 *
 * ⚠️⚠️ **LE DÉFAUT QUE CE MODULE FERME : LA ZONE GRISE.** Julien, depuis le
 * terrain : « le téléphone pense avoir du réseau alors qu'en fait ça ne capte
 * pas bien. Ça affiche 5G mais en réalité il n'y a rien qui se passe, donc le
 * téléphone mouline. »
 *
 * Le hors ligne fonctionnait déjà, et il le dit lui-même. Mais il ne
 * s'enclenchait que **sur l'échec d'une requête** — or dans une zone grise une
 * requête n'échoue pas : elle pend. Sans délai à nous, l'app attendait celui
 * d'iOS, qui se compte en dizaines de secondes. Le premier scan payait donc le
 * prix plein avant que `offlineSync` ne bascule et que tout redevienne
 * instantané.
 *
 * Deux budgets, et la distinction est la seule qui compte :
 *
 *   · **interactif** — quelqu'un REGARDE l'écran en attendant. Deux secondes et
 *     demie, au-delà c'est une panne de son point de vue, quelle que soit la
 *     vérité du réseau.
 *   · **de fond** — un filet pour que rien ne pende indéfiniment : la remontée
 *     de la file, le catalogue, le rafraîchissement du jeton. Personne n'attend
 *     devant, mais une requête immortelle retient de la mémoire et fausse
 *     l'état du réseau.
 *
 * ⚠️ **ON ANNULE POUR DE VRAI, ON NE COURSE PAS.** La première idée était de
 * faire une course entre la promesse et un minuteur. Elle est fausse pour une
 * écriture : la requête abandonnée continue en arrière-plan et peut **arriver
 * après** qu'on a mis le comptage en file — deux lignes pour un scan, puisque
 * le chemin en ligne laisse le serveur choisir l'identifiant. `AbortSignal`
 * coupe la requête, donc ce cas n'existe pas.
 *
 * ⚠️ Et `postgrest-js` **relance l'`AbortError` d'origine** au lieu de le
 * convertir en `{ error }` (vérifié dans son code, `executeWithRetry`). Il
 * arrive donc tel quel jusqu'à `isNetworkError`, qui le reconnaît par son nom —
 * c'est ce qui fait basculer l'app hors ligne au lieu de remonter une erreur à
 * l'écran. Son signal couvre aussi les nouvelles tentatives internes : le
 * budget est celui de l'opération entière, pas d'un essai.
 */

/** Quelqu'un attend devant l'écran. Au-delà, c'est une panne de son point de vue. */
export const DELAI_INTERACTIF_MS = 2_500

/** Personne n'attend, mais rien ne doit pendre indéfiniment. */
export const DELAI_DE_FOND_MS = 20_000

/**
 * Joue `action` avec un signal qui s'annule au bout de `ms`.
 *
 * ⚠️ Le minuteur est toujours nettoyé (`finally`) : sans ça, chaque requête
 * laisserait un minuteur de vingt secondes derrière elle, et React Native
 * avertit à juste titre sur les minuteurs longs qui s'accumulent.
 */
export async function avecDelai<T>(
  ms: number,
  action: (signal: AbortSignal) => PromiseLike<T>,
): Promise<T> {
  const controleur = new AbortController()
  const minuterie = setTimeout(() => controleur.abort(), ms)
  try {
    return await action(controleur.signal)
  } finally {
    clearTimeout(minuterie)
  }
}
