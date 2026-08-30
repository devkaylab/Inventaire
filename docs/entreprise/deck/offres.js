// Les trois offres, LUES DANS LE CODE DU SITE (`web/lib/offres.ts`).
//
// ⚠️ Elles ne sont pas recopiées ici, et c'est tout l'objet de ce module.
// Les decks du 24 août portaient encore la grille au volume de stock une
// semaine après son remplacement — un prix périmé dans un document qu'on
// présente en face à face coûte plus cher qu'un bug. En lisant la source, un
// deck régénéré dit forcément le prix en vigueur, et une grille qui change
// sans que ce module suive **casse la génération** au lieu de mentir.
//
// L'analyse est volontairement stricte : on ne devine rien, on échoue.

const fs = require('fs')
const path = require('path')

const SOURCE = path.resolve(__dirname, '../../../web/lib/offres.ts')

function lire() {
  const src = fs.readFileSync(SOURCE, 'utf8')

  const bloc = src.match(/export const OFFRES: Offre\[\] = \[([\s\S]*?)\n\]/)
  if (!bloc) throw new Error(`OFFRES introuvable dans ${SOURCE}`)

  const offres = []
  for (const m of bloc[1].matchAll(/\{\s*\n([\s\S]*?)\n  \},?/g)) {
    const o = m[1]
    const champ = (nom, motif) => {
      const t = o.match(new RegExp(`${nom}:\\s*${motif}`))
      if (!t) throw new Error(`champ « ${nom} » introuvable dans une offre de ${SOURCE}`)
      return t[1]
    }
    const points = [...o.matchAll(/^\s{6}'(.+?)',$/gm)].map((p) => p[1])
    offres.push({
      cle: champ('cle', "'(\\w+)'"),
      nom: champ('nom', "'(.+?)'"),
      plage: champ('plage', "'(.+?)'"),
      mois: Number(champ('mois', '(\\d+)')),
      an: Number(champ('an', '(\\d+)')),
      pour: champ('pour', "'(.+?)'"),
      points,
    })
  }
  if (offres.length !== 3) throw new Error(`3 offres attendues, ${offres.length} lues dans ${SOURCE}`)

  const nb = (nom) => {
    const t = src.match(new RegExp(`${nom}[^\\n]*?(\\d+)`))
    if (!t) throw new Error(`« ${nom} » introuvable dans ${SOURCE}`)
    return Number(t[1])
  }
  const sup = src.match(/export const SUPPLEMENT = \{ par: (\d+), mois: (\d+), an: (\d+) \}/)
  if (!sup) throw new Error(`SUPPLEMENT introuvable dans ${SOURCE}`)

  return {
    offres,
    supplement: { par: Number(sup[1]), mois: Number(sup[2]), an: Number(sup[3]) },
    plafond: nb('export const APPAREILS_MAX ='),
    tva: 0.2,
  }
}

/**
 * 2400 → « 2 400 € ».
 *
 * ⚠️ Le séparateur de milliers est une espace FINE INSÉCABLE (U+202F), comme
 * dans `euros()` de `web/lib/offres.ts` : c'est la typographie française, et
 * c'est ce qui empêche le « 2 » de finir seul en bout de ligne. Avec une
 * espace ordinaire, les decks affichaient un montant très légèrement différent
 * de celui du site — sur deux documents qu'un prospect voit côte à côte.
 */
function euros(v) {
  return `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`
}


/** Ce que payer à l'année fait économiser sur douze mensualités. */
function economie(o) {
  return o.mois * 12 - o.an
}

module.exports = { lire, euros, economie, SOURCE }
