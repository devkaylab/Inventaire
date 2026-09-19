# Quantinvo peut enfin supprimer un compte (23 août 2026)

Constat de Julien : *« Quantinvo sur le site ne peut supprimer personne. »*
Vérifié, et c'était exact. `admin_delete_user` existe depuis le 18 août
2026 — gardée par `is_admin()`, journalisée, identité figée avant le
`delete` — mais **le seul bouton qui l'appelait** était sur une *demande* de
suppression déposée par la personne elle-même (/admin/console). La section
« Personnes » de la fiche entreprise était une liste de lecture, sans aucune
action. Autrement dit : la console pouvait effacer une **entreprise entière**,
pas un compte.

Le geste est posé là où on regarde les gens : `/admin/entreprise/<id>`,
section « Personnes », un lien rouge par ligne. Aucune RPC nouvelle, aucune
migration — seulement le bouton qui manquait.

- **La recopie du nom est exigée** (`requireText`), comme sur /equipe. Ce
  bouton est à quelques centimètres d'une simple liste, et la suppression est
  irréversible. C'est aussi pourquoi il ouvre la **modale du produit** et non
  un `confirm()` du navigateur comme le reste de cette page : `window.confirm`
  ne sait pas exiger un geste délibéré. ⚠️ Les six autres confirmations de
  cette page sont restées natives — incohérence connue, à reprendre.
- **La confirmation dit ce qui reste** : les comptages sont conservés mais
  détachés, donc le nom disparaît des rapports déjà faits ; inventaires et
  invitations sont détachés eux aussi.
- **Supprimer un administrateur d'entreprise ajoute une ligne** : sans lui,
  l'entreprise n'a plus personne pour gérer ses superviseurs — et elle remonte
  dans « À traiter » sur /admin. Autant le dire avant.

⚠️ **`admin_delete_user` ne se refuse à personne**, contrairement à
`ca_delete_user` (qui refuse soi-même et les autres administrateurs). Ce n'est
pas atteignable depuis ce bouton — un administrateur Quantinvo n'a pas de
`company_id`, il ne figure donc dans aucune fiche entreprise. À garder en tête
si un jour la console liste les personnes autrement que par entreprise.

Vu à l'écran (route jetable `/tmp-polish`, retirée — `git status` contrôlé),
clair et sombre : la ligne, la modale, la recopie du nom, et la cinquième
puce sur un administrateur d'entreprise.

Tests de garde : `web/tests/console-admin.test.ts`.
