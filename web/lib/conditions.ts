// Les conditions générales de vente et d'utilisation — publiées et acceptées.
//
// ⚠️ UN SEUL TEXTE. La page `/conditions-generales` lit
// `docs/entreprise/cgv-quantinvo-brouillon.md` à la construction : recopier un
// contrat, c'est garantir que les deux versions divergeront. Le fichier garde
// ses notes internes (statut, points à trancher) HORS du passage publié —
// entre le titre de l'article 1 et « Points à trancher ».
//
// ⚠️ LA VERSION EST CE QUE LE CLIENT ACCEPTE. Elle voyage avec chaque
// souscription jusqu'en base, où `version_conditions()` porte la même valeur :
// une page restée ouverte sur une ancienne version se fait refuser, plutôt que
// d'enregistrer l'acceptation d'un texte qui n'est plus celui en ligne. Changer
// le texte de façon substantielle = changer la date ici ET dans la migration,
// ensemble. Un test compare les deux.

export const VERSION_CONDITIONS = '2026-09-16'
export const CONDITIONS_URL = '/conditions-generales'

const DEBUT = '## 1. Identification'
const FIN = '## Points à trancher'

/** Le passage publié du fichier, sans les notes internes qui l'entourent. */
export function passagePublie(source: string): string {
  const a = source.indexOf(DEBUT)
  const b = source.indexOf(FIN)
  if (a < 0 || b < a) throw new Error('Conditions générales : repères introuvables dans le fichier source.')
  const texte = source.slice(a, b).replace(/\n---\s*\n/g, '\n\n').trim()
  // ⚠️ Une construction ratée vaut mieux qu'un contrat à trous en ligne.
  for (const interdit of ['[', '⚠️', 'docs/', '`', '~~']) {
    if (texte.includes(interdit)) {
      throw new Error(`Conditions générales : « ${interdit} » dans le passage publié — il reste une note interne.`)
    }
  }
  return texte
}

export type Segment = { gras: boolean; texte: string }
export type Bloc =
  | { type: 'titre'; texte: string }
  | { type: 'paragraphe'; segments: Segment[] }
  | { type: 'liste'; items: Segment[][] }
  | { type: 'tableau'; entete: Segment[][]; lignes: Segment[][][] }

/** `**gras**` → segments. Rien d'autre n'est interprété. */
export function segments(ligne: string): Segment[] {
  return ligne
    .split('**')
    .map((texte, i) => ({ gras: i % 2 === 1, texte }))
    .filter((s) => s.texte !== '')
}

const cellules = (ligne: string) =>
  ligne.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => segments(c.trim()))

/**
 * Le sous-ensemble de Markdown que le contrat emploie : titres de niveau 2,
 * paragraphes, listes à tirets, tableaux, gras. Volontairement étroit — une
 * bibliothèque de rendu serait une dépendance de plus pour quatre formes.
 */
export function blocs(texte: string): Bloc[] {
  const sortie: Bloc[] = []
  for (const morceau of texte.split(/\n\s*\n/)) {
    const lignes = morceau.split('\n').filter((l) => l.trim() !== '')
    if (lignes.length === 0) continue
    const premiere = lignes[0].trim()
    if (premiere.startsWith('## ')) {
      sortie.push({ type: 'titre', texte: premiere.slice(3).trim() })
      if (lignes.length > 1) {
        sortie.push(...blocs(lignes.slice(1).join('\n')))
      }
    } else if (premiere.startsWith('|')) {
      const [tete, , ...reste] = lignes
      sortie.push({ type: 'tableau', entete: cellules(tete), lignes: reste.map(cellules) })
    } else if (premiere.startsWith('- ')) {
      const items: string[] = []
      for (const l of lignes) {
        if (l.trim().startsWith('- ')) items.push(l.trim().slice(2))
        else items[items.length - 1] += ' ' + l.trim()
      }
      sortie.push({ type: 'liste', items: items.map(segments) })
    } else {
      sortie.push({ type: 'paragraphe', segments: segments(lignes.map((l) => l.trim()).join(' ')) })
    }
  }
  return sortie
}
