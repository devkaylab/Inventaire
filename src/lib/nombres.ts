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
//
// ⚠️ ET C'EST L'ESPACE INSÉCABLE ORDINAIRE (U+00A0), PAS L'ÉTROITE DE `fr-FR`.
// Celle que pose la locale (U+202F) NE SE VOIT PAS à la taille du texte
// courant sur un nombre à quatre chiffres : Julien a lu « 1146 » à côté d'un
// « 12 210 » qui, lui, se détachait (4 septembre 2026). Le séparateur était
// pourtant le même des deux côtés — le défaut n'était pas qu'il manquait,
// c'était qu'il était invisible. `web/lib/format.ts` porte la même règle, et
// un test compare les deux modules.
//
// ⚠️ LA LOCALE EST CELLE DE L'INTERFACE, PAS CELLE DU TÉLÉPHONE (10 septembre
// 2026). `locale()` rend « fr-FR » ou « en-GB » selon la langue choisie dans
// Mon compte : une interface en anglais écrit « 18,402 », et le symbole de
// l'euro passe devant le montant, comme l'anglais l'écrit.

import { langue, locale } from '@/lib/i18n'

/** Le séparateur de milliers, en un seul point. */
const SEPARATEUR = '\u00a0'
function grouper(s: string): string {
  return s.replace(/\u202f/g, SEPARATEUR)
}

/**
 * Quantité : groupée par milliers, décimales sans zéros inutiles
 * (1500 → « 1 500 », 1.500 → « 1,5 »). `null` rend un tiret — une quantité
 * absente n'est pas une quantité nulle.
 *
 * `v || 0` écrase le zéro négatif, qui se lirait comme un manque.
 */
export function qte(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return grouper((v || 0).toLocaleString(locale(), { maximumFractionDigits: 3 }))
}

/** Écart signé : le + reste, c'est lui qui donne le sens. */
export function qteSignee(v: number): string {
  return v > 0 ? `+${qte(v)}` : qte(v)
}

/** Montant en euros, deux décimales, dans la locale de l'interface. */
export function euros(v: number): string {
  if (!Number.isFinite(v)) v = 0
  const n = grouper((v || 0).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  return langue() === 'en' ? `€${n}` : `${n} €`
}

/** Un entier avec ses séparateurs de milliers : 18402 → « 18 402 ». */
export function nb(n: number): string {
  return grouper((Number.isFinite(n) ? n : 0).toLocaleString(locale()))
}
