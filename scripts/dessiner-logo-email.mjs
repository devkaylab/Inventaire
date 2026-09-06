#!/usr/bin/env node
/**
 * Dessine le PNG de la marque servie dans le bandeau des e-mails.
 *
 *   node scripts/dessiner-logo-email.mjs
 *
 * ⚠️ POURQUOI UN SCRIPT PLUTÔT QU'UN FICHIER DÉPOSÉ À LA MAIN.
 * La marque existe en SVG (`web/components/Logo.tsx`, `web/public/favicon.svg`)
 * et en PNG (ici) — Gmail retire les SVG et bloque les `data:` en source
 * d'image, d'où le PNG hébergé. Le jour où la marque bouge, un PNG déposé à la
 * main se retrouve en retard sur le SVG et personne ne le voit : le bandeau
 * des e-mails est le seul endroit du produit que nous ne regardons jamais.
 * Le script referme ça — on relance, on commite, les deux disent la même chose.
 *
 * ⚠️ ET IL NE DÉPEND DE RIEN. Ni `sharp`, ni ImageMagick, ni `rsvg-convert` —
 * aucun n'est installé sur ce Mac, et en ajouter un pour deux rectangles
 * serait une dépendance native de plus à tenir. `zlib` suffit, Node le porte.
 *
 * ⚠️ LE FOND EST TRANSPARENT, ET C'EST VOULU. Le bandeau de l'e-mail est en
 * encre ; la marque y est posée en OS (#ECEFEC), sans tuile. L'ancien cube
 * portait la sienne parce qu'il était violet sur fond sombre — il lui fallait
 * son propre fond pour exister. Un signe monochrome clair n'en a pas besoin,
 * et une tuile encre sur un bandeau encre serait invisible.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SORTIE = path.join(RACINE, 'web/public/email/logo-quantinvo-encre.png')

const COTE = 192 // la taille servie dans l'e-mail
const ECH = 4 // ⚠️ on dessine à 4× puis on moyenne : c'est tout l'anticrénelage
const N = COTE * ECH
/**
 * ⚠️ ON DESSINE DANS 40 UNITÉS, PAS 36, ET LA MARQUE EST CENTRÉE DEDANS.
 * Le cadre occupe exactement le viewBox de 36 — son trait part de 0 et finit
 * à 36 — donc rendu tel quel il touche les quatre bords du PNG. Dans le
 * bandeau d'un e-mail, à 56 px, ça se lit comme un carré plein collé au bord
 * plutôt que comme une marque. Deux unités d'air de chaque côté suffisent.
 */
const MARGE = 2
const k = N / (36 + MARGE * 2)

const OS = [0xec, 0xef, 0xec] // --sur-encre, la couleur du texte du bandeau

/**
 * La géométrie, identique à `Logo.tsx` — le cadre du magasin et l'allée
 * comptée. Le cadre est un contour : on le décrit par ses deux rectangles,
 * l'extérieur et le trou, plutôt que par un `stroke` qu'il faudrait simuler.
 */
const TRAIT = 4.5
const CADRE = { x: 2.25 - TRAIT / 2, y: 2.25 - TRAIT / 2, l: 31.5 + TRAIT, h: 31.5 + TRAIT }
const TROU = { x: 2.25 + TRAIT / 2, y: 2.25 + TRAIT / 2, l: 31.5 - TRAIT, h: 31.5 - TRAIT }
const ALLEE = { x: 10.5, y: 4.5, l: 9, h: 27 }

const dans = (x, y, r) => x >= r.x && y >= r.y && x <= r.x + r.l && y <= r.y + r.h

// ── Le rendu, à 4× ─────────────────────────────────────────────────────────
const grand = new Uint8Array(N * N * 4)
for (let py = 0; py < N; py++) {
  for (let px = 0; px < N; px++) {
    const x = (px + 0.5) / k - MARGE
    const y = (py + 0.5) / k - MARGE
    const encre = (dans(x, y, CADRE) && !dans(x, y, TROU)) || dans(x, y, ALLEE)
    if (!encre) continue
    const o = (py * N + px) * 4
    grand[o] = OS[0]; grand[o + 1] = OS[1]; grand[o + 2] = OS[2]; grand[o + 3] = 255
  }
}

// ── La réduction : chaque pixel final est la moyenne de ECH × ECH ──────────
const pixels = new Uint8Array(COTE * COTE * 4)
for (let y = 0; y < COTE; y++) {
  for (let x = 0; x < COTE; x++) {
    let a = 0
    for (let dy = 0; dy < ECH; dy++) {
      for (let dx = 0; dx < ECH; dx++) a += grand[((y * ECH + dy) * N + (x * ECH + dx)) * 4 + 3]
    }
    const p = (y * COTE + x) * 4
    // ⚠️ La couleur reste pleine et seule l'opacité varie : la marque est
    // monochrome, donc rien à moyenner sur les canaux — et c'est ce qui évite
    // le halo sombre sur les bords qu'une moyenne naïve produit.
    pixels[p] = OS[0]; pixels[p + 1] = OS[1]; pixels[p + 2] = OS[2]
    pixels[p + 3] = Math.round(a / (ECH * ECH))
  }
}

// ── L'encodage PNG (RGBA, sans filtre) ─────────────────────────────────────
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k2 = 0; k2 < 8; k2++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const o of buf) c = crcTable[(c ^ o) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const morceau = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const corps = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const som = Buffer.alloc(4); som.writeUInt32BE(crc(corps))
  return Buffer.concat([len, corps, som])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(COTE, 0); ihdr.writeUInt32BE(COTE, 4)
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

const brut = Buffer.alloc(COTE * (COTE * 4 + 1))
for (let y = 0; y < COTE; y++) {
  brut[y * (COTE * 4 + 1)] = 0 // filtre « aucun »
  Buffer.from(pixels.buffer, y * COTE * 4, COTE * 4).copy(brut, y * (COTE * 4 + 1) + 1)
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  morceau('IHDR', ihdr),
  morceau('IDAT', deflateSync(brut, { level: 9 })),
  morceau('IEND', Buffer.alloc(0)),
])

writeFileSync(SORTIE, png)
console.log(`${SORTIE} — ${COTE}×${COTE}, ${(png.length / 1024).toFixed(1)} ko`)
