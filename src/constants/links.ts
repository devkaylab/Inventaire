// Liens publics de l'application (affichés dans l'app).
//
// ⚠️ PRIVACY_URL doit pointer vers la politique de confidentialité hébergée
// en ligne (le fichier source est docs/privacy.html). L'URL ci-dessous
// correspond à un hébergement GitHub Pages ; remplacez-la si vous hébergez
// la page ailleurs.
// ⚠️ Effectif au PROCHAIN BUILD seulement : les applications installées
// continuent d'ouvrir l'ancienne adresse, qui reste en ligne pour elles.
export const PRIVACY_URL = 'https://www.quantinvo.com/confidentialite'

// Site public. Personne ne s'inscrit depuis l'app : un superviseur est invité
// par l'administrateur de son entreprise (page Mon équipe du site), un
// compteur par son superviseur.
//
// `SUPERVISOR_REQUEST_URL` a été retiré le 21 août 2026 avec le formulaire
// public de demande d'accès. La page /superviseur, elle, doit rester en ligne :
// les builds déjà installés sur les téléphones la partagent encore.
export const SITE_URL = 'https://www.quantinvo.com'
export const COMPANY_REQUEST_URL = `${SITE_URL}/inscription`

// « Mot de passe oublié » : le parcours vit sur le site (envoi du lien par
// e-mail, puis /reinitialisation). C'est la porte de sortie de quelqu'un qui
// ne se souvient plus de son mot de passe actuel et ne peut donc pas le
// changer depuis l'app.
export const PASSWORD_FORGOT_URL = `${SITE_URL}/mot-de-passe-oublie`
