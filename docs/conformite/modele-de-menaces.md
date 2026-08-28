# Modèle de menaces — Quantinvo

**Établi le** : 28 août 2026, à l'issue de la revue de sécurité en dix-huit points
**Portée** : l'application mobile, le site, la base Supabase et les fonctions edge
**À relire** : à chaque nouveau rôle, nouveau flux d'argent, ou nouvelle
surface publique — et au moins une fois par an

Ce document dit **ce qu'on protège, contre qui, et par quoi**. Il n'énumère pas
les correctifs (ils vivent dans `AGENTS.md`, datés et motivés) : il donne la
carte, pour qu'un défaut se range quelque part au lieu d'être un incident
isolé.

---

## 1. Ce qu'il y a à perdre

Par ordre de ce que coûterait la perte, pas par volume.

| Bien | Où il vit | Ce que sa perte coûte |
|---|---|---|
| **Codes d'accès** magasin et entreprise | `stores.join_code`, `companies.join_code` | Ils ouvrent l'entrée dans un magasin. Un code qui fuit, c'est un inconnu dans l'inventaire d'un client. |
| **Cloisonnement entre clients** | `company_id`, RLS, `get_my_company()` | Un client qui voit les données d'un autre : la fin commerciale du produit, et une notification CNIL. |
| **Élévation de rôle** | `profiles.role`, `is_company_admin`, `team_invitations.role` | Un compteur devenu administrateur voit et supprime tout ce qui appartient à son entreprise. |
| **Données d'inventaire** | `counts`, `articles`, `theoretical_stock` | Stock, prix d'achat, démarque. Le client en est responsable de traitement ; nous en sommes le sous-traitant. |
| **Données personnelles** | `profiles`, `auth.users`, `counts.counted_by` | Noms et adresses de salariés, et **qui a compté quoi**. Le suivi nominatif en direct a été retiré (constat E3) ; l'attribution différée reste, elle sert l'arbitrage des écarts. |
| **Argent** | `company_requests`, `store_requests`, Stripe | Un devis accepté sans paiement, ou une entreprise créée sans facture. |
| **Le journal** | `admin_audit_log`, `company_audit_log` | Sans lui, un abus ne se prouve pas. Il s'écrit dans la même transaction que l'action, exprès. |

---

## 2. Contre qui

Cinq profils. Les trois premiers sont les seuls réalistes aujourd'hui ; les
deux derniers cadrent les décisions d'architecture.

### A. Le curieux de passage — anonyme, sur Internet

**Ce qu'il peut faire** : appeler les quatre fonctions publiques (le parcours de
devis, le formulaire d'inscription), lire les pages publiques, poster sur le
webhook Stripe.

**Ce qui l'arrête** : la RLS refuse tout à `anon` — les policies s'appuient sur
`auth.uid()`, nul pour lui. Les quatre fonctions publiques portent chacune leur
garde : jeton aléatoire de 122 bits pour le devis, limitation de débit et
réponse uniforme pour l'inscription. Le webhook Stripe vérifie une signature
HMAC sur le corps brut **avant toute lecture**.

**Ce qu'il apprend quand même** : qu'une adresse a un compte, s'il passe par un
formulaire d'ajout de membre — compromis assumé et documenté. Et le temps de
réponse du formulaire d'inscription diffère légèrement selon qu'une demande
existe : canal étroit, laissé ouvert.

### B. Le compteur — un salarié du client, compte légitime

**C'est le profil le plus important**, parce qu'il est nombreux, peu formé, et
que son téléphone circule.

**Ce qu'il peut faire** : lire les inventaires où il est membre, écrire ses
comptages, lire son propre profil.

**Ce qui l'arrête** : `counts_select_own` le limite à ses lignes ; il ne voit
pas les magasins qu'on ne lui a pas affectés ; **il ne peut pas lire un code
d'accès** (droit révoqué au niveau de la colonne) ; il ne peut pas se promouvoir
(`profiles_pin_privileged` fige `role`, `company_id` et les deux drapeaux) ; et
depuis le 28 août il ne peut plus lister l'annuaire de toute l'entreprise.

**Ce qui reste ouvert** : son téléphone garde le catalogue d'articles et sa file
de comptages dans un stockage non chiffré. Le ménage à la déconnexion a été
posé ; **le jeton de session reste dans `AsyncStorage`** plutôt que dans le
trousseau — voir §5.

### C. Le superviseur — le rôle qui manipule le plus

**Ce qu'il peut faire** : créer des inventaires, inviter des compteurs, importer
des fichiers, lire les comptages de son équipe.

**Ce qui l'arrête** : la policy `team_invitations` le borne à `role = 'employee'`
— sans elle, il s'écrirait une invitation `company_admin` que `handle_new_user`
honorerait. Les magasins qu'il affecte doivent être les siens. Il ne supprime
un inventaire que s'il l'a créé. Un inventaire clôturé ne se rouvre que par son
créateur.

**La leçon du 28 août** : ces gardes vivent dans la RLS, mais **les fonctions
edge écrivent avec la clé de service, donc hors RLS**. Chaque contrôle que la
RLS aurait fait doit y être réécrit à la main — et c'est exactement là que le
défaut de l'invitation reprenable s'était logé. *Une fonction en `service_role`
est un trou dans la RLS que l'on rebouche à la main, ligne par ligne.*

### D. Le client mécontent, ou le concurrent

**Ce qu'il vise** : les données d'un autre client, ou la connaissance de qui est
client.

**Ce qui l'arrête** : le cloisonnement par `company_id`, et le fait qu'aucun
message ne nomme jamais une autre entreprise — ni « cette personne appartient à
X », ni le nom d'un magasin dans une réponse publique. C'est une règle de
rédaction autant que de code.

### E. Nous — Devkaylab

Le profil qu'on oublie. L'administrateur Quantinvo peut tout lire et tout
supprimer.

**Ce qui l'encadre** : `is_admin()` exige un second facteur dès que le compte en
a un, **côté serveur** et non seulement à l'écran ; les dix-huit fonctions
d'administration passent toutes par là ; chacune est journalisée dans la même
transaction que son action, avec l'identité figée avant toute suppression.

---

## 3. Les six endroits où tout se joue

Un défaut ailleurs est un défaut ; un défaut ici est une brèche.

1. **`is_session_participant`** — une seule fonction garde la policy de lecture
   des inventaires *et* `can_access_session`, dont dépendent comptages, zones,
   audits, rapports et membres. Une ligne y ouvre tout, de façon cohérente. La
   changer sans le savoir ouvre quinze choses à la fois.
2. **`handle_new_user`** — décide du rôle de chaque nouveau compte. Il le lit
   dans l'invitation, **jamais dans les métadonnées** envoyées à l'inscription.
   Ne jamais inverser.
3. **`profiles_pin_privileged`** — fige `role`, `company_id`, `is_admin`,
   `is_company_admin`. Doit rester en `SECURITY INVOKER` : en `DEFINER`,
   `current_user` vaudrait le propriétaire et le garde-fou ne s'appliquerait
   jamais.
4. **`is_admin()` / `is_company_admin()`** — portent l'exigence du second
   facteur. L'exigence est **conditionnelle** (elle ne vise que les comptes
   ayant un facteur vérifié) : c'est ce qui rend le dépannage d'un téléphone
   perdu possible sans défaire la migration.
5. **La signature du webhook Stripe** — le seul verrou d'une fonction déployée
   sans jeton. HMAC sur le corps brut, tolérance de cinq minutes, comparaison à
   temps constant, avant toute lecture.
6. **Les GRANT** — `create or replace function` rend EXECUTE à PUBLIC. Trois
   fois le projet s'est fait prendre. Toute migration qui définit une fonction
   repose ses droits dans le même fichier, fonctions de déclencheur comprises.

---

## 4. Ce qui protège, par couche

| Couche | Ce qu'elle fait | Ce qu'elle ne fait pas |
|---|---|---|
| **RLS** (22 tables, toutes actives) | Le cloisonnement réel | Rien contre `service_role` |
| **Fonctions `SECURITY DEFINER`** | Les gestes que la RLS ne sait pas exprimer | Elles doivent porter leur propre garde — la RLS ne s'applique plus dedans |
| **Déclencheurs** | Les invariants que personne ne contourne, `service_role` compris | Ils ne remplacent pas un message lisible |
| **Fonctions edge** | Ce qui demande un secret (Resend, Stripe, `generateLink`) | Elles écrivent hors RLS : chaque contrôle y est manuel |
| **Écrans** | Empêcher, expliquer, éviter le refus après coup | Ne protègent rien : tout est revérifié côté serveur |
| **Tests de garde** | Empêcher qu'un invariant se défasse en silence | Ils lisent des fichiers, pas la base — voir §5 |

**Le principe qui traverse les six** : l'écran empêche, le serveur refuse, la
base verrouille. Trois épaisseurs, et aucune ne fait le travail des autres.

---

## 5. Ce qui reste ouvert, et pourquoi

Assumé, pas oublié.

- **Le jeton de session mobile vit dans `AsyncStorage`**, non chiffré, avec une
  session valable trente jours d'inactivité. `expo-secure-store` (le trousseau
  iOS) serait le durcissement ; il demande une dépendance native, donc un
  `pod install` et une reconstruction. À faire au prochain chantier mobile.
- **CORS `*` sur les fonctions edge.** Sans cookie, un site tiers ne peut pas
  emprunter la session : le jeton est posé par le code appelant. Le gain d'un
  resserrement est proche de zéro, le coût est de redéployer treize fonctions
  qui traitent des paiements et des invitations. Écarté sciemment.
- **Le lot d'avis Next.js.** La branche 14 ne reçoit plus ces correctifs. La
  plupart des avis supposent un middleware, de l'i18n, des *server actions* ou
  un serveur maison — le site n'a rien de tout cela, il est rendu côté
  navigateur et parle directement à Supabase.
- **Les tests de garde lisent des fichiers, pas la base.** Ils ne verront jamais
  un objet modifié directement en console. C'est ce qui a laissé passer la
  limitation de débit perdue : le correctif a été de lire *la dernière*
  migration qui définit la fonction, pas un fichier nommé en dur.
- **Aucune alerte.** Les journaux existent, personne n'est prévenu de rien — ni
  d'une série d'échecs de connexion, ni d'un webhook Stripe qui répondrait 500
  en boucle. C'est le manque le plus structurant de cette liste.
- **`account_deletion_requests` et `request_account_deletion` n'ont pas de
  migration** : créés directement en console. Repartir d'un `supabase db pull`
  avant toute refonte.

---

## 6. Comment s'en servir

Devant un changement, trois questions :

1. **Quel bien du §1 ce changement touche-t-il ?** S'il n'en touche aucun, il
   n'y a rien à faire ici.
2. **Lequel des cinq profils du §2 gagne quelque chose ?** Le compteur et le
   superviseur sont les deux qui comptent en pratique.
3. **Le changement passe-t-il par un des six points du §3 ?** Si oui, il se
   vérifie en base et se garde par un test — pas seulement à l'écran.

Et une règle de méthode, apprise en août 2026 : **vérifier ce qui tourne, pas
ce que le dépôt raconte**. Trois des neuf constats de la revue ne se voyaient
qu'en interrogeant la base en production.
