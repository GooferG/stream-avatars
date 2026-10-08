import { describe, expect, it } from 'vitest'
import type { EmoteSpan } from '../chat/types'
import { isJumbo, tokenize } from './bubbleTokens'

const PEPE: EmoteSpan = { provider: '7tv', id: '01PEPE', start: 0, end: 6, animated: true, zeroWidth: false }
const rainAt = (start: number): EmoteSpan => ({
  provider: '7tv',
  id: '01RAIN',
  start,
  end: start + 7,
  animated: true,
  zeroWidth: true,
})

describe('tokenize', () => {
  it('splits words and emotes, keeping each emote’s provider', () => {
    const kappa: EmoteSpan = { provider: 'twitch', id: '25', start: 4, end: 8 }
    expect(tokenize('hey Kappa there', [kappa], 120)).toEqual([
      { kind: 'word', text: 'hey' },
      { kind: 'emote', emote: kappa, fallback: 'Kappa', overlays: [] },
      { kind: 'word', text: 'there' },
    ])
  })

  it('puts a zero-width emote on top of the emote before it', () => {
    const rain = rainAt(8)
    expect(tokenize('PepePls RainTime', [PEPE, rain], 120)).toEqual([
      { kind: 'emote', emote: PEPE, fallback: 'PepePls', overlays: [rain] },
    ])
  })

  it('shows a zero-width emote on its own when no emote comes right before it', () => {
    const rainFirst = rainAt(0)
    const rainAfterWord = rainAt(3)
    expect(tokenize('RainTime', [rainFirst], 120)).toEqual([
      { kind: 'emote', emote: rainFirst, fallback: 'RainTime', overlays: [] },
    ])
    expect(tokenize('hi RainTime', [rainAfterWord], 120)).toEqual([
      { kind: 'word', text: 'hi' },
      { kind: 'emote', emote: rainAfterWord, fallback: 'RainTime', overlays: [] },
    ])
  })

  it('drops emotes past the character limit', () => {
    const kappa: EmoteSpan = { provider: 'twitch', id: '25', start: 6, end: 10 }
    // the ellipsis is cut too: the pixel font has no glyph for it
    expect(tokenize('hello Kappa', [kappa], 5)).toEqual([{ kind: 'word', text: 'hello' }])
  })
})

describe('isJumbo', () => {
  const kappaAt = (start: number): EmoteSpan => ({ provider: 'twitch', id: '25', start, end: start + 4 })

  it('is true for a message of only a few emotes', () => {
    expect(isJumbo(tokenize('Kappa', [kappaAt(0)], 120))).toBe(true)
    expect(isJumbo(tokenize('Kappa Kappa Kappa', [kappaAt(0), kappaAt(6), kappaAt(12)], 120))).toBe(true)
  })

  it('does not count zero-width emotes riding on another', () => {
    const rain = rainAt(8)
    const spans = [PEPE, rain, { ...PEPE, start: 17, end: 23 }, { ...PEPE, start: 25, end: 31 }]
    expect(isJumbo(tokenize('PepePls RainTime PepePls PepePls', spans, 120))).toBe(true)
  })

  it('is false once any word is in the message', () => {
    expect(isJumbo(tokenize('hey Kappa', [kappaAt(4)], 120))).toBe(false)
  })

  it('is false for emote spam past the jumbo limit', () => {
    const text = 'Kappa Kappa Kappa Kappa'
    expect(isJumbo(tokenize(text, [0, 6, 12, 18].map(kappaAt), 120))).toBe(false)
  })

  it('is false for an empty message', () => {
    expect(isJumbo([])).toBe(false)
  })
})
