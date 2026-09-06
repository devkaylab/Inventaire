#!/usr/bin/env node
/**
 * Dessine le PNG du logo servi dans le bandeau des e-mails.
 *
 *   node scripts/dessiner-logo-email.mjs
 *
 * ⚠️ POURQUOI UN SCRIPT PLUTÔT QU'UN FICHIER DÉPOSÉ À LA MAIN.
 * Le logo existe en SVG (`web/components/Logo.tsx`, `web/public/favicon.svg`)
 * et en PNG (ici) — Gmail retire les SVG et bloque les `data:` en source
 * d'image, d'où le PNG hébergé. Le jour où la marque bouge, un PNG déposé à la
 * main se retrouve en retard sur le SVG et personne ne le voit : le bandeau
 * des e-mails est le seul endroit du produit que nous ne regardons jamais.
 * Le script referme ça — on relance, on commite, les deux disent la même chose.
 *
 * ⚠️ ET IL NE DÉPEND DE RIEN. Ni `sharp`, ni ImageMagick, ni `rsvg-convert` —
 * aucun n'est installé sur ce Mac, et en ajouter un pour cinq formes serait
 * une dépendance native de plus à tenir. Le rendu tient en une centaine de
 * lignes : cinq formes, un dégradé, et `zlib` que Node porte déjà.
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
const k = N / 512 // l'échelle depuis le viewBox du SVG

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]

// Les couleurs d'Ardoise, dans l'ordre où le SVG les pose.
const DEGRADE = [
  { t: 0, c: hex('#4E9B79') },
  { t: 0.52, c: hex('#23604A') },
  { t: 1, c: hex('#0E241C') },
]
const FACE_HAUT = hex('#A8D6C1')
const FACE_GAUCHE = hex('#63AE8C')
const FACE_DROITE = hex('#35745B')
const SCAN = hex('#4FB6CF')

/** La couleur du dégradé diagonal, à la position `t` entre 0 et 1. */
function surLeDegrade(t) {
  for (let i = 1; i < DEGRADE.length; i++) {
    const a = DEGRADE[i - 1]
    const b = DEGRADE[i]
    if (t <= b.t) {
      const p = (t - a.t) / (b.t - a.t)
      return [0, 1, 2].map((j) => Math.round(a.c[j] + (b.c[j] - a.c[j]) * p))
    }
  }
  return DEGRADE[DEGRADE.length - 1].c
}

/** Le point (x, y) est-il dans le rectangle arrondi ? Coordonnées du viewBox. */
function dansRectArrondi(x, y, rx, ry, larg, haut, r) {
  if (x < rx || y < ry || x > rx + larg || y > ry + haut) return false
  const cx = Math.min(Math.max(x, rx + r), rx + larg - r)
  const cy = Math.min(Math.max(y, ry + r), ry + haut - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

/** Le point (x, y) est-il dans le polygone ? Lancer de rayon, comme le SVG. */
function dansPolygone(x, y, pts) {
  let dedans = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans
  }
  return dedans
}

const HAUT = [[256, 146], [352, 196], [256, 246], [160, 196]]
const GAUCHE = [[160, 196], [256, 246], [256, 366], [160, 316]]
const DROITE = [[352, 196], [352, 316], [256, 366], [256, 246]]

// ── Le rendu, à 4× ─────────────────────────────────────────────────────────
const grand = new Uint8Array(N * N * 4)
for (let py = 0; py < N; py++) {
  for (let px = 0; px < N; px++) {
    const x = (px + 0.5) / k
    const y = (py + 0.5) / k
    const o = (py * N + px) * 4
    if (!dansRectArrondi(x, y, 6, 6, 500, 500, 116)) continue // hors du cube : transparent

    let c = surLeDegrade(Math.min(1, Math.max(0, (x / 512 + y / 512) / 2)))
    if (dansRectArrondi(x, y, 92, 282, 328, 12, 6)) c = SCAN
    else if (dansPolygone(x, y, HAUT)) c = FACE_HAUT
    else if (dansPolygone(x, y, GAUCHE)) c = FACE_GAUCHE
    else if (dansPolygone(x, y, DROITE)) c = FACE_DROITE
    grand[o] = c[0]; grand[o + 1] = c[1]; grand[o + 2] = c[2]; grand[o + 3] = 255
  }
}

// ── La réduction : chaque pixel final est la moyenne de ECH × ECH ──────────
const pixels = new Uint8Array(COTE * COTE * 4)
for (let y = 0; y < COTE; y++) {
  for (let x = 0; x < COTE; x++) {
    let r = 0, v = 0, b = 0, a = 0
    for (let dy = 0; dy < ECH; dy++) {
      for (let dx = 0; dx < ECH; dx++) {
        const o = ((y * ECH + dy) * N + (x * ECH + dx)) * 4
        // ⚠️ On pondère la couleur par l'opacité : sans ça, les bords arrondis
        // tirent vers le noir des pixels transparents (le halo noir classique).
        const al = grand[o + 3] / 255
        r += grand[o] * al; v += grand[o + 1] * al; b += grand[o + 2] * al; a += grand[o + 3]
      }
    }
    const n = ECH * ECH
    const moyA = a / n
    const p = (y * COTE + x) * 4
    const div = moyA > 0 ? (moyA / 255) * n : 1
    pixels[p] = Math.round(r / div)
    pixels[p + 1] = Math.round(v / div)
    pixels[p + 2] = Math.round(b / div)
    pixels[p + 3] = Math.round(moyA)
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
