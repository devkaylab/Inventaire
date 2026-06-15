// Generates a double low-pitched error buzz into assets/sounds/error.wav
// Pattern: two short descending tones separated by a gap — classic "error" feel
const fs = require('fs')
const path = require('path')

const sampleRate = 44100

// Two tones: 440Hz then 330Hz, each 0.14s, with a 0.06s silence gap
const tone1 = { freq: 440, duration: 0.14 }
const tone2 = { freq: 330, duration: 0.14 }
const gap   = 0.06

const totalSamples =
  Math.floor(sampleRate * tone1.duration) +
  Math.floor(sampleRate * gap) +
  Math.floor(sampleRate * tone2.duration)

const dataSize = totalSamples * 2
const buffer = Buffer.alloc(44 + dataSize)

// ── RIFF header ──────────────────────────────────────────────────────────────
buffer.write('RIFF', 0)
buffer.writeUInt32LE(36 + dataSize, 4)
buffer.write('WAVE', 8)

// ── fmt chunk ────────────────────────────────────────────────────────────────
buffer.write('fmt ', 12)
buffer.writeUInt32LE(16, 16)
buffer.writeUInt16LE(1, 20)          // PCM
buffer.writeUInt16LE(1, 22)          // mono
buffer.writeUInt32LE(sampleRate, 24)
buffer.writeUInt32LE(sampleRate * 2, 28)
buffer.writeUInt16LE(2, 32)
buffer.writeUInt16LE(16, 34)

// ── data chunk ───────────────────────────────────────────────────────────────
buffer.write('data', 36)
buffer.writeUInt32LE(dataSize, 40)

function writeTone(offset, freq, duration) {
  const n = Math.floor(sampleRate * duration)
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate
    const envelope = Math.exp(-t / (duration * 0.4))
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.8 * 32767
    buffer.writeInt16LE(Math.round(sample), 44 + (offset + i) * 2)
  }
  return n
}

function writeGap(offset, duration) {
  const n = Math.floor(sampleRate * duration)
  for (let i = 0; i < n; i++) buffer.writeInt16LE(0, 44 + (offset + i) * 2)
  return n
}

let pos = 0
pos += writeTone(pos, tone1.freq, tone1.duration)
pos += writeGap(pos, gap)
pos += writeTone(pos, tone2.freq, tone2.duration)

const outPath = path.join(__dirname, '../assets/sounds/error.wav')
fs.writeFileSync(outPath, buffer)
console.log(`✓ error.wav generated (${dataSize} bytes, ${totalSamples} samples)`)
