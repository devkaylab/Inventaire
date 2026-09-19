# L'onboarding est clos (4 septembre 2026)

*« Fais-moi le reste de l'onboarding, je veux que l'on clôture ce sujet
aujourd'hui. »* La maquette du 23 août
(https://claude.ai/code/artifact/e54ce742-3f4c-4788-839e-d118f82c2e02) décrit
vingt écrans, sur trois profils. Audit écran par écran, code en main : **tout
est construit**, sauf deux points écartés avec leurs raisons — et deux qui
manquaient réellement, faits ce jour.

## ⚠️ D'ABORD, UNE ERREUR DE MA PART, ET ELLE PORTE UNE RÈGLE

J'ai annoncé à Julien qu'il restait « l'état des invitations dans l'équipe d'un
inventaire » et « la checklist de l'administrateur d'entreprise ». **Les deux
étaient réglés depuis le 28 août** : le premier écarté (il n'existe plus
d'invitation en attente à un inventaire), le second construit (`etapesAdmin`
dans `BandeauDemarrage`). J'avais relu la liste « Ce qui reste de la maquette
du 23 août », écrite le MATIN du 28, sans voir que la section de l'APRÈS-MIDI
la vidait.

**Une liste de « reste à faire » qui vit dans un fichier daté doit être barrée
quand elle est faite.** Celle-là porte désormais son avertissement.

## Les deux pièces qui manquaient vraiment

- **La progression du superviseur ne portait que des pourcentages.** La
  maquette dit : l'avancement se compte en **balises** — c'est ce qui dit où en
  est le magasin — « et le nombre de pièces l'accompagne sans le remplacer ».
  Il manquait : « 60 % » ne dit pas si les rayons faits portaient dix articles
  ou trois mille, et c'est la première question qu'on se pose en le lisant. Une
  ligne de plus (« 243 pièces comptées · 81 auditées »), avec des nombres
  **déjà chargés** pour l'autre mode d'affichage.
- **L'écran d'import ne disait pas que le site fait la même chose.** Un
  référentiel sort d'un ERP : il est sur un poste, pas sur le téléphone. Sans
  cette ligne, on transfère un fichier vers le téléphone pour rien.
  · **⚠️ ELLE N'EST PAS CLIQUABLE, ET C'EST VOULU.** La maquette dessinait une
    pastille-lien ; l'espace connecté du site **se ferme sous 720 px**. Ouvert
    depuis ce téléphone, le lien tomberait sur « Cet espace se pilote depuis un
    ordinateur » — un cul-de-sac. L'adresse est écrite pour être **retapée sur
    le poste**, pas touchée ici. Un test refuse `Linking` dans cet écran.

## Les deux écartés, et pourquoi

- **L'état des invitations d'un inventaire (relance, QR).** Il n'y a plus
  d'invitation en attente à un inventaire depuis que `invite-to-session` refuse
  les adresses sans compte : la table est vide en production. Le vrai risque
  que la maquette visait — « la veille, la moitié de l'équipe n'est jamais
  entrée » — est couvert par le badge « Mot de passe à créer ». Déjà documenté
  le 28 août ; rien n'a changé.
- **Les appareils connectés sur l'écran du superviseur** (« 3 connectés · 2 en
  comptage · 1 en audit »). Le contrat de présence **v3** du 21 août a retiré
  aux téléphones l'abonnement au canal temps réel : ils émettent un battement
  HTTP, **seul le tableau de bord écoute**. L'afficher dans l'app rouvrirait
  une connexion par téléphone de superviseur, pour une information que le site
  donne déjà et que la progression rend visible autrement. La phrase de la
  maquette est d'ailleurs d'abord une **interdiction** — « des appareils,
  jamais des noms » —, et elle tient : le suivi nominatif a été retiré en août
  (constat E3).

## La garde qui ferme le sujet

⚠️ **Chaque repère déclaré dans `lib/reperes.ts` doit être branché sur un
écran.** C'est arrivé de ne pas l'être : `balayage` a vécu huit jours déclaré
et affiché nulle part. Le test balaie `src/` et exige un `useRepere('<nom>'`
pour chacun des treize — un repère qui n'existe qu'en déclaration est une aide
qui n'existe pas.

## Vérifications

Au simulateur, sur les données réelles du compte de démonstration (Maison
Oberlin, inventaire « Rayon textile »), **clair et sombre** : la progression
affiche « 26 % des balises comptées · 9 % des balises auditées · 243 pièces
comptées · 81 auditées », et l'écran d'import porte sa ligne vers le site.
Aucune écriture — consulter n'écrit rien, contrôlé par la règle du 25 août.
410 tests, `tsc --noEmit`. Les quatre gardes nouvelles ont été mises en défaut
une à une (repère débranché, ligne des pièces retirée, `Linking` ajouté, rôle
de bienvenue renommé) : les quatre échouent.
