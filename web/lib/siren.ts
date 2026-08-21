/**
 * Numéro SIREN — mise en forme et contrôle.
 *
 * Le formulaire d'inscription demande le SIREN plutôt qu'un extrait Kbis.
 * Ce n'est pas un détail de commodité :
 *
 * - le Kbis porte les date et lieu de naissance, la nationalité et l'adresse du
 *   dirigeant, soit beaucoup de données d'identité pour vérifier qu'une société
 *   existe — le RGPD demande de ne collecter que le nécessaire ;
 * - il est de toute façon téléchargeable librement par n'importe qui sur
 *   `annuaire-entreprises.data.gouv.fr` à partir du seul SIREN, donc le
 *   demander au client revient à obtenir le même document avec plus de friction,
 *   et un PDF se retouche là où une consultation du registre ne se retouche pas ;
 * - l'État a suivi le même raisonnement : depuis novembre 2021, plus de
 *   95 démarches administratives ne demandent que le SIREN ;
 * - le SIREN du client est enfin une mention obligatoire de la facture
 *   électronique, où il sert d'identifiant de routage.
 *
 * Le contrôle ci-dessous est purement local. Il attrape les fautes de frappe
 * sans aucun appel réseau ; la consultation du registre ne part qu'ensuite, sur
 * un numéro déjà plausible.
 */

/** Ne garde que les chiffres, au plus neuf. */
export function normaliserSiren(saisie: string): string {
  return (saisie ?? '').replace(/\D/g, '').slice(0, 9)
}

/** Groupe par trois pour la lecture : « 123 456 782 ». */
export function formaterSiren(saisie: string): string {
  return normaliserSiren(saisie).replace(/(\d{3})(?=\d)/g, '$1 ').trim()
}

/**
 * Clé de Luhn — le même calcul que celui qui valide un numéro de carte
 * bancaire, et c'est bien celui qui valide un SIREN.
 */
function luhn(chiffres: string): boolean {
  let somme = 0
  for (let i = 0; i < chiffres.length; i++) {
    let d = Number(chiffres[chiffres.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    somme += d
  }
  return somme % 10 === 0
}

/**
 * Un SIREN valide : neuf chiffres qui passent la clé de Luhn.
 *
 * Les répétitions d'un même chiffre sont écartées explicitement — `000000000`
 * passe la clé de Luhn par construction (sa somme vaut zéro), et laisser
 * entrer neuf zéros rendrait le contrôle décoratif.
 */
export function sirenValide(saisie: string): boolean {
  const n = normaliserSiren(saisie)
  if (n.length !== 9) return false
  if (/^(\d)\1{8}$/.test(n)) return false
  return luhn(n)
}

/**
 * Message à afficher sous le champ, ou `null` quand il n'y a rien à dire.
 *
 * Ne parle que de ce que la personne vient de taper : un formulaire public ne
 * doit rien apprendre d'autre à qui l'essaie.
 */
export function messageSiren(saisie: string): string | null {
  const n = normaliserSiren(saisie)
  if (n.length === 0) return null
  if (n.length < 9) return null
  if (!sirenValide(n)) {
    return 'Ces neuf chiffres ne forment pas un SIREN valide. Vérifiez la saisie — le numéro figure en haut de vos factures.'
  }
  return null
}
