import { describe, expect, it } from 'vitest'
import { luma } from '../color'
import {
  ACCESSORIES,
  ALL_SHEETS,
  ANIMALS,
  BUILDS,
  COLOR_NAMES,
  COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  layersFor,
  type Look,
} from './roster'

describe('SKIN_TONES', () => {
  it('offers six tones from light to deep, keeping the original four in place', () => {
    expect(SKIN_TONES).toHaveLength(6)
    const lumas = SKIN_TONES.map(luma)
    for (let i = 1; i < lumas.length; i++) expect(lumas[i]).toBeLessThan(lumas[i - 1] ?? 0)
    expect([SKIN_TONES[0], SKIN_TONES[1], SKIN_TONES[3], SKIN_TONES[5]]).toEqual([
      0xf6d2b4, 0xe2a882, 0xb9784f, 0x7d4a2c,
    ])
  })
})

describe('COLORS', () => {
  it('offers the color words viewers can type, natural first', () => {
    expect(COLOR_NAMES).toEqual([
      'black', 'brown', 'white', 'gray', 'gold', 'orange', 'red', 'pink', 'purple', 'blue', 'green',
    ])
  })

  it('rolls hair from the original four shades, which the matching color words share', () => {
    expect(HAIR_COLORS).toEqual([0x2a1a12, 0x7a4520, 0xe0b04a, 0xa8322c])
    expect(HAIR_COLORS).toEqual([COLORS.black, COLORS.brown, COLORS.gold, COLORS.red])
  })
})

const human: Look = {
  kind: 'human',
  build: 'chubby',
  skin: 2,
  hairStyle: 'long',
  hairColor: 1,
  accessory: 'cap',
  color: null,
}

describe('layersFor', () => {
  it('stacks a human back to front with each layer colored by its role', () => {
    expect(layersFor(human)).toEqual([
      { sheet: 'hair-long-back', role: 'hair' },
      { sheet: 'human-chubby-pants', role: 'fixed' },
      { sheet: 'human-chubby-shirt', role: 'chat' },
      { sheet: 'human-chubby-skin', role: 'skin' },
      { sheet: 'human-face', role: 'fixed' },
      { sheet: 'hair-long', role: 'hair' },
      { sheet: 'accessory-cap', role: 'accent' },
    ])
  })

  it('leaves out the back hair and accessory when a human has none', () => {
    const plain = layersFor({ ...human, hairStyle: 'short', accessory: null })
    expect(plain.map((l) => l.sheet)).toEqual([
      'human-chubby-pants',
      'human-chubby-shirt',
      'human-chubby-skin',
      'human-face',
      'hair-short',
    ])
  })

  it('tucks spiky hair and buns under a cap instead of letting them poke through it', () => {
    for (const hairStyle of ['spiky', 'bun'] as const) {
      const sheets = layersFor({ ...human, hairStyle, accessory: 'cap' }).map((l) => l.sheet)
      expect(sheets).toContain('hair-short')
      expect(sheets).not.toContain(`hair-${hairStyle}`)
    }
    // long hair keeps its strands below the cap, and other accessories keep the style
    const longCap = layersFor({ ...human, hairStyle: 'long', accessory: 'cap' }).map((l) => l.sheet)
    expect(longCap).toEqual(expect.arrayContaining(['hair-long-back', 'hair-long']))
    const spikyBow = layersFor({ ...human, hairStyle: 'spiky', accessory: 'bow' }).map((l) => l.sheet)
    expect(spikyBow).toContain('hair-spiky')
  })

  it('builds an animal from its fur, its fixed details and the chat-colored collar', () => {
    expect(layersFor({ ...human, kind: 'fox' })).toEqual([
      { sheet: 'fox', role: 'fur' },
      { sheet: 'fox-details', role: 'fixed' },
      { sheet: 'collar', role: 'chat' },
    ])
    expect(layersFor({ ...human, kind: 'penguin' }).map((l) => l.sheet)).toEqual([
      'penguin',
      'penguin-details',
      'collar',
    ])
  })

  it('only ever asks for sheets that exist', () => {
    const known = new Set<string>(ALL_SHEETS)
    for (const kind of ['human', ...ANIMALS] as const) {
      for (const build of BUILDS) {
        for (const hairStyle of HAIR_STYLES) {
          for (const accessory of [...ACCESSORIES, null]) {
            for (const layer of layersFor({ ...human, kind, build, hairStyle, accessory })) {
              expect(known.has(layer.sheet)).toBe(true)
            }
          }
        }
      }
    }
  })

  it('lists every sheet exactly once', () => {
    expect(new Set(ALL_SHEETS).size).toBe(ALL_SHEETS.length)
    expect(ALL_SHEETS).toHaveLength(9 + 1 + 4 + 1 + 3 + 8 + 8 + 1)
  })
})
