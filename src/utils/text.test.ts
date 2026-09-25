import { describe, expect, it } from 'vitest'
import {
  isPrintableAscii,
  sanitizeSegment,
  toCodePoints,
  toRenderable,
  truncateCodePoints,
} from './text'

describe('code point helpers', () => {
  it('splits astral characters as single units', () => {
    // a party popper emoji is two UTF-16 units but one code point;
    // Twitch emote ranges index code points
    const cps = toCodePoints('\u{1F389} hi')
    expect(cps).toHaveLength(4)
    expect(cps[0]).toBe('\u{1F389}')
  })

  it('truncates in code point space with ellipsis', () => {
    const cps = toCodePoints('\u{1F389}'.repeat(5))
    expect(truncateCodePoints(cps, 3).join('')).toBe('\u{1F389}\u{1F389}\u{1F389}…')
    expect(truncateCodePoints(cps, 5).join('')).toBe('\u{1F389}'.repeat(5))
  })
})

describe('sanitizeSegment', () => {
  it('strips control characters and collapses whitespace', () => {
    expect(sanitizeSegment('a\u0000bc')).toBe('abc')
    expect(sanitizeSegment('a \t\n b')).toBe('a b')
  })
})

describe('renderability', () => {
  it('detects printable ascii', () => {
    expect(isPrintableAscii('Goofer_G 42')).toBe(true)
    expect(isPrintableAscii('ゴーファー')).toBe(false)
    expect(isPrintableAscii('')).toBe(false)
  })

  it('drops characters the pixel font cannot draw', () => {
    expect(toRenderable('hi\u{1F389}there')).toBe('hithere')
  })
})
