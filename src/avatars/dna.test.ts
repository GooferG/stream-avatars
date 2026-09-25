import { describe, expect, it } from 'vitest'
import { fnv1a32, generateDna, type Catalog } from './dna'

const palettes = Array.from({ length: 12 }, (_, i) => ({ body: i, accent: i + 100 }))
const catalog: Catalog = { bodyCount: 3, accessoryCount: 4, palettes }
const speeds: [number, number] = [30, 70]

describe('fnv1a32', () => {
  // Golden values: these lock the hash function. If this test breaks,
  // every viewer's avatar rerolls. Do not update casually.
  it('matches golden values', () => {
    expect(fnv1a32('gooferg')).toBe(1414851626)
    expect(fnv1a32('pixelpete')).toBe(4063665787)
  })
})

describe('generateDna', () => {
  it('is deterministic and case-insensitive', () => {
    const a = generateDna('GooferG', catalog, speeds)
    const b = generateDna('gooferg', catalog, speeds)
    expect(a).toEqual(b)
  })

  // Locks the PRNG draw order. Changing the order of draws in generateDna
  // rerolls every avatar; this test is the tripwire.
  it('matches golden DNA for known logins', () => {
    const gooferg = generateDna('gooferg', catalog, speeds)
    expect(gooferg.bodyIndex).toBe(2)
    expect(gooferg.paletteIndex).toBe(10)
    expect(gooferg.accessoryIndex).toBe(-1)
    expect(gooferg.walkSpeed).toBeCloseTo(31.55556, 4)
    expect(gooferg.depth).toBeCloseTo(0.74888, 4)

    const slime = generateDna('slime_time', catalog, speeds)
    expect(slime.bodyIndex).toBe(0)
    expect(slime.paletteIndex).toBe(10)
    expect(slime.accessoryIndex).toBe(2)
  })

  it('stays within catalog bounds across many logins', () => {
    let withAccessory = 0
    for (let i = 0; i < 500; i++) {
      const dna = generateDna(`user_${i}`, catalog, speeds)
      expect(dna.bodyIndex).toBeGreaterThanOrEqual(0)
      expect(dna.bodyIndex).toBeLessThan(catalog.bodyCount)
      expect(dna.paletteIndex).toBeGreaterThanOrEqual(0)
      expect(dna.paletteIndex).toBeLessThan(palettes.length)
      expect(dna.accessoryIndex).toBeGreaterThanOrEqual(-1)
      expect(dna.accessoryIndex).toBeLessThan(catalog.accessoryCount)
      expect(dna.walkSpeed).toBeGreaterThanOrEqual(speeds[0])
      expect(dna.walkSpeed).toBeLessThanOrEqual(speeds[1])
      expect(dna.depth).toBeGreaterThanOrEqual(0)
      expect(dna.depth).toBeLessThan(1)
      if (dna.accessoryIndex >= 0) withAccessory++
    }
    // roughly 75% should have an accessory
    expect(withAccessory).toBeGreaterThan(300)
    expect(withAccessory).toBeLessThan(450)
  })

  it('resolves tints from the palette', () => {
    const dna = generateDna('gooferg', catalog, speeds)
    expect(dna.bodyTint).toBe(10)
    expect(dna.accentTint).toBe(110)
  })
})
