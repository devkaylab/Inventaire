# Le démarrage conclut la préparation, il ne l'ouvre pas (25 août 2026)

Julien, test réel sur l'inventaire « Fwee », fichier importé et balises
renseignées : *« Placer bouton commencer l'inventaire en bas. Le mettre en haut
est perturbant et on ne sait pas quoi faire après. »* Le bandeau ouvrait
l'onglet Set up, **avant** les deux volets — donc avant le travail qu'on vient
faire. Il se lisait comme une consigne posée sur le chemin de la préparation,
et une fois pressé il disparaissait sans dire où aller.

`Demarrage` (`SetupTab.tsx`) est donc **la dernière chose de la page**, sous
les volets. Ce qui ne change pas de la règle du 21 août : **il n'entre pas dans
un volet** — une action ne doit pas se cacher derrière une section fermée. Être
en dessous n'est pas être caché.

Points à ne pas défaire :

- **Il est là dans les trois états**, et c'est la seconde moitié du constat
  (« on ne sait pas quoi faire après ») : ce qui manque encore (« Il reste une
  chose à faire » — le référentiel, nommé, bouton désactivé), le démarrage
  (« Tout est prêt », la carte se teinte, seul moment où elle appelle), puis
  **la suite** (« L'inventaire est en cours », et « Suivre l'avancement » qui
  mène à l'onglet Suivi). Un bouton qui disparaît une fois pressé laisse la
  question sans réponse.
- **Le clic emmène sur Suivi.** *« Cliquer sur commencer l'inventaire doit
  ramener sur la page suivi »* — la préparation est finie, on n'a plus rien à
  faire sur Set up. Le troisième état n'est donc pas ce qu'on voit juste après
  avoir cliqué : il est là pour qui **revient** préparer un inventaire déjà
  lancé. La bascule se fait **après `onChanged`**, sinon Suivi s'ouvrirait sur
  l'état d'avant.
- **`onOpenSuivi` vient de la page** (`selectTab('suivi')`), comme
  `ProgressRail` : l'onglet vit dans l'URL, la section ne se déplace pas
  toute seule.
- Un inventaire clôturé n'affiche rien de tout cela — le bloc est sous
  `!readOnly`, et son avertissement reste, lui, en tête de page.
- `.demarrage .btn { flex: none }` : dans une colonne flex, un bouton s'étire
  sur toute la largeur — déjà vu sur « Ouvrir le magasin ».

Vu au navigateur, clair et sombre, par une route jetable rendant les quatre
états (retirée, `git status` contrôlé). Tests de garde :
`web/tests/navigation.test.ts`, bloc « “Commencer l'inventaire” conclut la
page ».
