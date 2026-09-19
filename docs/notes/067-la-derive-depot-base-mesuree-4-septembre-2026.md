# La dérive dépôt/base, mesurée (4 septembre 2026)

⚠️ **LES NEUF ORPHELINS DE CETTE SECTION SONT RATTRAPÉS DEPUIS LE 6 SEPTEMBRE
2026** — voir « La discipline des migrations est faite », en fin de fichier. Ce
qui reste vrai ici, c'est la méthode et le piège de mesure.

Julien : *« qu'en est-il de la discipline des migrations ? »* La note du dépôt
dit depuis des semaines « le dossier diverge de la base, ne pas faire
`db push` ». **Mesuré, c'est faux — ou plus exactement, ce n'est plus vrai.**

| | en base | avec leur migration | orphelins |
|---|---|---|---|
| Fonctions | 187 | **181 identiques, 0 divergente** | 6 |
| Tables | 31 | 28 | 3 |

Les six fonctions orphelines : `ensure_zone`, `generate_zones`, `norm_balise`,
`register_balise`, `set_zone_status`, `request_account_deletion`. Les trois
tables : `stores`, `zones`, `account_deletion_requests`. Tout le reste — y
compris les 187 corps de fonction, commentaires et blancs normalisés — est
**identique au dépôt**.

La discipline des derniers mois (une migration par changement, appliquée puis
comparée par MD5) a donc rattrapé la dérive sans qu'on s'en aperçoive. Ce qui
reste est le socle des tout premiers jours, écrit avant que les migrations ne
soient tenues.

## ⚠️ La méthode, parce que le premier chiffre était faux

La première mesure annonçait **83 divergences**. C'était l'extracteur, pas la
base : il n'ancrait le corps que sur `\nas $$` et `\nAS $function$`, alors que
la moitié des fichiers écrivent `as $function$` en minuscules. Toutes les
fonctions dont le fichier employait cette forme ressortaient « divergentes ».

**Un chiffre de dérive invraisemblable est d'abord un défaut de mesure.**
L'ancre correcte est `\bas\s+(\$[A-Za-z_]*\$)` en ignorant la casse, puis la
recherche du même tag pour fermer. Et `derniereDefinition()` de
`web/tests/migrations.ts` a la même faiblesse potentielle : elle cherche
`$function$;` et `$$;` en dur — elle tient parce que ces deux formes couvrent
le dépôt aujourd'hui, pas parce qu'elle est générale.

## ⚠️ `supabase db query --file` sert aussi à MESURER sans rien retaper

`supabase db query "<sql>" --linked --output-format json` rend le résultat sur
la sortie standard : on compare 187 empreintes au dépôt sans jamais les faire
passer par la conversation. C'est ce qui a rendu cette mesure possible en deux
commandes.
