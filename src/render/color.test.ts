import { describe, expect, it } from 'vitest'
import {
  ACCENT_COLORS,
  MIN_LABEL_LUMA,
  characterColors,
  colorDistance,
  contrastingAccent,
  luma,
  parseNameColor,
  readableOnDark,
  roleTints,
} from './color'
import { COLORS, HAIR_COLORS, NATURAL_FUR, SKIN_TONES } from './sprites/roster'

describe('parseNameColor', () => {
  it('parses Twitch #RRGGBB colors', () => {
    expect(parseNameColor('#1E90FF', 0x123456)).toBe(0x1e90ff)
  })

  it('falls back when the color is missing or malformed', () => {
    expect(parseNameColor(null, 0x123456)).toBe(0x123456)
    expect(parseNameColor('blue', 0x123456)).toBe(0x123456)
    expect(parseNameColor('#12345', 0x123456)).toBe(0x123456)
  })
})

describe('readableOnDark', () => {
  it('leaves colors that are already bright enough untouched', () => {
    expect(readableOnDark(0xffd700)).toBe(0xffd700)
    expect(readableOnDark(0x00ff7f)).toBe(0x00ff7f)
  })

  it('lifts dark colors to the minimum brightness', () => {
    for (const dark of [0x0000ff, 0x8b0000, 0x000000, 0x2e1a47]) {
      const lifted = readableOnDark(dark)
      expect(luma(lifted)).toBeGreaterThanOrEqual(MIN_LABEL_LUMA - 1)
      expect(luma(lifted)).toBeLessThan(MIN_LABEL_LUMA + 2)
    }
  })

  it('keeps the hue by mixing toward white', () => {
    const lifted = readableOnDark(0x0000ff)
    expect(lifted & 0xff).toBe(0xff) // blue channel stays dominant
    expect((lifted >> 16) & 0xff).toBe((lifted >> 8) & 0xff) // red == green
    expect((lifted >> 16) & 0xff).toBeLessThan(0xff)
  })
})

describe('contrastingAccent', () => {
  it('picks the palette accent furthest from the body color', () => {
    for (const body of [0x1e90ff, 0xff4500, 0xffd700, 0x00ff7f, 0xffffff, 0x9acd32]) {
      const accent = contrastingAccent(body)
      expect(ACCENT_COLORS).toContain(accent)
      for (const other of ACCENT_COLORS) {
        expect(colorDistance(body, accent)).toBeGreaterThanOrEqual(colorDistance(body, other))
      }
    }
  })

  it('gives a blue body a warm accessory', () => {
    const accent = contrastingAccent(0x1e90ff)
    expect((accent >> 16) & 0xff).toBeGreaterThan(accent & 0xff) // more red than blue
  })
})

describe('characterColors', () => {
  it('paints the body in the chat color, lifted exactly like the name tag', () => {
    expect(characterColors('#FFD700', 0x123456).body).toBe(0xffd700)
    expect(characterColors('#0000FF', 0x123456).body).toBe(readableOnDark(0x0000ff))
  })

  it('falls back to the palette body when the chatter never set a color', () => {
    expect(characterColors(null, 0x6fa8dc).body).toBe(readableOnDark(0x6fa8dc))
  })

  it('pairs every body with its contrasting accessory color', () => {
    const colors = characterColors('#FF4500', 0x123456)
    expect(colors.accent).toBe(contrastingAccent(colors.body))
  })
})

describe('roleTints', () => {
  it('colors each layer role for a look', () => {
    const look = {
      kind: 'human' as const, build: 'average' as const, skin: 2, hairStyle: 'bun' as const, hairColor: 3, accessory: null, color: null,
    }
    expect(roleTints(look, { body: 0x1e90ff, accent: 0xf5c542 })).toEqual({
      chat: 0x1e90ff,
      accent: 0xf5c542,
      skin: SKIN_TONES[2],
      hair: HAIR_COLORS[3],
      fur: 0xffffff,
      fixed: 0xffffff,
    })
  })

  const colors = { body: 0x1e90ff, accent: 0xf5c542 }
  const dog = {
    kind: 'dog' as const, build: 'average' as const, skin: 0, hairStyle: 'short' as const, hairColor: 1, accessory: null, color: null,
  }

  it('paints an animal in its natural fur color until the viewer picks one', () => {
    expect(roleTints(dog, colors).fur).toBe(NATURAL_FUR.dog)
    expect(roleTints({ ...dog, kind: 'penguin' }, colors).fur).toBe(NATURAL_FUR.penguin)
  })

  it('uses a picked color for fur on an animal and hair on a human', () => {
    expect(roleTints({ ...dog, color: 'blue' }, colors).fur).toBe(COLORS.blue)
    expect(roleTints({ ...dog, kind: 'human', color: 'pink' }, colors).hair).toBe(COLORS.pink)
  })
})
