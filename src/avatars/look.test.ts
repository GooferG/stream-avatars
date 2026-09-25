import { describe, expect, it } from 'vitest'
import { PALETTES } from '../render/sprites/contract'
import { ACCESSORIES, BUILDS, HAIR_COLORS, HAIR_STYLES, KINDS, SKIN_TONES } from '../render/sprites/roster'
import { lookDna, resolveLook } from './look'

const SPEEDS: [number, number] = [30, 70]
const logins = Array.from({ length: 2000 }, (_, i) => `viewer_${i}`)

describe('lookDna', () => {
  it('is deterministic and ignores login case', () => {
    expect(lookDna('GooferG', SPEEDS)).toEqual(lookDna('gooferg', SPEEDS))
  })

  it('keeps every field in range', () => {
    for (const login of logins) {
      const { look, paletteIndex, walkSpeed, depth } = lookDna(login, SPEEDS)
      expect(KINDS).toContain(look.kind)
      expect(BUILDS).toContain(look.build)
      expect(HAIR_STYLES).toContain(look.hairStyle)
      expect(look.skin).toBeGreaterThanOrEqual(0)
      expect(look.skin).toBeLessThan(SKIN_TONES.length)
      expect(look.hairColor).toBeGreaterThanOrEqual(0)
      expect(look.hairColor).toBeLessThan(HAIR_COLORS.length)
      expect([...ACCESSORIES, null]).toContain(look.accessory)
      expect(paletteIndex).toBeLessThan(PALETTES.length)
      expect(walkSpeed).toBeGreaterThanOrEqual(SPEEDS[0])
      expect(walkSpeed).toBeLessThanOrEqual(SPEEDS[1])
      expect(depth).toBeGreaterThanOrEqual(0)
      expect(depth).toBeLessThan(1)
    }
  })

  it('makes about half the crowd human', () => {
    const humans = logins.filter((l) => lookDna(l, SPEEDS).look.kind === 'human').length
    expect(humans).toBeGreaterThan(900)
    expect(humans).toBeLessThan(1100)
  })

  it('gives about three in four an accessory', () => {
    const withAccessory = logins.filter((l) => lookDna(l, SPEEDS).look.accessory !== null).length
    expect(withAccessory).toBeGreaterThan(1350)
    expect(withAccessory).toBeLessThan(1650)
  })

  // Golden values: they lock the draw order. Changing it rerolls every viewer.
  it('matches golden looks for known logins', () => {
    expect(lookDna('gooferg', SPEEDS)).toMatchInlineSnapshot(`
      {
        "depth": 0.9890630973968655,
        "look": {
          "accessory": "glasses",
          "build": "skinny",
          "hairColor": 2,
          "hairStyle": "short",
          "kind": "fox",
          "skin": 2,
        },
        "paletteIndex": 11,
        "walkSpeed": 44.310963805764914,
      }
    `)
    expect(lookDna('pixelpete', SPEEDS)).toMatchInlineSnapshot(`
      {
        "depth": 0.715067194076255,
        "look": {
          "accessory": null,
          "build": "skinny",
          "hairColor": 1,
          "hairStyle": "long",
          "kind": "human",
          "skin": 1,
        },
        "paletteIndex": 6,
        "walkSpeed": 44.68304708600044,
      }
    `)
  })
})

describe('resolveLook', () => {
  const base = lookDna('gooferg', SPEEDS).look

  it('keeps the username look when there is no choice', () => {
    expect(resolveLook(base)).toEqual(base)
    expect(resolveLook(base, null)).toEqual(base)
  })

  it('applies a chosen kind and build, keeping skin and hair', () => {
    const cat = resolveLook(base, { kind: 'cat' })
    expect(cat).toEqual({ ...base, kind: 'cat' })
    const chubby = resolveLook(base, { kind: 'human', build: 'chubby' })
    expect(chubby).toEqual({ ...base, kind: 'human', build: 'chubby' })
  })
})
