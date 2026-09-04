// Les nombres tels qu'on les lit (3 septembre 2026).
//
// ⚠️ LE SÉPARATEUR DE MILLIERS N'EST PAS UN ORNEMENT. Demande de Julien :
// « toujours avoir un séparateur de milliers, exemple 1000 > 1 000, plus
// facile à lire ». Sur un inventaire, la colonne des quantités porte des
// nombres à cinq ou six chiffres : sans groupement, « 128400 » et « 12840 »
// se ressemblent au coup d'œil — et c'est exactement là qu'on cherche un
// écart.
//
// Ces trois fonctions sont le miroir de `web/lib/format.ts` (`fmtQty`,
// `money`, `nb`) : l'application et le site ne compilent pas ensemble, mais
// un même inventaire doit s'afficher à l'identique des deux côtés. Elles
// remplacent les deux copies de `fmt` qui vivaient chacune dans son écran.
//
// ⚠️ AFFICHAGE SEULEMENT. Un export, une valeur de champ de saisie ou une
// comparaison prennent le nombre brut : `toLocaleString` insère une espace
// insécable qu'aucun tableur ne relit comme un chiffre.

/**
 * Quantité : groupée par milliers, décimales sans zéros inutiles
 * (1500 → « 1 500 », 1.500 → « 1,5 »). `null` rend un tiret — une quantité
 * absente n'est pas une quantité nulle.
 *
 * `v || 0` écrase le zéro négatif, qui se lirait comme un manque.
 */
export function qte(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return (v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 })
}

/** Écart signé : le + reste, c'est lui qui donne le sens. */
export function qteSignee(v: number): string {
  return v > 0 ? `+${qte(v)}` : qte(v)
}

/** Montant en euros, deux décimales, séparateurs français. */
export function euros(v: number): string {
  if (!Number.isFinite(v)) v = 0
  return `${(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

/** Un entier avec ses séparateurs de milliers : 18402 → « 18 402 ». */
export function nb(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('fr-FR')
}
