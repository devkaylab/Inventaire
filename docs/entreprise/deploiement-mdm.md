# Déployer Quantinvo par votre catalogue d'entreprise

*Fiche destinée à la direction informatique du client. Dernière mise à jour :
22 août 2026.*

## En résumé

Quantinvo s'installe **comme n'importe quelle application d'entreprise**, par
votre outil de gestion de parc : Workspace ONE UEM (Omnissa), Microsoft
Intune, SOTI MobiControl, Ivanti, Jamf, ou tout autre MDM. Il n'y a pas de
version spéciale à demander, pas d'installation manuelle, pas de compte
personnel Apple ou Google à utiliser sur les appareils.

## Identifiants de l'application

| | |
|---|---|
| Nom | Quantinvo |
| Identifiant iOS (bundle ID) | `com.quantinvo.app` |
| Identifiant Android (package) | `com.quantinvo.app` |
| Version minimale iOS | 16.4 |
| Version minimale Android | 7.0 (à confirmer au premier build) |
| Éditeur | Devkaylab |

## Comment la mettre à votre catalogue

**iPhone et iPad.** Depuis Apple Business Manager, rubrique « Apps et livres » :
vous recherchez Quantinvo, vous attribuez le nombre de licences voulu
(l'application est gratuite, la licence d'usage est facturée séparément), puis
votre MDM les distribue aux appareils ou aux utilisateurs. L'installation est
silencieuse.

Si votre politique interne interdit les applications publiques, nous pouvons
publier une **application personnalisée** réservée à votre organisation :
elle n'apparaît alors dans aucune recherche publique et n'est visible que dans
votre Apple Business Manager. Il nous faut pour cela votre **identifiant
d'organisation** ABM.

**Android et terminaux durcis (Zebra, Honeywell, Datalogic).** Deux voies au
choix : par **Managed Google Play**, en approuvant l'application dans votre
catalogue géré ; ou en nous demandant l'**APK**, que vous chargez dans votre
MDM comme application interne, sans passer par Google.

## Ce dont l'application a besoin

Quatre points à vérifier dans votre profil de restrictions. Les trois premiers
sont bloquants : sans eux, l'application s'installe mais ne sert à rien.

**1. La caméra doit rester autorisée.** C'est le lecteur de codes-barres :
c'est avec elle que l'on scanne les articles et les étiquettes de zone. Une
restriction qui désactive l'appareil photo rend le comptage impossible. Les
douchettes Bluetooth et les terminaux à gâchette fonctionnent aussi, en
complément.

**2. Ces adresses doivent être joignables**, en HTTPS sur le port 443 :

| Adresse | Usage |
|---|---|
| `heabesqvlinzarqenymj.supabase.co` | Données, authentification, synchronisation temps réel (HTTPS et WebSocket) |
| `exp.host` | Obtention du jeton de notification, au premier lancement |
| `www.quantinvo.com` | Liens d'invitation reçus par e-mail |

Les services de notification d'Apple (APNs) et de Google (FCM) sont également
utilisés ; ils sont ouverts par défaut dans la plupart des réseaux.

**3. Ne pas effacer les données de l'application pendant un inventaire.**
Quantinvo fonctionne **hors ligne** : en réserve ou en chambre froide, les
comptages sont conservés sur l'appareil et remontés au retour du réseau. Un
effacement à distance, ou une désinstallation, pendant cette fenêtre **perd
les comptages non encore synchronisés**. Ce sont quelques minutes à quelques
heures de travail.

**4. Les notifications sont recommandées**, sans être indispensables : elles
servent à prévenir une personne qu'elle a été invitée à un inventaire.

## Comptes et connexion

Chaque personne a un **compte nominatif**, créé par invitation depuis
l'application ou le site — il n'y a **pas d'inscription libre**. Cela permet de
savoir qui a compté quoi, ce qui est nécessaire pour arbitrer un écart de
stock.

La connexion se fait par adresse e-mail et mot de passe, avec **double
authentification par code à usage unique** disponible pour qui le souhaite. Il
n'y a pas encore de connexion par votre annuaire d'entreprise (SAML, Entra
ID) : c'est possible techniquement, dites-le nous si c'est une exigence.

**Appareils partagés** : le cas est prévu. Chacun se connecte en prenant
l'appareil et se déconnecte en le rendant. Le mode « application unique » de
votre MDM, qui verrouille le terminal sur Quantinvo, est compatible.

## Données

Les données sont hébergées **dans l'Union européenne** (Irlande). La politique
de confidentialité, la liste des sous-traitants et les durées de conservation
sont publiées à l'adresse
https://devkaylab.github.io/Inventaire/privacy.html.

## Ce qui n'existe pas encore

Deux fonctions courantes en environnement géré ne sont pas implémentées à ce
jour. Elles ne sont pas nécessaires au déploiement ; dites-nous si vous en
avez besoin.

- **Configuration administrée** (standard AppConfig) : pré-remplir le code du
  magasin ou l'adresse e-mail depuis votre MDM, pour que la personne n'ait
  rien à saisir au premier lancement.
- **Connexion par votre annuaire** (SAML 2.0, Entra ID).
