// Prépare les captures de l'application pour le guide de prise en main.
//
// Entrée : les captures brutes du simulateur (1206 × 2622, iPhone 17), prises
// par `xcrun simctl io booted screenshot`. Sortie : `captures/`, en demi-
// résolution — 603 px suffisent largement à la taille où le deck les affiche,
// et 20 captures pèsent alors 1,3 Mo au lieu de 13.
//
// ⚠️ **Le masquage des adresses n'est pas cosmétique.** Le compte d'essai est
// créé avec de vraies adresses (un `+alias` d'une boîte personnelle) : sans ce
// passage, le guide remis au client les afficherait. Les adresses de
// remplacement sont fictionnelles et utilisent le domaine réservé `.example`,
// qui ne peut appartenir à personne.
//
//   node preparer-captures.js <dossier-des-captures-brutes>

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const SORTIE = path.join(__dirname, 'captures')
const LARGEUR = 603

// Les écrans repris dans le deck. Ajouter ici une capture nouvelle.
const ECRANS = [
  'accueil-superviseur', 'nouvel-inventaire', 'zones', 'importer',
  'fiche-inventaire', 'inventaire-superviseur', 'mon-equipe', 'boite-a-outils',
  'creer-balises', 'ajouter-membre', 'mon-compte',
  'bienvenue-compteur', 'accueil-compteur', 'inventaire-compteur',
  'scanner-balise', 'comptage', 'balise-terminee', 'audit',
  'balise-hors-plage', 'balises-comptees-detail',
]

/**
 * Adresses à recouvrir, en pixels de la capture brute (1206 × 2622).
 * `align: 'centre'` pour une fiche d'identité, `'gauche'` pour une ligne de
 * liste. Le fond est celui de la carte qui porte le texte.
 */
const MASQUES = {
  'mon-compte': [{
    x: 140, y: 838, w: 926, h: 66, fond: '#FFFFFF',
    texte: 'nadia.benali@maison-oberlin.example', taille: 40, align: 'centre',
  }],
  'mon-equipe': [{
    x: 222, y: 562, w: 700, h: 58, fond: '#FFFFFF',
    texte: 'nadia.benali@maison-oberlin.example', taille: 36, align: 'gauche',
  }],
}

async function masquer(buffer, masques) {
  const calques = []
  for (const m of masques) {
    const y = Math.round(m.h * 0.72) // ligne de base du texte dans la bande
    const x = m.align === 'centre' ? m.w / 2 : 0
    const ancre = m.align === 'centre' ? 'middle' : 'start'
    calques.push({
      input: Buffer.from(`<svg width="${m.w}" height="${m.h}">
        <rect width="${m.w}" height="${m.h}" fill="${m.fond}"/>
        <text x="${x}" y="${y}" text-anchor="${ancre}" fill="#5B6475"
              font-family="Helvetica, Arial, sans-serif" font-size="${m.taille}">${m.texte}</text>
      </svg>`),
      left: m.x, top: m.y,
    })
  }
  return sharp(buffer).composite(calques).png().toBuffer()
}

async function main() {
  const source = process.argv[2]
  if (!source) {
    console.error('usage : node preparer-captures.js <dossier-des-captures-brutes>')
    process.exit(1)
  }
  fs.mkdirSync(SORTIE, { recursive: true })
  let faits = 0
  for (const nom of ECRANS) {
    const entree = path.join(source, nom + '.png')
    if (!fs.existsSync(entree)) { console.warn('MANQUE', nom); continue }
    let buf = await sharp(entree).png().toBuffer()
    if (MASQUES[nom]) buf = await masquer(buf, MASQUES[nom])
    await sharp(buf).resize(LARGEUR).png({ compressionLevel: 9, palette: true })
      .toFile(path.join(SORTIE, nom + '.png'))
    faits++
  }
  console.log(`OK ${faits}/${ECRANS.length} captures dans captures/`)
}

main().catch((e) => { console.error(e); process.exit(1) })
