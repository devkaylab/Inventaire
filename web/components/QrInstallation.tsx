'use client'

// Le code à faire scanner pour installer l'application.
//
// ⚠️⚠️ **UN SEUL CODE, ET IL NE PÉRIME PAS.** Il porte `…/open`, pas une fiche
// de boutique : cette page tente d'abord d'ouvrir l'application installée, et
// propose la boutique du téléphone sinon. Il sert donc aux deux gestes —
// installer et ouvrir —, il vaut sur iPhone comme sur Android, et **il n'y
// aura rien à ajouter le jour où Google Play ouvrira**. On peut l'imprimer et
// l'afficher en réserve dès aujourd'hui sans qu'il devienne faux.
//
// Éprouvé le 28 septembre 2026 par Julien, sur un iPhone où l'application
// n'était PAS installée : le scan a mené à Quantinvo puis à l'App Store. C'est
// la seule vérification qui comptait — la crainte était qu'iOS affiche
// « impossible d'ouvrir la page » sur le lien `quantinvo://`.
//
// ⚠️ **LE CODE VIT DANS LA BOÎTE À OUTILS, PAS SUR LE SITE PUBLIC.** L'espace
// connecté ne s'ouvre pas sous 720 px (`globals.css`, écran « ordinateur
// requis ») : on y est toujours devant un ordinateur, et un bouton de
// téléchargement tapable n'y a jamais servi à rien. Le superviseur prépare son
// inventaire là, et c'est de là qu'il équipe ses compteurs. Les deux boutons,
// eux, restent au pied du site public, où le visiteur peut être sur un
// téléphone.

import QRCode from 'qrcode'
import { SITE_URL } from '@/lib/site'

/**
 * L'adresse que le code porte. **Déduite de `SITE_URL`**, jamais recopiée : un
 * QR écrit en dur survivrait à un changement de domaine sans que rien ne le
 * dise, et il n'existe aucun moyen de lire un QR à l'œil.
 */
export const URL_INSTALLATION = `${SITE_URL}/open`

/**
 * Le tracé des modules, calculé une fois au chargement du module : l'adresse
 * est une constante, il n'y a rien à recalculer à chaque rendu.
 */
const { chemin, cote } = (() => {
  const qr = QRCode.create(URL_INSTALLATION, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  let d = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.data[r * n + c]) d += `M${c} ${r}h1v1h-1z`
    }
  }
  return { chemin: d, cote: n }
})()

export function QrInstallation({ taille = 148 }: { taille?: number }) {
  // ⚠️ **SOMBRE SUR CLAIR DANS LES DEUX THÈMES, ET C'EST VOULU.** Un lecteur
  // de QR attend des modules sombres sur un fond clair ; l'inverse fait
  // décrocher une partie des téléphones. Le code garde donc ses couleurs quel
  // que soit le thème du site — d'où les valeurs écrites ici plutôt que des
  // jetons. La zone de silence de quatre modules fait partie du code : sans
  // elle, il ne se lit pas.
  const vue = cote + 8
  return (
    <svg
      viewBox={`-4 -4 ${vue} ${vue}`}
      width={taille}
      height={taille}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Code QR vers ${URL_INSTALLATION}`}
      style={{ display: 'block' }}
    >
      <rect x={-4} y={-4} width={vue} height={vue} fill="#FFFFFF" />
      <path d={chemin} fill="#14181A" />
    </svg>
  )
}
