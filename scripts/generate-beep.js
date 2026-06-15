// Generates a short scanner beep WAV file into assets/sounds/beep.wav
const fs = require('fs')
const path = require('path')

const sampleRate = 44100
const duration = 0.12   // seconds — short, snappy
const frequency = 1800  // Hz — high-pitched scanner tone
const numSamples = Math.floor(sampleRate * duration)

const dataSize = numSamples * 2 // 16-bit mono
const buffer = Buffer.alloc(44 + dataSize)

// ── RIFF header ──────────────────────────────────────────────────────────────
buffer.write('RIFF', 0)
buffer.writeUInt32LE(36 + dataSize, 4)
buffer.write('WAVE', 8)

// ── fmt chunk ────────────────────────────────────────────────────────────────
buffer.write('fmt ', 12)
buffer.writeUInt32LE(16, 16)         // chunk size
buffer.writeUInt16LE(1, 20)          // PCM
buffer.writeUInt16LE(1, 22)          // mono
buffer.writeUInt32LE(sampleRate, 24)
buffer.writeUInt32LE(sampleRate * 2, 28) // byte rate
buffer.writeUInt16LE(2, 32)          // block align
buffer.writeUInt16LE(16, 34)         // bits per sample

// ── data chunk ───────────────────────────────────────────────────────────────
buffer.write('data', 36)
buffer.writeUInt32LE(dataSize, 40)

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate
  // Quick attack, smooth exponential decay
  const envelope = Math.exp(-t / (duration * 0.35))
  const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.75 * 32767
  buffer.writeInt16LE(Math.round(sample), 44 + i * 2)
}

const outPath = path.join(__dirname, '../assets/sounds/beep.wav')
fs.writeFileSync(outPath, buffer)
console.log(`✓ beep.wav generated (${dataSize} bytes of audio data)`)
