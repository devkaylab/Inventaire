// Generates colored placeholder PNGs (one per tutorial step) with a unique tint
// per step, so the help screens render meaningfully before real screenshots
// are captured.
//
// Uses pure Node (no canvas/sharp deps): writes uncompressed PNG manually.

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const W = 540
const H = 840 // ~9:14

function pngFromRgb(width, height, fillRgb) {
  // Build raw pixel data: each row prefixed with filter byte 0
  const rowBytes = width * 3
  const data = Buffer.alloc((rowBytes + 1) * height)
  for (let y = 0; y < height; y++) {
    data[y * (rowBytes + 1)] = 0 // filter type: None
    for (let x = 0; x < width; x++) {
      const off = y * (rowBytes + 1) + 1 + x * 3
      data[off]     = fillRgb[0]
      data[off + 1] = fillRgb[1]
      data[off + 2] = fillRgb[2]
    }
  }
  const compressed = zlib.deflateSync(data)

  function chunk(type, payload) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(payload.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, payload])), 0)
    return Buffer.concat([len, typeBuf, payload, crc])
  }

  const signature = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// CRC32 table-based (PNG spec)
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = (crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)) >>> 0
  return (c ^ 0xFFFFFFFF) >>> 0
}

// Tints
const blueLight  = [232, 240, 252]   // supervisor placeholder background
const greenLight = [231, 247, 234]   // employee placeholder background

const supervisor = ['01-sessions','02-new-session','03-credentials','04-import-catalog','05-import-stock','06-advance-pass','07-audits','08-results','09-close']
const employee   = ['01-join','02-scanner','03-virtual-button','04-volume','05-manual','06-illisible','07-edit-row']

const base = path.join(__dirname, '../assets/help')

supervisor.forEach(n => fs.writeFileSync(path.join(base, 'supervisor', n + '.png'), pngFromRgb(W, H, blueLight)))
employee.forEach(n   => fs.writeFileSync(path.join(base, 'employee',   n + '.png'), pngFromRgb(W, H, greenLight)))

console.log(`✓ ${supervisor.length + employee.length} placeholder PNGs generated (${W}×${H})`)
