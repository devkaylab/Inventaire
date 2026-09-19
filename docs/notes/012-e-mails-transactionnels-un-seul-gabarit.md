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
