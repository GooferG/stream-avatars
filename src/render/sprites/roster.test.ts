import { describe, expect, it } from 'vitest'
import {
  ACCESSORIES,
  ALL_SHEETS,
  ANIMALS,
  BUILDS,
  HAIR_STYLES,
  layersFor,
  type Look,
} from './roster'

const human: Look = {
  kind: 'human',
  build: 'chubby',
  skin: 2,
  hairStyle: 'long',
  hairColor: 1,
  accessory: 'cap',
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

  it('builds an animal from its own sheet plus the chat-colored collar', () => {
    expect(layersFor({ ...human, kind: 'fox' })).toEqual([
      { sheet: 'fox', role: 'fixed' },
      { sheet: 'collar', role: 'chat' },
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
    expect(ALL_SHEETS).toHaveLength(9 + 1 + 4 + 1 + 3 + 7 + 1)
  })
})
