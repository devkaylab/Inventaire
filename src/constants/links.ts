// Liens publics de l'application (affichés dans l'app).
//
// ⚠️ PRIVACY_URL doit pointer vers la politique de confidentialité hébergée
// en ligne (le fichier source est docs/privacy.html). L'URL ci-dessous
// correspond à un hébergement GitHub Pages ; remplacez-la si vous hébergez
// la page ailleurs.
export const PRIVACY_URL = 'https://devkaylab.github.io/Inventaire/privacy.html'

// Site public. Personne ne s'inscrit depuis l'app : un superviseur est invité
// par l'administrateur de son entreprise (page Mon équipe du site), un
// compteur par son superviseur.
//
// `SUPERVISOR_REQUEST_URL` a été retiré le 21 août 2026 avec le formulaire
// public de demande d'accès. La page /superviseur, elle, doit rester en ligne :
// les builds déjà installés sur les téléphones la partagent encore.
export const SITE_URL = 'https://quantinvo.vercel.app'
export const COMPANY_REQUEST_URL = `${SITE_URL}/inscription`
