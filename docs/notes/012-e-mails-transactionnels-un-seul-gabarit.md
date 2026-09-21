# E-mails transactionnels : un seul gabarit

Tout ce que le produit envoie par Resend passe par
`supabase/functions/_shared/email.ts` (`emailQuantinvo`). Les fonctions edge ne
décrivent plus que le contenu — titre, salutation, paragraphes, encadré de
faits, bouton, note, raison de l'envoi — et reçoivent en retour le **HTML et la
version texte**, envoyés tous les deux à Resend (les messageries sans HTML, et
les filtres anti-spam, lisent la seconde).

Le gabarit suit la charte « Papier », en trois zones (arrêté avec Julien le
21 août 2026, après plusieurs passes sur le rendu réel dans Gmail) :

- **bandeau encre** en tête — le cube seul (sans la tuile de l'icône
  d'application, qui faisait vignette rapportée) à 56 px, « Quantinvo » en
  blanc à 28 px, le filet de scan cyan faisant la frontière avec le corps ;
- **corps blanc** — titre noir à 20 px, texte à 15 px, bouton indigo mesuré
  (14 px demi-gras) : il vient après la marque, il ne doit pas peser plus
  qu'elle ;
- **pied gris clair** — l'identité et les liens, rien d'autre.

Sous le bouton : l'adresse de secours, puis « Ce lien est personnel… » s'il y
a lieu, puis **« Vous recevez ce message parce que… »**. Cette phrase a
remplacé « vous pouvez ignorer cet e-mail » et ne se répète pas en pied.

Vérifié sur 375 px de large : l'en-tête tient sur une ligne. Au-delà de cette
échelle de marque, il mangerait l'écran d'un petit téléphone avant que le
message ne commence.

Quatre points à ne pas défaire :

- **Tout ce qui vient de la base est échappé** par le gabarit, et un lien qui
  n'est pas en `http(s)` est refusé. Avant, un nom de magasin ou un prénom
  était interpolé tel quel dans le HTML.
- **Une seule image, aucune police distante** : le logo, en PNG servi par le
  site (`web/public/email/logo-quantinvo.png`, adresse dérivée de
  `APP_PUBLIC_URL`). Gmail retire les SVG et bloque les `data:` en source
  d'image — d'où le PNG hébergé. Le mot-symbole reste **du texte à côté** de la
  tuile, avec un `alt` vide : la moitié des messageries coupent les images par
  défaut, la marque doit se lire quand même, et sans afficher « Quantinvo »
  deux fois. **Le site doit être déployé avant les fonctions edge**, sinon les
  e-mails pointent vers une image absente.
- **Tableaux et styles en ligne**, pas de flexbox : Outlook. La dégradation
  (coins droits, mêmes couleurs) est prévue — ne pas « moderniser » ce
  balisage.
- Le module reste **sans API Deno** : c'est ce qui permet aux tests du site de
  l'exécuter tel quel (`web/tests/email-template.test.ts`, qui vérifie aussi
  qu'aucune fonction edge ne réécrit son HTML à la main).

Aperçu des quatre messages (compteur, superviseur, administrateur, invitation à
un inventaire) : https://claude.ai/code/artifact/c5dc05ae-7500-4455-8c9f-3ae600b2ecf4

**Les fonctions edge modifiées doivent être redéployées** pour que le nouveau
gabarit parte réellement : le dépôt ne déploie rien tout seul.

## On peut répondre aux messages (22 août 2026)

Julien : *« tu dis “dites-le nous en répondant à ce message”, sauf qu'on ne
peut pas y répondre »*. Les messages partent d'une adresse d'envoi
(`INVITE_FROM_EMAIL`) qui ne lit rien, et quatre textes promettaient une
réponse. Deux règles, gardées par `web/tests/email-template.test.ts` qui
balaie toutes les fonctions :

- **tout envoi pose un `reply_to`** — `CONTACT_EMAIL` d'abord, sinon un repli
  que l'appelant a sous la main (l'adresse de l'administrateur qui envoie le
  devis ou refuse, celle du client sur un avis interne — on répond alors au
  prospect directement depuis sa boîte). `_shared/email.ts` porte
  `adresseDeContact()` et `envoyerEmail()` ; les fonctions les plus récentes
  passent par ce dernier, les autres injectent `reply_to` dans leur appel ;
- **un texte qui invite à écrire donne l'adresse, ou se tait**. Jamais
  « répondez à ce message ». Côté site, `lib/contact.ts` lit
  `NEXT_PUBLIC_CONTACT_EMAIL` et `/devis` s'en sert de la même façon.

**Posé le 22 août 2026** : `CONTACT_EMAIL` (secret edge) et
`NEXT_PUBLIC_CONTACT_EMAIL` (Vercel, environnement Production) valent
`contact@quantinvo.com`. Vérifié sur la page publique du devis. Sans ces
variables, les fonctions sans repli n'auraient pas de `reply_to` et les
textes ne promettraient rien : c'est le comportement de secours.

**La boîte `contact@quantinvo.com`** : redirection ImprovMX (gratuit) vers
`devkaylab@gmail.com` — MX `mx1/mx2.improvmx.com`, SPF
`include:spf.improvmx.com` et DMARC `p=none` (rapports sur contact@) posés
sur la racine, dans Vercel → Domains. Gmail « envoie en tant que » contact@
par `smtp.gmail.com` avec un mot de passe d'application (le SMTP d'ImprovMX
est payant) : un client qui reçoit une réponse voit Quantinvo, pas Gmail.
Resend reste sur `send.quantinvo.com`, aucun conflit. Un mail envoyé à
soi-même via l'alias peut tomber en spam — c'est propre à ce cas, ImprovMX
l'explique ; tester depuis une autre adresse.

**Les templates hébergés par Resend ont été examinés puis écartés**
(21 août 2026, décision de Julien). Ils existent bien — `template: { id,
variables }` à l'envoi, éditeur et historique côté tableau de bord — et ils
permettraient de changer un mot sans redéployer. Trois raisons de rester au
code : la syntaxe de variables est `{{{NOM}}}`, dont la documentation ne dit
pas si elle échappe (c'est précisément le trou fermé ici) ; il n'y a ni
condition ni répétition, alors que nos messages en ont (salutation nommée ou
non, encadré de faits pour le seul inventaire, note et raison facultatives) ;
et le gabarit sortirait de git et de ses tests.

À savoir si la question revient : **la clé Resend en production est limitée à
l'envoi**. Vérifié en direct — `POST /emails` répond 200, mais `POST
/templates`, `GET /templates` et `GET /emails/{id}` répondent tous 401
« This API key is restricted to only send emails ». C'est du moindre privilège
voulu : une fuite de cette clé permettrait d'envoyer, pas de lire ce qui est
parti. Passer aux templates Resend obligerait donc à créer une clé plus
puissante quelque part — c'est une décision de sécurité, pas un simple
déplacement de fichiers.

---

## Il en restait un dehors : « mot de passe oublié » (20 septembre 2026)

⚠️ **CONSTAT DE JULIEN, EN RECEVANT LE MESSAGE** : « c'est un mail supabase
qu'on reçoit, pas de quantinvo, il faut changer ça ». L'application était en
cours de publication.

Ce fichier dit « un seul gabarit pour tous les envois ». C'était faux d'un :
la réinitialisation partait de `supabase.auth.resetPasswordForEmail()`,
c'est-à-dire du serveur d'authentification, avec son propre modèle, son propre
expéditeur et sa propre langue. Hors du dépôt, hors des gardes, hors de la
charte — et personne ne l'avait vu parce que personne n'oublie son mot de passe
pendant qu'il développe.

⚠️ **ET CE N'ÉTAIT PAS QU'UNE QUESTION DE CHARTE.** Un message d'un expéditeur
inconnu, sans logo, en anglais, avec un lien à cliquer et une urgence
implicite, a exactement la forme d'un hameçonnage. On apprend à nos clients à
s'en méfier ; il ne faut pas être celui qui leur en envoie.

### Ce qui a été fait

| | |
|---|---|
| `demander_reinitialisation()` | En base : valide l'adresse, applique le quota, dit si le compte existe. `service_role` seul. |
| `mot-de-passe-oublie` | Fonction edge publique : demande le lien à Supabase, le met dans le gabarit maison, l'envoie par Resend. |
| `/mot-de-passe-oublie` | La page appelle la fonction, et ne retombe sur Supabase que si elle est injoignable. |

⚠️ **LE LIEN VIENT DE `auth.admin.generateLink`, PAS DE NOUS.** Fabriquer un
jeton de récupération à la main serait fabriquer une seconde porte d'entrée
dans les comptes. Supabase reste l'autorité : on lui demande le lien qu'il
aurait mis dans son propre message, et on le met dans le nôtre.

⚠️ **LE QUOTA EST À REFAIRE PARCE QU'ON PERD CELUI DE SUPABASE.** En passant
par l'API d'administration, sa limitation de débit ne s'applique plus. Une
fonction publique sans quota, c'est un envoi de courriel gratuit vers
n'importe quelle adresse, signé Quantinvo. Cinq par heure et par adresse,
`rate_limit_ok`, **avant** la recherche par adresse — l'ordre fait le contrôle.

⚠️ **LA REDIRECTION EST BORNÉE.** Un `redirectTo` libre ferait de cette
fonction un envoyeur de liens de récupération vers le domaine de son choix :
il suffirait de demander une réinitialisation pour une adresse qu'on ne
possède pas et d'espérer un clic depuis un site qu'on contrôle.

⚠️ **ET LE REPLI EST VOLONTAIRE.** Si la fonction est injoignable, la page
retombe sur `resetPasswordForEmail` : le message est alors celui de Supabase,
ce qui est moins bien — mais quelqu'un qui ne peut plus entrer chez lui a
besoin d'un lien, pas d'une charte.

### Vérifié dans la vraie boîte

Les deux messages, à douze minutes d'écart, dans la même boîte :

```
19:39  noreply@mail.app.supabase.io   Reset your password
19:51  invitations@quantinvo.com      Votre lien pour choisir un nouveau mot de passe
```

Et une adresse inconnue reçoit exactement la même réponse HTTP qu'une adresse
connue (`{success:true, received:true}`) : pas d'oracle d'énumération.

Gardes : `web/tests/formulaires-publics.test.ts`.

⚠️ **LA FONCTION EST DÉPLOYÉE, LA PAGE QUI L'APPELLE EST SUR `on-demand`.** Tant
que la branche n'est pas fusionnée, la production continue d'envoyer le message
de Supabase : c'est le site qui choisit le chemin, et le site en production ne
connaît pas encore la fonction.


---

## L'ancien logo est revenu, un mois après (21 septembre 2026)

⚠️ **CONSTAT DE JULIEN, CAPTURE À L'APPUI** : « pourquoi le mail porte l'ancien
logo ? Tu ne devrais même plus pouvoir l'utiliser ». Le message de
réinitialisation envoyé la veille affichait **le cube violet d'avant Ardoise**,
celui retiré du produit le 6 septembre.

### Ce n'était ni le fichier, ni la production

| Vérifié | Résultat |
|---|---|
| Le PNG du dépôt | le bon — la marque Ardoise |
| Ce que sert `www.quantinvo.com` | **octet pour octet le même fichier** (empreintes comparées) |
| Les autres logos du dépôt (favicon, icônes d'app) | tous Ardoise, aucun ancien dessin nulle part |

⚠️ **CE QUI N'AVAIT PAS CHANGÉ, C'ÉTAIT L'ADRESSE.** Gmail ne charge pas
l'image d'un e-mail depuis le site : il la **proxie** et la garde en cache, et
son cache est indexé par URL. `/email/logo-quantinvo-encre.png` servait
l'ancien cube jusqu'au 7 septembre. Toute boîte qui avait reçu un message avant
cette date gardait donc l'ancien dessin — **c'est-à-dire exactement les gens
qui nous connaissent déjà**. Les nouveaux destinataires, eux, voyaient le bon :
c'est pour ça que personne ne l'avait vu.

⚠️ **REMPLACER UN FICHIER SOUS LA MÊME ADRESSE NE LE REMPLACE PAS.** C'est vrai
de tous les caches d'images de messagerie, pas seulement de Gmail. Le 7
septembre, changer le PNG semblait suffire ; ça ne suffisait que pour les gens
qui n'avaient jamais reçu de message.

### La correction : l'adresse porte l'empreinte du dessin

```ts
export const EMPREINTE_LOGO = '5ecb9c9a'   // les 8 premiers du SHA-256 du fichier
export const CHEMIN_LOGO = `/email/logo-quantinvo-encre.png?v=${EMPREINTE_LOGO}`
```

⚠️ **ET CE N'EST PLUS UNE DÉCISION.** `web/tests/email-template.test.ts` calcule
l'empreinte du fichier et refuse qu'elle diffère de celle de l'adresse. On ne
peut plus changer le dessin en oubliant l'adresse — c'est exactement ce qui
vient de se passer, et ça s'est vu un mois plus tard, dans la boîte d'un
client.

⚠️ **SEULE LA CHAÎNE DE REQUÊTE CHANGE, PAS LE FICHIER.** Un nom de fichier
neuf aurait imposé de déployer le site AVANT les fonctions edge (règle
d'AGENTS.md) — et entre les deux, une image cassée, pire que l'ancien logo. Là,
la production sert déjà ces octets : les seize fonctions qui envoient du
courrier ont été redéployées seules.

⚠️ **LES SEIZE, PAS UNE.** `CHEMIN_LOGO` est une constante bundlée à la
compilation, pas une variable lue à l'exécution : une fonction non redéployée
garde l'ancienne adresse, donc l'ancien cube. Vérifié après coup qu'aucune n'a
changé de `verify_jwt` au passage.
