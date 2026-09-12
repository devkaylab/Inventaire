// Le favicon du site — trois fichiers, trois destinataires.
//
// Constat de Julien, 12 septembre 2026, capture d'un onglet Safari à l'appui :
// « sur safari j'ai toujours l'ancien logo dans l'onglet alors que chrome
// non ». C'était bien l'icône d'AVANT Ardoise, retirée le 6 septembre : le
// site servait déjà la bonne, Safari gardait la sienne en cache. Mais il
// n'avait rien de frais à aller chercher — `/favicon.ico` répondait 404 — et
// c'est ce qui rend un cache collant. Ces gardes figent le remède.
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p))
const layout = lire('../app/layout.tsx').toString('utf8')
const script = lire('../scripts/dessiner-favicons.mjs').toString('utf8')

/** Le code seul : un commentaire qui EXPLIQUE une règle en cite les mots. */
const sansCommentaires = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('les trois fichiers existent et sont déclarés', () => {
  it('⚠️ le SVG, l’ICO et l’icône d’écran d’accueil', () => {
    // ⚠️ Un seul des trois ne suffit pas, et c'est tout le constat : Chrome lit
    // le SVG, Safari et les robots demandent `/favicon.ico`, iOS demande
    // `apple-touch-icon`. Une adresse qui répond 404 ne remplace jamais un
    // cache périmé.
    for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png']) {
      expect(statSync(path.resolve(__dirname, '../public/' + f)).size,
        `public/${f} est absent ou vide`).toBeGreaterThan(0)
    }
    const code = sansCommentaires(layout)
    expect(code).toContain("url: '/favicon.svg'")
    expect(code).toContain("url: '/favicon.ico'")
    expect(code).toContain("apple: '/apple-touch-icon.png'")
  })

  it('⚠️ et le SVG annonce son type', () => {
    // Sans `type`, le navigateur doit deviner le format d'un fichier qu'il
    // n'a pas encore téléchargé. Safari est celui qui devine le moins.
    expect(sansCommentaires(layout)).toMatch(/url: '\/favicon\.svg', type: 'image\/svg\+xml'/)
  })
})

describe('l’ICO est un vrai ICO', () => {
  const ico = lire('../public/favicon.ico')

  it('⚠️ plusieurs tailles, dont 16 et 32', () => {
    // Un ICO d'une seule taille force le navigateur à redimensionner : à 16 px
    // les allées de la marque font 1,3 pixel et disparaissent. Les tailles sont
    // rendues une à une depuis un rendu de 256.
    expect(ico.readUInt16LE(0), 'octets réservés non nuls').toBe(0)
    expect(ico.readUInt16LE(2), 'le type n’est pas « icône »').toBe(1)
    const n = ico.readUInt16LE(4)
    expect(n, 'une seule taille dans l’ICO').toBeGreaterThanOrEqual(2)
    const tailles = new Set<number>()
    for (let i = 0; i < n; i++) {
      const e = 6 + i * 16
      tailles.add(ico.readUInt8(e) || 256)
      // Chaque entrée pointe sur une image réellement présente, et c'est un
      // PNG — la forme que lisent tous les navigateurs d'aujourd'hui.
      const taille = ico.readUInt32LE(e + 8)
      const decalage = ico.readUInt32LE(e + 12)
      expect(decalage + taille, 'une entrée de l’ICO déborde du fichier')
        .toBeLessThanOrEqual(ico.length)
      expect(ico.subarray(decalage, decalage + 8).toString('hex'),
        'une entrée de l’ICO n’est pas un PNG').toBe('89504e470d0a1a0a')
    }
    expect(tailles.has(16), 'l’ICO n’a pas de 16 px').toBe(true)
    expect(tailles.has(32), 'l’ICO n’a pas de 32 px').toBe(true)
  })
})

describe('l’icône d’écran d’accueil suit la règle d’iOS', () => {
  it('⚠️ 180 px, carrée, et SANS canal alpha', () => {
    // iOS arrondit lui-même les coins : un PNG déjà arrondi en ressort
    // doublement rogné, et un PNG transparent se retrouve composé sur du noir.
    const png = lire('../public/apple-touch-icon.png')
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    // L'en-tête IHDR suit immédiatement la signature : largeur, hauteur, puis
    // profondeur et type de couleur.
    expect(png.readUInt32BE(16), 'largeur').toBe(180)
    expect(png.readUInt32BE(20), 'hauteur').toBe(180)
    const typeCouleur = png.readUInt8(25)
    // 2 = RVB sans alpha, 0 = gris sans alpha. 4 et 6 portent un canal alpha.
    expect([0, 2], `type de couleur ${typeCouleur} : l’icône porte un alpha`)
      .toContain(typeCouleur)
  })
})

describe('la marque n’est pas redessinée', () => {
  it('⚠️ le script RASTÉRISE le SVG, il ne trace rien', () => {
    // Quatre fichiers portent déjà la géométrie de la marque (le composant du
    // site, celui de l'application, le script des icônes et ce SVG) et une
    // garde les compare. Un cinquième dessin échapperait à cette comparaison :
    // le script doit donc partir du SVG, jamais de coordonnées à lui.
    const code = sansCommentaires(script)
    expect(code).toContain("readFileSync(join(racine, 'public/favicon.svg'))")
    expect(code, 'le script trace la marque au lieu de lire le SVG')
      .not.toMatch(/<rect|<polygon|<svg/)
  })
})
