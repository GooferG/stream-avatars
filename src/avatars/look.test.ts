import { describe, expect, it } from 'vitest'
import { PALETTES } from '../render/sprites/contract'
import { ACCESSORIES, BUILDS, HAIR_COLORS, HAIR_STYLES, KINDS, SKIN_TONES } from '../render/sprites/roster'
import { mulberry32, pickIndex } from '../utils/rng'
import { fnv1a32 } from './dna'
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
      expect(look.color).toBeNull()
      expect(paletteIndex).toBeLessThan(PALETTES.length)
      expect(walkSpeed).toBeGreaterThanOrEqual(SPEEDS[0])
      expect(walkSpeed).toBeLessThanOrEqual(SPEEDS[1])
      expect(depth).toBeGreaterThanOrEqual(0)
      expect(depth).toBeLessThan(1)
    }
  })

  it('rolls skin only from the four original tones, so no existing viewer changes color', () => {
    const ORIGINAL = [0xf6d2b4, 0xe2a882, 0xb9784f, 0x7d4a2c]
    for (const login of logins) expect(ORIGINAL).toContain(SKIN_TONES[lookDna(login, SPEEDS).look.skin])
    // the golden logins below keep the exact colors they had with four tones
    expect(SKIN_TONES[lookDna('gooferg', SPEEDS).look.skin]).toBe(0xb9784f)
    expect(SKIN_TONES[lookDna('pixelpete', SPEEDS).look.skin]).toBe(0xe2a882)
  })

  it('makes about half the crowd human', () => {
    const humans = logins.filter((l) => lookDna(l, SPEEDS).look.kind === 'human').length
    expect(humans).toBeGreaterThan(900)
    expect(humans).toBeLessThan(1100)
  })

  it('turns about one in eight animals into a penguin and leaves every other animal as it was', () => {
    const ORIGINAL_ANIMALS = ['cat', 'dog', 'duck', 'frog', 'bunny', 'bear', 'fox']
    /** The animal the roll gave before penguins: the second draw, over the original seven. */
    const originalAnimal = (login: string) => {
      const rng = mulberry32(fnv1a32(login))
      rng()
      return ORIGINAL_ANIMALS[pickIndex(rng, ORIGINAL_ANIMALS.length)]
    }
    const animals = logins.filter((l) => lookDna(l, SPEEDS).look.kind !== 'human')
    for (const login of animals) {
      expect(['penguin', originalAnimal(login)]).toContain(lookDna(login, SPEEDS).look.kind)
    }
    const penguins = animals.filter((l) => lookDna(l, SPEEDS).look.kind === 'penguin').length
    expect(penguins / animals.length).toBeGreaterThan(0.09)
    expect(penguins / animals.length).toBeLessThan(0.16)
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
          "color": null,
          "hairColor": 2,
          "hairStyle": "short",
          "kind": "fox",
          "skin": 3,
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
          "color": null,
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

  it('applies a chosen skin tone and hairstyle', () => {
    expect(resolveLook(base, { kind: 'human', skin: 4, hairStyle: 'long' })).toEqual({
      ...base,
      kind: 'human',
      skin: 4,
      hairStyle: 'long',
    })
    expect(resolveLook(base, { skin: 0 }).skin).toBe(0) // tone 1 is index 0, a real pick
  })

  it('applies a picked color, keeping the kind', () => {
    expect(resolveLook(base, { color: 'blue' })).toEqual({ ...base, color: 'blue' })
    expect(resolveLook(base, { kind: 'penguin', color: 'pink' })).toEqual({ ...base, kind: 'penguin', color: 'pink' })
  })

  it('drops a cap that would hide the picked hairstyle, and only then', () => {
    const capped = { ...base, kind: 'human' as const, accessory: 'cap' as const }
    expect(resolveLook(capped, { hairStyle: 'spiky' }).accessory).toBeNull()
    expect(resolveLook(capped, { hairStyle: 'bun' }).accessory).toBeNull()
    expect(resolveLook(capped, { hairStyle: 'long' }).accessory).toBe('cap')
    // hair the username rolled stays tucked under its cap
    expect(resolveLook({ ...capped, hairStyle: 'spiky' }, { build: 'chubby' }).accessory).toBe('cap')
  })
})
