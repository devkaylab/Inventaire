import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Les gabarits des visuels de boutique — le bandeau Google Play et l'image de
 * partage du site.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. Le 13 septembre 2026, ces deux gabarits
 * portaient encore l'identité d'AVANT Ardoise — dégradé violet, cube
 * isométrique, filet de scan cyan, Sora — dix jours après que tout le reste du
 * produit en soit sorti. Personne ne l'avait vu, et pour une raison simple :
 * ils vivent dans `docs/`, donc hors de tout ce que les gardes du site et de
 * l'application balaient.
 *
 * Ce n'était pas un détail. `og.png` part à chaque fois qu'un lien du site est
 * collé dans LinkedIn, Slack ou un message — c'est la première chose qu'un
 * prospect voit de Quantinvo. Et les deux visuels de la fiche Play sont ceux
 * qu'on déposera au moment de publier : l'app aurait porté le plan de magasin
 * derrière une fiche au cube violet.
 *
 * ⚠️ LA GARDE DÉDUIT SES FICHIERS ET SES POLICES, ELLE NE LES CITE PAS. Un
 * troisième gabarit ajouté demain est couvert sans qu'on y pense — et surtout,
 * le lien entre les gabarits et le contrôle de `produire.mjs` se vérifie tout
 * seul. C'est ce lien qui manquait : le script vérifiait que Sora était
 * résolue bien après que les gabarits soient passés à Archivo, donc il
 * contrôlait une police que plus personne n'employait.
 */

const BOUTIQUES = path.resolve(__dirname, '../../docs/entreprise/boutiques')

/** Les commentaires CITENT ce qu'ils interdisent : une garde qui les lit se
 *  déclenche sur sa propre documentation. Piège payé treize fois sur ce dépôt. */
const code = (s: string) =>
  s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')

const gabarits = readdirSync(BOUTIQUES)
  .filter((f) => f.endsWith('.html'))
  .map((f) => ({ nom: f, source: code(readFileSync(path.join(BOUTIQUES, f), 'utf8')) }))

describe('Visuels de boutique — charte', () => {
  it('il y a bien des gabarits à garder', () => {
    // Une détection cassée rendrait tout ce fichier silencieux, ce qui est
    // pire que pas de garde du tout.
    expect(gabarits.length).toBeGreaterThanOrEqual(2)
  })

  it('⚠️ portent la palette d’ARDOISE — et plus une valeur de l’ancienne', () => {
    for (const { nom, source } of gabarits) {
      const bas = source.toLowerCase()
      for (const morte of ['#0b0f19', '#17123a', '#090c14', '#7466f4', '#4636b0',
                           '#1c153f', '#a99cfa', '#6e5dec', '#4a3aa8', '#38c9ff',
                           '#a8b0c2', '#6366f1', '#4f46e5']) {
        expect(bas, `${nom} garde ${morte}, un reste de la palette d’avant`).not.toContain(morte)
      }
      // Et il porte bien l'encre et le texte d'Ardoise.
      expect(bas, `${nom} ne pose pas le fond d’Ardoise`).toContain('#141716')
      expect(bas, `${nom} ne pose pas l’encre claire d’Ardoise`).toContain('#ecefec')
    }
  })

  it('⚠️ la marque est le PLAN DE MAGASIN, pas le cube', () => {
    // Le cube isométrique se dessinait en `polygon`, le plan en `rect`. La
    // géométrie est celle de `web/components/Logo.tsx`, au dixième près.
    for (const { nom, source } of gabarits) {
      expect(source, `${nom} dessine encore un polygone — le cube ?`).not.toContain('<polygon')
      expect(source, `${nom} n’a pas le viewBox de la marque`).toContain('viewBox="0 0 36 36"')
      expect(source, `${nom} n’a pas le cadre du magasin`).toContain('width="33" height="33"')
    }
  })

  it('⚠️ l’accent ne porte QUE la seconde ligne du titre', () => {
    // Sur une image, la promesse est la seule chose qui engage ; tout le reste
    // est de l'encre. Trois accents sur un visuel, c'est l'ancien monde.
    for (const { nom, source } of gabarits) {
      const accents = source.match(/#8fc9b0/gi) ?? []
      expect(accents.length, `${nom} emploie l’accent ${accents.length} fois`).toBe(1)
    }
  })

  it('⚠️ le script vérifie EXACTEMENT les polices que les gabarits demandent', () => {
    // C'est le lien qui manquait. `produire.mjs` refuse de sortir une image si
    // une police n'a pas été résolue — encore faut-il qu'il surveille les
    // bonnes : il a vérifié Sora bien après le passage à Archivo, donc il ne
    // gardait plus rien.
    const script = readFileSync(path.join(BOUTIQUES, 'produire.mjs'), 'utf8')

    const demandees = new Set<string>()
    for (const { source } of gabarits) {
      for (const m of source.matchAll(/family=([A-Za-z+]+):/g)) {
        demandees.add(m[1].replace(/\+/g, ' '))
      }
    }
    expect(demandees.size, 'aucune police détectée dans les gabarits').toBeGreaterThan(0)

    for (const police of demandees) {
      expect(script, `produire.mjs ne vérifie pas que ${police} est résolue`)
        .toContain(`'${police}'`)
    }
  })

  it('⚠️ et ce contrôle compare deux SECOURS, pas la police à un secours', () => {
    // `document.fonts.check()` répond `true` pour une famille qui n'existe
    // nulle part — mesuré le 13 septembre 2026. Et comparer la largeur d'un
    // mot en Archivo à sa largeur en fonte système finirait par refuser des
    // images bonnes : Archivo est un grotesque, donc proche d'Helvetica.
    const script = code(readFileSync(path.join(BOUTIQUES, 'produire.mjs'), 'utf8'))
    expect(script, 'le contrôle est revenu à document.fonts.check(), qui ne mord pas')
      .not.toContain('fonts.check')
    expect(script, 'le contrôle ne compare plus deux familles de secours')
      .toContain('monospace')
    expect(script, 'le contrôle ne compare plus deux familles de secours')
      .toContain('serif')
  })
})
