// Generates all app icon PNGs from the Inventaire logo (isometric package +
// scan beam), keeping the home-screen icon, splash icon, Android adaptive
// foreground and web favicon visually identical to src/components/AppLogo.tsx.
//
//   node scripts/generate-icons.mjs
//
// Requires the dev dependency @resvg/resvg-js (pure binary, no system deps).

import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'node:fs'
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

// Shared gradient defs (identical palette to AppLogo.tsx)
const defs = `
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7466F4"/>
      <stop offset="0.52" stop-color="#4636B0"/>
      <stop offset="1" stop-color="#1C153F"/>
    </linearGradient>
    <radialGradient id="topGlow" cx="0.3" cy="0.12" r="0.95">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.20"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="faceTop" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#A99CFA"/><stop offset="1" stop-color="#8E7FF2"/>
    </linearGradient>
    <linearGradient id="faceLeft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6E5DEC"/><stop offset="1" stop-color="#5A49D4"/>
    </linearGradient>
    <linearGradient id="faceRight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4A3AA8"/><stop offset="1" stop-color="#3A2C8C"/>
    </linearGradient>
  </defs>`

// How much to enlarge the package+beam within the icon (1 = original design).
const GLYPH_SCALE = 1.3

// Package + static scan beam (beam at rest position, mid-travel), scaled up
// around the icon centre (256,256) so the box reads larger on the home screen.
const glyph = `
  <g transform="translate(256,256) scale(${GLYPH_SCALE}) translate(-256,-256)">
    <polygon points="256,146 352,196 256,246 160,196" fill="url(#faceTop)" stroke="rgba(255,255,255,0.14)" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="160,196 256,246 256,366 160,316" fill="url(#faceLeft)" stroke="rgba(255,255,255,0.10)" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="352,196 352,316 256,366 256,246" fill="url(#faceRight)" stroke="rgba(0,0,0,0.10)" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M256,146 L256,246 M160,196 L352,196" stroke="rgba(255,255,255,0.22)" stroke-width="3" stroke-linecap="round"/>
    <rect x="92" y="278" width="328" height="20" rx="10" fill="#38C9FF" opacity="0.25"/>
    <rect x="92" y="282" width="328" height="12" rx="6" fill="#38C9FF" opacity="0.9"/>
    <rect x="92" y="285.5" width="328" height="5" rx="2.5" fill="#B6ECFF"/>
  </g>`

// Full-bleed square (no rounded corners — iOS masks the home-screen icon itself)
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <rect x="0" y="0" width="512" height="512" fill="url(#bgGrad)"/>
  <rect x="0" y="0" width="512" height="512" fill="url(#topGlow)"/>
  ${glyph}
</svg>`

// Rounded icon on a transparent canvas (splash / favicon / web)
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <rect x="6" y="6" width="500" height="500" rx="116" fill="url(#bgGrad)"/>
  <rect x="6" y="6" width="500" height="500" rx="116" fill="url(#topGlow)"/>
  ${glyph}
</svg>`

// Android adaptive icon, in TWO layers — the background carries the purple
// gradient full-bleed, the foreground carries ONLY the glyph. Putting the
// whole rounded tile in the foreground (the first attempt) left it floating
// on the dark backgroundColor: black borders around the icon once Android
// applied its circular mask.
const adaptiveBackground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <rect x="0" y="0" width="512" height="512" fill="url(#bgGrad)"/>
  <rect x="0" y="0" width="512" height="512" fill="url(#topGlow)"/>
</svg>`

// Foreground glyph scaled into the centre safe zone (central 66% of the
// canvas — everything outside may be cropped by the launcher mask).
const adaptiveForeground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${defs}
  <g transform="translate(256,256) scale(0.76) translate(-256,-256)">
    ${glyph}
  </g>
</svg>`

// opaque=true → RGB (no alpha), for the iOS home-screen icon.
function render(svg, size, file, opaque = false) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' })
  const img = r.render()
  const png = opaque ? encodeOpaquePng(img.pixels, img.width, img.height) : img.asPng()
  writeFileSync(out(file), png)
  console.log(`✓ ${file} (${size}px${opaque ? ', no alpha' : ''})`)
}

render(fullBleed, 1024, 'icon.png', true)
render(rounded, 1024, 'splash-icon.png')
render(adaptiveBackground, 1024, 'android-icon-background.png')
render(adaptiveForeground, 1024, 'android-icon-foreground.png')
render(rounded, 48, 'favicon.png')
console.log('Done.')
