import { describe, expect, it } from 'vitest'
import { MIN_LABEL_LUMA, luma, parseNameColor, readableOnDark } from './color'

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
