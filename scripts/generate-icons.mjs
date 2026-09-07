// Dessine toutes les icônes de l'application à partir de la marque Quantinvo,
// en gardant l'icône d'accueil, l'icône de démarrage, l'avant-plan adaptatif
// d'Android et le favicon identiques à src/components/AppLogo.tsx.
//
//   node scripts/generate-icons.mjs
//
// Requires the dev dependency @resvg/resvg-js (pure binary, no system deps).

import { Resvg } from '@resvg/resvg-js'
import { copyFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'

// Minimal opaque-PNG (RGB, color type 2) encoder. iOS app icons must not carry
// an alpha channel, even when fully opaque, or Xcode/App Store complain.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodeOpaquePng(rgba, width, height) {
  // RGBA → filtered RGB scanlines (filter byte 0 per row)
  const raw = Buffer.alloc(height * (1 + width * 3))
  let o = 0
  for (let y = 0; y < height; y++) {
    raw[o++] = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      raw[o++] = rgba[i]
      raw[o++] = rgba[i + 1]
      raw[o++] = rgba[i + 2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = (f) => join(root, 'assets/images', f)

/**
 * ⚠️ LA MARQUE EST « LA ZONE » DEPUIS LE 6 SEPTEMBRE 2026 — un plan de magasin
 * vu du dessus, pas un cube isométrique. Le cube et son faisceau bleu
 * électrique sont partis avec l'indigo ; la géométrie ci-dessous est celle de
 * `src/components/AppLogo.tsx` et de `web/components/Logo.tsx`, au dixième
 * près. Si l'une des trois bouge, les trois bougent.
 *
 * ⚠️ ET IL N'Y A PLUS AUCUN DÉGRADÉ. La marque est monochrome : de l'os
 * (#ECEFEC) sur l'encre d'Ardoise (#14181A). C'est la même tuile que le
 * favicon du site.
 */
const ENCRE = '#14181A'
const OS = '#ECEFEC'

/**
 * Le plan, dans un viewBox de 36, transporté au centre d'un canevas de 512.
 * `k` est l'échelle : à 1,0 le cadre occuperait exactement les 512 px et
 * toucherait les quatre bords — d'où les 0,62, qui lui laissent sa marge.
 */
function plan(echelle) {
  const k = (512 / 36) * echelle
  const d = (512 - 36 * k) / 2
  return `
  <g transform="translate(${d},${d}) scale(${k})">
    <rect x="1.5" y="1.5" width="33" height="33" fill="none" stroke="${OS}" stroke-width="3"/>
    <rect x="11" y="3" width="3" height="30" fill="${OS}"/>
    <rect x="22" y="3" width="3" height="30" fill="${OS}"/>
    <rect x="3" y="3" width="8" height="30" fill="${OS}"/>
  </g>`
}

// Plein cadre (iOS masque lui-même les coins de l'icône d'accueil).
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="0" y="0" width="512" height="512" fill="${ENCRE}"/>
  ${plan(0.62)}
</svg>`

// Tuile arrondie sur fond transparent (démarrage, favicon, web).
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="6" y="6" width="500" height="500" rx="116" fill="${ENCRE}"/>
  ${plan(0.62)}
</svg>`

// ⚠️ L'icône adaptative d'Android est en DEUX COUCHES — le fond porte l'encre
// plein cadre, l'avant-plan porte UNIQUEMENT le plan. Mettre la tuile arrondie
// entière dans l'avant-plan (le premier essai, en mai) la laissait flotter sur
// le `backgroundColor` sombre : des bords noirs apparaissaient dès que le
// lanceur appliquait son masque circulaire.
const adaptiveBackground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="0" y="0" width="512" height="512" fill="${ENCRE}"/>
</svg>`

// ⚠️ L'avant-plan tient dans la ZONE SÛRE — les 66 % centraux du canevas.
// Tout ce qui déborde peut être rogné par le masque du lanceur.
const adaptiveForeground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${plan(0.47)}
</svg>`

// opaque=true → RGB (no alpha), for the iOS home-screen icon.
function render(svg, size, file, opaque = false) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' })
  const img = r.render()
  const png = opaque ? encodeOpaquePng(img.pixels, img.width, img.height) : img.asPng()
  writeFileSync(out(file), png)
  console.log(`✓ ${file} (${size}px${opaque ? ', no alpha' : ''})`)
}

/**
 * ⚠️ `assets/images/` N'EST QUE LA SOURCE — LES PROJETS NATIFS EN GARDENT LEUR
 * PROPRE COPIE, ET C'EST CE QUI A FAIT CROIRE QUE L'ICÔNE N'AVAIT PAS CHANGÉ.
 *
 * Constat de Julien au premier build du 6 septembre 2026 : « l'icône de l'app
 * n'a pas changé ». Elle avait bien changé dans `assets/images/` — et nulle
 * part ailleurs. Les deux projets natifs ne lisent pas ce dossier au build :
 *
 * · **iOS** — `ios/` est VERSIONNÉ et ne se régénère jamais. Son icône vit
 *   dans `Images.xcassets/AppIcon.appiconset/`, et la sienne datait du
 *   19 juin. Le script l'y écrit donc lui-même : c'est le seul moyen pour
 *   qu'elle suive, et le fichier passe par git comme le reste d'`ios/`.
 *
 * · **Android** — `android/` est GÉNÉRÉ et gitignoré, et `pixel.sh` ne le
 *   régénère que s'il MANQUE. Ses `mipmap-*` gardent donc les anciennes
 *   icônes indéfiniment. Le script ne peut rien y faire : il faut relancer
 *   `npx expo prebuild --platform android --clean`, ce que ce fichier rappelle
 *   en clair à la fin de son exécution.
 */
const ICONE_IOS = join(root, 'ios/Inventaire/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png')

render(fullBleed, 1024, 'icon.png', true)
render(rounded, 1024, 'splash-icon.png')
render(adaptiveBackground, 1024, 'android-icon-background.png')
render(adaptiveForeground, 1024, 'android-icon-foreground.png')
render(rounded, 48, 'favicon.png')

// ⚠️ L'icône iOS, dans le projet versionné. `copyFileSync` plutôt qu'un
// `render` de plus : c'est exactement le même fichier, et deux rendus du même
// dessin finiraient par diverger.
copyFileSync(out('icon.png'), ICONE_IOS)
console.log('✓ ios/…/AppIcon.appiconset/App-Icon-1024x1024@1x.png')

console.log('')
console.log('⚠️  Android : ses icônes vivent dans android/app/src/main/res/mipmap-*,')
console.log('    un dossier GÉNÉRÉ que pixel.sh ne refait que s\'il manque.')
console.log('    Pour qu\'elles suivent :  npx expo prebuild --platform android --clean')
console.log('')
console.log('Done.')
