// Garde d'approvisionnement de SheetJS, côté application.
//
// npm ne distribue que xlsx@0.18.5, vulnérable en lecture (CVE-2023-30533,
// CVE-2024-22363) et jamais corrigée depuis le départ de SheetJS. L'archive
// officielle est versionnée dans vendor/ et installée en `file:` ; un
// `npm install xlsx` écraserait ce branchement sans rien signaler.
//
// C'est ici que ça compte le plus : la lecture tourne sur le téléphone des
// superviseurs, sur des fichiers fournis par leurs clients.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const MINIMALE = [0, 20, 2] // 0.19.3 corrige la pollution de prototype, 0.20.2 le ReDoS

function auMoins(version: string, minimale: number[]): boolean {
  const a = version.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== minimale[i]) return (a[i] ?? 0) > minimale[i]
  }
  return true
}

const lire = (p: string) => JSON.parse(readFileSync(path.resolve(__dirname, p), 'utf8'))

describe('approvisionnement de SheetJS', () => {
  it('est déclaré en archive locale, jamais depuis npm', () => {
    expect(lire('../package.json').dependencies.xlsx).toMatch(/^file:vendor\/xlsx-/)
  })

  it('installe une version où les deux failles de lecture sont corrigées', () => {
    const version: string = lire('../node_modules/xlsx/package.json').version
    expect(auMoins(version, MINIMALE), `xlsx@${version} est trop ancienne`).toBe(true)
  })
})
