import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * L'en-tête d'une page ne porte pas de panneau — la garde (9 octobre 2026).
 *
 * ⚠️⚠️ **LE DÉFAUT, RELEVÉ PAR JULIEN.** Sur « Mon équipe », le formulaire
 * d'ajout d'un compteur apparaissait collé à droite du titre, avec un grand
 * vide à gauche. La cause n'était pas dans le CSS : `.app-head` est une rangée
 * `display:flex; justify-content:space-between`, faite pour « titre à gauche,
 * ACTION à droite ». L'administrateur y mettait un bouton ; le superviseur y
 * recevait `AddCounter`, un composant qui portait **lui-même** ses deux états
 * — bouton fermé, carte ouverte. Fermé il passait pour un bouton ; ouvert, la
 * carte entière devenait l'élément de droite.
 *
 * ⚠️ La leçon vaut au-delà de cette page : **un composant qui porte son propre
 * bouton impose sa place à la page.** Quand il s'ouvre, il occupe l'emplacement
 * prévu pour le bouton. La page doit tenir l'ouverture, et rendre le panneau
 * sous l'en-tête.
 *
 * Cette garde ne cite ni la page ni les composants : elle PARCOURT les pages,
 * relève ce que chaque en-tête contient, et refuse qu'un de ces composants soit
 * un panneau. Un troisième panneau posé dans un en-tête demain tombera aussi.
 */

const racine = path.resolve(__dirname, '..')

function fichiersTsx(dossier: string): string[] {
  const sortie: string[] = []
  for (const nom of readdirSync(dossier)) {
    if (nom === 'node_modules' || nom === '.next') continue
    const complet = path.join(dossier, nom)
    if (statSync(complet).isDirectory()) sortie.push(...fichiersTsx(complet))
    else if (nom.endsWith('.tsx')) sortie.push(complet)
  }
  return sortie
}

/** Le contenu de chaque bloc `<div className="app-head…">` d'un fichier. */
function entetes(source: string): string[] {
  const blocs: string[] = []
  const ouverture = /<div className="app-head[^"]*">/g
  for (const m of source.matchAll(ouverture)) {
    const debut = m.index! + m[0].length
    // La fermeture est le `</div>` à la MÊME indentation que l'ouverture :
    // compter les balises serait fragile face au JSX conditionnel.
    const indentation = source.slice(0, m.index!).split('\n').pop() ?? ''
    const fin = source.indexOf(`\n${indentation}</div>`, debut)
    blocs.push(source.slice(debut, fin === -1 ? source.length : fin))
  }
  return blocs
}

/** Le code source du composant `<Nom …>`, qu'il soit local ou importé. */
function sourceDuComposant(nom: string, fichier: string, source: string): string | null {
  if (new RegExp(`function ${nom}\\(`).test(source)) {
    return source.slice(source.search(new RegExp(`function ${nom}\\(`)))
  }
  const imp = new RegExp(`import \\{[^}]*\\b${nom}\\b[^}]*\\} from '([^']+)'`).exec(source)
  if (!imp) return null
  const brut = imp[1]
  const base = brut.startsWith('@/')
    ? path.join(racine, brut.slice(2))
    : path.resolve(path.dirname(fichier), brut)
  for (const essai of [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx')]) {
    if (existsSync(essai)) return readFileSync(essai, 'utf8')
  }
  return null
}

describe('⚠️⚠️ un en-tête de page ne contient jamais de panneau', () => {
  const pages = fichiersTsx(path.join(racine, 'app'))
    .map((f) => ({ f, src: readFileSync(f, 'utf8') }))
    .filter(({ src }) => src.includes('className="app-head'))

  it('des pages à en-tête existent bien', () => {
    // Sans ça, un renommage de `.app-head` rendrait la garde verte et aveugle.
    expect(pages.length, 'aucune page à en-tête trouvée : la classe a changé de nom ?')
      .toBeGreaterThan(2)
  })

  it('aucun composant rendu dans un en-tête n’est une carte', () => {
    const fautes: string[] = []

    for (const { f, src } of pages) {
      for (const bloc of entetes(src)) {
        const utilises = new Set([...bloc.matchAll(/<([A-Z]\w+)/g)].map((m) => m[1]))
        for (const nom of utilises) {
          const code = sourceDuComposant(nom, f, src)
          if (code && /className="panel/.test(code)) {
            fautes.push(`${path.relative(racine, f)} : <${nom}> est un panneau`)
          }
        }
      }
    }

    expect(
      fautes,
      'un panneau est rendu dans un en-tête : `.app-head` étant une rangée ' +
        'space-between, la carte se collera à droite du titre. Mettre un bouton ' +
        'dans l’en-tête et rendre le panneau en dessous.\n' + fautes.join('\n'),
    ).toEqual([])
  })
})
